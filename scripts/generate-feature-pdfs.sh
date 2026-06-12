#!/usr/bin/env bash
# Generate Machina feature guide PDFs from markdown (docs/guides + cinema mode).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
GEN_PY="${SCRIPT_DIR}/lib/generate-guide-pdfs.py"

VENV="${ROOT}/.pdf-venv"
PY=""
if [[ -x "${VENV}/bin/python" ]] && "${VENV}/bin/python" -c 'import fpdf' 2>/dev/null; then
  PY="${VENV}/bin/python"
elif python3 -c 'import fpdf' 2>/dev/null; then
  PY="python3"
else
  echo "  › Preparing PDF toolchain (fpdf2)…"
  rm -rf "${VENV}"
  python3 -m venv "${VENV}"
  "${VENV}/bin/python" -m pip install -q --disable-pip-version-check fpdf2
  PY="${VENV}/bin/python"
fi

echo "  › Machina feature guide PDFs"
"${PY}" "${GEN_PY}" --root "${ROOT}"
