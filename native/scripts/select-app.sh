#!/bin/bash
#
# Copies one app's folder into the place the Xcode build reads, and writes the
# build settings that folder implies.
#
# Two apps differ only by data: this script is what turns that data into a build.
# Run it before building, or the app target has no app.json and the shell stops
# on its failure screen.
#
#   native/scripts/select-app.sh demo                      # a folder in native/Apps
#   native/scripts/select-app.sh ../my-app/native/my-app   # a folder anywhere else
#   native/scripts/select-app.sh --self-test               # the rules, checked
#
# A real app keeps its folder in its own repository, beside its site, so its
# identity, icon and build number change with the app and not with the shell.
# native/Apps holds the demo. An argument with a slash in it is a path.
#
# Nothing here depends on a tool that is not already on a Mac. `plutil` reads
# JSON and ships with the system, so the shell keeps its promise of no
# third-party build-time dependency.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# What an app folder may put in the bundle. Everything else in the folder -- a
# README, a source image, a stray .DS_Store -- stays out of the app. An
# allowlist rather than a list of exclusions, because the bundle is what ships
# and the next unexpected file should be left out by default, not by luck.
#
#   app.json         the configuration the shell reads at launch
#   Assets.xcassets  the asset catalog; Xcode compiles it, it is not copied raw
#
# The list is the `case` in select_app, spelled out, so it compares exact names.

# A version as App Store Connect accepts it: one to three whole numbers joined
# by dots. The same shape holds for the build number (CFBundleVersion).
VERSION_SHAPE='^[0-9]+(\.[0-9]+){0,2}$'

# A bundle identifier App Store Connect accepts: letters, digits and hyphens,
# in two or more dot-separated parts, no part starting or ending with a hyphen.
BUNDLE_ID_SHAPE='^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$'

# A host that may be listed as an App-Bound domain: lowercase DNS labels, or a
# dotted IPv4 address. Nothing else is accepted, because each host reaches
# Info.plist through the C preprocessor (NATIVE-021), and a bracketed IPv6
# literal has never been tried there.
BOUND_HOST_SHAPE='^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$'

# WebKit's documented limit on App-Bound Domains. The iOS 26.5 simulator still
# honored an eleventh entry, but a limit Apple documents is the one a device
# may enforce, so it is enforced here.
BOUND_HOST_LIMIT=10

# An app's name is its folder's name, and it becomes PRODUCT_NAME: the
# executable's file name and the app module's name. Lowercase letters and
# digits only, because a folder outside this repository is named by someone
# who has not read this, and a space or a dot survives into paths and signing.
APP_NAME_SHAPE='^[a-z][a-z0-9]*$'

# scheme://host[:port], lowercased, with a default port dropped, or nothing
# when the URL has no scheme and host. The same comparison AppConfiguration
# makes: whole origins, never prefixes.
origin_of() {
  local url="$1" scheme host
  [[ "$url" =~ ^([A-Za-z][A-Za-z0-9+.-]*)://([^/?#]+) ]] || return 0
  scheme="$(printf '%s' "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]')"
  host="$(printf '%s' "${BASH_REMATCH[2]##*@}" | tr '[:upper:]' '[:lower:]')"
  case "$scheme:$host" in
    https:*:443) host="${host%:443}" ;;
    http:*:80) host="${host%:80}" ;;
  esac
  printf '%s://%s' "$scheme" "$host"
}

