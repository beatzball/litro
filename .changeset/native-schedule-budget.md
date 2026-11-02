---
'@beatzball/litro-native': patch
---

`notifications.schedule` inside the native shell now sends the id and its own wait time with the call. When you pass no `id`, the page makes one, so a call that times out still tells you which reminder it may have scheduled: the error carries it as `err.data.id`, and you can cancel it or retry with it. The shell uses the wait time to schedule nothing after the page has stopped waiting.

`secureStorage` rejects an empty key, or a key or value that is not well-formed text, with `INVALID_PARAMS`, on the web and in the shell alike. Before, the web accepted an empty key that the shell refused. Inside the shell the keychain is now one store per origin, as browser storage is.
