#!/bin/bash
#
# Refuses a Release build whose app.json still carries a development
# configuration.
#
# The demo app starts at http://localhost:5173/, which is correct: that is where
# a Litro dev server runs. On a device `localhost` is the device, so an app
# submitted with that start URL reaches nothing, and the reviewer sees the
# shell's load failure screen instead of the app. There is no step between
# "works on my Mac" and "uploaded" that would have caught it.
#
# This runs as the first build phase of the app target. A Debug build is left
# alone, because a Debug build is where a loopback address belongs.
#
#   native/scripts/check-release-config.sh             # as a build phase
#   native/scripts/check-release-config.sh --self-test # the rules, checked
#
# Errors are fatal and warnings are not, and the split is deliberate. A start
# URL the device cannot reach is certainly broken. An app with no capabilities
# turned on is a thin web view wrapper, which is what guideline 4.2 rejects --
# likely, not certain, and not this script's call to make.
#
# Output is written in Xcode's diagnostic format, so each line lands in the
# issue navigator rather than only in the build log.

set -euo pipefail

# Records that the check ran and passed, so Xcode's dependency analysis can skip
# it when neither the script nor app.json has changed.
#
# The phase declares this file as its output. Without one, the phase has to be
# marked as always out of date, and Xcode then prints a note about that on every
# single build -- which teaches everyone reading the log to ignore notes, and
# the next real one with them.
stamp() {
  [ -n "${DERIVED_FILE_DIR:-}" ] || return 0
  mkdir -p "$DERIVED_FILE_DIR"
  date > "$DERIVED_FILE_DIR/check-release-config.stamp"
}

# Why a host is not shippable, or empty when it is fine.
#
# Split out from the build phase so --self-test can drive it, because a rule
# that only runs during an archive is a rule nobody has ever seen run.
host_problem() {
  local host="$1"
  case "$host" in
    localhost|localhost.*|*.localhost)
      echo "localhost on a device is the device itself" ;;
    # The bracket forms are listed because split_url keeps the brackets on an
    # IPv6 literal, so [::1] does not match a bare ::1.
    127.*|::1|\[::1\]|0.0.0.0|::|\[::\])
      echo "a loopback address reaches only the device itself" ;;
    10.*|192.168.*|169.254.*)
      echo "a private network address reaches nothing outside your network" ;;
    # IPv6 link-local and unique-local, the private ranges' counterparts.
    \[fe8*|\[fe9*|\[fea*|\[feb*|\[fc*|\[fd*)
      echo "a private network address reaches nothing outside your network" ;;
    # 172.16.0.0 through 172.31.255.255. Spelled out because 172.32 and up are
    # public, and a glob wide enough to cover the range would catch them too.
    172.1[6-9].*|172.2[0-9].*|172.3[0-1].*)
      echo "a private network address reaches nothing outside your network" ;;
    *.local)
      echo "a .local name is resolved only on your own network" ;;
    "")
      echo "the start URL has no host" ;;
    *)
      echo "" ;;
  esac
}

# The scheme and host of a URL, as two words.
#
# Done with parameter expansion rather than a URL parser so the script keeps the
# shell's promise of needing nothing that is not already on a Mac.
split_url() {
  local url="$1"
  local scheme="${url%%://*}"
  local rest="${url#*://}"
  local hostport="${rest%%/*}"
  # Strip any credentials and the port. An IPv6 literal in brackets keeps them,
  # which is why the bracket form is matched first.
  hostport="${hostport##*@}"
  case "$hostport" in
    \[*\]*) echo "$scheme ${hostport%%\]*}]" ;;
    *)      echo "$scheme ${hostport%%:*}" ;;
  esac
}

# How many capabilities an app.json turns on.
#
# `plutil -extract` on an array prints its element count, not its elements. An
# earlier version counted the LINES of that output, which is 1 whether the count
# is 0 or 20, so the warning below never fired once. The self-test covers this
# now, which is the only reason that is not still true.
capability_count() {
  plutil -extract capabilities raw -o - "$1" 2>/dev/null || echo 0
}

