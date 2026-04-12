import React, { useState, useMemo } from 'react';
import { DamlLedger, useLedger, useParty, useStreamQueries, useQuery } from "@c7/react";
import { Attestation, ProviderRole } from '@daml.js/canton-kyc-identity-0.1.0/lib/KYC';
import { TrustedProvider, TrustRegistry } from '@daml.js/canton-kyc-identity-0.1.0/lib/TrustRegistry';
import { ContractId } from '@daml/types';
import './App.css';

const App: React.FC = () => {
  const [credentials, setCredentials] = useState<{party: string; token: string} | undefined>();

  const logout = () => {
    setCredentials(undefined);
  };

  if (!credentials) {
    return <LoginScreen onLogin={setCredentials} />;
  } else {
    return (
      <DamlLedger party={credentials.party} token={credentials.token} httpBaseUrl="http://localhost:7575">
        <MainScreen onLogout={logout} />
      </DamlLedger>
    );
  }
};

const LoginScreen: React.FC<{onLogin: (creds: {party: string; token: string}) => void}> = ({ onLogin }) => {
  const [party, setParty] = useState('');
  const [token, setToken] = useState('');

  // Pre-populate with typical sandbox values for convenience
  React.useEffect(() => {
    setParty("Operator");
    const generatedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2RhbWwuY29tL2xlZGdlci1hcGkiOnsibGVkZ2VySWQiOiJteWxvY2FsbGVkZ2VyIiwiYXBwbGljYXRpb25JZCI6Imh0dHAtanNvbi1hcGktZ2F0ZXdheSIsInBhcnR5IjoiT3BlcmF0b3IiLCJhY3RBcyI6WyJPcGVyYXRvciJdfX0.k26acmhiNm25Y6jTDEmRk5nPqBPO2JAl2YVO3R6l_qA";
    setToken(generatedToken);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ party, token });
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1>Canton KYC Admin</h1>
        <p>Log in as Operator or a trusted Provider.</p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Party ID</label>
            <input type="text" value={party} onChange={e => setParty(e.target.value)} placeholder="e.g. Operator" required />
          </div>
          <div className="form-group">
            <label>DAML Ledger Token (JWT)</label>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} required />
          </div>
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

const MainScreen: React.FC<{onLogout: () => void}> = ({ onLogout }) => {
  const party = useParty();
  return (
    <div className="main-screen">
      <header>
        <h1>KYC Identity Admin Dashboard</h1>
        <div className="header-info">
          <span>Logged in as: <strong>{party}</strong></span>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>
      <main>
        <div className="panel">
          <TrustRegistryPanel />
        </div>
        <div className="panel">
          <AttestationPanel />
        </div>
      </main>
    </div>
  );
};

