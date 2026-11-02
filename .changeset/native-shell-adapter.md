---
'@beatzball/litro-native': minor
---

Talk to the Litro native shell. Inside the iOS shell, every capability the shell's build compiled in now goes to the shell over the bridge protocol, after a handshake, and every capability it left out takes its web behavior. A call made before the handshake answers waits for it. Every call has a timeout, so no promise is left pending.

When `isNative` is true, a `secureStorage` write reaches the keychain or goes nowhere: the shell bridge never falls back to browser storage, even on a build without the keychain module. A page inside the shell whose handshake failed gets the web bridge and browser storage, with `isNative` false. So gate a token write on `isNative` and nothing else.

A rejection is now a `NativeBridgeError`, exported with `ERROR_CODES`, so an app can tell a declined permission (`isPermissionDenied`) or a timeout (`isTimeout`) from a fault.
