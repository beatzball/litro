---
'@beatzball/litro': patch
---

fix(content): add rehype-raw to content parser pipeline

HTML blocks containing blank lines (e.g. side-by-side code sections) were being split at
blank line boundaries after remark's MDAST→HAST step. Adding `rehype-raw` to the pipeline
ensures raw HTML blocks are correctly re-parsed as a unit.
