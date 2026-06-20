// Notion 프로젝트 DB → data/projects.json 동기화 스크립트
//
// 환경변수:
//   NOTION_TOKEN          - Notion integration 토큰 (글 DB와 동일 토큰 사용)
//   NOTION_PROJECTS_DB_ID - (선택) 프로젝트 DB id. 미설정 시 아래 기본값 사용
//
// 로컬 실행:  NOTION_TOKEN=... npm run sync:projects
// CI 실행:    .github/workflows/sync-notion.yml 에서 함께 실행
//
// 텍스트(title/kind/summary/highlights/stack/links/body)만 동기화한다.
// 히어로 스크린샷(thumb/shots/wide)은 코드(app/Gazette.jsx PROJECT_SHOTS)에서 관리.
// 본문 변환 규칙은 sync-notion.mjs와 동일(머메이드 코드블록·인라인 이미지 포함).

import { Client } from "@notionhq/client";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.NOTION_TOKEN;
// DB id는 비밀이 아니므로 기본값 하드코딩 (필요 시 환경변수로 덮어쓰기)
const DB_ID = process.env.NOTION_PROJECTS_DB_ID || "933578ac0f354cad99cd9736ba3f2e80";

if (!TOKEN) {
  console.error("✖ NOTION_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}

const notion = new Client({ auth: TOKEN });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../data/projects.json");
const IMG_ROOT = resolve(__dirname, "../public/projects"); // 프로젝트 본문 이미지 저장 위치

/* ── Notion 속성 읽기 헬퍼 ────────────────────────────── */

const getTitle = (props) => {
  const entry = Object.values(props).find((p) => p.type === "title");
  return (entry?.title ?? []).map((t) => t.plain_text).join("").trim();
};
const getMultiSelect = (props, name) =>
  (props[name]?.multi_select ?? []).map((t) => t.name);
const getCheckbox = (props, name) => Boolean(props[name]?.checkbox);
const getRichText = (props, name) =>
  (props[name]?.rich_text ?? []).map((t) => t.plain_text).join("").trim();
const getDate = (props, name) => {
  const d = props[name]?.date?.start;
  return d ? new Date(d).getTime() : null;
};

// 여러 줄 텍스트 속성 → 줄 배열 (빈 줄 제거)
const splitLines = (text) =>
  String(text).split("\n").map((s) => s.trim()).filter(Boolean);

/* ── 이미지 다운로드 (Notion URL은 ~1시간 뒤 만료 → 파일로 보관) ─── */

const extFromUrl = (url) => {
  try {
    const m = new URL(url).pathname.match(/\.(png|jpe?g|gif|webp|svg)$/i);
    return m ? m[0].toLowerCase() : ".png";
  } catch {
    return ".png";
  }
};

// public/projects/<id>/NN.ext 로 저장하고 사이트용 경로를 돌려준다
async function saveImage(url, projId, index) {
  const dir = resolve(IMG_ROOT, projId);
  await mkdir(dir, { recursive: true });
  const name = String(index).padStart(2, "0") + extFromUrl(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await writeFile(resolve(dir, name), Buffer.from(await res.arrayBuffer()));
  return `/projects/${projId}/${name}`;
}

/* ── 본문 블록 → 마크다운 ──────────────────────────────── */

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

// 페이지의 모든 블록 (페이지네이션 + 중첩 자식 재귀 평탄화)
async function fetchAllBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const b of res.results) {
      blocks.push(b);
      if (b.has_children && b.type !== "child_page" && b.type !== "child_database") {
        blocks.push(...(await fetchAllBlocks(b.id)));
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function blocksToMarkdown(blocks, projId) {
  const lines = [];
  let imgIndex = 0;
  for (const b of blocks) {
    const t = b.type;
    const data = b[t];
    switch (t) {
      case "image": {
        const src = data.type === "external" ? data.external?.url : data.file?.url;
        if (!src) break;
        imgIndex += 1;
        const caption = richToMd(data.caption ?? []);
        try {
          const localPath = await saveImage(src, projId, imgIndex);
          lines.push(`![${caption}](${localPath})`, "");
        } catch (e) {
          console.error(`  ⚠ 이미지 #${imgIndex} 건너뜀: ${e.message}`);
        }
        break;
      }
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
        // 머메이드 등 언어 보존 ("plain text"만 무명 처리)
        const lang = data.language && data.language !== "plain text" ? data.language : "";
        lines.push("```" + lang, richToMd(data.rich_text), "```", "");
        break;
      }
      case "paragraph": {
        lines.push(richToMd(data.rich_text), "");
        break;
      }
      default:
        break;
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── DB 쿼리 (Published == true, Date 내림차순) ─────────── */

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
  await mkdir(IMG_ROOT, { recursive: true });
  const pages = await fetchPublishedPages();
  console.log(`· Published 프로젝트 ${pages.length}건 발견`);

  // 0건이면 거의 항상 설정 오류(미연결·미임포트)다. 기존 projects.json을
  // 빈 배열로 덮어써 사이트 프로젝트를 날리지 않도록 그대로 종료한다.
  if (pages.length === 0) {
    console.log("⚠ Published 프로젝트 0건 — projects.json을 덮어쓰지 않고 종료(실수 방지)");
    return;
  }

  const projects = [];
  for (const page of pages) {
    const props = page.properties;
    const blocks = await fetchAllBlocks(page.id);
    const slug = getRichText(props, "Slug");
    const id = slug || page.id.replace(/-/g, "");
    const created = getDate(props, "Date") ?? new Date(page.created_time).getTime();

    // 본문 이미지 폴더만 비운다 (히어로 스크린샷은 public/projects/ 최상위라 안전)
    await rm(resolve(IMG_ROOT, id), { recursive: true, force: true });

    const links = splitLines(getRichText(props, "Links")).map((line) => {
      const [label, url] = line.split(/\s*\|\s*/);
      return { label: (label || "").trim(), url: (url || "").trim() };
    });

    projects.push({
      id,
      title: getTitle(props),
      kind: getRichText(props, "Kind"),
      summary: getRichText(props, "Summary"),
      pinned: getCheckbox(props, "Pinned"),
      created,
      highlights: splitLines(getRichText(props, "Highlights")),
      stack: getMultiSelect(props, "Stack"),
      links,
      body: await blocksToMarkdown(blocks, id),
    });
    console.log(`  ✓ ${getTitle(props)}`);
  }

  await writeFile(OUT_PATH, JSON.stringify(projects, null, 2) + "\n", "utf8");
  console.log(`✔ ${projects.length}건 → data/projects.json 저장 완료`);
}

main().catch((err) => {
  console.error("✖ 동기화 실패:", err.body ?? err.message ?? err);
  process.exit(1);
});
