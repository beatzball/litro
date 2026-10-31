#!/bin/bash
#
# Serves native/scripts/bridge-test-page.html on the port the demo app's
# start URL names, so the shell can be exercised with no Litro app running.
#
#   native/scripts/serve-test-page.sh          # port 5173
#   native/scripts/serve-test-page.sh 5174
#
# The page is copied to a temporary directory as index.html, so the server has
# nothing else to serve and the repository is not exposed on the network.

set -euo pipefail

port="${1:-5173}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT

cp "$here/bridge-test-page.html" "$root/index.html"
echo "serving the bridge test page on http://localhost:$port"
cd "$root"
exec python3 -m http.server "$port" --bind 127.0.0.1
