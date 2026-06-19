// Notion DB → data/posts.json 동기화 스크립트
//
// 환경변수:
//   NOTION_TOKEN   - Notion integration 토큰 (secret_... )
//   NOTION_DB_ID   - 글을 담은 데이터베이스 ID
//
// 로컬 실행:  NOTION_TOKEN=... NOTION_DB_ID=... npm run sync:notion
// CI 실행:    .github/workflows/sync-notion.yml 에서 secret 주입
//
// 본문은 사이트의 Body 파서가 지원하는 마크다운 부분집합으로만 변환한다:
//   #/##/### 제목, **굵게**, `코드`, ``` 코드블록, > 인용, - 목록
// (이미지 등 그 외 블록은 의도적으로 건너뛴다 — 현재는 텍스트 전용)

import { Client } from "@notionhq/client";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!TOKEN || !DB_ID) {
  console.error("✖ NOTION_TOKEN, NOTION_DB_ID 환경변수가 필요합니다.");
  process.exit(1);
}

const notion = new Client({ auth: TOKEN });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../data/posts.json");

/* ── Notion 속성 읽기 헬퍼 ────────────────────────────── */

// 타입으로 title 속성을 찾는다 (속성 이름이 무엇이든 동작)
const getTitle = (props) => {
  const entry = Object.values(props).find((p) => p.type === "title");
  return (entry?.title ?? []).map((t) => t.plain_text).join("").trim();
};

const getSelect = (props, name) => props[name]?.select?.name ?? "";
const getMultiSelect = (props, name) =>
  (props[name]?.multi_select ?? []).map((t) => t.name);
const getCheckbox = (props, name) => Boolean(props[name]?.checkbox);
const getRichText = (props, name) =>
  (props[name]?.rich_text ?? []).map((t) => t.plain_text).join("").trim();
const getDate = (props, name) => {
  const d = props[name]?.date?.start;
  return d ? new Date(d).getTime() : null;
};

/* ── 본문 블록 → 마크다운 변환 ─────────────────────────── */

// rich_text 배열을 Body 파서가 이해하는 인라인 마크다운으로
const richToMd = (rich = []) =>
  rich
    .map((t) => {
      let s = t.plain_text;
      const a = t.annotations ?? {};
      if (a.code) s = "`" + s + "`";
      if (a.bold) s = "**" + s + "**";
      return s;
    })
    .join("");

// 한 페이지의 모든 블록을 페이지네이션까지 처리해 가져온다
async function fetchAllBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function blocksToMarkdown(blocks) {
  const lines = [];
  for (const b of blocks) {
    const t = b.type;
    const data = b[t];
    switch (t) {
      case "heading_1":
        lines.push("# " + richToMd(data.rich_text), "");
        break;
      case "heading_2":
        lines.push("## " + richToMd(data.rich_text), "");
        break;
      case "heading_3":
        lines.push("### " + richToMd(data.rich_text), "");
        break;
      case "bulleted_list_item":
      case "numbered_list_item":
        lines.push("- " + richToMd(data.rich_text));
        break;
      case "quote":
        lines.push("> " + richToMd(data.rich_text), "");
        break;
      case "code": {
        const lang = data.language && data.language !== "plain text" ? data.language : "";
        lines.push("```" + lang, richToMd(data.rich_text), "```", "");
        break;
      }
      case "paragraph": {
        const md = richToMd(data.rich_text);
        lines.push(md, ""); // 빈 문단은 빈 줄로 → 문단 구분
        break;
      }
      // 이미지·구분선·기타 블록은 텍스트 전용 정책상 건너뜀
      default:
        break;
    }
  }
  // 끝부분 연속 빈 줄 정리
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── DB 쿼리 (Published == true 만, Date 내림차순) ─────── */

async function fetchPublishedPages() {
  const pages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: { property: "Published", checkbox: { equals: true } },
      sorts: [{ property: "Date", direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/* ── 메인 ─────────────────────────────────────────────── */

async function main() {
  const pages = await fetchPublishedPages();
  console.log(`· Published 글 ${pages.length}건 발견`);

  const posts = [];
  for (const page of pages) {
    const props = page.properties;
    const blocks = await fetchAllBlocks(page.id);
    const slug = getRichText(props, "Slug");
    const created = getDate(props, "Date") ?? new Date(page.created_time).getTime();

    posts.push({
      id: slug || page.id.replace(/-/g, ""),
      title: getTitle(props),
      category: getSelect(props, "Category") || "기타",
      pinned: getCheckbox(props, "Pinned"),
      tags: getMultiSelect(props, "Tags"),
      created,
      updated: new Date(page.last_edited_time).getTime(),
      body: blocksToMarkdown(blocks),
    });
    console.log(`  ✓ ${getTitle(props)}`);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(posts, null, 2) + "\n", "utf8");
  console.log(`✔ ${posts.length}건 → data/posts.json 저장 완료`);
}

main().catch((err) => {
  console.error("✖ 동기화 실패:", err.body ?? err.message ?? err);
  process.exit(1);
});
