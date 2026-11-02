---
'@beatzball/litro-native': minor
---

Talk to the Litro native shell. Inside the iOS shell, every capability the shell's build compiled in now goes to the shell over the bridge protocol, after a handshake, and every capability it left out takes its web behavior. A call made before the handshake answers waits for it. Every call has a timeout, so no promise is left pending.

Inside the shell, `secureStorage` never falls back to browser storage, even on a build without the keychain module: there it reads `null` and writes nothing. So checking `isNative` before writing a token stays enough to keep it out of browser storage.

A rejection is now a `NativeBridgeError`, exported with `ERROR_CODES`, so an app can tell a declined permission (`isPermissionDenied`) or a timeout (`isTimeout`) from a fault.
