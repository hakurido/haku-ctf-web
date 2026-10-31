import React from "react";
import { Block, Inline, MathNode, texToNodes, texToSpeech } from "@/lib/markdown";

function renderMathNodes(nodes: MathNode[]): React.ReactNode {
  return nodes.map((node, idx) => {
    switch (node.type) {
      case "var":
        return <var key={idx} className="font-mono italic">{node.name}</var>;
      case "text":
        return <span key={idx}>{node.value}</span>;
      case "sub":
        return <sub key={idx} className="text-[0.8em]">{renderMathNodes(node.children)}</sub>;
      case "sup":
        return <sup key={idx} className="text-[0.8em]">{renderMathNodes(node.children)}</sup>;
      default:
        return null;
    }
  });
}

function renderInlines(inlines: Inline[]): React.ReactNode {
  return inlines.map((item, idx) => {
    switch (item.type) {
      case "text":
        return <span key={idx}>{item.value}</span>;
      case "strong":
        return <strong key={idx} className="font-semibold text-fg">{renderInlines(item.children)}</strong>;
      case "code":
        return (
          <code
            key={idx}
            className="rounded-xs border border-line bg-inset px-1.5 py-0.5 font-mono text-code-inline text-fg break-all"
          >
            {item.value}
          </code>
        );
      case "link":
        return (
          <a
            key={idx}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-4 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
          >
            {renderInlines(item.children)}
          </a>
        );
      case "math": {
        const nodes = texToNodes(item.tex);
        if (!nodes) {
          return (
            <code key={idx} className="font-mono text-code-inline text-fg">
              {item.tex}
            </code>
          );
        }
        return (
          <span key={idx} className="font-mono text-code">
            {renderMathNodes(nodes)}
          </span>
        );
      }
      default:
        return null;
    }
  });
}

function renderBlock(block: Block, idx: number): React.ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
      const sizeClass =
        block.level === 2
          ? "text-heading font-semibold text-fg mt-8 mb-3"
          : block.level === 3
          ? "text-title font-semibold text-fg mt-6 mb-2"
          : "text-ui font-semibold text-fg mt-5 mb-2";

      return (
        <Tag key={idx} id={block.id} className={sizeClass}>
          <a
            href={`#${block.id}`}
            className="hover:text-accent hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
          >
            {renderInlines(block.children)}
          </a>
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p key={idx} className="text-body text-fg-secondary leading-relaxed mb-4">
          {renderInlines(block.children)}
        </p>
      );

    case "list":
      return (
        <ul key={idx} className="list-disc pl-6 space-y-2 mb-4 text-ui text-fg-secondary">
          {block.items.map((subBlocks, itemIdx) => (
            <li key={itemIdx} className="leading-relaxed">
              {subBlocks.map((b, bIdx) => renderBlock(b, bIdx))}
            </li>
          ))}
        </ul>
      );

    case "code":
      return (
        <pre
          key={idx}
          tabIndex={0}
          role="group"
          aria-label={block.lang ? `Code example, ${block.lang}` : "Code example"}
          className="rounded-md border border-line bg-inset p-4 font-mono text-code text-fg whitespace-pre overflow-x-auto mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <code>{block.value}</code>
        </pre>
      );

    case "math": {
      const nodes = texToNodes(block.tex);
      const speech = texToSpeech(block.tex);
      return (
        <div
          key={idx}
          className="my-3 p-3 rounded-md border border-line bg-inset font-mono text-code text-fg text-center"
        >
          <span aria-hidden="true">{nodes ? renderMathNodes(nodes) : block.tex}</span>
          {speech && <span className="sr-only">{speech}</span>}
        </div>
      );
    }

    case "rule":
      return <hr key={idx} className="my-6 border-line" />;

    case "literal":
      return (
        <p key={idx} className="text-ui text-fg mb-3">
          {block.value}
        </p>
      );

    default:
      return null;
  }
}

export function SkillDocument({ blocks }: { blocks: Block[] }) {
  return (
    <article className="prose-clean max-w-none">
      {blocks.map((b, idx) => renderBlock(b, idx))}
    </article>
  );
}
