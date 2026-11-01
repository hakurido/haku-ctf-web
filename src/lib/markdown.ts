export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "math"; tex: string };

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; id: string; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; items: Block[][] }
  | { type: "code"; lang: string | null; value: string }
  | { type: "math"; tex: string }
  | { type: "rule" }
  | { type: "literal"; value: string };

export type MathNode =
  | { type: "var"; name: string }
  | { type: "text"; value: string }
  | { type: "sub"; children: MathNode[] }
  | { type: "sup"; children: MathNode[] };

const seenIds = new Map<string, number>();

/**
 * A leading run of pictographic emoji (with the U+FE0F variation selector and
 * U+200D joiners) plus the whitespace after it. `\p{Emoji}` is not used because
 * it also matches the digits, `#`, and `*`.
 */
const LEADING_EMOJI = /^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u;

export function slugify(text: string): string {
  const stripped = text.replace(LEADING_EMOJI, "");
  // NFKD normalization and lowercase
  let slug = stripped
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) slug = "section";

  const count = seenIds.get(slug) || 0;
  seenIds.set(slug, count + 1);
  if (count > 0) {
    return `${slug}-${count + 1}`;
  }
  return slug;
}

export function resetSlugCounts() {
  seenIds.clear();
}

function parseInlines(text: string): Inline[] {
  const inlines: Inline[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Backtick inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      const codeVal = codeMatch[1];
      if (/^https:\/\/\S+$/.test(codeVal)) {
        inlines.push({
          type: "link",
          href: codeVal,
          children: [{ type: "code", value: codeVal }],
        });
      } else {
        inlines.push({ type: "code", value: codeVal });
      }
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold **...**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      inlines.push({
        type: "strong",
        children: parseInlines(boldMatch[1]),
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Inline math $...$
    const mathMatch = remaining.match(/^\$([^$]+)\$/);
    if (mathMatch) {
      inlines.push({
        type: "math",
        tex: mathMatch[1],
      });
      remaining = remaining.slice(mathMatch[0].length);
      continue;
    }

    // Regular text up to next special char (` * $)
    const nextSpecial = remaining.search(/[`*$]/);
    if (nextSpecial === -1) {
      inlines.push({ type: "text", value: remaining });
      break;
    } else if (nextSpecial === 0) {
      inlines.push({ type: "text", value: remaining[0] });
      remaining = remaining.slice(1);
    } else {
      inlines.push({ type: "text", value: remaining.slice(0, nextSpecial) });
      remaining = remaining.slice(nextSpecial);
    }
  }

  return inlines;
}

/** Drops a leading emoji from the first text inline, so the heading never renders it (A8). */
function stripLeadingEmoji(inlines: Inline[]): Inline[] {
  const first = inlines[0];
  if (!first || first.type !== "text") return inlines;
  const value = first.value.replace(LEADING_EMOJI, "");
  if (value === first.value) return inlines;
  const rest = inlines.slice(1);
  return value ? [{ type: "text", value }, ...rest] : rest;
}

function extractHeadingText(children: Inline[]): string {
  return children
    .map((c) => {
      if (c.type === "text" || c.type === "code") return c.value;
      if (c.type === "strong" || c.type === "link") return extractHeadingText(c.children);
      return "";
    })
    .join("");
}

export function parseMarkdown(source: string): Block[] {
  resetSlugCounts();
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = line.match(/^( *)```(\w*)\s*$/);
    if (fenceMatch) {
      const indent = fenceMatch[1].length;
      const lang = fenceMatch[2] || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^ *```\s*$/)) {
        let codeLine = lines[i];
        if (codeLine.startsWith(" ".repeat(indent))) {
          codeLine = codeLine.slice(indent);
        }
        codeLines.push(codeLine);
        i++;
      }
      i++; // skip closing fence
      blocks.push({
        type: "code",
        lang,
        value: codeLines.join("\n"),
      });
      continue;
    }

    // Thematic break
    if (/^---\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    // Heading: # -> h2, ## -> h3, ### -> h4
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const hashes = headingMatch[1].length;
      const level = (hashes + 1) as 2 | 3 | 4;
      const rawText = headingMatch[2].trim();
      const inlines = stripLeadingEmoji(parseInlines(rawText));
      const plainText = extractHeadingText(inlines);
      const id = slugify(plainText);
      blocks.push({
        type: "heading",
        level,
        id,
        children: inlines,
      });
      i++;
      continue;
    }

    // Display math line $$...$$
    const mathMatch = line.trim().match(/^\$\$(.+)\$\$$/);
    if (mathMatch) {
      blocks.push({
        type: "math",
        tex: mathMatch[1].trim(),
      });
      i++;
      continue;
    }

    // List item * ...
    if (/^ *\* /.test(line)) {
      const listItems: Block[][] = [];

      while (i < lines.length && /^ *\* /.test(lines[i])) {
        const itemLine = lines[i];
        const itemText = itemLine.replace(/^ *\* /, "");
        const itemBlocks: Block[] = [
          { type: "paragraph", children: parseInlines(itemText) },
        ];
        i++;

        // Nested continuation lines (indented >= 2 spaces)
        const nestedLines: string[] = [];
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^ *\* /.test(lines[i]) &&
          /^ {2,}/.test(lines[i])
        ) {
          nestedLines.push(lines[i].replace(/^ {2}/, ""));
          i++;
        }

        if (nestedLines.length > 0) {
          const nestedBlocks = parseMarkdown(nestedLines.join("\n"));
          itemBlocks.push(...nestedBlocks);
        }

        listItems.push(itemBlocks);
      }

      blocks.push({
        type: "list",
        items: listItems,
      });
      continue;
    }

    // Paragraph
    const paraLines: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^---\s*$/.test(lines[i]) &&
      !/^ *\* /.test(lines[i]) &&
      !/^\$\$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    blocks.push({
      type: "paragraph",
      children: parseInlines(paraLines.join(" ")),
    });
  }

  return blocks;
}

/** TeX symbol commands the renderer typesets, with the text each one prints. */
const TEX_SYMBOLS = new Map<string, string>([
  ["cdot", " · "],
  ["times", " × "],
  ["gg", " ≫ "],
]);

/** How each typeset symbol is read aloud. */
const SPOKEN_SYMBOLS = new Map<string, string>([
  ["·", " times "],
  ["×", " times "],
  ["≫", " shifted right by "],
]);

/** The `{…}` group opening at `open`, or null when `open` isn't `{` or the group never closes. */
function readGroup(s: string, open: number): { inside: string; end: number } | null {
  if (s[open] !== "{") return null;
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return { inside: s.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** The argument of `_` or `^` starting at `at`: a `{…}` group or a single character. */
function readScript(s: string, at: number): { nodes: MathNode[]; end: number } | null {
  let i = at;
  while (s[i] === " ") i++;
  if (s[i] === "{") {
    const group = readGroup(s, i);
    if (!group) return null;
    const nodes = texToNodes(group.inside);
    return nodes ? { nodes, end: group.end } : null;
  }
  const char = s[i];
  if (char === undefined || "\\}_^".includes(char)) return null;
  const node: MathNode = /^[a-zA-Z]$/.test(char)
    ? { type: "var", name: char }
    : { type: "text", value: char };
  return { nodes: [node], end: i + 1 };
}

/**
 * Typesets the TeX subset used by skill.md: Latin letters (as variables),
 * digits and punctuation, `_` and `^` scripts, `\cdot`, `\times`, `\gg`, and
 * `\pmod{m}`. Returns null for any other command or an unbalanced group, so
 * the renderer can fall back to showing the raw TeX as code.
 */
export function texToNodes(tex: string): MathNode[] | null {
  const s = tex.trim();
  const nodes: MathNode[] = [];
  let idx = 0;
  while (idx < s.length) {
    const char = s[idx];
    if (char === "\\") {
      const name = /^\\([a-zA-Z]+)/.exec(s.slice(idx))?.[1];
      if (!name) return null;
      idx += name.length + 1;
      const symbol = TEX_SYMBOLS.get(name);
      if (symbol !== undefined) {
        nodes.push({ type: "text", value: symbol });
        continue;
      }
      if (name !== "pmod") return null;
      while (s[idx] === " ") idx++;
      const group = readGroup(s, idx);
      if (!group) return null;
      const modulus = texToNodes(group.inside);
      if (!modulus) return null;
      nodes.push({ type: "text", value: " mod " }, ...modulus);
      idx = group.end;
      continue;
    }
    if (char === "_" || char === "^") {
      const script = readScript(s, idx + 1);
      if (!script) return null;
      nodes.push({ type: char === "_" ? "sub" : "sup", children: script.nodes });
      idx = script.end;
      continue;
    }
    nodes.push(/^[a-zA-Z]$/.test(char) ? { type: "var", name: char } : { type: "text", value: char });
    idx++;
  }
  return nodes;
}

function visibleMath(nodes: MathNode[]): string {
  return nodes
    .map((n) => (n.type === "var" ? n.name : n.type === "text" ? n.value : visibleMath(n.children)))
    .join("");
}

function spokenMath(nodes: MathNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "var") return n.name;
      if (n.type === "text") return n.value.replace(/[·×≫]/g, (c) => SPOKEN_SYMBOLS.get(c) ?? c);
      return `${n.type === "sub" ? " sub " : " to the power "}${spokenMath(n.children)} `;
    })
    .join("");
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/**
 * The spoken form of a supported TeX expression, for example
 * "X sub n shifted right by 16" for `X_n \gg 16`. Returns null when the
 * expression needs no separate spoken text (it reads correctly as typeset) or
 * when `texToNodes` doesn't support it.
 */
export function texToSpeech(tex: string): string | null {
  const nodes = texToNodes(tex);
  if (!nodes) return null;
  const spoken = collapse(spokenMath(nodes));
  return spoken === collapse(visibleMath(nodes)) ? null : spoken;
}
