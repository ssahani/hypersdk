#!/usr/bin/env bash
# Wrapper — real editor is edit-demos.py (Pillow + ffmpeg overlay).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/edit-demos.py" "${1:-all}"
