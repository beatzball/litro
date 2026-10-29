---
"@beatzball/litro": patch
---

Update `satori` to 0.33.5 and `seroval` to 1.7.3, clearing four security advisories published on 2026-10-27 and 2026-10-28. Open Graph images render byte-for-byte the same after the satori update: the only API changes across the range are optional new options, and the font this package ships is a static instance, so the variable-font handling added upstream does not apply.
