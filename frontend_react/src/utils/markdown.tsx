import React from 'react';

type Node = { type: 'text' | 'codeblock' | 'inlinecode' | 'bold' | 'italic' | 'br'; value?: string };

function parseMarkdown(input: string): Node[] {
  const nodes: Node[] = [];
  const lines = input.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      nodes.push({ type: 'codeblock', value: buf.join('\n') });
      // skip closing ```
      i++;
      continue;
    }
    // Basic inline parsing for bold/italic/inlinecode
    const parts: Node[] = [];
    let rest = line;
    while (rest.length) {
      const idxCode = rest.indexOf('`');
      const idxBold = rest.indexOf('**');
      const idxItalic = rest.indexOf('*');

      const candidates = [idxCode, idxBold, idxItalic].filter((x) => x >= 0);
      if (candidates.length === 0) {
        parts.push({ type: 'text', value: rest });
        break;
      }
      const next = Math.min(...candidates);
      if (next > 0) {
        parts.push({ type: 'text', value: rest.slice(0, next) });
        rest = rest.slice(next);
      } else {
        // At a marker
        if (rest.startsWith('`')) {
          const end = rest.indexOf('`', 1);
          if (end > 0) {
            parts.push({ type: 'inlinecode', value: rest.slice(1, end) });
            rest = rest.slice(end + 1);
          } else {
            parts.push({ type: 'text', value: rest });
            rest = '';
          }
        } else if (rest.startsWith('**')) {
          const end = rest.indexOf('**', 2);
          if (end > 0) {
            parts.push({ type: 'bold', value: rest.slice(2, end) });
            rest = rest.slice(end + 2);
          } else {
            parts.push({ type: 'text', value: rest });
            rest = '';
          }
        } else if (rest.startsWith('*')) {
          const end = rest.indexOf('*', 1);
          if (end > 0) {
            parts.push({ type: 'italic', value: rest.slice(1, end) });
            rest = rest.slice(end + 1);
          } else {
            parts.push({ type: 'text', value: rest });
            rest = '';
          }
        } else {
          parts.push({ type: 'text', value: rest });
          rest = '';
        }
      }
    }
    parts.forEach((p) => nodes.push(p));
    nodes.push({ type: 'br' });
    i++;
  }
  return nodes;
}

/**
 * PUBLIC_INTERFACE
 * Render minimal markdown safely without external dependencies.
 */
export function Markdown({ content }: { content: string }) {
  const nodes = parseMarkdown(content);
  return (
    <div>
      {nodes.map((n, idx) => {
        if (n.type === 'text') return <span key={idx}>{n.value}</span>;
        if (n.type === 'inlinecode')
          return (
            <code key={idx} style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 6 }}>
              {n.value}
            </code>
          );
        if (n.type === 'bold') return <strong key={idx}>{n.value}</strong>;
        if (n.type === 'italic') return <em key={idx}>{n.value}</em>;
        if (n.type === 'br') return <br key={idx} />;
        if (n.type === 'codeblock')
          return (
            <div key={idx} className="code-block">
              <div className="code-toolbar">
                <button
                  className="code-copy"
                  aria-label="Copy code to clipboard"
                  onClick={() => navigator.clipboard.writeText(n.value || '')}
                >
                  Copy
                </button>
              </div>
              <pre style={{ margin: 0 }}>
                <code>{n.value}</code>
              </pre>
            </div>
          );
        return null;
      })}
    </div>
  );
}
