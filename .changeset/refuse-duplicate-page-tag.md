---
'@beatzball/litro': patch
---

Refuse two page files that derive the same component tag. `pages/index.ts` is special-cased to `page-home`, so adding `pages/home.ts` next to it used to kill the server at startup with `Failed to execute 'define' on 'CustomElementRegistry': the name "page-home" has already been used with this registry`, and `/` went down with `/home`. The page scan now fails first, in `litro dev`, `litro build` and the static build alike, with one clear error that names the tag and every page file that claims it. The root index tag stays `page-home` for now; renaming it to `page-index` is a breaking change deferred to the next major.
