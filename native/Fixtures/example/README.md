# example

A store-shaped app that exists only so CI can build the shell for Release.
It is never shipped. `example.com` is reserved for documentation (RFC 2606),
so it can never be the name of someone else's app.

The release guard refuses the demo on purpose, because the demo starts at a
dev server. A Release build therefore needs an app with an https origin, an
icon and a bundle identifier, and a real app keeps its folder in its own
repository, which CI here cannot read. This folder is that app, written down.

It opts in to App-Bound Domains, so CI can assert that the key reaches a
Release build and a Debug build (NATIVE-021).

`select-app.sh` copies only `app.json` and `Assets.xcassets` into the build,
so this file stays out of the bundle.
