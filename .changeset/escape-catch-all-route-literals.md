---
"@beatzball/create-litro": patch
---

The scaffolded `server/routes/[...].ts` route matcher now escapes the literal
runs between params before it builds a RegExp. Unescaped, a route path such as
`/@[handle]/:statusId` turned `[handle]` into a character class, so six
one-letter handles answered 200 and the real path answered 404 (issue 234).
