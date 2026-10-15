# lunar-javascript 1.7.7 — browser ESM

- Upstream: https://github.com/6tail/lunar-javascript
- Source: https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/lunar.js
- License: MIT; retain LICENSE
- Original SHA-256: 9750324BFE1AA63C146F8C72B1143DF924466C11C8A5277D7D9225C541A18AAA

The original UMD wrapper is replaced with an immediately invoked function assigned
to `engine`, followed by `export const { Solar } = engine`. The factory body and
calculation algorithms are unchanged. This avoids browser globals and a bundler.
The byte-identical upstream source is retained in tests/vendor for comparison.

Application adapter: js/saju-calculator.js. It applies fixed UTC+9 year/month
boundaries, midnight-based day/hour handling, Korean lunar conversion via the
separate calendar module, and uncertainty handling near solar terms.
