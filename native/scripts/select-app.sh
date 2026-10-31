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
#
# Nothing here depends on a tool that is not already on a Mac. `plutil` reads
# JSON and ships with the system, so the shell keeps its promise of no
# third-party build-time dependency.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
apps="$here/Apps"
out="$here/Build"

available() {
  find "$apps" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | sed 's/^/  /'
}

if [ "$#" -ne 1 ]; then
  echo "usage: $(basename "$0") <app>" >&2
  echo "apps in $apps:" >&2
  available >&2
  exit 2
fi

app="$1"
source_dir="$apps/$app"

# A typo must stop the build, not produce a shell with the wrong app in it.
if [ ! -d "$source_dir" ]; then
  echo "select-app: no app named '$app'" >&2
  echo "apps in $apps:" >&2
  available >&2
  exit 1
fi

config="$source_dir/app.json"
if [ ! -f "$config" ]; then
  echo "select-app: '$app' has no app.json" >&2
  exit 1
fi

read_key() {
  if ! plutil -extract "$1" raw -o - "$config" 2>/dev/null; then
    echo "select-app: $config has no '$1'" >&2
    exit 1
  fi
}

name="$(read_key name)"
bundle_id="$(read_key bundleIdentifier)"
# Read but not used in a setting: reading it here is what makes a config missing
# a start URL fail now, at selection, rather than on the device.
read_key startURL >/dev/null

# Everything from a previous selection goes first. Leaving a stale file behind
# is how an app ships with another app's icon.
rm -rf "$out"
mkdir -p "$out/Resources"
cp -R "$source_dir/." "$out/Resources/"

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
CONFIG

echo "select-app: $app"
echo "  name   : $name"
echo "  bundle : $bundle_id"
echo "  into   : ${out#"$PWD"/}"
