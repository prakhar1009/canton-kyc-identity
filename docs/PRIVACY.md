# Privacy Model & GDPR Considerations

This document outlines the privacy architecture of the Canton KYC Identity solution, explaining how it leverages the unique features of the Canton network and Daml smart contracts to protect personal data and align with regulations like GDPR.

## Core Principle: Privacy by Design

Unlike traditional public blockchains that broadcast all transaction data to all nodes, the Canton network operates on a "privacy by design" principle. Data is segregated and distributed on a strict need-to-know basis.

1.  **No Global Broadcast:** A Daml contract, which represents a piece of shared state (like a KYC attestation), is *only* known to the participants who are stakeholders on that contract.
2.  **Explicit Stakeholders:** Daml forces developers to explicitly define who can see and act on data. The primary stakeholders are `signatories` (who must authorize creation/archival) and `observers` (who have read-only visibility).
3.  **Sub-transaction Privacy:** When a choice is exercised on a contract, only the stakeholders of that contract and any contracts created or fetched within the transaction see the details. Other parties on the network remain unaware of the transaction's existence.

In the context of this KYC solution, this means that the raw Personally Identifiable Information (PII) is never exposed to unintended parties.

## The Attestation Model: Data Minimization in Practice

The core of our privacy model is the separation of raw PII from the verifiable attestation.

1.  **PII Data Contract:** When a user (`Subject`) onboards with an `IdentityProvider`, their PII (e.g., name, date of birth, document numbers) is encapsulated in a `PiiData` contract. The stakeholders of this contract are strictly limited to the `IdentityProvider` and the `Subject`. **No one else on the network can see this contract or its contents.**

2.  **KYC Attestation Contract:** Upon successful verification, the `IdentityProvider` issues a `KycAttestation` contract. This contract acts as a verifiable credential or a "stamp of approval". It **does not contain the raw PII**. Instead, it contains metadata:
    *   The issuer (`IdentityProvider`).
    *   The owner (`Subject`).
    *   The level of verification (e.g., "Level 1 - ID & Liveness Check").
    *   An issue date and an expiry date.
    *   A status (e.g., `Active`, `Revoked`, `Expired`).

## Privacy-Preserving Verification Flow

When a third-party service (e.g., a DeFi application, an exchange) needs to verify a user's KYC status, the flow is as follows:

1.  The user (`Subject`) initiates an action with the service.
2.  The service requests proof of KYC.
3.  The user exercises a `Share` or `Disclose` choice on their `KycAttestation` contract, adding the service provider's party as an `observer`.
4.  The service provider gains read-only access to the `KycAttestation` contract. They can verify:
    *   That the attestation was issued by an `IdentityProvider` they trust.
    *   That the `Subject` of the attestation matches the user they are interacting with.
    *   That the attestation is currently `Active` and has not expired.

Crucially, the service provider **never** sees the underlying `PiiData` contract. They only see the *fact* of the attestation. This is a powerful implementation of the principle of data minimization.

## GDPR Compliance Considerations

The Canton/Daml architecture aligns well with key GDPR principles.

#### Right to be Forgotten (Article 17)

While distributed ledgers are often associated with immutability, Daml's contract model provides a clear path for data removal from the *active state*.

*   **Archival, Not Deletion:** A Daml contract can be archived. Archiving removes it from the Active Contract Set (ACS). For all practical purposes in the application's business logic, the data is gone.
*   **Revocation:** If a user revokes consent or an `IdentityProvider` needs to invalidate an attestation, the `KycAttestation` contract is archived. This immediately prevents it from being used for future verifications.
*   **Off-Ledger PII:** The `IdentityProvider` remains the primary Data Controller for the raw PII, which they typically store in their own secure, off-ledger systems. They are responsible for deleting this raw data upon a valid request from the user. The on-ledger system reflects this by archiving the associated contracts.

#### Data Controller vs. Data Processor

*   **Data Controller:** The `IdentityProvider` who collects and verifies the PII is the Data Controller. They determine the purpose and means of processing personal data.
*   **Data Subject:** The end-user who owns their identity and attestations is the Data Subject. They have control over who they share their attestations with.
*   **Data Processor:** The Canton network participants (validators) can be considered Data Processors, as they process data on behalf of the stakeholders according to the rules defined in the Daml contracts. Due to Canton's privacy model, they process this data without being able to see its contents unless they are a stakeholder.

#### Data Minimization (Article 5)

As described above, the entire system is architected around data minimization. Verifying parties receive the minimum information necessary (the attestation) to make a decision, without gaining access to the sensitive underlying PII.

#### Data Portability (Article 20)

The user (`Subject`) is a signatory on their own `KycAttestation` contract. They hold the "key" to this digital credential and can choose to present it to any service provider on the network, enabling seamless portability of their verified status across different applications.