self_test() {
  local failures=0
  check() {
    local url="$1" expected="$2"
    local got
    read -r scheme host <<<"$(split_url "$url")"
    if [ -n "$(host_problem "$host")" ]; then
      got="reject"
    elif [ "$scheme" != "https" ]; then
      got="reject"
    else
      got="accept"
    fi
    if [ "$got" != "$expected" ]; then
      echo "  FAIL $url -> $got, wanted $expected" >&2
      failures=$((failures + 1))
    else
      echo "  ok   $url -> $got"
    fi
  }

  echo "check-release-config: self-test"
  check "https://app.example.com/"            accept
  check "https://app.example.com:8443/path"   accept
  # 172.32 is public even though 172.16 through 172.31 are not.
  check "https://172.32.0.1/"                 accept
  check "https://11.0.0.1/"                   accept
  check "http://localhost:5173/"              reject
  check "http://127.0.0.1:5173/"              reject
  check "https://localhost/"                  reject
  check "https://192.168.10.241:5173/"        reject
  check "https://10.0.0.5/"                   reject
  check "https://172.16.0.1/"                 reject
  check "https://172.31.255.254/"             reject
  check "https://169.254.1.1/"                reject
  check "https://my-mac.local/"               reject
  check "https://[::1]/"                      reject
  check "https://[fe80::1]/"                  reject
  check "https://[fd00::1]/"                  reject
  check "https://[2606:4700::1111]/"          accept
  # Plain http to a public host is refused by App Transport Security at run
  # time, so it is an error here rather than something to discover on a device.
  check "http://app.example.com/"             reject
  # Credentials in the URL must not hide the host behind an @.
  check "https://user:pass@localhost/"        reject

  # The capability count, against real files, because the bug it had was in
  # reading plutil's output rather than in any rule.
  local dir
  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' RETURN
  count_check() {
    local label="$1" json="$2" expected="$3" got
    printf '%s' "$json" > "$dir/app.json"
    got="$(capability_count "$dir/app.json")"
    if [ "$got" != "$expected" ]; then
      echo "  FAIL capabilities $label -> $got, wanted $expected" >&2
      failures=$((failures + 1))
    else
      echo "  ok   capabilities $label -> $got"
    fi
  }
  count_check "none"    '{"capabilities":[]}'                   0
  count_check "one"     '{"capabilities":["haptics"]}'          1
  count_check "two"     '{"capabilities":["haptics","badging"]}' 2
  count_check "missing" '{}'                                    0

  if [ "$failures" -ne 0 ]; then
    echo "check-release-config: self-test FAILED, $failures of them" >&2
    exit 1
  fi
  echo "check-release-config: self-test OK"
}

if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit 0
fi

# A Debug build is where a development configuration belongs.
configuration="${CONFIGURATION:-Debug}"
if [ "$configuration" != "Release" ]; then
  echo "check-release-config: $configuration build, nothing to check"
  stamp
  exit 0
fi

config="${SRCROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/Build/Resources/app.json"
if [ ! -f "$config" ]; then
  echo "error: no app.json at $config. Run native/scripts/select-app.sh first." >&2
  exit 1
fi

start_url="$(plutil -extract startURL raw -o - "$config")"
read -r scheme host <<<"$(split_url "$start_url")"

status=0

problem="$(host_problem "$host")"
if [ -n "$problem" ]; then
  echo "error: this Release build starts at $start_url, and $problem." >&2
  echo "note: set startURL and allowedOrigins to the address the app ships against." >&2
  status=1
elif [ "$scheme" != "https" ]; then
  # Checked only once the host is known good, so a localhost URL reports the
  # one problem that actually matters rather than two.
  echo "error: this Release build starts at $start_url, which is not https." >&2
  echo "note: App Transport Security refuses plain http to a public host at run time." >&2
  status=1
fi

capabilities="$(capability_count "$config")"
if [ "$capabilities" -eq 0 ]; then
  echo "warning: this app turns on no capabilities, so it does nothing a browser cannot." >&2
  echo "note: App Store guideline 4.2 rejects an app that is only a web view." >&2
fi

if [ "$status" -eq 0 ]; then
  echo "check-release-config: OK - $start_url"
  stamp
fi
exit "$status"
