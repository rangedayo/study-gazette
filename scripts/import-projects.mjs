// 일회성 마이그레이션: data/projects.json → Notion 프로젝트 DB
//
// 기존 프로젝트(p1~p3)를 Notion DB로 한 번에 올린다. (이후 수정은 Notion에서)
// 텍스트 필드는 DB 속성으로, 본문은 Notion 블록으로 변환한다.
// Slug에 원래 id(p1..)를 넣어 사이트 URL을 보존.
//
// 실행:
//   $env:NOTION_TOKEN="secret_..."; npm run import:projects
//
// 주의: 여러 번 돌리면 같은 프로젝트가 중복 생성된다. 한 번만 실행할 것.

import { Client } from "@notionhq/client";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_PROJECTS_DB_ID || "933578ac0f354cad99cd9736ba3f2e80";
if (!TOKEN) {
  console.error("✖ NOTION_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}

const notion = new Client({ auth: TOKEN });
const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(__dirname, "../data/projects.json");

// Notion code 블록이 받는 언어 (머메이드 포함)
const NOTION_LANGS = new Set([
  "mermaid", "python", "javascript", "typescript", "bash", "shell", "json",
  "yaml", "java", "c", "c++", "sql", "go", "rust", "markdown", "html", "css",
]);

/* ── 인라인 마크다운(**굵게**, `코드`) → rich_text ─────── */
function toRichText(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", text: { content: text.slice(last, m.index) } });
    const tok = m[0];
    if (tok.startsWith("**"))
      out.push({ type: "text", text: { content: tok.slice(2, -2) }, annotations: { bold: true } });
    else
      out.push({ type: "text", text: { content: tok.slice(1, -1) }, annotations: { code: true } });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: { content: text.slice(last) } });
  return out.length ? out : [{ type: "text", text: { content: "" } }];
}

const para = (rich) => ({ object: "block", type: "paragraph", paragraph: { rich_text: rich } });

/* ── 본문 마크다운 → Notion 블록 배열 ──────────────────── */
function bodyToBlocks(body) {
  const blocks = [];
  const segs = String(body).split("```"); // 짝수=일반, 홀수=코드블록
  segs.forEach((seg, si) => {
    if (si % 2 === 1) {
      const firstNl = seg.indexOf("\n");
      const lang = firstNl > 0 ? seg.slice(0, firstNl).trim() : "";
      const code = firstNl > 0 ? seg.slice(firstNl + 1) : seg;
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: code.replace(/\n$/, "").slice(0, 2000) } }],
          language: NOTION_LANGS.has(lang) ? lang : "plain text",
        },
      });
      return;
    }
    for (const raw of seg.split("\n")) {
      const ln = raw.replace(/\s+$/, "");
      if (ln.trim() === "") continue;
      if (/^### /.test(ln)) blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: toRichText(ln.slice(4)) } });
      else if (/^## /.test(ln)) blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: toRichText(ln.slice(3)) } });
      else if (/^# /.test(ln)) blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: toRichText(ln.slice(2)) } });
      else if (/^> /.test(ln)) blocks.push({ object: "block", type: "quote", quote: { rich_text: toRichText(ln.slice(2)) } });
      else if (/^[-*] /.test(ln.trim())) blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: toRichText(ln.trim().slice(2)) } });
      else if (/^\d+\.\s/.test(ln.trim())) blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: toRichText(ln.trim().replace(/^\d+\.\s/, "")) } });
      else blocks.push(para(toRichText(ln)));
    }
  });
  return blocks;
}

const toISODate = (ms) => new Date(ms).toISOString().slice(0, 10);
const joinLinks = (links) => (links || []).map((l) => `${l.label} | ${l.url}`).join("\n");

/* ── 메인 ─────────────────────────────────────────────── */
async function main() {
  const projects = JSON.parse(await readFile(SRC_PATH, "utf8"));
  console.log(`· projects.json ${projects.length}건 로드`);

  for (const p of projects) {
    const blocks = bodyToBlocks(p.body);
    const page = await notion.pages.create({
      parent: { database_id: DB_ID },
      properties: {
        Name: { title: [{ type: "text", text: { content: p.title } }] },
        Kind: { rich_text: toRichText(p.kind || "") },
        Summary: { rich_text: [{ type: "text", text: { content: (p.summary || "").slice(0, 2000) } }] },
        Stack: { multi_select: (p.stack || []).map((name) => ({ name })) },
        Highlights: { rich_text: [{ type: "text", text: { content: (p.highlights || []).join("\n").slice(0, 2000) } }] },
        Links: { rich_text: [{ type: "text", text: { content: joinLinks(p.links).slice(0, 2000) } }] },
        Date: { date: { start: toISODate(p.created) } },
        Published: { checkbox: true },
        Pinned: { checkbox: Boolean(p.pinned) },
        Slug: { rich_text: [{ type: "text", text: { content: p.id } }] },
      },
      children: blocks.slice(0, 100),
    });
    for (let i = 100; i < blocks.length; i += 100) {
      await notion.blocks.children.append({
        block_id: page.id,
        children: blocks.slice(i, i + 100),
      });
    }
    console.log(`  ✓ ${p.title} (${blocks.length} blocks)`);
  }
  console.log(`✔ ${projects.length}건 Notion 업로드 완료`);
}

main().catch((err) => {
  console.error("✖ 임포트 실패:", err.body ?? err.message ?? err);
  process.exit(1);
});
