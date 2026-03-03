#!/bin/bash
# smoke-test-node.sh — Validates the node-server preset build output.
#
# Usage:
#   bash scripts/smoke-test-node.sh
#
# Note: This script must be executable. Run once after cloning:
#   chmod +x scripts/smoke-test-node.sh
# In CI this is invoked via `bash scripts/smoke-test-node.sh` which does not
# require the executable bit.
set -e

echo "=== Litro Smoke Test: node-server preset ==="

cd "$(dirname "$0")/.."

# Build framework so the CLI is available
echo "Building framework..."
pnpm --filter litro build

# Build playground
echo "Building..."
cd playground
node ../packages/framework/dist/cli/index.js build --mode=server
cd ..

# Check output exists
if [ ! -f "playground/.nitro/dev/index.mjs" ] && [ ! -f "playground/dist/server/index.mjs" ]; then
  # Try alternate output paths
  SERVER_OUT=$(find playground/dist -name "*.mjs" | head -1)
  if [ -z "$SERVER_OUT" ]; then
    echo "ERROR: No server output found"
    exit 1
  fi
fi

echo "Build succeeded"
echo "=== node-server smoke test passed ==="
