#!/bin/bash
# smoke-test-static.sh — Validates the static preset build output.
#
# Usage:
#   bash scripts/smoke-test-static.sh
#
# Note: This script must be executable. Run once after cloning:
#   chmod +x scripts/smoke-test-static.sh
# In CI this is invoked via `bash scripts/smoke-test-static.sh` which does not
# require the executable bit.
set -e

echo "=== Litro Smoke Test: static preset ==="

cd "$(dirname "$0")/.."

# Build
echo "Building static site..."
LITRO_MODE=static pnpm --filter playground build

# Check output
if [ ! -f "playground/dist/static/index.html" ]; then
  echo "ERROR: dist/static/index.html not found"
  exit 1
fi

# Check content
if ! grep -q "Welcome to Litro" "playground/dist/static/index.html"; then
  echo "ERROR: index.html does not contain expected content"
  exit 1
fi

echo "dist/static/index.html exists and contains expected content"
echo "=== static smoke test passed ==="
