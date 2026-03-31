# Canton KYC and Identity Registry

This project implements a decentralized KYC and identity registry on the Canton Network, leveraging Daml smart contracts for verifiable attestations. It allows identity providers to issue attestations to parties, which can then be used by other contracts to verify identities without exposing raw personally identifiable information (PII).

## Key Features

*   **Decentralized Attestations:** Identity providers issue verifiable attestations about parties on the Canton Network.
*   **Privacy-Preserving Verification:** Contracts can verify attestations without accessing the underlying PII.
*   **Attestation Expiry:** Attestations can be configured with expiry dates, ensuring validity over time.
*   **Attestation Revocation:** Identity providers can revoke attestations, invalidating them immediately.
*   **Multi-Provider Trust Hierarchies:** Supports complex trust models where attestations can be chained across multiple providers.

## Project Structure

The project is structured as a Daml project and contains the following key components:

*   `daml.yaml`:  The Daml project configuration file.
*   `src/`: Contains the Daml source code.
    *   `KYC.daml`: Defines the core data models and contract logic for KYC attestations.
    *   `Identity.daml`: Defines the core data models and contract logic for Identity attestations.
    *   `Attestation.daml`: Defines the core data models and contract logic for general Attestations.
*   `test/`: Contains Daml script-based tests.
*   `README.md`: This file.

## Getting Started

1.  **Install Daml SDK:**  Follow the instructions at [https://docs.daml.com/getting-started/index.html](https://docs.daml.com/getting-started/index.html) to install the Daml SDK.  Minimum SDK version is 3.1.0.

2.  **Clone the Repository:**

    ```bash
    git clone <repository_url>
    cd canton-kyc-identity
    ```

3.  **Build the Project:**

    ```bash
    daml build
    ```

4.  **Run Tests:**

    ```bash
    daml test
    ```

## Running the Application

To run this application on the Canton network, you'll need to:

1.  **Set up a Canton network:** Follow the instructions in the Canton documentation to create a local Canton network or connect to an existing one.

2.  **Deploy the DAR file:**  Deploy the compiled DAR file (`.daml/dist/canton-kyc-identity-0.1.0.dar`) to the Canton network.

3.  **Interact with the contracts:**  Use the Daml Ledger API or a Ledger Client (e.g., using the JavaScript Ledger API) to interact with the deployed contracts.

## Contract Overview

### `KYC.daml`

*   **`KYCAgreement`:** Represents a KYC agreement between an identity provider and a party.
*   **`KYCAttestation`:** Represents a KYC attestation issued by an identity provider. This attestation contains information about KYC compliance of a party.

### `Identity.daml`

*   **`IdentityAgreement`:**  Represents an agreement between an identity provider and a party regarding identity verification.
*   **`IdentityAttestation`:** Represents an Identity attestation issued by an identity provider. This attestation contains information about the identity of a party.

### `Attestation.daml`

*   **`Attestation`:** Represents a general attestation which can be inherited.
*   **`AttestationRevocation`:** Represents an attestation revocation.

## Contributing

We welcome contributions to this project. Please see the `CONTRIBUTING.md` file for guidelines on how to contribute.

## License

This project is licensed under the Apache 2.0 License - see the `LICENSE` file for details.