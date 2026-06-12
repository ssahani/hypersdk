#!/usr/bin/env bash
# Generate PDFs for new Machina feature decks (07–10) in client-presentations format.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/generate-client-presentation-pdfs.sh" --only=07,08,09,10,11 --force "$@"
