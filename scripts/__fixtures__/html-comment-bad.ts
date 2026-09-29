/**
 * Fixture for `scripts/check-html-comments.mjs --self-test`.
 *
 * Every FLAG-* marker below must be reported; every KEEP-* marker must not be.
 * This file is never compiled and never rendered — it exists so the scanner is
 * proved before it is trusted.
 */
// @ts-nocheck
/* eslint-disable */
import { html, css } from 'lit';

// KEEP-TS-COMMENT — a TypeScript comment beside a template is the whole point
// of the rule. It must never be flagged.
const plain = html`
  <!-- FLAG-PLAIN a comment on its own line -->
  <p>hello</p>
  <ul>
    ${[1, 2].map(i => html`<li>${i}</li>`)}
  </ul>
  <!-- FLAG-AFTER-NESTED the walk has to survive the nested template above -->
  <!--
    FLAG-MULTILINE a comment that spans
    more than one line
  -->
`;

const fast = html<Thing>`
  <!-- FLAG-FAST a FAST template carries a type argument on the opener -->
  <p>hi</p>
`;

const styles = css`
  /* KEEP-CSS a CSS comment is a different rule's problem */
  p {
    color: red;
  }
`;

// KEEP-STRING — markup inside an ordinary string literal reaches no reader.
const assertion = '<!-- KEEP-STRING -->';

// KEEP-LIT-MARKER — lit's hydration markers written as data, for a test that
// strips them. They are not authored prose and never come from a template here.
const marker = '<!--lit-part KEEP-LIT-MARKER-->';

export { plain, fast, styles, assertion, marker };