# Refuses an icon set App Store Connect would refuse, with the reason on
# stderr: exactly one image, named in Contents.json, present, 1024 by 1024,
# and with no alpha channel -- refused even when every pixel is opaque.
icon_problem_of() {
  local set="$1" manifest="$1/Contents.json" count file width height alpha
  if [ ! -f "$manifest" ]; then
    echo "select-app: $set has no Contents.json" >&2
    return 1
  fi
  if [ "$(plutil -type images "$manifest" 2>/dev/null)" != array ] \
     || ! count="$(plutil -extract images raw -o - "$manifest" 2>/dev/null)" || [ "$count" != 1 ]; then
    echo "select-app: $manifest must list exactly one image, the 1024x1024 universal icon" >&2
    return 1
  fi
  if [ "$(plutil -type images.0.filename "$manifest" 2>/dev/null)" != string ]; then
    echo "select-app: $manifest names no image file" >&2
    return 1
  fi
  file="$set/$(plutil -extract images.0.filename raw -o - "$manifest")"
  if [ ! -f "$file" ]; then
    echo "select-app: $manifest names $(basename "$file"), which is not in the icon set" >&2
    return 1
  fi
  width="$(sips -g pixelWidth "$file" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$file" 2>/dev/null | awk '/pixelHeight/ {print $2}')"
  alpha="$(sips -g hasAlpha "$file" 2>/dev/null | awk '/hasAlpha/ {print $2}')"
  if [ "$width" != 1024 ] || [ "$height" != 1024 ]; then
    echo "select-app: $(basename "$file") is ${width:-?}x${height:-?}; the icon must be 1024x1024" >&2
    return 1
  fi
  if [ "$alpha" != no ]; then
    echo "select-app: $(basename "$file") has an alpha channel (hasAlpha: ${alpha:-?}); App Store Connect refuses one even when every pixel is opaque" >&2
    return 1
  fi
}

available() {
  find "$1" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | sed 's/^/  /'
}

