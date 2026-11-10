#!/bin/bash
#
# Copies one app's folder into the place the Xcode build reads, and writes the
# build settings that folder implies.
#
# Two apps differ only by data: this script is what turns that data into a build.
# Run it before building, or the app target has no app.json and the shell stops
# on its failure screen.
#
#   native/scripts/select-app.sh demo
#   native/scripts/select-app.sh --self-test   # the rules, checked
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
SHIPPED=(app.json Assets.xcassets)

# A version as App Store Connect accepts it: one to three whole numbers joined
# by dots. The same shape holds for the build number (CFBundleVersion).
VERSION_SHAPE='^[0-9]+(\.[0-9]+){0,2}$'

available() {
  find "$1" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | sed 's/^/  /'
}

# Selects <app> from <apps> into <out>. Returns non-zero, with the reason on
# stderr, and leaves <out> alone when the app cannot be selected.
#
# Everything is validated BEFORE <out> is cleared, so a bad app.json never
# leaves the build without any app at all.
select_app() {
  local apps="$1" out="$2" app="$3"
  local source_dir="$apps/$app"

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

  # plutil reports a missing key on stdout on some machines and stderr on
  # others (NATIVE-014), so the exit code decides, never the text.
  read_key() {
    local value
    if ! value="$(plutil -extract "$1" raw -o - "$config" 2>/dev/null)"; then
      echo "select-app: $config has no '$1'" >&2
      return 1
    fi
    printf '%s' "$value"
  }

  local name bundle_id version build
  name="$(read_key name)" || return 1
  bundle_id="$(read_key bundleIdentifier)" || return 1
  # Read but not used in a setting: reading it here is what makes a config
  # missing a start URL fail now, at selection, rather than on the device.
  read_key startURL >/dev/null || return 1
  # Per app, because two apps do not share a version, and in app.json rather
  # than only on a command line, so the number that shipped is in the history.
  # An xcodebuild command line can still override either for one build
  # (MARKETING_VERSION=... CURRENT_PROJECT_VERSION=...), because a command-line
  # setting outranks an xcconfig.
  version="$(read_key version)" || return 1
  build="$(read_key build)" || return 1
  if ! [[ "$version" =~ $VERSION_SHAPE ]]; then
    echo "select-app: $config has version '$version'; use one to three whole numbers, such as 1.0.0" >&2
    return 1
  fi
  if ! [[ "$build" =~ $VERSION_SHAPE ]]; then
    echo "select-app: $config has build '$build'; use one to three whole numbers, such as 7" >&2
    return 1
  fi

  # The icon is the asset catalog's AppIcon set, when the folder has one. An
  # app without one still builds, and the release guard refuses to ship it.
  local icon_line="// No icon: Apps/$app has no Assets.xcassets/AppIcon.appiconset." icon="none"
  if [ -f "$source_dir/Assets.xcassets/AppIcon.appiconset/Contents.json" ]; then
    icon_line="ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon"
    icon="AppIcon"
  fi

  # Everything from a previous selection goes first. Leaving a stale file
  # behind is how an app ships with another app's icon.
  rm -rf "$out"
  mkdir -p "$out/Resources"
  local entry skipped=()
  for entry in "$source_dir"/* "$source_dir"/.[!.]*; do
    [ -e "$entry" ] || continue
    local base
    base="$(basename "$entry")"
    if [[ " ${SHIPPED[*]} " == *" $base "* ]]; then
      cp -R "$entry" "$out/Resources/"
    else
      skipped+=("$base")
    fi
  done

  # The per-app build settings, as a file Xcode reads rather than a value typed
  # into the project. The project file then carries no per-app logic at all.
  cat > "$out/App.xcconfig" <<CONFIG
// Written by native/scripts/select-app.sh from Apps/$app/app.json.
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
CONFIG

  echo "select-app: $app"
  echo "  name    : $name"
  echo "  bundle  : $bundle_id"
  echo "  version : $version ($build)"
  echo "  icon    : $icon"
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

  local base='"name":"T","bundleIdentifier":"com.example.t","startURL":"https://t.example/"'
  echo "select-app: self-test"
  fixture good "{$base,\"version\":\"1.2.3\",\"build\":\"7\"}"
  expect "a complete app.json" accept good
  assert "MARKETING_VERSION" "$(setting MARKETING_VERSION)" "1.2.3"
  assert "CURRENT_PROJECT_VERSION" "$(setting CURRENT_PROJECT_VERSION)" "7"
  assert "no icon set, no icon setting" "$(setting ASSETCATALOG_COMPILER_APPICON_NAME)" ""

  fixture numbers "{$base,\"version\":\"2.0\",\"build\":12}"
  expect "a build number written as a number" accept numbers
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
  fixture nostart '{"name":"T","bundleIdentifier":"com.example.t","version":"1","build":"1"}'
  expect "no startURL" reject nostart
  expect "an app that does not exist" reject no-such-app

  # A rejected selection leaves the previous one in place.
  select_app "$dir/apps" "$dir/out" good >/dev/null
  select_app "$dir/apps" "$dir/out" badversion >/dev/null 2>&1 || true
  assert "a rejected app keeps the previous selection" "$(setting LITRO_APP)" "good"

  # The icon, and what is shipped.
  fixture icon "{$base,\"version\":\"1\",\"build\":\"1\"}"
  mkdir -p "$dir/apps/icon/Assets.xcassets/AppIcon.appiconset" "$dir/apps/icon/notes"
  printf '{}' > "$dir/apps/icon/Assets.xcassets/AppIcon.appiconset/Contents.json"
  printf 'x' > "$dir/apps/icon/README.md"
  printf 'x' > "$dir/apps/icon/.DS_Store"
  printf 'x' > "$dir/apps/icon/icon-source.png"
  expect "an app with an icon and stray files" accept icon
  assert "ASSETCATALOG_COMPILER_APPICON_NAME" "$(setting ASSETCATALOG_COMPILER_APPICON_NAME)" "AppIcon"
  assert "what reached the bundle" "$(cd "$dir/out/Resources" && ls -A | LC_ALL=C sort | tr '\n' ' ')" "Assets.xcassets app.json "

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
  echo "usage: $(basename "$0") <app>" >&2
  echo "       $(basename "$0") --self-test" >&2
  echo "apps in $here/Apps:" >&2
  available "$here/Apps" >&2
  exit 2
fi

select_app "$here/Apps" "$here/Build" "$1"
