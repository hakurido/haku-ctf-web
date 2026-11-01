// WCAG 2.x contrast math, CSS color parsing, and OKLCH -> sRGB conversion.
// Pure functions, no DOM. Channels are 0-255 (not rounded unless stated);
// alpha is 0-1.

export type RGB = readonly [number, number, number];
export type RGBA = readonly [number, number, number, number];

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Luminance and ratio
// ---------------------------------------------------------------------------

/** sRGB channel 0-255 -> linear 0-1, using the WCAG 2.x formula (threshold 0.03928). */
export function srgbChannelToLinear(channel255: number): number {
  const c = clamp(channel255, 0, 255) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an sRGB color (channels 0-255). */
export function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * srgbChannelToLinear(rgb[0]) +
    0.7152 * srgbChannelToLinear(rgb[1]) +
    0.0722 * srgbChannelToLinear(rgb[2])
  );
}

/** WCAG contrast ratio (1-21) between two opaque colors. Order doesn't matter. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composites `top` (with alpha) over the opaque `bottom`. */
export function composite(top: RGBA, bottom: RGB): RGB {
  const a = clamp(top[3], 0, 1);
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a)];
}

/** Composites a stack of layers, bottom first, over an opaque base (default white, like a browser canvas). */
export function compositeStack(layersBottomFirst: readonly RGBA[], base: RGB = [255, 255, 255]): RGB {
  return layersBottomFirst.reduce<RGB>((acc, layer) => composite(layer, acc), base);
}

/** WCAG large text: at least 24px, or at least 18.66px (14pt) and bold (weight >= 700). */
export function isLargeText(fontSizePx: number, fontWeight: number | string): boolean {
  const w = typeof fontWeight === "string" ? (fontWeight === "bold" ? 700 : Number.parseInt(fontWeight, 10)) : fontWeight;
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && w >= 700);
}

/** Required text contrast: 3 for large text, 4.5 otherwise. */
export function requiredTextRatio(fontSizePx: number, fontWeight: number | string): 3 | 4.5 {
  return isLargeText(fontSizePx, fontWeight) ? 3 : 4.5;
}

/** Non-text contrast threshold (borders, state indicators, focus rings), WCAG 1.4.11. */
export const NON_TEXT_RATIO = 3;

// ---------------------------------------------------------------------------
// OKLab / OKLCH -> sRGB (Björn Ottosson's matrices, as in CSS Color 4)
// ---------------------------------------------------------------------------

/** Linear-light sRGB 0-1 -> gamma-encoded 0-1. */
export function linearToSrgb(c: number): number {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  return sign * (abs <= 0.0031308 ? 12.92 * abs : 1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
}

/** OKLab -> linear sRGB (unclamped, 0-1 when in gamut). */
export function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export interface SrgbConversion {
  /** Gamma-encoded sRGB, channels 0-255, clamped, not rounded. */
  rgb: RGB;
  /** True when no channel needed clamping (tolerance 1e-4 in 0-1 units). */
  inGamut: boolean;
}

/** OKLCH (L 0-1, C >= 0, hue in degrees) -> sRGB. */
export function oklchToSrgb(L: number, C: number, hueDeg: number): SrgbConversion {
  const h = (hueDeg * Math.PI) / 180;
  const lin = oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
  const enc = lin.map(linearToSrgb);
  const eps = 1e-4;
  const inGamut = enc.every((v) => v >= -eps && v <= 1 + eps);
  return { rgb: [clamp(enc[0], 0, 1) * 255, clamp(enc[1], 0, 1) * 255, clamp(enc[2], 0, 1) * 255], inGamut };
}

/** Rounds channels to 8-bit integers. */
export function round8(rgb: RGB): [number, number, number] {
  return [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2])];
}

