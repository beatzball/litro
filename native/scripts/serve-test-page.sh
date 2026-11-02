#!/bin/bash
#
# Serves native/scripts/bridge-test-page.html so the shell can be exercised with
# no Litro app running.
#
#   native/scripts/serve-test-page.sh              # port 5173, this Mac only
#   native/scripts/serve-test-page.sh 5174         # another port
#   native/scripts/serve-test-page.sh 5173 --lan   # reachable from a phone
#
# The default binds the loopback address, which the simulator shares with the
# Mac. A real device does not: `localhost` on a phone is the phone, so a device
# test needs --lan, which binds every interface and prints the two values to put
# in the app's app.json. Without it the shell on a device waits for a server it
# can never reach and shows its load failure screen.
#
# --lan puts the page on the local network for as long as the server runs. It
# serves one static file out of a temporary directory, so nothing from this
# repository is exposed, but it is still the reason the flag is opt-in.
#
# The page is copied to a temporary directory as index.html, so the server has
# nothing else to serve.

set -euo pipefail

port="${1:-5173}"
bind="127.0.0.1"
reach="localhost"

if [ "${2:-}" = "--lan" ]; then
  bind="0.0.0.0"
  # The address of the interface that carries the default route, which is the
  # one a phone on the same network can reach.
  reach="$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}' \
    | xargs -I{} ipconfig getifaddr {} 2>/dev/null || true)"
  if [ -z "$reach" ]; then
    echo "serve-test-page: this Mac has no address on a local network" >&2
    echo "  Connect it to the same Wi-Fi as the device and try again." >&2
    exit 1
  fi
elif [ "$#" -gt 1 ]; then
  echo "serve-test-page: unknown option '$2'" >&2
  echo "usage: $(basename "$0") [port] [--lan]" >&2
  exit 2
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT

cp "$here/bridge-test-page.html" "$root/index.html"

echo "serving the bridge test page on http://$reach:$port"
if [ "$bind" = "0.0.0.0" ]; then
  echo
  echo "for a device test, an app.json needs both of these:"
  echo "  \"startURL\": \"http://$reach:$port/\""
  echo "  \"allowedOrigins\": [\"http://$reach:$port\"]"
  echo
  echo "the shell permits this plain http address because Info.plist sets"
  echo "NSAllowsLocalNetworking, which covers private network addresses only."
  echo
fi

cd "$root"
exec python3 -m http.server "$port" --bind "$bind"
