#!/bin/bash
# -----------------------------------------------------------------------------
# Onboard a new KYC Provider to the Canton network.
#
# This script performs the following actions:
# 1. Allocates a new party for the KYC provider on a specified participant node.
# 2. Determines the main package ID from the project's compiled DAR file.
# 3. Creates a `Kyc.Identity.Provider` contract on the ledger, associating the
#    new party with the provider's metadata.
#
# Prerequisites:
# - curl: for making HTTP requests to the Canton JSON API.
# - jq: for parsing JSON responses from the API.
# - dpm: for inspecting the DAR file to get the package ID.
#
# Usage:
#   scripts/onboard-provider.sh \
#     --provider-name "VeriSure Inc." \
#     --description "Global leader in identity verification."
#
# Options:
#   --provider-name <name>      (Required) The legal name of the KYC provider.
#   --description <desc>        (Required) A short description of the provider.
#   --participant-url <url>     URL of the Canton participant's JSON API.
#                               (Default: http://localhost:7575)
#   --dar-path <path>           Path to the compiled project DAR file.
#                               (Default: .daml/dist/canton-kyc-identity-0.1.0.dar)
#   --jwt <token>               Authentication JWT. Can also be set via the
#                               CANTON_JWT environment variable.
#   -h, --help                  Show this help message.
# -----------------------------------------------------------------------------

set -euo pipefail

# --- Configuration and Defaults ---
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_PARTICIPANT_URL="http://localhost:7575"
DEFAULT_DAR_PATH="$PROJECT_ROOT/.daml/dist/canton-kyc-identity-0.1.0.dar"
PROVIDER_NAME=""
DESCRIPTION=""
JWT="${CANTON_JWT:-}"

# --- Helper Functions ---
function usage() {
  echo "Usage: $0 --provider-name <name> --description <desc> [options]"
  echo ""
  echo "Onboards a new KYC provider."
  echo ""
  echo "Options:"
  echo "  --provider-name <name>      (Required) The legal name of the KYC provider."
  echo "  --description <desc>        (Required) A short description of the provider."
  echo "  --participant-url <url>     Canton participant JSON API URL. (Default: $DEFAULT_PARTICIPANT_URL)"
  echo "  --dar-path <path>           Path to the compiled DAR file. (Default: $DEFAULT_DAR_PATH)"
  echo "  --jwt <token>               Authentication JWT. Can also be set via CANTON_JWT."
  echo "  -h, --help                  Show this help message."
  exit 1
}

function check_deps() {
  local missing_deps=0
  for dep in curl jq dpm; do
    if ! command -v "$dep" &> /dev/null; then
      echo "Error: Required command '$dep' is not installed or not in your PATH."
      missing_deps=1
    fi
  done
  if [ $missing_deps -eq 1 ]; then
    exit 1
  fi
}

# --- Argument Parsing ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --provider-name)
      PROVIDER_NAME="$2"
      shift 2
      ;;
    --description)
      DESCRIPTION="$2"
      shift 2
      ;;
    --participant-url)
      PARTICIPANT_URL="$2"
      shift 2
      ;;
    --dar-path)
      DAR_PATH="$2"
      shift 2
      ;;
    --jwt)
      JWT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# --- Validation ---
if [[ -z "$PROVIDER_NAME" || -z "$DESCRIPTION" ]]; then
  echo "Error: --provider-name and --description are required."
  usage
fi
if [[ -z "$JWT" ]]; then
  echo "Error: Authentication JWT must be provided via --jwt option or CANTON_JWT environment variable."
  usage
fi
if [[ ! -f "$DAR_PATH" ]]; then
    echo "Error: DAR file not found at '$DAR_PATH'. Please build the project with 'dpm build'."
    exit 1
fi

check_deps
PARTICIPANT_URL="${PARTICIPANT_URL:-$DEFAULT_PARTICIPANT_URL}"
DAR_PATH="${DAR_PATH:-$DEFAULT_DAR_PATH}"

# --- Main Execution ---
echo "▶️  Starting KYC Provider Onboarding..."
echo "  Provider Name:     $PROVIDER_NAME"
echo "  Participant URL:   $PARTICIPANT_URL"
echo "  DAR Path:          $DAR_PATH"
echo ""

# 1. Allocate Party
echo "1. Allocating party for '$PROVIDER_NAME'..."
PARTY_ALLOC_PAYLOAD=$(jq -n --arg name "$PROVIDER_NAME" '{"displayName": $name}')
PARTY_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  --data "$PARTY_ALLOC_PAYLOAD" \
  "$PARTICIPANT_URL/v2/parties/allocate")

PROVIDER_PARTY_ID=$(echo "$PARTY_RESPONSE" | jq -r '.identifier')
if [[ -z "$PROVIDER_PARTY_ID" || "$PROVIDER_PARTY_ID" == "null" ]]; then
  echo "Error: Failed to allocate party."
  echo "Response: $PARTY_RESPONSE"
  exit 1
fi
echo "   ✅ Success! Party ID: $PROVIDER_PARTY_ID"
echo ""

# 2. Get Package ID from DAR
echo "2. Inspecting DAR to find package ID..."
PACKAGE_ID=$(dpm damlc inspect-dar --json "$DAR_PATH" | jq -r .main_package_id)
if [[ -z "$PACKAGE_ID" ]]; then
    echo "Error: Failed to extract package ID from '$DAR_PATH'."
    exit 1
fi
echo "   ✅ Success! Package ID: $PACKAGE_ID"
echo ""

# 3. Create Provider Contract
echo "3. Creating Kyc.Identity.Provider contract on the ledger..."
PROVIDER_TEMPLATE_ID="${PACKAGE_ID}:Kyc.Identity.Provider"
CREATE_PAYLOAD=$(jq -n \
  --arg tpid "$PROVIDER_TEMPLATE_ID" \
  --arg party "$PROVIDER_PARTY_ID" \
  --arg name "$PROVIDER_NAME" \
  --arg desc "$DESCRIPTION" \
'{
  "templateId": $tpid,
  "payload": {
    "providerParty": $party,
    "name": $name,
    "description": $desc,
    "observers": []
  }
}')

CREATE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  --data "$CREATE_PAYLOAD" \
  "$PARTICIPANT_URL/v1/create")

CONTRACT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.result.contractId')
STATUS_CODE=$(echo "$CREATE_RESPONSE" | jq -r '.status')

if [[ "$STATUS_CODE" != "200" || -z "$CONTRACT_ID" || "$CONTRACT_ID" == "null" ]]; then
  echo "Error: Failed to create Provider contract."
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi
echo "   ✅ Success! Provider Contract ID: $CONTRACT_ID"
echo ""

# --- Final Output ---
echo "🎉 Onboarding Complete!"
echo "----------------------------------------"
echo "  Provider Name:     $PROVIDER_NAME"
echo "  Party ID:          $PROVIDER_PARTY_ID"
echo "  Provider CId:      $CONTRACT_ID"
echo "----------------------------------------"
echo "This provider can now start issuing attestations."
echo ""
exit 0