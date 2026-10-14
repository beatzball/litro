---
'@beatzball/litro': patch
---

Bump the `seroval` production dependency from `^1.3.0` to `^1.6.3`, resolving
GHSA-p6vx-979v-rg4c (Critical, CVSS 9.8) and GHSA-jp82-f5mq-hwhp (High, CVSS
7.5). Both advisories land on `fromJSON()`, which the Server Actions serializer
calls on every response it decodes, so this is a reachable path rather than a
baseline entry.