const TrustRegistryPanel: React.FC = () => {
  const ledger = useLedger();
  const party = useParty();
  const { contracts: registries, loading: registryLoading } = useQuery(TrustRegistry);
  const { contracts: providers, loading: providersLoading } = useStreamQueries(TrustedProvider);

  const [newProvider, setNewProvider] = useState('');
  const [newProviderName, setNewProviderName] = useState('');

  const trustRegistryCid = useMemo(() => {
    if (registries.length > 0) {
      return registries[0].contractId;
    }
    return null;
  }, [registries]);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trustRegistryCid || !newProvider || !newProviderName) {
      alert("Trust Registry not found or form is incomplete.");
      return;
    }
    try {
      await ledger.exercise(TrustRegistry.AddProvider, trustRegistryCid, { provider: newProvider, providerName: newProviderName });
      setNewProvider('');
      setNewProviderName('');
    } catch (error) {
      console.error("Error adding provider:", error);
      alert(`Failed to add provider: ${error}`);
    }
  };

  const handleRevokeProvider = async (cid: ContractId<TrustedProvider>) => {
    if (!window.confirm("Are you sure you want to revoke this provider?")) return;
    try {
      await ledger.exercise(TrustedProvider.Revoke, cid, {});
    } catch (error) {
      console.error("Error revoking provider:", error);
      alert(`Failed to revoke provider: ${error}`);
    }
  };

  if (registryLoading || providersLoading) return <div>Loading registry data...</div>;

  return (
    <div className="trust-registry-panel">
      <h2>Trusted Providers</h2>
      <div className="card">
        <h3>Add New Provider</h3>
        <form onSubmit={handleAddProvider}>
          <div className="form-row">
            <div className="form-group">
              <label>Provider Party ID</label>
              <input type="text" value={newProvider} onChange={e => setNewProvider(e.target.value)} placeholder="ProviderPartyId" required />
            </div>
            <div className="form-group">
              <label>Provider Name</label>
              <input type="text" value={newProviderName} onChange={e => setNewProviderName(e.target.value)} placeholder="e.g. Verified Inc." required />
            </div>
          </div>
          <button type="submit" disabled={!trustRegistryCid}>Add Provider</button>
          {!trustRegistryCid && <p className="error-text">No TrustRegistry contract found for party '{party}'. This action is Operator-only.</p>}
        </form>
      </div>

      <div className="card">
        <h3>Current Providers</h3>
        {providers.length === 0 ? <p>No trusted providers found.</p> : (
          <table>
            <thead>
              <tr>
                <th>Provider Name</th>
                <th>Party ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(p => (
                <tr key={p.contractId}>
                  <td>{p.payload.providerName}</td>
                  <td>{p.payload.provider}</td>
                  <td>
                    <button className="danger" onClick={() => handleRevokeProvider(p.contractId)} disabled={!trustRegistryCid}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const AttestationPanel: React.FC = () => {
    const ledger = useLedger();
    const party = useParty();
    const { contracts: providerRoles, loading: rolesLoading } = useQuery(ProviderRole, () => [{provider: party}]);
    const { contracts: attestations, loading: attestationsLoading } = useStreamQueries(Attestation);

    const [subject, setSubject] = useState('');
    const [attestationId, setAttestationId] = useState('');
    const [expiryDate, setExpiryDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]); // Default to 1 year from now

    const providerRoleCid = useMemo(() => {
        if (providerRoles.length > 0) {
            return providerRoles[0].contractId;
        }
        return null;
    }, [providerRoles]);

    const handleIssueAttestation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!providerRoleCid) {
            alert("Provider Role not found for your party. Can't issue attestations.");
            return;
        }
        try {
            await ledger.exercise(ProviderRole.IssueAttestation, providerRoleCid, {
                subject: subject,
                id: attestationId,
                expiry: expiryDate,
            });
            setSubject('');
            setAttestationId('');
        } catch (error) {
            console.error("Error issuing attestation:", error);
            alert(`Failed to issue attestation: ${error}`);
        }
    };

    const handleRevokeAttestation = async (cid: ContractId<Attestation>) => {
        if (!window.confirm("Are you sure you want to revoke this attestation?")) return;
        try {
            await ledger.exercise(Attestation.Revoke, cid, { reason: "Admin revocation" });
        } catch (error) {
            console.error("Error revoking attestation:", error);
            alert(`Failed to revoke attestation: ${error}`);
        }
    };

    if (rolesLoading || attestationsLoading) return <div>Loading attestation data...</div>;

    const myAttestations = attestations.filter(a => a.payload.provider === party);

    return (
        <div className="attestation-panel">
            <h2>KYC Attestations</h2>
            {providerRoleCid ? (
                <div className="card">
                    <h3>Issue New Attestation</h3>
                    <form onSubmit={handleIssueAttestation}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Subject Party ID</label>
                                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="SubjectPartyId" required />
                            </div>
                            <div className="form-group">
                                <label>Attestation ID</label>
                                <input type="text" value={attestationId} onChange={e => setAttestationId(e.target.value)} placeholder="Unique ID (e.g., UUID)" required />
                            </div>
                            <div className="form-group">
                                <label>Expiry Date</label>
                                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                            </div>
                        </div>
                        <button type="submit">Issue Attestation</button>
                    </form>
                </div>
            ) : (
                <div className="card notice">
                    <p>Your party (<strong>{party}</strong>) does not have a ProviderRole. Only trusted providers can issue attestations.</p>
                </div>
            )}

            <div className="card">
                <h3>Issued Attestations (by {party})</h3>
                {myAttestations.length === 0 ? <p>No attestations issued by this party.</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Subject</th>
                                <th>Provider</th>
                                <th>Expiry</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myAttestations.map(a => (
                                <tr key={a.contractId}>
                                    <td>{a.payload.id}</td>
                                    <td>{a.payload.subject}</td>
                                    <td>{a.payload.provider}</td>
                                    <td>{a.payload.expiry}</td>
                                    <td>
                                        <button className="danger" onClick={() => handleRevokeAttestation(a.contractId)}>Revoke</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default App;