import { encode } from 'js-base64';

// =================================================================================================
// Constants and Configuration
// =================================================================================================

const LEDGER_URL = process.env.REACT_APP_LEDGER_URL || 'http://localhost:7575';
const API_BASE_V1 = `${LEDGER_URL}/v1`;
const API_BASE_V2 = `${LEDGER_URL}/v2`;

// NOTE: These template IDs should match your compiled Daml model.
// Using a placeholder for the package ID which should be dynamically discovered
// or configured in a real application.
const MAIN_PACKAGE_ID = "kyc-identity-0.1.0"; // Adjust if your package name/version is different
const TEMPLATE_IDS = {
  ProviderRole: `${MAIN_PACKAGE_ID}:Kyc.Provider:ProviderRole`,
  AttestationRequest: `${MAIN_PACKAGE_ID}:Kyc.Attestation:AttestationRequest`,
  Attestation: `${MAIN_PACKAGE_ID}:Kyc.Attestation:Attestation`,
  CustomerInvite: `${MAIN_PACKAGE_ID}:Kyc.Customer:CustomerInvite`,
  CustomerRole: `${MAIN_PACKAGE_ID}:Kyc.Customer:CustomerRole`,
};

// =================================================================================================
// Type Definitions
// =================================================================================================

export type ContractId = string;
export type Party = string;

export interface Contract<T> {
  contractId: ContractId;
  payload: T;
  templateId: string;
}

export interface VerifiedAttribute {
  name: string;
  valueHash: string;
  verifiedAt: string; // Daml Time (ISO 8601 format)
}

export interface ProviderRole {
  provider: Party;
  displayName: string;
  observers: Party[];
}

export interface AttestationRequest {
  provider: Party;
  customer: Party;
  requestedAttributes: string[];
  customerNote: string;
}

export interface Attestation {
  provider: Party;
  subject: Party;
  attributes: VerifiedAttribute[];
  expiryDate: string; // Daml Date (YYYY-MM-DD)
  revoked: boolean;
  observers: Party[];
}

export interface CustomerRole {
  customer: Party;
  provider: Party;
  observers: Party[];
}

// =================================================================================================
// Internal Helper Functions
// =================================================================================================

/**
 * A generic, authenticated fetch wrapper for the JSON API.
 * @param endpoint The API endpoint (e.g., '/query').
 * @param token The JWT for the party.
 * @param body The request body.
 * @param method The HTTP method.
 * @returns The JSON response from the ledger.
 */
async function fetchLedger<T>(
  endpoint: string,
  token: string,
  body: object,
  method: 'POST' | 'GET' = 'POST'
): Promise<T> {
  const url = `${API_BASE_V1}${endpoint}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ledger API request failed with status ${response.status}: ${errorText}`);
    }

    const jsonResponse = await response.json();
    return (jsonResponse.result ?? jsonResponse) as T;
  } catch (error) {
    console.error(`Error during ledger request to ${url}:`, error);
    throw error;
  }
}

// =================================================================================================
// Public Service API
// =================================================================================================

/**
 * Fetches all KYC provider roles visible to the user.
 */
export const getProviders = async (token: string): Promise<Contract<ProviderRole>[]> => {
  return fetchLedger<Contract<ProviderRole>[]>(
    '/query',
    token,
    { templateIds: [TEMPLATE_IDS.ProviderRole] }
  );
};

/**
 * Fetches all attestation requests for a specific provider.
 */
export const getAttestationRequests = async (token: string): Promise<Contract<AttestationRequest>[]> => {
  return fetchLedger<Contract<AttestationRequest>[]>(
    '/query',
    token,
    { templateIds: [TEMPLATE_IDS.AttestationRequest] }
  );
};

/**
 * Fetches all attestations where the current user is the subject.
 */
export const getMyAttestations = async (token: string): Promise<Contract<Attestation>[]> => {
    return fetchLedger<Contract<Attestation>[]>(
        '/query',
        token,
        { templateIds: [TEMPLATE_IDS.Attestation] }
    );
};

/**
 * For a KYC Provider to issue a new attestation in response to a request.
 * @param token JWT of the provider party.
 * @param requestCid The ContractId of the AttestationRequest.
 * @param attributes The verified attributes to include in the attestation.
 * @param expiryDate The expiration date in YYYY-MM-DD format.
 */
