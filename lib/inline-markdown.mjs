const INLINE = /`[^`]+`|\[((?:\\.|[^\]\\])*)\]\(((?:\\.|[^)\\])*)\)|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*/g;

export function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function parseInlineMarkdown(value, allowLinks = true) {
  const text = String(value ?? "");
  const nodes = [];
  let offset = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > offset) nodes.push({ type: "text", text: text.slice(offset, match.index) });
    const raw = match[0];
    if (raw.startsWith("`")) nodes.push({ type: "code", text: raw.slice(1, -1) });
    else if (match[1] !== undefined) {
      const href = safeHttpUrl(match[2].replace(/\\([()\\])/g, "$1"));
      nodes.push(allowLinks && href
        ? { type: "link", href, children: parseInlineMarkdown(match[1].replace(/\\([\[\]\\])/g, "$1"), false) }
        : { type: "text", text: raw });
    } else {
      const count = raw.startsWith("***") ? 3 : raw.startsWith("**") ? 2 : 1;
      nodes.push({ type: count === 3 ? "bold-italic" : count === 2 ? "bold" : "italic", children: parseInlineMarkdown(raw.slice(count, -count), allowLinks) });
    }
    offset = match.index + raw.length;
  }
  if (offset < text.length) nodes.push({ type: "text", text: text.slice(offset) });
  return nodes;
}

export function inlinePlainText(value) {
  const flatten = nodes => nodes.map(node => node.children ? flatten(node.children) : node.text).join("");
  return flatten(parseInlineMarkdown(value));
}
