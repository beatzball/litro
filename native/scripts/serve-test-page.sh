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
# Two servers run, not one. The second, one port up, is the outside origin the
# page's allowlist check navigates to. That check needs a destination that is
# REACHABLE and not allowed: an unreachable one fails its navigation on its own,
# leaves the page in place, and reports success whether or not any allowlist
# exists. Do not add the second port to an app.json's allowedOrigins -- being
# refused is its entire job.
#
# Each page is copied to its own temporary directory as index.html, so neither
# server has anything else to serve.

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
outside="$(mktemp -d)"
outside_port=$((port + 1))
outside_pid=""
# `exec` below used to replace this shell, so this trap never ran and every run
# left its temporary directories behind. The server is now run as an ordinary
# foreground command.
cleanup() {
  [ -n "$outside_pid" ] && kill "$outside_pid" 2>/dev/null
  rm -rf "$root" "$outside"
}
trap cleanup EXIT

cp "$here/bridge-test-page.html" "$root/index.html"

# Loud on purpose. If the allowlist is not wired, the web view lands here and
# the test page is gone, so this page is the only thing left to say so.
cat > "$outside/index.html" <<'OUTSIDE'
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="background:#2b0000;color:#ff6b6b;font:700 22px/1.4 -apple-system,system-ui,sans-serif;padding:28px">
ORIGIN POLICY FAILED
<p style="font-weight:400;font-size:16px;color:#e8e8ea">
The shell loaded an origin that is not in this app's allowedOrigins.
The navigation allowlist is not running.
</p>
</body>
</html>
OUTSIDE

echo "serving the bridge test page on http://$reach:$port"
echo "  and the outside origin it must be refused, on http://$reach:$outside_port"
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

python3 -m http.server "$outside_port" --bind "$bind" --directory "$outside" >/dev/null 2>&1 &
outside_pid=$!

python3 -m http.server "$port" --bind "$bind" --directory "$root"
