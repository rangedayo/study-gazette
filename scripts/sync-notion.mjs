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
//   #/##/### 제목, **굵게**, `코드`, ``` 코드블록, > 인용, - 목록, 이미지
// 이미지 블록은 받아서 public/posts/<id>/ 에 저장하고 ![](...) 로 링크한다.
// (구분선·표·토글 등 그 외 블록은 건너뛴다)
// 페이지 커버 이미지는 public/posts/<id>/cover.ext 로 저장하고 posts.json 의 thumb 로 넣는다
// (목록 썸네일·상세 히어로용. 커버가 없으면 사이트가 자동 추상 그림 Art 로 폴백)

import { Client } from "@notionhq/client";
import { writeFile, mkdir, rm } from "node:fs/promises";
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
const IMG_ROOT = resolve(__dirname, "../public/posts"); // 글 이미지 저장 위치

/* ── 이미지 다운로드 ───────────────────────────────────── */
// Notion 호스팅 이미지 URL은 ~1시간 뒤 만료되므로, 받아서 public/에 저장한다.

const extFromUrl = (url) => {
  try {
    const m = new URL(url).pathname.match(/\.(png|jpe?g|gif|webp|svg)$/i);
    return m ? m[0].toLowerCase() : ".png";
  } catch {
    return ".png";
  }
};

// 이미지를 public/posts/<id>/<name> 으로 저장하고 사이트용 경로를 돌려준다
async function saveImageAs(url, postId, name) {
  const dir = resolve(IMG_ROOT, postId);
  await mkdir(dir, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await writeFile(resolve(dir, name), Buffer.from(await res.arrayBuffer()));
  return `/posts/${postId}/${name}`;
}

// 본문 이미지: NN.ext (읽기 순서대로 번호)
const saveImage = (url, postId, index) =>
  saveImageAs(url, postId, String(index).padStart(2, "0") + extFromUrl(url));

// 글 커버(썸네일·히어로용): 고정 이름 cover.ext — 페이지 커버에서 받는다
const saveCover = (url, postId) =>
  saveImageAs(url, postId, "cover" + extFromUrl(url));

// page.cover → 다운로드 가능한 URL (업로드 파일/외부 링크 모두 지원, 만료 대비 파일로 보관)
const coverUrl = (cover) =>
  !cover ? null : cover.type === "external" ? cover.external?.url : cover.file?.url;

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

// 한 페이지의 모든 블록을 가져온다 (페이지네이션 + 중첩 자식 블록까지 재귀로 평탄화).
// 불릿 안에 넣은 이미지처럼 자식으로 들어간 블록도 부모 바로 뒤에 이어 붙여 읽기 순서를 보존.
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
      // 하위 페이지·DB는 별개 문서이므로 파고들지 않는다
      if (b.has_children && b.type !== "child_page" && b.type !== "child_database") {
        blocks.push(...(await fetchAllBlocks(b.id)));
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function blocksToMarkdown(blocks, postId) {
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
          const localPath = await saveImage(src, postId, imgIndex);
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
        const lang = data.language && data.language !== "plain text" ? data.language : "";
        lines.push("```" + lang, richToMd(data.rich_text), "```", "");
        break;
      }
      case "paragraph": {
        const md = richToMd(data.rich_text);
        lines.push(md, ""); // 빈 문단은 빈 줄로 → 문단 구분
        break;
      }
      // 구분선·표·토글 등 그 외 블록은 건너뜀 (현재 미지원)
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
  await mkdir(IMG_ROOT, { recursive: true }); // 이미지가 없어도 폴더는 존재
  const pages = await fetchPublishedPages();
  console.log(`· Published 글 ${pages.length}건 발견`);

  const posts = [];
  for (const page of pages) {
    const props = page.properties;
    const blocks = await fetchAllBlocks(page.id);
    const slug = getRichText(props, "Slug");
    const id = slug || page.id.replace(/-/g, "");
    const created = getDate(props, "Date") ?? new Date(page.created_time).getTime();

    // 이 글의 이미지 폴더를 비우고 새로 받는다 (지워진 이미지·인덱스 정리)
    await rm(resolve(IMG_ROOT, id), { recursive: true, force: true });

    // 페이지 커버 → 목록 썸네일·상세 히어로용 thumb (없으면 사이트가 Art로 폴백)
    let thumb;
    const cov = coverUrl(page.cover);
    if (cov) {
      try {
        thumb = await saveCover(cov, id);
      } catch (e) {
        console.error(`  ⚠ 커버 이미지 건너뜀: ${e.message}`);
      }
    }

    posts.push({
      id,
      title: getTitle(props),
      category: getSelect(props, "Category") || "기타",
      pinned: getCheckbox(props, "Pinned"),
      tags: getMultiSelect(props, "Tags"),
      created,
      updated: new Date(page.last_edited_time).getTime(),
      ...(thumb ? { thumb } : {}),
      body: await blocksToMarkdown(blocks, id),
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
