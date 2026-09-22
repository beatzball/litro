---
'@beatzball/create-litro': patch
---

Two fixes to the supernova recipe's `litro-status-bar`.

The tab row is a div of spans rather than an `ol` of `li` elements. It still carries one `role="img"` and the same sentence, and every tab inside it is still hidden from assistive tech, so nothing is announced differently — but ARIA in HTML does not allow `role="img"` on a list, and axe-core reported `aria-allowed-role` on the prerendered page. A row of fake tabs is a picture, not a list of anything a reader can act on.

The site name is also shortened with an ellipsis when it does not fit. The bar is one line high, so a long name has always been cut on a narrow screen; it now reads as a cut instead of ending mid-letter.