export const issueAttestation = async (
  token: string,
  requestCid: ContractId,
  attributes: Omit<VerifiedAttribute, 'verifiedAt'>[],
  expiryDate: string
): Promise<any> => {
  return fetchLedger(
    '/exercise',
    token,
    {
      templateId: TEMPLATE_IDS.AttestationRequest,
      contractId: requestCid,
      choice: 'IssueAttestation',
      argument: {
        attributesToVerify: attributes,
        expiryDate: expiryDate,
      },
    }
  );
};

/**
 * For a KYC Provider to reject an attestation request.
 * @param token JWT of the provider party.
 * @param requestCid The ContractId of the AttestationRequest.
 * @param reason A reason for the rejection.
 */
export const rejectRequest = async (
  token: string,
  requestCid: ContractId,
  reason: string
): Promise<any> => {
  return fetchLedger(
    '/exercise',
    token,
    {
      templateId: TEMPLATE_IDS.AttestationRequest,
      contractId: requestCid,
      choice: 'Reject',
      argument: {
        reason,
      },
    }
  );
};

/**
 * For a KYC Provider to revoke an active attestation.
 * @param token JWT of the provider party.
 * @param attestationCid The ContractId of the Attestation to revoke.
 */
export const revokeAttestation = async (
  token: string,
  attestationCid: ContractId
): Promise<any> => {
  return fetchLedger(
    '/exercise',
    token,
    {
      templateId: TEMPLATE_IDS.Attestation,
      contractId: attestationCid,
      choice: 'Revoke',
      argument: {},
    }
  );
};

/**
 * For a customer to request an attestation from a provider.
 * Assumes a CustomerRole contract exists between the customer and provider.
 * @param token JWT of the customer party.
 * @param customerRoleCid The ContractId of the customer's role contract with the provider.
 * @param requestedAttributes List of attribute names to be verified.
 * @param customerNote A note to the provider.
 */
export const requestAttestation = async (
  token: string,
  customerRoleCid: ContractId,
  requestedAttributes: string[],
  customerNote: string
): Promise<any> => {
  return fetchLedger(
    '/exercise',
    token,
    {
      templateId: TEMPLATE_IDS.CustomerRole,
      contractId: customerRoleCid,
      choice: 'RequestAttestation',
      argument: {
        requestedAttributes,
        customerNote,
      },
    }
  );
};

/**
 * Allocates a new party on the ledger.
 * This is an administrative function, often used for onboarding new users.
 * @param adminToken JWT of a party with allocation rights.
 * @param partyIdHint A desired identifier for the party.
 * @param displayName A human-readable name for the party.
 */
export const allocateParty = async (
  adminToken: string,
  partyIdHint: string,
  displayName: string
): Promise<{ identifier: string }> => {
  const url = `${API_BASE_V2}/parties/allocate`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifierHint: partyIdHint,
        displayName: displayName,
      }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Party allocation failed with status ${response.status}: ${errorText}`);
    }
    const jsonResponse = await response.json();
    return jsonResponse.partyDetails;
  } catch (error) {
    console.error('Error during party allocation:', error);
    throw error;
  }
};

/**
 * Creates a JWT for a given party ID.
 * NOTE: This is an insecure method for development purposes ONLY.
 * In production, a secure token vending service must be used.
 * @param partyId The party ID to create a token for.
 */
export const createDevToken = (partyId: Party): string => {
  const payload = {
    "https://daml.com/ledger-api": {
      "ledgerId": "dpm-sandbox", // Default for `dpm sandbox`
      "participantId": "sandbox",
      "applicationId": "kyc-app",
      "actAs": [partyId],
    },
  };
  const header = { "alg": "HS256", "typ": "JWT" };
  const secret = "secret"; // Default for `dpm sandbox`
  const encodedHeader = encode(JSON.stringify(header));
  const encodedPayload = encode(JSON.stringify(payload));

  // In a real app, the signing should be done with a proper crypto library.
  // This is a simplified, non-secure HMAC-SHA256 simulation.
  // We just return the unsigned parts for the sandbox which accepts it.
  return `${encodedHeader}.${encodedPayload}.`;
};