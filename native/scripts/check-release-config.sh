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
# Every URL in the configuration is checked, not only the start URL. A leftover
# allowedOrigins entry is the one that matters for safety rather than for a
# rejection: Info.plist keeps NSAllowsLocalNetworking in Release, so plain http
# to a LAN address is still permitted in the shipped app, and whatever host
# holds that address on the user's current network would be served the bridge.
#
# This runs as the first build phase of the app target. A Debug build is left
# alone, because a Debug build is where a loopback address belongs.
#
#   native/scripts/check-release-config.sh             # as a build phase
#   native/scripts/check-release-config.sh --self-test # the rules, checked
#
# Errors are fatal and warnings are not, and the split is deliberate. A URL the
# device cannot reach is certainly broken. An app with no capabilities turned on
# is a thin web view wrapper, which is what guideline 4.2 rejects -- likely, not
# certain, and not this script's call to make.
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

# The scheme and host of a URL, as two words.
#
# Done with parameter expansion rather than a URL parser so the script keeps the
# shell's promise of needing nothing that is not already on a Mac.
split_url() {
  local url="$1"
  local scheme="${url%%://*}"
  local rest="${url#*://}"

  # The authority ends at the first of "?", "#" or "/", and in that order. An
  # earlier version cut at "/" alone, so `https://localhost?x=1` kept the query
  # inside the host and matched no rule, and `https://localhost?u=a@example.com`
  # moved the host to example.com when the credentials were stripped below.
  local hostport="${rest%%\?*}"
  hostport="${hostport%%#*}"
  hostport="${hostport%%/*}"

  # Strip any credentials, then the port. An IPv6 literal in brackets keeps its
  # brackets, which is why the bracket form is matched first.
  hostport="${hostport##*@}"
  case "$hostport" in
    \[*\]*) echo "$scheme ${hostport%%\]*}]" ;;
    *)      echo "$scheme ${hostport%%:*}" ;;
  esac
}

# One host, in the one spelling the rules are written against.
#
# Hosts are case-insensitive and DNS treats a trailing dot as the same name, so
# without this `https://LOCALHOST/` and `https://my-mac.local./` both pass every
# rule below.
normalize_host() {
  local host
  host="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  while [ "${host%.}" != "$host" ]; do host="${host%.}"; done
  printf '%s' "$host"
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
    127.*|0.*|::1|\[::1\]|0.0.0.0|::|\[::\]|\[0:0:0:0:0:0:0:1\])
      echo "a loopback address reaches only the device itself" ;;
    # An IPv4 address written inside an IPv6 literal.
    \[::ffff:*)
      echo "a loopback or private address in IPv4-mapped form" ;;
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
    # A host of nothing but digits is an IPv4 address written as one integer:
    # 2130706433 is 127.0.0.1. No DNS name can look like this, so there is
    # nothing legitimate to catch here by accident.
    [0-9]*)
      case "$host" in
        *[!0-9]*) echo "" ;;
        *) echo "an address written as a single number, which is a loopback or private address in disguise" ;;
      esac ;;
    "")
      echo "the start URL has no host" ;;
    *)
      echo "" ;;
  esac
}

# Why a URL cannot ship, or empty when it can.
#
# The one place the rules are applied, so startURL and every allowedOrigins
# entry are judged by exactly the same ones.
url_problem() {
  local url="$1" scheme host problem
  read -r scheme host <<<"$(split_url "$url")"
  host="$(normalize_host "$host")"
  problem="$(host_problem "$host")"
  if [ -n "$problem" ]; then
    echo "$problem"
    return
  fi
  # Checked only once the host is known good, so a localhost URL reports the one
  # problem that actually matters rather than two.
  if [ "$scheme" != "https" ]; then
    echo "App Transport Security refuses plain http to a public host at run time"
  fi
}

# How many capabilities an app.json turns on.
#
# `plutil -extract` on an array prints its element count, not its elements. An
# earlier version counted the LINES of that output, which is 1 whether the count
# is 0 or 20, so the warning below never fired once. The self-test covers this
# now, which is the only reason that is not still true.
#
# Anything that is not a plain number is read as zero, rather than trusted.
# `plutil` reports a missing key on stdout on some machines and on stderr on
# others -- it was stderr here and stdout on the CI runner -- so silencing one
# channel let the error text through as the count on the other. Checking the
# shape of the answer does not depend on which channel it arrived by.
capability_count() {
  local n
  n="$(plutil -extract capabilities raw -o - "$1" 2>/dev/null)" || n=""
  case "$n" in
    "" | *[!0-9]*) echo 0 ;;
    *) echo "$n" ;;
  esac
}

# How many allowedOrigins an app.json lists. Same reading rules as above.
origin_count() {
  local n
  n="$(plutil -extract allowedOrigins raw -o - "$1" 2>/dev/null)" || n=""
  case "$n" in
    "" | *[!0-9]*) echo 0 ;;
    *) echo "$n" ;;
  esac
}

