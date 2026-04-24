# Privacy Model & GDPR Considerations

This document outlines the privacy model of the Canton KYC/Identity solution and discusses its alignment with data protection regulations like the General Data Protection Regulation (GDPR).

## Core Principles: Privacy by Design

The solution is built on Canton, a distributed ledger platform that provides privacy and confidentiality by design. Unlike public blockchains where all data is replicated to all nodes, Canton ensures that contract data is only distributed on a **strict need-to-know basis**.

1.  **Data Minimization:** A party on the network only sees the data from contracts where they are an explicit stakeholder (e.g., a signatory or observer). They have zero visibility into other transactions on the network.
2.  **Sub-Transaction Privacy:** Within a single atomic transaction, Canton can enforce that different parties see different parts of the transaction. This is fundamental to our KYC model, where a Verifier can see a valid attestation without ever seeing the underlying Personal Identifiable Information (PII).
3.  **Confidentiality:** All communication between participant nodes is encrypted, and the contract data itself is not visible to the network operators (validators) who provide sequencing and notarization services.

## Data Flow and Roles

Our model involves three primary roles, each with a distinct relationship to the user's data:

*   **Subject (The User):** The individual whose identity is being managed. They are the ultimate owner of their identity data and attestations.
*   **Identity Provider (IP):** A trusted entity (e.g., a bank, government agency, or specialized KYC firm) that verifies the Subject's PII and issues corresponding on-ledger attestations.
*   **Verifier (Relying Party):** An application or service that needs to confirm certain attributes of the Subject (e.g., "is over 18", "is a resident of Switzerland") to grant them access to a service.

The privacy-preserving workflow is as follows:

1.  **PII Collection (Off-Ledger):** The Subject provides their raw PII (name, date of birth, address, government ID) to an Identity Provider through a secure, off-ledger channel (e.g., a web portal).
2.  **Attestation Issuance (On-Ledger):** After successfully verifying the PII, the IP creates an `Attestation` smart contract on the Canton ledger.
    *   **Crucially, this `Attestation` contract DOES NOT contain raw PII.** Instead, it contains metadata: the issuer (IP), the owner (Subject), the type of attestation (e.g., `KYC_LEVEL_1`), an expiry date, and a unique reference identifier.
    *   The Subject is a signatory on this contract, giving them control.
3.  **Attestation Presentation (On-Ledger):** When a Verifier needs to check the Subject's status, the Subject explicitly exercises a choice on their `Attestation` contract to make the Verifier an `observer` on it. This is a granular, time-bound, and auditable act of consent.
4.  **Verification:** The Verifier can now see the active `Attestation` contract. They can trust its validity because it was signed by a trusted IP. They confirm the Subject's status without ever seeing the underlying PII that the IP holds.

## GDPR Compliance

This architecture directly addresses several key articles of the GDPR.

#### **Article 17: Right to be Forgotten (Right to Erasure)**

While distributed ledgers are inherently immutable, our model fully supports the Right to be Forgotten.

*   **Archiving Contracts:** The primary on-ledger data is the `Attestation` contract. This contract can be **archived** through a `Revoke` choice exercised by the IP or an `Expire` choice. Archiving removes the contract from the Active Contract Set (ACS), making it non-discoverable and unusable for future verifications. While the transaction history remains on the ledgers of the involved participants (IP and Subject), the data is no longer "active" or being processed.
*   **Off-Ledger PII:** Since the sensitive raw PII is held in the Identity Provider's off-ledger systems, the Subject can request its deletion directly from the IP. Once the source PII is deleted, the on-ledger `Attestation` is effectively an orphaned, tokenized claim with no link back to the user's personal data.

#### **Article 20: Right to Data Portability**

The Subject is a first-class participant on the Canton network. They are a direct stakeholder in all their `Attestation` contracts. This means they can directly query their participant node's ledger to retrieve a machine-readable record of all their active and archived attestations at any time, without needing an intermediary.

#### **Article 6 & 7: Lawfulness of Processing and Conditions for Consent**

Consent is managed explicitly and granularly through the Daml smart contract logic.

*   The Subject must actively accept the `Attestation` proposal from the IP to bring it into existence.
*   The Subject must actively exercise a choice (e.g., `Present_To_Verifier`) to share their attestation with any third party. This action is atomic, auditable, and specific to a single Verifier for a specific purpose. There are no broad, standing allowances. The Subject can see exactly who they have shared their attestations with by querying their view of the ledger.

#### **Data Controller vs. Data Processor**

The roles under GDPR are clearly delineated:

*   **Identity Provider:** Acts as the **Data Controller** for the raw PII it collects from Subjects.
*   **Subject:** Acts as the **Data Controller** for their on-ledger `Attestation` contracts, managing who is permitted to view them.
*   **Verifier:** Acts as a **Data Processor**, as they are consuming the `Attestation` for a specific, limited purpose based on the Subject's consent.
*   **Network Operators:** Act as **Data Processors** on behalf of the participants. Due to Canton's encryption, they are processing encrypted data and have no access to its content, providing a strong basis for confidentiality.