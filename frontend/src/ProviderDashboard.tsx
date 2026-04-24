import React, { useState } from 'react';
import { useParty, useLedger, useStreamQueries } from '@c7/react';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  CircularProgress,
  Snackbar,
  Alert,
  Chip
} from '@mui/material';
import { Main } from '@daml.js/canton-kyc-identity-0.1.0';

/**
 * Renders a dashboard for Identity Providers to manage their issued attestations.
 * It displays lists of active and revoked attestations and allows the provider
 * to revoke active ones.
 */
const ProviderDashboard: React.FC = () => {
  const party = useParty();
  const ledger = useLedger();

  // State for notification snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // Stream active attestations issued by the current provider party
  const { contracts: activeAttestations, loading: loadingActive } = useStreamQueries(
    Main.MultiAttestation.Attestation,
    () => [{ provider: party }],
    [party]
  );

  // Stream revoked attestations issued by the current provider party
  const { contracts: revokedAttestations, loading: loadingRevoked } = useStreamQueries(
    Main.MultiAttestation.RevokedAttestation,
    () => [{ provider: party }],
    [party]
  );

  /**
   * Handles the revocation of an attestation by exercising the 'Revoke' choice.
   * @param contractId The ContractId of the Attestation to revoke.
   */
  const handleRevoke = async (contractId: string) => {
    try {
      await ledger.exercise(Main.MultiAttestation.Attestation.Revoke, contractId, {});
      setSnackbar({ open: true, message: 'Attestation revoked successfully.', severity: 'success' });
    } catch (error) {
      console.error("Error revoking attestation:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setSnackbar({ open: true, message: `Failed to revoke attestation: ${errorMessage}`, severity: 'error' });
    }
  };

  const handleCloseSnackbar = () => {
    if (snackbar) {
      setSnackbar({ ...snackbar, open: false });
    }
  };

  /**
   * Helper function to render a table of attestations.
   * @param title The title for the table section.
   * @param loading The loading state for this data set.
   * @param contracts The list of contracts (active or revoked) to display.
   * @param isRevokedTable A boolean flag to adjust columns for revoked attestations.
   */
  const renderAttestationTable = (
    title: string,
    loading: boolean,
    contracts: readonly any[], // Can be Attestation or RevokedAttestation contracts
    isRevokedTable: boolean = false
  ) => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        {title}
      </Typography>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label={`${title} table`}>
          <TableHead>
            <TableRow>
              <TableCell>Subject Party</TableCell>
              <TableCell>Attestation Type</TableCell>
              <TableCell>Data Hash</TableCell>
              {isRevokedTable ? (
                <TableCell>Revocation Date</TableCell>
              ) : (
                <>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No attestations to display.
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((c) => (
                <TableRow key={c.contractId}>
                  <TableCell component="th" scope="row">
                    {c.payload.subject}
                  </TableCell>
                  <TableCell><Chip label={c.payload.attestationType} color="primary" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {c.payload.attestationDataHash}
                  </TableCell>
                  {isRevokedTable ? (
                    <TableCell>{new Date(c.payload.revocationDate).toLocaleString()}</TableCell>
                  ) : (
                    <>
                      <TableCell>{c.payload.expiryDate || 'N/A'}</TableCell>
                      <TableCell align="right">
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => handleRevoke(c.contractId)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Provider Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary">
        Managing attestations for: {party}
      </Typography>

      {renderAttestationTable(
        'Active Attestations',
        loadingActive,
        activeAttestations
      )}

      {renderAttestationTable(
        'Revoked Attestations',
        loadingRevoked,
        revokedAttestations,
        true
      )}

      {snackbar && (
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
};

export default ProviderDashboard;