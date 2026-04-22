# Canton KYC & Identity Registry

[![CI](https://github.com/digital-asset/canton-kyc-identity/actions/workflows/ci.yml/badge.svg)](https://github.com/digital-asset/canton-kyc-identity/actions/workflows/ci.yml)

This project provides a decentralized Know-Your-Customer (KYC) and identity registry built on the [Canton Network](https://www.canton.io/) using [Daml](https://www.daml.com/) smart contracts. It enables trusted identity providers to issue private, verifiable attestations to parties, which can then be used across various applications on the network without repeatedly exposing sensitive Personal Identifiable Information (PII).

## Overview

In many decentralized applications, verifying the identity of counterparties is a critical requirement for compliance and risk management. Traditional identity verification is siloed, repetitive, and requires users to share sensitive data with every new service they use.

This project solves this by creating a shared, on-ledger registry of identity attestations.

-   **Reusable KYC:** A user (Subject) gets verified once by a trusted Identity Provider.
-   **Privacy-Preserving:** The Provider issues a digital `Attestation` contract on the ledger. This contract confirms the verification level (e.g., "KYC Level 1", "Accredited Investor") but does **not** contain the underlying PII (like passport scans or addresses).
-   **On-Chain Verification:** Other applications (Consumers) can programmatically check for the existence of a valid `Attestation` for a given user, trusting the signature of the Provider. This verification is atomic and integrated directly into their Daml workflows.
-   **User Control:** Subjects are stakeholders on their own attestations, giving them visibility and control.
-   **Lifecycle Management:** The model supports attestation expiry and on-demand revocation by the Provider, ensuring the registry remains up-to-date.

## Core Concepts

The system is designed around three primary roles:

1.  **Subject:** An individual or entity who needs their identity verified. They request an attestation from a Provider.
2.  **Provider:** A trusted institution (e.g., a bank, a regulated exchange, a government agency) that performs off-chain identity verification and issues on-chain `Attestation` contracts.
3.  **Consumer:** An application or service that needs to verify a Subject's identity status before interacting with them. The Consumer queries the ledger for a valid attestation from a Provider it trusts.

### The Attestation Workflow

1.  **Request:** A `Subject` initiates a workflow by requesting an attestation from a `Provider`. This is modeled as an `AttestationRequest` contract.
2.  **Off-Chain Verification:** The `Provider` receives the request and performs its standard, off-chain KYC/identity verification process using its internal systems.
3.  **Issuance:** Upon successful verification, the `Provider` creates an `Attestation` contract on the ledger. The `Subject` is an observer on this contract, ensuring they are aware of it. The contract contains metadata like the provider, subject, attestation type, issuance date, and expiry date.
4.  **Verification:** A `Consumer` application, as part of its own business logic (e.g., an onboarding workflow), can now require the `Subject` to present a valid `Attestation` contract. The `Consumer`'s Daml logic can fetch this contract and verify its details (e.g., that it's from a trusted provider and hasn't expired) atomically within the transaction.
5.  **Revocation:** If the `Subject`'s status changes, the `Provider` can exercise a choice on the `Attestation` contract to revoke it, immediately invalidating it for all future verification checks.

### Trust Hierarchies with `MultiAttestation`

The system also supports a web of trust. A top-tier provider (e.g., a central bank or regulator) can issue a `MultiAttestation` that vouches for a group of other providers. This allows consumers to trust an entire ecosystem of providers by simply trusting the single, top-tier provider. See `daml/MultiAttestation.daml` for the implementation.

For a detailed analysis of the privacy model, see `docs/PRIVACY.md`.

## Project Structure

```
.
├── .github/workflows/      # CI configuration for GitHub Actions
│   └── ci.yml
├── daml/                   # Daml smart contract source code
│   ├── Attestation.daml
│   ├── MultiAttestation.daml
│   └── ...
├── frontend/               # React/TypeScript web interface
│   ├── src/
│   │   ├── App.tsx
│   │   └── ProviderDashboard.tsx
│   └── ...
├── docs/                   # Project documentation
│   └── PRIVACY.md
├── daml.yaml               # Daml package configuration
└── README.md               # This file
```

## Getting Started

### Prerequisites

-   [DPM (Canton SDK) v3.4.0 or higher](https://docs.daml.com/3.4.0/support/release-notes)
-   [Node.js](https://nodejs.org/) (v18 or higher) and [npm](https://www.npmjs.com/)

### Running Locally

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/digital-asset/canton-kyc-identity.git
    cd canton-kyc-identity
    ```

2.  **Start the Canton Sandbox Ledger:**
    This command starts a local Canton ledger, including the HTTP JSON API on port 7575.
    ```bash
    dpm sandbox
    ```

3.  **Build the Daml Models:**
    Compile the Daml code into a DAR (Daml Archive).
    ```bash
    dpm build
    ```
    The output will be in `.daml/dist/canton-kyc-identity-0.1.0.dar`.

4.  **Run Tests (Optional):**
    Execute the Daml Script tests defined in the `daml/` directory to verify the contract logic.
    ```bash
    dpm test
    ```

5.  **Run Setup Script:**
    A Daml Script is typically used to initialize the ledger with parties (Provider, Subject) and initial contracts.
    ```bash
    # This command depends on the setup script defined in daml.yaml
    # Example: dpm script --dar .daml/dist/*.dar --script-name Main:setup
    ```

6.  **Run the Frontend Application:**
    Navigate to the frontend directory, install dependencies, and start the development server.
    ```bash
    cd frontend
    npm install
    npm start
    ```
    The application will be available at `http://localhost:3000`.

## Contributing

Contributions are welcome! Please feel free to open an issue to discuss a new feature or bug, or submit a pull request with your changes.

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/my-new-feature`).
3.  Commit your changes (`git commit -am 'Add some feature'`).
4.  Push to the branch (`git push origin feature/my-new-feature`).
5.  Create a new Pull Request.

## License

This project is licensed under the Apache 2.0 License. See the LICENSE file for details.