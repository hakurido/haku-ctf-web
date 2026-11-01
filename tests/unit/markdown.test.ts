// src/lib/markdown.ts (through tests/preserve/subjects.ts): the in-house
// skill.md parser. It returns a block tree that React renders as text, so
// "HTML escaping" means no input character becomes markup: every `<` from the
// input ends up inside a text, code, or math value. No server.
//
// Not tested here, because HEAD doesn't do it yet (exploration owns it):
// removing the two decorative emoji from heading text (M-12, R-45), mapping
// \gg and \times (R-46), and the docs page's load-error branch, which lives in
// src/app/docs/page.tsx rather than in a pure module at HEAD. New-tab `rel`
// is set by the renderer component, not by the parser.
//
// **Validates: Requirements 3.17, 3.2**

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { readRepoFile } from "../support/source.ts";
import { parseMarkdown, texToNodes, type MarkdownBlock } from "../preserve/subjects.ts";

const BLOCK_TYPES = new Set(["heading", "paragraph", "list", "code", "math", "rule", "literal"]);
const INLINE_TYPES = new Set(["text", "strong", "code", "link", "math"]);

type Node = { type: string; [k: string]: unknown };

/** Walks blocks, list items, and inline children. */
function walk(blocks: readonly unknown[], visit: (node: Node, kind: "block" | "inline") => void): void {
  const inline = (nodes: unknown): void => {
    for (const n of (nodes as Node[] | undefined) ?? []) {
      visit(n, "inline");
      inline(n.children);
    }
  };
  for (const b of blocks as Node[]) {
    visit(b, "block");
    if (b.type === "list") for (const item of b.items as unknown[][]) walk(item, visit);
    else inline(b.children);
  }
}

/** Every content string in the tree (text, code, math), not ids or hrefs. */
function contentStrings(blocks: readonly unknown[]): string[] {
  const out: string[] = [];
  walk(blocks, (n) => {
    for (const k of ["value", "tex"]) if (typeof n[k] === "string") out.push(n[k] as string);
  });
  return out;
}

function inlineText(children: unknown): string {
  return ((children as Node[]) ?? []).map((c) => (typeof c.value === "string" ? c.value : inlineText(c.children))).join("");
}

const only = (blocks: MarkdownBlock[]): Node => {
  assert.equal(blocks.length, 1, JSON.stringify(blocks));
  return blocks[0] as unknown as Node;
};