self_test() {
  local failures=0
  check() {
    local url="$1" expected="$2" got
    if [ -n "$(url_problem "$url")" ]; then got="reject"; else got="accept"; fi
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
  check "https://app.example.com/?x=1#a"      accept
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
  # Credentials in the URL must not hide the host behind an @. Written without
  # a password because a CI log masks anything shaped like one, and a masked
  # line in the one place these rules are read is worse than no line.
  check "https://someone@localhost/"          reject

  # Every one of these passed the guard before a reviewer wrote them down. They
  # are each a different way of spelling an address the rules already refuse.
  check "https://LOCALHOST/"                  reject
  check "https://LocalHost:5173/"             reject
  check "https://Example.LOCAL/"              reject
  check "https://[FD00::1]/"                  reject
  check "https://my-mac.local./"              reject
  check "https://localhost?x=1"               reject
  check "https://localhost#a"                 reject
  check "https://localhost?u=a@example.com"   reject
  check "https://2130706433/"                 reject
  check "https://[::ffff:127.0.0.1]/"         reject
  check "https://[0:0:0:0:0:0:0:1]/"          reject

  # The counts, against real files, because the bug they had was in reading
  # plutil's output rather than in any rule.
  local dir
  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' RETURN
  count_check() {
    local what="$1" label="$2" json="$3" expected="$4" got
    printf '%s' "$json" > "$dir/app.json"
    got="$("${what}_count" "$dir/app.json")"
    if [ "$got" != "$expected" ]; then
      echo "  FAIL $what $label -> $got, wanted $expected" >&2
      failures=$((failures + 1))
    else
      echo "  ok   $what $label -> $got"
    fi
  }
  count_check capability "none"    '{"capabilities":[]}'                    0
  count_check capability "one"     '{"capabilities":["haptics"]}'           1
  count_check capability "two"     '{"capabilities":["haptics","badging"]}' 2
  count_check capability "missing" '{}'                                     0
  # Both of these make plutil fail and print why. Which channel it prints on
  # differs between machines, so these are what keep the answer a number
  # rather than an error message that happened to arrive on stdout.
  count_check capability "not json" 'this is not a plist at all'            0
  # A capabilities value that is not a list prints as itself, which is not a
  # number, so it reads as none and warns. That is the right end of the two:
  # AppConfiguration refuses to decode it, so the app shows its failure screen
  # on launch, and the guard has no business calling that a release blocker.
  count_check capability "not a list" '{"capabilities":"haptics"}'          0
  count_check origin "none"    '{"allowedOrigins":[]}'                      0
  count_check origin "two"     '{"allowedOrigins":["https://a.test","https://b.test"]}' 2
  count_check origin "missing" '{}'                                         0

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

# Everything but Debug is checked, rather than Release alone. A future
# configuration -- Staging, AppStore -- would otherwise skip every rule here
# while being exactly the kind of build that must not carry a dev address.
configuration="${CONFIGURATION:-Debug}"
if [ "$configuration" = "Debug" ]; then
  echo "check-release-config: Debug build, nothing to check"
  stamp
  exit 0
fi

config="${SRCROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/Build/Resources/app.json"
if [ ! -f "$config" ]; then
  echo "error: no app.json at $config. Run native/scripts/select-app.sh first." >&2
  exit 1
fi

status=0

start_url="$(plutil -extract startURL raw -o - "$config")"
problem="$(url_problem "$start_url")"
if [ -n "$problem" ]; then
  echo "error: this $configuration build starts at $start_url, and $problem." >&2
  echo "note: set startURL to the address the app ships against." >&2
  status=1
fi

# Every allowed origin, not only the start URL. One left behind is what hands a
# page on the user's current network the bridge, over plain http, because
# NSAllowsLocalNetworking is on in this build too.
origins="$(origin_count "$config")"
index=0
while [ "$index" -lt "$origins" ]; do
  origin="$(plutil -extract "allowedOrigins.$index" raw -o - "$config" 2>/dev/null || echo "")"
  if [ -n "$origin" ]; then
    problem="$(url_problem "$origin")"
    if [ -n "$problem" ]; then
      echo "error: allowedOrigins has $origin, and $problem." >&2
      echo "note: any host on that address would be served this app's bridge." >&2
      status=1
    fi
  fi
  index=$((index + 1))
done

capabilities="$(capability_count "$config")"
if [ "$capabilities" -eq 0 ]; then
  echo "warning: this app turns on no capabilities, so it does nothing a browser cannot." >&2
  echo "note: App Store guideline 4.2 rejects an app that is only a web view." >&2
fi

if [ "$status" -eq 0 ]; then
  echo "check-release-config: OK - $start_url, $origins allowed origin(s)"
  stamp
fi
exit "$status"
