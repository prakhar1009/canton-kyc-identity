// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { CreateEvent, Event, ExerciseEvent } from "@daml/ledger";

// --- Custom branded type for ContractId for type safety ---
export type ContractId<T> = string & { __brand: T };

// --- Daml Types (mirroring Daml templates) ---

export interface Attestation {
  provider: string;
  owner: string;
  attestationId: string;
  attestationType: string;
  expiryDate: string | null; // ISO 8601 Date string "YYYY-MM-DD" or null
  detailsHash: string;
}

export interface AttestationProposal {
  provider: string;
  requester: string;
  attestationType: string;
  detailsHash: string;
  expiryDate: string | null;
}

export interface ProviderRole {
  provider: string;
  displayName: string;
}

export interface TrustDelegation {
  truster: string;
  trustee: string;
  role: string;
  expiry: string; // ISO 8601 Time string
}

// --- API Response Types ---

type ApiResponse<T> = {
  status: number;
  result: T;
  errors?: string[];
  warnings?: string[];
};

type CreateResponse<T> = CreateEvent<T>;
type ExerciseResponse<R> = {
  exerciseResult: R;
  events: Event<unknown>[];
};
type QueryResponse<T> = CreateEvent<T>[];
type FetchResponse<T> = {
  contractId: string;
  payload: T;
};


// --- Template IDs ---

const TEMPLATE_IDS = {
  Attestation: "KYC.Attestation:Attestation",
  AttestationProposal: "KYC.Attestation:AttestationProposal",
  ProviderRole: "KYC.Provider:ProviderRole",
  TrustDelegation: "Trust.Registry:TrustDelegation",
};


// --- Custom Error Class ---

export class LedgerServiceError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "LedgerServiceError";
  }
}

// --- KYC Service Class ---

/**
 * Provides a client for interacting with the KYC Daml ledger via the JSON API.
 */
export class KycService {
  private readonly ledgerUrl: string;
  private readonly authToken: string;

  constructor(ledgerUrl: string, authToken: string) {
    if (!ledgerUrl || !authToken) {
      throw new Error("Ledger URL and auth token are required.");
    }
    this.ledgerUrl = ledgerUrl.endsWith('/') ? ledgerUrl.slice(0, -1) : ledgerUrl;
    this.authToken = authToken;
  }

  // --- Core API methods ---

  private async fetchLedger<T>(
    endpoint: string,
    method: "GET" | "POST",
    body?: object
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.ledgerUrl}${endpoint}`, {
        method,
        headers: {
          "Authorization": `Bearer ${this.authToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new LedgerServiceError(
          `Ledger API request failed with status ${response.status}`,
          { status: response.status, body: errorBody }
        );
      }

      return response.json() as Promise<ApiResponse<T>>;
    } catch (error) {
      if (error instanceof LedgerServiceError) {
        throw error;
      }
      throw new LedgerServiceError("Network or unexpected error during ledger request.", error);
    }
  }

  // --- Public service methods for KYC workflows ---

  /**
   * Proposes a new KYC attestation from a requester to a provider.
   */
  async proposeAttestation(
    requester: string,
    provider: string,
    attestationType: string,
    detailsHash: string,
    expiryDate: Date | null,
  ): Promise<CreateResponse<AttestationProposal>> {
    const payload: AttestationProposal = {
      requester,
      provider,
      attestationType,
      detailsHash,
      expiryDate: expiryDate ? expiryDate.toISOString().split("T")[0] : null,
    };

    const response = await this.fetchLedger<CreateResponse<AttestationProposal>>(
      "/v1/create",
      "POST",
      {
        templateId: TEMPLATE_IDS.AttestationProposal,
        payload,
      }
    );
    return response.result;
  }

  /**
   * Finds an active attestation proposal for a given requester.
   */
  async findAttestationProposal(
    provider: string,
    requester: string
  ): Promise<CreateEvent<AttestationProposal> | null> {
    const response = await this.fetchLedger<QueryResponse<AttestationProposal>>(
      "/v1/query",
      "POST",
      {
        templateIds: [TEMPLATE_IDS.AttestationProposal],
        query: { provider, requester },
      }
    );
    return response.result.length > 0 ? response.result[0] : null;
  }

  /**
   * Accepts an attestation proposal, creating an Attestation contract.
   * Executed by the Identity Provider.
   */
  async acceptAttestationProposal(
    proposalCid: ContractId<AttestationProposal>
  ): Promise<ExerciseResponse<ContractId<Attestation>>> {
    const response = await this.fetchLedger<ExerciseResponse<ContractId<Attestation>>>(
      "/v1/exercise",
      "POST",
      {
        templateId: TEMPLATE_IDS.AttestationProposal,
        contractId: proposalCid,
        choice: "Accept",
        argument: {},
      }
    );
    return response.result;
  }

  /**
   * Revokes an existing KYC attestation.
   * Executed by the Identity Provider who issued it.
   */
  async revokeAttestation(
    attestationCid: ContractId<Attestation>
  ): Promise<ExerciseResponse<void>> {
    const response = await this.fetchLedger<ExerciseResponse<void>>(
        "/v1/exercise",
        "POST",
        {
            templateId: TEMPLATE_IDS.Attestation,
            contractId: attestationCid,
            choice: "Revoke",
            argument: {},
        }
    );
    return response.result;
  }

  /**
   * Fetches all active KYC attestations for a given party (owner).
   */
  async getActiveAttestations(
    owner: string
  ): Promise<QueryResponse<Attestation>> {
    const response = await this.fetchLedger<QueryResponse<Attestation>>(
      "/v1/query",
      "POST",
      {
        templateIds: [TEMPLATE_IDS.Attestation],
        query: { owner },
      }
    );
    return response.result;
  }

  /**
   * Fetches the ProviderRole contract for a specific provider party.
   */
  async getProviderRole(provider: string): Promise<CreateEvent<ProviderRole> | null> {
    const response = await this.fetchLedger<QueryResponse<ProviderRole>>(
      "/v1/query",
      "POST",
      {
        templateIds: [TEMPLATE_IDS.ProviderRole],
        query: { provider },
      }
    );
    return response.result.length > 0 ? response.result[0] : null;
  }

  /**
   * Fetches all TrustDelegation contracts where the given party is the truster.
   * This shows who the given party trusts.
   */
  async getTrustDelegations(truster: string): Promise<QueryResponse<TrustDelegation>> {
    const response = await this.fetchLedger<QueryResponse<TrustDelegation>>(
      "/v1/query",
      "POST",
      {
        templateIds: [TEMPLATE_IDS.TrustDelegation],
        query: { truster },
      }
    );
    return response.result;
  }
}