#!/usr/bin/env bash
# Generate Machina feature guide PDFs and email to client stakeholders.
#
# Usage:
#   ./scripts/mail-feature-pdfs.sh
#   FEATURE_PDF_TO=sibu@zyvor.dev FEATURE_PDF_CC=ssahani@zyvor.dev ./scripts/mail-feature-pdfs.sh
#
# SMTP: scripts/deploy-mailer.env or ../hypersdk-web/contact-mailer.env
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

export FEATURE_PDF_TO="${FEATURE_PDF_TO:-sibu@zyvor.dev}"
export FEATURE_PDF_CC="${FEATURE_PDF_CC:-ssahani@zyvor.dev}"

echo "══ Generate feature guide PDFs ══"
"${SCRIPT_DIR}/generate-feature-pdfs.sh"

echo ""
echo "══ Mail PDFs to ${FEATURE_PDF_TO} (cc ${FEATURE_PDF_CC}) ══"
python3 "${SCRIPT_DIR}/send-feature-pdfs.py"