# Turns the command line's one argument into the folder that holds the app and
# the app's name, in app_parent and app_name. A name is a folder in Apps/; an
# argument with a slash is a path to the app's folder, relative or absolute.
locate_app() {
  local arg="$1"
  case "$arg" in
    */*)
      if [ ! -d "$arg" ]; then
        echo "select-app: no folder at '$1'" >&2
        return 1
      fi
      app_parent="$(cd "$(dirname "$arg")" && pwd)"
      app_name="$(basename "$arg")"
      ;;
    *)
      app_parent="$here/Apps"
      app_name="$arg"
      ;;
  esac
}

# Selects <app> from <apps> into <out>. Returns non-zero, with the reason on
# stderr, and leaves <out> alone when the app cannot be selected.
#
# Everything is validated BEFORE <out> is cleared, so a bad app.json never
# leaves the build without any app at all.
select_app() {
  local apps="$1" out="$2" app="$3"
  local source_dir="$apps/$app"

  if ! [[ "$app" =~ $APP_NAME_SHAPE ]]; then
    echo "select-app: '$app' cannot name an app; the folder's name becomes the executable's name, so use lowercase letters and digits" >&2
    return 1
  fi

  # A typo must stop the build, not produce a shell with the wrong app in it.
  if [ ! -d "$source_dir" ]; then
    echo "select-app: no app named '$app'" >&2
    echo "apps in $apps:" >&2
    available "$apps" >&2
    return 1
  fi

  local config="$source_dir/app.json"
  if [ ! -f "$config" ]; then
    echo "select-app: '$app' has no app.json" >&2
    return 1
  fi

  # Reads one value, and refuses it unless its JSON type is one of <types>.
  #
  # The type is checked BEFORE the raw value is read, because `plutil -extract
  # raw` converts silently: an array comes back as its length and a real as
  # "1.500000". `"build": [99]` once selected build 1 that way, with the
  # app.json in the bundle still saying 99.
  #
  # plutil reports a missing key on stdout on some machines and stderr on
  # others (NATIVE-014), so the exit code decides, and the type must be one
  # of plutil's own words, never whatever text came back.
  read_typed() {
    local key="$1" types="$2" type value
    if ! type="$(plutil -type "$key" "$config" 2>/dev/null)"; then
      echo "select-app: $config has no '$key'" >&2
      return 1
    fi
    case " $types " in
      *" $type "*) ;;
      *)
        echo "select-app: $config has '$key' of type $type; it must be of type ${types// / or }" >&2
        return 1 ;;
    esac
    if ! value="$(plutil -extract "$key" raw -o - "$config" 2>/dev/null)"; then
      echo "select-app: $config has no '$key'" >&2
      return 1
    fi
    printf '%s' "$value"
  }

  local name bundle_id start_url version build
  name="$(read_typed name string)" || return 1
  if [ -z "${name//[[:space:]]/}" ]; then
    echo "select-app: $config has an empty name; it is the label under the home screen icon" >&2
    return 1
  fi
  # The one value that can never change after the first upload, so it is
  # checked here rather than at signing: letters, digits and hyphens, in two
  # or more parts separated by dots, no part starting or ending with a hyphen.
  bundle_id="$(read_typed bundleIdentifier string)" || return 1
  if ! [[ "$bundle_id" =~ $BUNDLE_ID_SHAPE ]]; then
    echo "select-app: $config has bundleIdentifier '$bundle_id'; use letters, digits and hyphens in dot-separated parts, such as com.example.app" >&2
    return 1
  fi
  # Per app, because two apps do not share a version, and in app.json rather
  # than only on a command line, so the number that shipped is in the history.
  # An xcodebuild command line can still override either for one build
  # (MARKETING_VERSION=... CURRENT_PROJECT_VERSION=...), because a command-line
  # setting outranks an xcconfig. A version is customer-visible text, so it
  # must be a string; a build number may be a string or a whole number.
  version="$(read_typed version string)" || return 1
  build="$(read_typed build "string integer")" || return 1
  if ! [[ "$version" =~ $VERSION_SHAPE ]]; then
    echo "select-app: $config has version '$version'; use one to three whole numbers, such as 1.0.0" >&2
    return 1
  fi
  if ! [[ "$build" =~ $VERSION_SHAPE ]]; then
    echo "select-app: $config has build '$build'; use one to three whole numbers, such as 7" >&2
    return 1
  fi

  # The start URL must be one of the allowed origins, or the origin policy
  # cancels the first navigation and the app opens to a white screen
  # (NATIVE-018). AppConfiguration still checks this at launch; this says so
  # at selection instead. Capability names are NOT checked here: a third copy
  # of the protocol's list, in bash, is the drift NATIVE-008 exists to prevent.
  start_url="$(read_typed startURL string)" || return 1
  local start_origin count index entry_origin covered=no hosts=()
  start_origin="$(origin_of "$start_url")"
  if [ -z "$start_origin" ]; then
    echo "select-app: $config has startURL '$start_url', which has no scheme and host" >&2
    return 1
  fi
  read_typed allowedOrigins array >/dev/null || return 1
  count="$(plutil -extract allowedOrigins raw -o - "$config")"
  index=0
  while [ "$index" -lt "$count" ]; do
    local entry_url
    entry_url="$(read_typed "allowedOrigins.$index" string)" || return 1
    entry_origin="$(origin_of "$entry_url")"
    [ "$entry_origin" = "$start_origin" ] && covered=yes
    # The host alone, for App-Bound Domains: no scheme, no port. Kept even when
    # empty, so an entry that is not an origin is refused below by name.
    local entry_host="${entry_origin#*://}"
    hosts+=("${entry_host%:[0-9]*}")
    index=$((index + 1))
  done
  if [ "$covered" != yes ]; then
    echo "select-app: $config starts at $start_url, but allowedOrigins does not include $start_origin" >&2
    return 1
  fi

  # App-Bound Domains, only when the app asks for them (NATIVE-021). They are
  # what lets WKWebView run a site's service worker, and so play offline. The
  # hosts are not a second list in app.json: they are the hosts of
  # allowedOrigins, because once the key is declared an origin missing from it
  # fails to load, and two lists would drift.
  local bound="none" bound_defs="" bound_type host slot=0 listed=" "
  if bound_type="$(plutil -type appBoundDomains "$config" 2>/dev/null)"; then
    if [ "$bound_type" != bool ]; then
      echo "select-app: $config has 'appBoundDomains' of type $bound_type; it must be true or false" >&2
      return 1
    fi
    if [ "$(plutil -extract appBoundDomains raw -o - "$config")" = true ]; then
      bound_defs="LITRO_APP_BOUND_DOMAINS=1"
      for host in "${hosts[@]}"; do
        # DNS reads a trailing dot as the same name, but whether WebKit matches
        # a listed name to a page host spelled with the dot was not measured.
        # Refused by name, so the fix is obvious, rather than guessed at.
        case "$host" in *.)
          echo "select-app: $config sets appBoundDomains, and allowedOrigins has the host '$host' with a trailing dot; write it without the dot" >&2
          return 1 ;;
        esac
        if ! [[ "$host" =~ $BOUND_HOST_SHAPE ]]; then
          echo "select-app: $config sets appBoundDomains, and allowedOrigins has an entry whose host '$host' cannot be an App-Bound domain; use a scheme and a DNS name or an IPv4 address" >&2
          return 1
        fi
        # Two origins on one host, such as two ports, are one domain.
        case "$listed" in *" $host "*) continue ;; esac
        listed="$listed$host "
        bound_defs="$bound_defs LITRO_APP_BOUND_DOMAIN_$slot=$host"
        slot=$((slot + 1))
      done
      if [ "$slot" -gt "$BOUND_HOST_LIMIT" ]; then
        echo "select-app: $config sets appBoundDomains with $slot hosts; WebKit allows at most $BOUND_HOST_LIMIT App-Bound domains" >&2
        return 1
      fi
      bound="$(printf '%s' "${listed# }" | sed 's/ $//')"
    fi
  fi
  local bound_line="LITRO_INFOPLIST_DEFINITIONS = $bound_defs"

  # The icon is the asset catalog's AppIcon set, when the folder has one, and
  # it is checked down to the pixels here, because nothing later can be
  # trusted to. The release guard runs sandboxed and may only stat the set
  # (NATIVE-019). Xcode builds a set whose image is missing with one warning
  # and ships no icon at all; and it compiles an image with an alpha channel,
  # which App Store Connect refuses.
  local icon_line="// No icon: $source_dir has no Assets.xcassets/AppIcon.appiconset." icon="none"
  local icon_set="$source_dir/Assets.xcassets/AppIcon.appiconset"
  if [ -d "$icon_set" ]; then
    icon_problem_of "$icon_set" || return 1
    icon_line="ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon"
    icon="AppIcon"
  fi

  # Everything from a previous selection goes first. Leaving a stale file
  # behind is how an app ships with another app's icon.
  rm -rf "$out"
  mkdir -p "$out/Resources"
  local entry base skipped=()
  for entry in "$source_dir"/* "$source_dir"/.[!.]*; do
    [ -e "$entry" ] || continue
    base="$(basename "$entry")"
    # Exact names. A membership test over a joined string let a file named
    # "app.json Assets.xcassets" through.
    case "$base" in
      app.json|Assets.xcassets) cp -R "$entry" "$out/Resources/" ;;
      *) skipped+=("$base") ;;
    esac
  done

  # The per-app build settings, as a file Xcode reads rather than a value typed
  # into the project. The project file then carries no per-app logic at all.
  cat > "$out/App.xcconfig" <<CONFIG
// Written by native/scripts/select-app.sh from $source_dir/app.json.
// Do not edit, and do not commit: run the script instead.
LITRO_APP = $app
// PRODUCT_NAME becomes the executable's file name, so it is the folder name and
// never the display name: a space in it survives into paths and signing.
PRODUCT_NAME = $app
PRODUCT_BUNDLE_IDENTIFIER = $bundle_id
// The home screen label. Info.plist reads it through CFBundleDisplayName.
LITRO_APP_DISPLAY_NAME = $name
MARKETING_VERSION = $version
CURRENT_PROJECT_VERSION = $build
$icon_line
// App-Bound Domains (NATIVE-021), as Info.plist preprocessor definitions,
// because an xcconfig cannot hold a plist array. Empty unless app.json sets
// appBoundDomains.
$bound_line
CONFIG

  echo "select-app: $app"
  echo "  from    : ${source_dir#"$PWD"/}"
  echo "  name    : $name"
  echo "  bundle  : $bundle_id"
  echo "  version : $version ($build)"
  echo "  icon    : $icon"
  echo "  bound   : $bound"
  if [ "${#skipped[@]}" -gt 0 ]; then
    echo "  not shipped: ${skipped[*]}"
  fi
  echo "  into    : ${out#"$PWD"/}"
}

self_test() {
  local dir failures=0
  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' RETURN

  fixture() {
    local app="$1" json="$2"
    mkdir -p "$dir/apps/$app"
    printf '%s' "$json" > "$dir/apps/$app/app.json"
  }
  expect() {
    local label="$1" want="$2" app="$3" got
    if select_app "$dir/apps" "$dir/out" "$app" >"$dir/log" 2>&1; then got="accept"; else got="reject"; fi
    if [ "$got" != "$want" ]; then
      echo "  FAIL $label -> $got, wanted $want" >&2
      sed 's/^/       /' "$dir/log" >&2
      failures=$((failures + 1))
    else
      echo "  ok   $label -> $got"
    fi
  }
  # Rejected, and for this reason. Two checks can refuse the same bad file,
  # so a rejection alone does not prove the check named in the label ran.
  refuse() {
    local label="$1" app="$2" reason="$3"
    if select_app "$dir/apps" "$dir/out" "$app" >"$dir/log" 2>&1; then
      echo "  FAIL $label -> accept, wanted reject ($reason)" >&2
      failures=$((failures + 1))
    elif ! grep -qF -- "$reason" "$dir/log"; then
      echo "  FAIL $label -> rejected, but not for: $reason" >&2
      sed 's/^/       /' "$dir/log" >&2
      failures=$((failures + 1))
    else
      echo "  ok   $label -> reject ($reason)"
    fi
  }
  setting() { grep -E "^$1 = " "$dir/out/App.xcconfig" | sed "s/^$1 = //"; }
  assert() {
    local label="$1" got="$2" want="$3"
    if [ "$got" != "$want" ]; then
      echo "  FAIL $label -> '$got', wanted '$want'" >&2
      failures=$((failures + 1))
    else
      echo "  ok   $label -> '$got'"
    fi
  }
  # A real PNG, so the icon checks run on pixels and not on a stand-in.
  # Standard library only, run isolated (-I).
  png() {
    python3 -I - "$1" "$2" "$3" <<'PY'
import struct, sys, zlib
path, size, mode = sys.argv[1], int(sys.argv[2]), sys.argv[3]
channels, color = (4, 6) if mode == "rgba" else (3, 2)
row = b"\x00" + b"\x40\x20\x60\xff"[:channels] * size
def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
with open(path, "wb") as f:
    f.write(b"\x89PNG\r\n\x1a\n")
    f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, color, 0, 0, 0)))
    f.write(chunk(b"IDAT", zlib.compress(row * size, 1)))
    f.write(chunk(b"IEND", b""))
PY
  }
  icon_set() {
    local app="$1" manifest="$2"
    mkdir -p "$dir/apps/$app/Assets.xcassets/AppIcon.appiconset"
    printf '%s' "$manifest" > "$dir/apps/$app/Assets.xcassets/AppIcon.appiconset/Contents.json"
  }
  local one_image='{"images":[{"filename":"icon.png","idiom":"universal","platform":"ios","size":"1024x1024"}]}'

  local base='"name":"T","bundleIdentifier":"com.example.t","startURL":"https://t.example/","allowedOrigins":["https://t.example"]'
  echo "select-app: self-test"
  fixture good "{$base,\"version\":\"1.2.3\",\"build\":\"7\"}"
  expect "a complete app.json" accept good
  assert "MARKETING_VERSION" "$(setting MARKETING_VERSION)" "1.2.3"
  assert "CURRENT_PROJECT_VERSION" "$(setting CURRENT_PROJECT_VERSION)" "7"
  assert "no icon set, no icon setting" "$(setting ASSETCATALOG_COMPILER_APPICON_NAME)" ""

  fixture numbers "{$base,\"version\":\"2.0\",\"build\":12}"
  expect "a build number written as a whole number" accept numbers
  assert "CURRENT_PROJECT_VERSION from a number" "$(setting CURRENT_PROJECT_VERSION)" "12"

  fixture noversion "{$base,\"build\":\"1\"}"
  expect "no version" reject noversion
  fixture nobuild "{$base,\"version\":\"1.0\"}"
  expect "no build" reject nobuild
  fixture badversion "{$base,\"version\":\"1.0-beta\",\"build\":\"1\"}"
  expect "a version with a suffix" reject badversion
  fixture fourparts "{$base,\"version\":\"1.0.0.0\",\"build\":\"1\"}"
  expect "a four-part version" reject fourparts
  fixture badbuild "{$base,\"version\":\"1.0\",\"build\":\"7a\"}"
  expect "a build that is not a number" reject badbuild
  # plutil -extract raw turns an array into its length and a real into
  # "1.500000". Each of these once selected a value the file did not say.
  fixture buildarray "{$base,\"version\":\"1.0.0\",\"build\":[99]}"
  refuse "a build that is an array" buildarray "'build' of type array"
  fixture versionarray "{$base,\"version\":[\"bad\"],\"build\":\"1\"}"
  refuse "a version that is an array" versionarray "'version' of type array"
  fixture buildreal "{$base,\"version\":\"1.0.0\",\"build\":1.5}"
  refuse "a build that is a real number" buildreal "'build' of type float"
  fixture versionnumber "{$base,\"version\":1,\"build\":\"1\"}"
  refuse "a version that is a number, not text" versionnumber "'version' of type integer"

  local rest='"version":"1","build":"1"'
  fixture nostart "{\"name\":\"T\",\"bundleIdentifier\":\"com.example.t\",\"allowedOrigins\":[\"https://t.example\"],$rest}"
  expect "no startURL" reject nostart
  fixture emptyname "{\"name\":\"  \",\"bundleIdentifier\":\"com.example.t\",\"startURL\":\"https://t.example/\",\"allowedOrigins\":[\"https://t.example\"],$rest}"
  refuse "an empty name" emptyname "an empty name"
  fixture underscore "{\"name\":\"T\",\"bundleIdentifier\":\"com.example_t\",\"startURL\":\"https://t.example/\",\"allowedOrigins\":[\"https://t.example\"],$rest}"
  refuse "a bundle identifier with an underscore" underscore "has bundleIdentifier"
  fixture onepart "{\"name\":\"T\",\"bundleIdentifier\":\"example\",\"startURL\":\"https://t.example/\",\"allowedOrigins\":[\"https://t.example\"],$rest}"
  refuse "a one-part bundle identifier" onepart "has bundleIdentifier"
  fixture notallowed "{\"name\":\"T\",\"bundleIdentifier\":\"com.example.t\",\"startURL\":\"https://t.example/\",\"allowedOrigins\":[\"https://other.example\"],$rest}"
  refuse "a startURL its allowedOrigins do not cover" notallowed "allowedOrigins does not include"
  fixture prefix "{\"name\":\"T\",\"bundleIdentifier\":\"com.example.t\",\"startURL\":\"https://t.example.evil.test/\",\"allowedOrigins\":[\"https://t.example\"],$rest}"
  refuse "an origin that only shares a prefix" prefix "allowedOrigins does not include"
  fixture spelling "{\"name\":\"T\",\"bundleIdentifier\":\"com.example.t\",\"startURL\":\"HTTPS://T.example:443/play\",\"allowedOrigins\":[\"https://t.example/\"],$rest}"
  expect "the same origin spelled differently" accept spelling
  fixture noorigins "{\"name\":\"T\",\"bundleIdentifier\":\"com.example.t\",\"startURL\":\"https://t.example/\",$rest}"
  expect "no allowedOrigins" reject noorigins
  expect "an app that does not exist" reject no-such-app

  # App-Bound Domains (NATIVE-021): off unless asked for, and when asked for,
  # the hosts of allowedOrigins and nothing else.
  local who='"name":"T","bundleIdentifier":"com.example.t","startURL":"https://t.example/"'
  fixture boundabsent "{$who,\"allowedOrigins\":[\"https://t.example\"],$rest}"
  expect "no appBoundDomains" accept boundabsent
  assert "no appBoundDomains, no definitions" "$(setting LITRO_INFOPLIST_DEFINITIONS)" ""
  fixture boundfalse "{$who,\"allowedOrigins\":[\"https://t.example\"],\"appBoundDomains\":false,$rest}"
  expect "appBoundDomains false" accept boundfalse
  assert "appBoundDomains false, no definitions" "$(setting LITRO_INFOPLIST_DEFINITIONS)" ""
  fixture boundtrue "{$who,\"allowedOrigins\":[\"https://t.example\",\"https://T.Example:8443\",\"http://localhost:5173\",\"http://192.168.1.20:5173\"],\"appBoundDomains\":true,$rest}"
  expect "appBoundDomains true" accept boundtrue
  assert "hosts of allowedOrigins, lowercased, one per host, no ports" \
    "$(setting LITRO_INFOPLIST_DEFINITIONS)" \
    "LITRO_APP_BOUND_DOMAINS=1 LITRO_APP_BOUND_DOMAIN_0=t.example LITRO_APP_BOUND_DOMAIN_1=localhost LITRO_APP_BOUND_DOMAIN_2=192.168.1.20"
  fixture boundstring "{$who,\"allowedOrigins\":[\"https://t.example\"],\"appBoundDomains\":\"yes\",$rest}"
  refuse "appBoundDomains that is text" boundstring "'appBoundDomains' of type string"
  # plutil reads a JSON null as type "(any)", and that must not pass as absent.
  fixture boundnull "{$who,\"allowedOrigins\":[\"https://t.example\"],\"appBoundDomains\":null,$rest}"
  refuse "appBoundDomains that is null" boundnull "'appBoundDomains' of type"
  fixture bounddot "{$who,\"allowedOrigins\":[\"https://t.example\",\"https://cdn.example.\"],\"appBoundDomains\":true,$rest}"
  refuse "an App-Bound host with a trailing dot" bounddot "with a trailing dot"
  fixture boundipv6 "{$who,\"allowedOrigins\":[\"https://t.example\",\"http://[::1]:5173\"],\"appBoundDomains\":true,$rest}"
  refuse "an IPv6 literal as an App-Bound domain" boundipv6 "cannot be an App-Bound domain"
  fixture boundnoscheme "{$who,\"allowedOrigins\":[\"https://t.example\",\"app.example.com\"],\"appBoundDomains\":true,$rest}"
  refuse "an allowedOrigins entry with no scheme" boundnoscheme "cannot be an App-Bound domain"
  local ten='"https://t.example"' eleven i
  for i in 1 2 3 4 5 6 7 8 9; do ten="$ten,\"https://h$i.example\""; done
  eleven="$ten,\"https://h10.example\""
  fixture boundten "{$who,\"allowedOrigins\":[$ten],\"appBoundDomains\":true,$rest}"
  expect "ten App-Bound domains" accept boundten
  fixture boundeleven "{$who,\"allowedOrigins\":[$eleven],\"appBoundDomains\":true,$rest}"
  refuse "eleven App-Bound domains" boundeleven "at most 10"
  # Eleven origins on ten hosts is ten domains.
  fixture boundtenhosts "{$who,\"allowedOrigins\":[$ten,\"https://t.example:8443\"],\"appBoundDomains\":true,$rest}"
  expect "eleven origins on ten hosts" accept boundtenhosts

  # A rejected selection leaves the previous one in place.
  select_app "$dir/apps" "$dir/out" good >/dev/null
  select_app "$dir/apps" "$dir/out" badversion >/dev/null 2>&1 || true
  assert "a rejected app keeps the previous selection" "$(setting LITRO_APP)" "good"

  # An app's folder outside native/Apps, the way a real app keeps it: a path,
  # relative or absolute, with or without a trailing slash. Its name is the
  # folder's name.
  local app_parent app_name
  mkdir -p "$dir/elsewhere/repo/native/outside"
  cp "$dir/apps/good/app.json" "$dir/elsewhere/repo/native/outside/"
  locate_app "$dir/elsewhere/repo/native/outside/"
  assert "an absolute path names its folder" "$app_parent|$app_name" "$dir/elsewhere/repo/native|outside"
  app_parent="" app_name=""
  locate_app "$(cd "$dir/elsewhere" && pwd)/repo/native/outside"
  assert "a path with no trailing slash" "$app_name" "outside"
  (cd "$dir/elsewhere/repo" && locate_app native/outside && printf '%s|%s' "$app_parent" "$app_name") > "$dir/located"
  assert "a relative path resolves from where the script runs" "$(cat "$dir/located")" "$dir/elsewhere/repo/native|outside"
  if select_app "$app_parent" "$dir/out" "$app_name" > "$dir/log" 2>&1; then
    assert "an app from outside native/Apps is selected" "$(setting LITRO_APP)" "outside"
  else
    echo "  FAIL an app from outside native/Apps -> reject" >&2
    sed 's/^/       /' "$dir/log" >&2
    failures=$((failures + 1))
  fi
  locate_app demo
  assert "a bare name is a folder in native/Apps" "$app_parent|$app_name" "$here/Apps|demo"
  if locate_app "$dir/elsewhere/nothing" 2> "$dir/log"; then
    echo "  FAIL a path to no folder -> accept" >&2
    failures=$((failures + 1))
  else
    assert "a path to no folder is refused" "$(grep -c "no folder at" "$dir/log")" "1"
  fi
  fixture Outside "{$base,$rest}"
  refuse "a folder name with a capital letter" Outside "cannot name an app"
  fixture "two.parts" "{$base,$rest}"
  refuse "a folder name with a dot" "two.parts" "cannot name an app"

  # The icon, down to its pixels. Each rejecting shape here built and shipped
  # with no usable icon before these checks existed.
  fixture icon "{$base,$rest}"
  icon_set icon "$one_image"
  png "$dir/apps/icon/Assets.xcassets/AppIcon.appiconset/icon.png" 1024 rgb
  printf 'x' > "$dir/apps/icon/README.md"
  printf 'x' > "$dir/apps/icon/.DS_Store"
  printf 'x' > "$dir/apps/icon/app.json Assets.xcassets"
  mkdir -p "$dir/apps/icon/notes"
  expect "an app with a valid icon and stray files" accept icon
  assert "ASSETCATALOG_COMPILER_APPICON_NAME" "$(setting ASSETCATALOG_COMPILER_APPICON_NAME)" "AppIcon"
  assert "what reached the bundle" "$(cd "$dir/out/Resources" && ls -A | LC_ALL=C sort | tr '\n' '|')" "Assets.xcassets|app.json|"

  fixture emptyset "{$base,$rest}"
  icon_set emptyset '{}'
  refuse "an icon set that lists no image" emptyset "must list exactly one image"
  fixture missingfile "{$base,$rest}"
  icon_set missingfile "$one_image"
  refuse "an icon set whose image is missing" missingfile "which is not in the icon set"
  fixture alpha "{$base,$rest}"
  icon_set alpha "$one_image"
  png "$dir/apps/alpha/Assets.xcassets/AppIcon.appiconset/icon.png" 1024 rgba
  refuse "an icon with an alpha channel" alpha "has an alpha channel"
  fixture small "{$base,$rest}"
  icon_set small "$one_image"
  png "$dir/apps/small/Assets.xcassets/AppIcon.appiconset/icon.png" 512 rgb
  refuse "a 512 icon" small "is 512x512"
  fixture notpng "{$base,$rest}"
  icon_set notpng "$one_image"
  printf 'not an image' > "$dir/apps/notpng/Assets.xcassets/AppIcon.appiconset/icon.png"
  refuse "an icon file that is not an image" notpng "the icon must be 1024x1024"
  fixture noset "{$base,$rest}"
  mkdir -p "$dir/apps/noset/Assets.xcassets/AppIcon.appiconset"
  refuse "an icon set with no Contents.json" noset "has no Contents.json"

  if [ "$failures" -ne 0 ]; then
    echo "select-app: self-test FAILED, $failures of them" >&2
    exit 1
  fi
  echo "select-app: self-test OK"
}

if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit 0
fi

if [ "$#" -ne 1 ]; then
  echo "usage: $(basename "$0") <app in native/Apps>" >&2
  echo "       $(basename "$0") <path to an app's folder>" >&2
  echo "       $(basename "$0") --self-test" >&2
  echo "apps in $here/Apps:" >&2
  available "$here/Apps" >&2
  exit 2
fi

locate_app "$1" || exit 1
select_app "$app_parent" "$here/Build" "$app_name"