describe("markdown: blocks", () => {
  it("maps #, ##, ### to h2, h3, h4 with slug ids", () => {
    const blocks = parseMarkdown("# Gate One\n\n## Gate Two\n\n### Gate Three") as unknown as Node[];
    assert.deepEqual(
      blocks.map((b) => [b.type, b.level, b.id, inlineText(b.children)]),
      [
        ["heading", 2, "gate-one", "Gate One"],
        ["heading", 3, "gate-two", "Gate Two"],
        ["heading", 4, "gate-three", "Gate Three"],
      ],
    );
  });

  it("drops a leading emoji from heading ids", () => {
    const blocks = parseMarkdown("## 🎯 Protocol Overview\n\n## 🏆 Submitting Flags to Scoreboard") as unknown as Node[];
    assert.deepEqual(blocks.map((b) => b.id), ["protocol-overview", "submitting-flags-to-scoreboard"]);
  });

  it("parses lists, inline code, bold, and https links", () => {
    const list = only(parseMarkdown("* one\n* two `code`"));
    assert.equal(list.type, "list");
    const items = list.items as Node[][];
    assert.equal(items.length, 2);
    assert.equal(inlineText(items[0][0].children), "one");
    const second = items[1][0].children as Node[];
    assert.ok(second.some((c) => c.type === "code" && c.value === "code"));
    const para = only(parseMarkdown("Read **this** at `https://ctf.hakudigital.tech/skill.md` now."));
    const kids = para.children as Node[];
    assert.ok(kids.some((c) => c.type === "strong" && inlineText(c.children) === "this"));
    const link = kids.find((c) => c.type === "link");
    assert.equal(link?.href, "https://ctf.hakudigital.tech/skill.md");
  });

  it("keeps fenced code verbatim with its language", () => {
    const code = only(parseMarkdown('```bash\ncurl -X POST "$BASE/api/gate1/chat" -d \'{"prompt": "**x**"}\'\n```'));
    assert.equal(code.type, "code");
    assert.equal(code.lang, "bash");
    assert.equal(code.value, 'curl -X POST "$BASE/api/gate1/chat" -d \'{"prompt": "**x**"}\'');
  });

  it("turns a $$ line into a math block and --- into a rule", () => {
    const blocks = parseMarkdown("$$X_{n+1} = (A \\cdot X_n + C)$$\n\n---") as unknown as Node[];
    assert.deepEqual(blocks.map((b) => b.type), ["math", "rule"]);
    assert.equal(blocks[0].tex, "X_{n+1} = (A \\cdot X_n + C)");
  });

  it("keeps <script> as text", () => {
    const para = only(parseMarkdown("<script>alert(1)</script>"));
    assert.equal(para.type, "paragraph");
    assert.equal(inlineText(para.children), "<script>alert(1)</script>");
  });

  it("typesets the skill.md recurrence without literal TeX commands", () => {
    const nodes = texToNodes("X_{n+1} = (A \\cdot X_n + C) \\pmod{2^{64}}");
    assert.ok(nodes);
    const flat = JSON.stringify(nodes);
    assert.ok(!flat.includes("\\\\"), flat);
    assert.deepEqual(nodes[0], { type: "var", name: "X" });
    assert.equal(nodes[1].type, "sub");
  });
});

describe("markdown: skill.md", () => {
  it("parses public/skill.md into known blocks with unique heading ids and no literal Markdown in text", () => {
    const blocks = parseMarkdown(readRepoFile("public/skill.md"));
    const ids: string[] = [];
    walk(blocks, (n, kind) => {
      assert.ok((kind === "block" ? BLOCK_TYPES : INLINE_TYPES).has(n.type), `known ${kind} type ${n.type}`);
      if (n.type === "heading") ids.push(n.id as string);
      if (n.type === "text") {
        const v = n.value as string;
        assert.ok(!v.includes("**") && !v.includes("$$") && !v.includes("```"), `literal Markdown in text: ${v}`);
      }
    });
    assert.ok(ids.length >= 6);
    assert.equal(new Set(ids).size, ids.length, "heading ids are unique");
    assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)), JSON.stringify(ids));
  });
});

describe("markdown: properties", () => {
  it("no input character becomes markup: every < stays inside a content value, every node type is known, links are http(s)", () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom("<", ">", "&", "*", "`", "$", "#", "-", " ", "\n", "a", "1", "h", "t", "p", "s", ":", "/") , maxLength: 80 }), (src) => {
        const blocks = parseMarkdown(src);
        walk(blocks, (n, kind) => {
          assert.ok((kind === "block" ? BLOCK_TYPES : INLINE_TYPES).has(n.type), `unknown ${kind} type ${n.type}`);
          if (n.type === "link") assert.match(n.href as string, /^https?:\/\//);
        });
        const count = (s: string) => s.split("<").length - 1;
        assert.equal(contentStrings(blocks).reduce((sum, s) => sum + count(s), 0), count(src));
      }),
      { numRuns: 500 },
    );
  });

  it("plain text without Markdown syntax renders as itself (property)", () => {
    const plain = fc.stringMatching(/^[A-Za-z0-9](?:[A-Za-z0-9,.;:!?'"()<>&_=+ ]{0,60}[A-Za-z0-9.!?)])?$/);
    fc.assert(
      fc.property(plain, (text) => {
        const para = only(parseMarkdown(text));
        assert.equal(para.type, "paragraph");
        assert.ok((para.children as Node[]).every((c) => c.type === "text"));
        assert.equal(inlineText(para.children), text);
      }),
      { numRuns: 300 },
    );
  });
});
