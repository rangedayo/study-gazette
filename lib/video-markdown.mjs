import { safeHttpUrl } from "./inline-markdown.mjs";

// 본문 안의 영상 블록. 캡션의 괄호·줄바꿈이 다른 마크다운으로 해석되지 않게 보존한다.
export function videoToMarkdown(value, caption = "") {
  const src = safeHttpUrl(value);
  return src ? `!video[${encodeURIComponent(caption)}](${src})` : null;
}

export function parseVideoMarkdown(line) {
  const match = line.match(/^!video\[([^\]]*)\]\((.+)\)$/);
  if (!match) return null;
  const src = safeHttpUrl(match[2]);
  if (!src) return null;
  try { return { src, caption: decodeURIComponent(match[1]) }; }
  catch { return null; }
}

export const stripVideoMarkdown = (value) => String(value).replace(/^[ \t]*!video\[[^\]]*\]\([^\r\n]*\)[ \t]*$/gm, "");
