---
'@beatzball/litro-native': minor
---

New package: native device capabilities behind one interface, with an honest web
fallback for each.

`haptics.impact('light')` is a device buzz in a native app, a vibrate in an
Android browser, and silent in iOS Safari, with no branch at the call site. The
same holds for the app icon badge, the share sheet, secure storage, local
notifications and a review request.

This first release ships the web path, which is useful on its own: Android web
haptics and the web app badge work today. Two fallbacks are deliberately empty
because the web has no equivalent — a local notification cannot be scheduled for
a closed page, and a store review cannot be requested — so `supports()` reports
them as unavailable rather than failing at the call. Browser storage stands in
for the keychain, which is not secure; the README says so at the call site.

Nothing native is imported or read while a module is evaluated, so the package is
safe to import from a page that renders on the server.