/** "#rrggbb" from channels 0-255 (rounded). */
export function toHex(rgb: RGB): string {
  return "#" + round8(rgb).map((v) => clamp(v, 0, 255).toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// CSS color parsing
// ---------------------------------------------------------------------------

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa. */
export function parseHex(hex: string): RGBA {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m || ![3, 4, 6, 8].includes(m[1].length)) throw new Error(`Not a hex color: ${hex}`);
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = (i: number): number => Number.parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
}

function parseNumberOrPercent(token: string, percentScale: number): number {
  if (token === "none") return 0;
  if (token.endsWith("%")) return (Number.parseFloat(token) / 100) * percentScale;
  const v = Number.parseFloat(token);
  if (Number.isNaN(v)) throw new Error(`Bad color component ${token}`);
  return v;
}

function parseHue(token: string): number {
  if (token === "none") return 0;
  const v = Number.parseFloat(token);
  if (token.endsWith("turn")) return v * 360;
  if (token.endsWith("grad")) return v * 0.9;
  if (token.endsWith("rad") && !token.endsWith("grad")) return (v * 180) / Math.PI;
  return v;
}

function splitArgs(inner: string): { parts: string[]; alpha: string | null } {
  const [main, alpha] = inner.split("/").map((s) => s.trim());
  const parts = main.includes(",") ? main.split(",").map((s) => s.trim()) : main.split(/\s+/);
  if (parts.length === 4 && alpha === undefined) return { parts: parts.slice(0, 3), alpha: parts[3] };
  return { parts, alpha: alpha ?? null };
}

/**
 * Parses a CSS color: hex, rgb()/rgba(), oklch(), oklab(), `color(srgb ...)`,
 * or "transparent". Returns RGBA with channels 0-255 (unrounded) and alpha 0-1.
 * Throws for anything else (named colors other than transparent, var(), etc.).
 */
export function parseCssColor(input: string): RGBA {
  const s = input.trim().toLowerCase();
  if (s === "transparent") return [0, 0, 0, 0];
  if (s.startsWith("#")) return parseHex(s);
  const fn = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!fn) throw new Error(`Unsupported CSS color: ${input}`);
  const [, name, inner] = fn;
  if (name === "color") {
    const [space, ...rest] = inner.trim().split(/\s+/);
    if (space !== "srgb") throw new Error(`Unsupported color() space: ${space}`);
    const { parts, alpha } = splitArgs(rest.join(" "));
    const a = alpha === null ? 1 : parseNumberOrPercent(alpha, 1);
    return [parseNumberOrPercent(parts[0], 1) * 255, parseNumberOrPercent(parts[1], 1) * 255, parseNumberOrPercent(parts[2], 1) * 255, a];
  }
  const { parts, alpha } = splitArgs(inner);
  const a = alpha === null ? 1 : parseNumberOrPercent(alpha, 1);
  if (name === "rgb" || name === "rgba") {
    return [parseNumberOrPercent(parts[0], 255), parseNumberOrPercent(parts[1], 255), parseNumberOrPercent(parts[2], 255), a];
  }
  if (name === "oklch") {
    const L = parseNumberOrPercent(parts[0], 1);
    const C = parseNumberOrPercent(parts[1], 0.4);
    const H = parseHue(parts[2]);
    const { rgb } = oklchToSrgb(L, C, H);
    return [rgb[0], rgb[1], rgb[2], a];
  }
  if (name === "oklab") {
    const L = parseNumberOrPercent(parts[0], 1);
    const A = parseNumberOrPercent(parts[1], 0.4);
    const B = parseNumberOrPercent(parts[2], 0.4);
    const enc = oklabToLinearSrgb(L, A, B).map(linearToSrgb).map((v) => clamp(v, 0, 1) * 255);
    return [enc[0], enc[1], enc[2], a];
  }
  throw new Error(`Unsupported CSS color function: ${name}()`);
}

/** Drops alpha (for opaque tokens). */
export function opaque(c: RGBA): RGB {
  return [c[0], c[1], c[2]];
}

// ---------------------------------------------------------------------------
// globals.css tokens
// ---------------------------------------------------------------------------

/**
 * Collects every `--name: value;` custom property declared in `css`, without
 * comments. Later declarations win. Keys keep their leading "--".
 */
export function parseCustomProperties(css: string): Record<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Record<string, string> = {};
  for (const m of clean.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/**
 * Color tokens from globals.css: every `--color-<name>` custom property,
 * keyed by `<name>` ("canvas", "fg-muted", ...), with `var(--x)` references
 * resolved. Values that aren't parseable colors are skipped.
 */
export function parseColorTokens(css: string): Record<string, RGBA> {
  const props = parseCustomProperties(css);
  const resolve = (value: string, depth = 0): string => {
    const v = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*(.+))?\)$/.exec(value.trim());
    if (!v) return value;
    if (depth > 10) throw new Error(`var() cycle at ${value}`);
    const target = props[v[1]] ?? v[2];
    if (target === undefined) throw new Error(`Unresolved ${v[1]}`);
    return resolve(target, depth + 1);
  };
  const out: Record<string, RGBA> = {};
  for (const [key, raw] of Object.entries(props)) {
    if (!key.startsWith("--color-")) continue;
    try {
      out[key.slice("--color-".length)] = parseCssColor(resolve(raw));
    } catch {
      // not a plain color value
    }
  }
  return out;
}

/** Contrast between two tokens; `fg` may be translucent and is composited over the opaque `bg`. */
export function tokenContrast(tokens: Record<string, RGBA>, fg: string, bg: string): number {
  const f = tokens[fg];
  const b = tokens[bg];
  if (!f) throw new Error(`Unknown color token ${fg}`);
  if (!b) throw new Error(`Unknown color token ${bg}`);
  const base = opaque(b);
  return contrastRatio(composite(f, base), base);
}
