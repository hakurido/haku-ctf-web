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

export function slugify(text: string): string {
  // Strip leading emoji
  const stripped = text.replace(/^[\p{Emoji}\p{Extended_Pictographic}\u200d]+\s*/u, "");
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
      const inlines = parseInlines(rawText);
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

export function texToNodes(tex: string): MathNode[] | null {
  const nodes: MathNode[] = [];
  let s = tex.trim();

  // Basic TeX subset parser:
  // e.g. X_{n+1} = (A \cdot X_n + C) \pmod{2^{64}}
  try {
    let idx = 0;
    while (idx < s.length) {
      if (s[idx] === " ") {
        nodes.push({ type: "text", value: " " });
        idx++;
        continue;
      }
      if (s.startsWith("\\cdot", idx)) {
        nodes.push({ type: "text", value: " · " });
        idx += 5;
        continue;
      }
      if (s.startsWith("\\pmod", idx)) {
        idx += 5;
        while (s[idx] === " ") idx++;
        if (s[idx] === "{") {
          let depth = 1;
          let end = idx + 1;
          while (end < s.length && depth > 0) {
            if (s[end] === "{") depth++;
            if (s[end] === "}") depth--;
            end++;
          }
          const inside = s.slice(idx + 1, end - 1);
          const subNodes = texToNodes(inside);
          nodes.push({ type: "text", value: " mod " });
          if (subNodes) nodes.push(...subNodes);
          idx = end;
          continue;
        }
      }
      if (s[idx] === "_") {
        idx++;
        if (s[idx] === "{") {
          let depth = 1;
          let end = idx + 1;
          while (end < s.length && depth > 0) {
            if (s[end] === "{") depth++;
            if (s[end] === "}") depth--;
            end++;
          }
          const inside = s.slice(idx + 1, end - 1);
          const subNodes = texToNodes(inside);
          if (subNodes) nodes.push({ type: "sub", children: subNodes });
          idx = end;
          continue;
        } else {
          const char = s[idx++];
          const charNode: MathNode = /^[a-zA-Z]$/.test(char)
            ? { type: "var", name: char }
            : { type: "text", value: char };
          nodes.push({ type: "sub", children: [charNode] });
          continue;
        }
      }
      if (s[idx] === "^") {
        idx++;
        if (s[idx] === "{") {
          let depth = 1;
          let end = idx + 1;
          while (end < s.length && depth > 0) {
            if (s[end] === "{") depth++;
            if (s[end] === "}") depth--;
            end++;
          }
          const inside = s.slice(idx + 1, end - 1);
          const supNodes = texToNodes(inside);
          if (supNodes) nodes.push({ type: "sup", children: supNodes });
          idx = end;
          continue;
        } else {
          const char = s[idx++];
          const charNode: MathNode = /^[a-zA-Z]$/.test(char)
            ? { type: "var", name: char }
            : { type: "text", value: char };
          nodes.push({ type: "sup", children: [charNode] });
          continue;
        }
      }
      if (/^[a-zA-Z]$/.test(s[idx])) {
        nodes.push({ type: "var", name: s[idx] });
        idx++;
        continue;
      }
      nodes.push({ type: "text", value: s[idx] });
      idx++;
    }
    return nodes;
  } catch {
    return null;
  }
}

export function texToSpeech(tex: string): string | null {
  return tex
    .replace(/\\cdot/g, "times")
    .replace(/\\pmod\{([^}]+)\}/g, "mod $1")
    .replace(/_\{([^}]+)\}/g, "sub $1")
    .replace(/_([a-zA-Z0-9])/g, "sub $1")
    .replace(/\^\{([^}]+)\}/g, "to the power $1")
    .replace(/\^([a-zA-Z0-9])/g, "to the power $1")
    .replace(/\s+/g, " ")
    .trim();
}
