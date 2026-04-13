import React from 'react';
import { useStreamQueries } from '@c7/react';
import { DamlLedger } from '@c7/ledger';
import { ContractId } from '@daml/types';
import { Attestation, RevokedAttestation } from '../daml.js/canton-kyc-identity-0.1.0/lib/MultiAttestation';
import { revokeAttestation } from './kycService';

interface ProviderDashboardProps {
  party: string;
  ledger: DamlLedger;
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    fontSize: '2em',
    color: '#333',
    borderBottom: '2px solid #eee',
    paddingBottom: '10px',
    marginBottom: '20px',
  },
  section: {
    marginBottom: '40px',
  },
  sectionHeader: {
    fontSize: '1.5em',
    color: '#555',
    marginBottom: '15px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  th: {
    backgroundColor: '#f8f8f8',
    border: '1px solid #ddd',
    padding: '12px',
    textAlign: 'left',
    fontWeight: 'bold',
  },
  td: {
    border: '1px solid #ddd',
    padding: '12px',
    verticalAlign: 'middle',
  },
  button: {
    backgroundColor: '#d9534f',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
  buttonHover: {
    backgroundColor: '#c9302c',
  },
  noContracts: {
    color: '#777',
    fontStyle: 'italic',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  loading: {
    fontSize: '1.2em',
    color: '#555',
  }
};

const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ party, ledger }) => {
  const { contracts: activeAttestations, loading: loadingActive } = useStreamQueries(Attestation, () => [{ provider: party }]);
  const { contracts: revokedAttestations, loading: loadingRevoked } = useStreamQueries(RevokedAttestation, () => [{ provider: party }]);

  const handleRevoke = async (attestationCid: ContractId<Attestation>) => {
    if (window.confirm("Are you sure you want to revoke this attestation? This is a permanent action.")) {
      try {
        await revokeAttestation(ledger, attestationCid);
        alert("Attestation successfully revoked.");
      } catch (error) {
        console.error("Failed to revoke attestation:", error);
        alert(`Error: Could not revoke attestation. See console for details.`);
      }
    }
  };

  if (loadingActive || loadingRevoked) {
    return <div style={styles.loading}>Loading dashboard...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Provider Dashboard</h1>

      <div style={styles.section}>
        <h2 style={styles.sectionHeader}>Active Attestations ({activeAttestations.length})</h2>
        {activeAttestations.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Subject Party</th>
                <th style={styles.th}>Attestation Type</th>
                <th style={styles.th}>Data Hash</th>
                <th style={styles.th}>Issue Date</th>
                <th style={styles.th}>Expiry Date</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeAttestations.map(attestation => (
                <tr key={attestation.contractId}>
                  <td style={styles.td} title={attestation.payload.subject}>{`${attestation.payload.subject.substring(0, 12)}...`}</td>
                  <td style={styles.td}>{attestation.payload.attestationType}</td>
                  <td style={styles.td} title={attestation.payload.attestationDataHash}>{`${attestation.payload.attestationDataHash.substring(0, 12)}...`}</td>
                  <td style={styles.td}>{attestation.payload.issueDate}</td>
                  <td style={styles.td}>{attestation.payload.expiryDate || 'N/A'}</td>
                  <td style={styles.td}>
                    <button
                      style={styles.button}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = styles.buttonHover.backgroundColor}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = styles.button.backgroundColor}
                      onClick={() => handleRevoke(attestation.contractId)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={styles.noContracts}>No active attestations found.</div>
        )}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionHeader}>Revoked Attestations ({revokedAttestations.length})</h2>
        {revokedAttestations.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Subject Party</th>
                <th style={styles.th}>Attestation Type</th>
                <th style={styles.th}>Data Hash</th>
                <th style={styles.th}>Issue Date</th>
                <th style={styles.th}>Revocation Date</th>
              </tr>
            </thead>
            <tbody>
              {revokedAttestations.map(attestation => (
                <tr key={attestation.contractId}>
                  <td style={styles.td} title={attestation.payload.subject}>{`${attestation.payload.subject.substring(0, 12)}...`}</td>
                  <td style={styles.td}>{attestation.payload.attestationType}</td>
                  <td style={styles.td} title={attestation.payload.attestationDataHash}>{`${attestation.payload.attestationDataHash.substring(0, 12)}...`}</td>
                  <td style={styles.td}>{attestation.payload.issueDate}</td>
                  <td style={styles.td}>{attestation.payload.revocationDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={styles.noContracts}>No revoked attestations found.</div>
        )}
      </div>
    </div>
  );
};

export default ProviderDashboard;