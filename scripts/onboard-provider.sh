#!/bin/bash
# ------------------------------------------------------------------------------------------------
# Description:
#   Onboards a new KYC identity provider onto the Canton network.
#
#   This script performs two main actions:
#   1. Allocates a new party for the provider on a specified Canton participant node.
#   2. Runs a Daml script to create a `TrustedProvider` contract on the ledger,
#      officially registering the new provider's party in the Trust Registry.
#
# Usage:
#   ./scripts/onboard-provider.sh <PROVIDER_DISPLAY_NAME> <PARTICIPANT_ID>
#
# Example:
#   ./scripts/onboard-provider.sh "Global KYC Corp" participant2
#
# Prerequisites:
#   - A running Canton network.
#   - Daml SDK (v3.1.0 or compatible) installed and `daml` in the PATH.
#   - A compiled DAR file at `.daml/dist/canton-kyc-identity-0.1.0.dar`.
#   - An environment file `.env` at the project root with `REGISTRAR_PARTY`, `LEDGER_HOST`,
#     `LEDGER_PORT`, and `CANTON_DIR` configured.
# ------------------------------------------------------------------------------------------------

set -euo pipefail

# --- Configuration ---
# Load from .env file at the project root if it exists
if [ -f "$(dirname "$0")/../.env" ]; then
  source "$(dirname "$0")/../.env"
fi

# Set defaults and check for required environment variables
LEDGER_HOST=${LEDGER_HOST:-"localhost"}
LEDGER_PORT=${LEDGER_PORT:-6865}
REGISTRAR_PARTY=${REGISTRAR_PARTY:?"ERROR: REGISTRAR_PARTY must be set in your .env file."}
DAR_FILE=${DAR_FILE:-".daml/dist/canton-kyc-identity-0.1.0.dar"}
CANTON_DIR=${CANTON_DIR:?"ERROR: CANTON_DIR (path to Canton installation) must be set in your .env file."}
CANTON_CONFIG_FILE=${CANTON_CONFIG_FILE:-"${CANTON_DIR}/participant.conf"}

# --- Argument Validation ---
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <PROVIDER_DISPLAY_NAME> <PARTICIPANT_ID>"
    echo "  <PROVIDER_DISPLAY_NAME>: The human-readable name for the provider (e.g., \"Global KYC Corp\")."
    echo "  <PARTICIPANT_ID>: The ID of the Canton participant node to host the provider (e.g., participant1)."
    exit 1
fi

PROVIDER_NAME=$1
PARTICIPANT_ID=$2

echo "🚀 Onboarding KYC Provider: '$PROVIDER_NAME' on participant '$PARTICIPANT_ID'..."

# --- Step 1: Allocate a new Party for the Provider ---
echo "--> Step 1: Allocating new party on participant '$PARTICIPANT_ID'..."

# Generate a unique party hint from the display name.
# Slugify the name and add a short random suffix for uniqueness.
PROVIDER_HINT=$(echo "$PROVIDER_NAME" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '-' | sed 's/[^a-z0-9-]//g')
RANDOM_SUFFIX=$(head /dev/urandom | tr -dc a-z0-9 | head -c 4)
PARTY_HINT="${PROVIDER_HINT}-${RANDOM_SUFFIX}"

echo "   Generated Party Hint: ${PARTY_HINT}"

# Canton console command to enable the party.
# This command doesn't return the party ID in a script-friendly way, so we list parties afterwards.
CANTON_ENABLE_CMD="${PARTICIPANT_ID}.parties.enable(\"${PARTY_HINT}\")"
$CANTON_DIR/bin/canton -c $CANTON_CONFIG_FILE --no-tty --console-command "$CANTON_ENABLE_CMD" > /dev/null

# Now, list parties with the specific hint to get the full Party ID.
CANTON_LIST_CMD="${PARTICIPANT_ID}.parties.list(limit = 1, filter_hint = \"${PARTY_HINT}\")"
PARTY_LIST_OUTPUT=$($CANTON_DIR/bin/canton -c $CANTON_CONFIG_FILE --no-tty --console-command "$CANTON_LIST_CMD")

# Extract the full Party ID from the list output. It's usually in quotes.
# Example: Vector(KnownParty(party(party_id(unique_id(fingerprint...)), "provider-xyz-a1b2::...") ,...))
PROVIDER_PARTY=$(echo "$PARTY_LIST_OUTPUT" | grep -oP '"'${PARTY_HINT}'::[^"]+"' | tr -d '"')

if [ -z "$PROVIDER_PARTY" ]; then
    echo "❌ ERROR: Failed to allocate or find party with hint '${PARTY_HINT}'."
    echo "   Please check your Canton logs and configuration."
    echo "   Canton 'parties.list' command output:"
    echo "$PARTY_LIST_OUTPUT"
    exit 1
fi

echo "✅ Party allocated successfully. Party ID: ${PROVIDER_PARTY}"

# --- Step 2: Register the Provider on the Ledger via Daml Script ---
echo "--> Step 2: Creating 'TrustedProvider' contract on the ledger..."

# We execute a Daml script to create the TrustRegistry.TrustedProvider contract.
# The script is expected to be named `TrustRegistry.Scripts:registerProvider`.
# It requires the REGISTRAR_PARTY to act as the controller and the new PROVIDER_PARTY as data.
# We pass them as named parties to the script, which the script can access via `getParty`.
SCRIPT_NAME="TrustRegistry.Scripts:registerProvider"

daml script \
  --dar "${DAR_FILE}" \
  --script-name "${SCRIPT_NAME}" \
  --ledger-host "${LEDGER_HOST}" \
  --ledger-port "${LEDGER_PORT}" \
  --party "Registrar=${REGISTRAR_PARTY}" \
  --party "Provider=${PROVIDER_PARTY}"

echo "✅ Provider registered on the ledger."

# --- Final Summary ---
echo ""
echo "========================================="
echo "  KYC Provider Onboarding Complete"
echo "========================================="
echo "  Display Name: ${PROVIDER_NAME}"
echo "  Participant:  ${PARTICIPANT_ID}"
echo "  Party ID:     ${PROVIDER_PARTY}"
echo "========================================="
echo ""
echo "The new provider is now active and can issue attestations."
echo ""