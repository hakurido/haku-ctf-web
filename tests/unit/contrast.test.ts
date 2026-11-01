// X08: token contrast. Reads the color tokens from src/app/globals.css (the
// working tree, so the check runs on HEAD and after the fix), converts OKLCH
// to sRGB, and checks every foreground/background pair the design's Contrast
// table declares against its WCAG 2.x minimum. No server.
//
// **Validates: Requirements 2.5, 3.17**

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readRepoFile } from "../support/source.ts";
import { contrastRatio, oklchToSrgb, parseColorTokens, parseCustomProperties, tokenContrast } from "../support/contrast.ts";

/** [foreground, background, minimum] from the design's Contrast table. */
const PAIRS: readonly [string, string, 3 | 4.5][] = [
  ["fg", "canvas", 4.5],
  ["fg", "surface", 4.5],
  ["fg", "inset", 4.5],
  ["fg", "surface-hover", 4.5],
  ["fg", "accent-subtle", 4.5],
  ["fg", "success-subtle", 4.5],
  ["fg", "error-subtle", 4.5],
  ["fg", "warning-subtle", 4.5],
  ["fg-secondary", "canvas", 4.5],
  ["fg-secondary", "surface", 4.5],
  ["fg-secondary", "inset", 4.5],
  ["fg-secondary", "surface-hover", 4.5],
  ["fg-secondary", "success-subtle", 4.5],
  ["fg-secondary", "error-subtle", 4.5],
  ["fg-secondary", "warning-subtle", 4.5],
  ["fg-muted", "canvas", 4.5],
  ["fg-muted", "surface", 4.5],
  ["fg-muted", "inset", 4.5],
  ["fg-muted", "surface-hover", 4.5],
  ["accent", "canvas", 4.5],
  ["accent", "surface", 4.5],
  ["accent", "inset", 4.5],
  ["accent", "surface-hover", 4.5],
  ["accent", "accent-subtle", 4.5],
  ["accent-hover", "canvas", 4.5],
  ["accent-hover", "surface", 4.5],
  ["success", "canvas", 4.5],
  ["success", "surface", 4.5],
  ["success", "inset", 4.5],
  ["success", "success-subtle", 4.5],
  ["error", "canvas", 4.5],
  ["error", "surface", 4.5],
  ["error", "inset", 4.5],
  ["error", "error-subtle", 4.5],
  ["warning", "canvas", 4.5],
  ["warning", "surface", 4.5],
  ["warning", "inset", 4.5],
  ["warning", "warning-subtle", 4.5],
  ["on-accent", "accent", 4.5],
  ["on-accent", "accent-hover", 4.5],
  ["on-accent", "accent-active", 4.5],
  ["line-control", "canvas", 3],
  ["line-control", "surface", 3],
  ["line-control", "inset", 3],
  ["line-control", "surface-hover", 3],
  ["focus", "canvas", 3],
  ["focus", "surface", 3],
  ["focus", "inset", 3],
  ["focus", "surface-hover", 3],
];

const css = readRepoFile("src/app/globals.css");
const tokens = parseColorTokens(css);

describe("X08: token contrast from globals.css", () => {
  it("defines every token the contrast table uses", () => {
    const names = new Set(PAIRS.flatMap(([f, b]) => [f, b]));
    for (const n of names) assert.ok(tokens[n], `--color-${n} is defined and parses`);
  });

  it("every declared pair meets its WCAG minimum", () => {
    const failing = PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, ratio: +tokenContrast(tokens, fg, bg).toFixed(2) })).filter((p) => p.ratio < p.min);
    assert.deepEqual(failing, []);
  });

  it("OKLCH tokens are inside the sRGB gamut, so the ratios hold on every display", () => {
    const props = parseCustomProperties(css);
    for (const [key, value] of Object.entries(props)) {
      if (!key.startsWith("--color-")) continue;
      const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
      if (!m) continue;
      assert.ok(oklchToSrgb(Number(m[1]), Number(m[2]), Number(m[3])).inGamut, `${key}: ${value}`);
    }
  });

  it("the WCAG math matches known values", () => {
    assert.equal(+contrastRatio([0, 0, 0], [255, 255, 255]).toFixed(2), 21);
    assert.equal(+contrastRatio([119, 119, 119], [255, 255, 255]).toFixed(2), 4.48);
  });
});
