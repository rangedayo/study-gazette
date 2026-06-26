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

/* ── 재시도 래퍼 ──────────────────────────────────────────
   Notion API/이미지 fetch 는 가끔 응답 도중 연결이 끊긴다
   ("Invalid response body ... Premature close"). 일시적 끊김이라
   잠깐 기다렸다 다시 부르면 대개 통과한다. 지수 백오프로 재시도. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, { tries = 4, base = 800, label = "요청" } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      // 인증·권한·요청 형식 오류(4xx)는 재시도해도 소용없으니 즉시 중단
      const status = err?.status;
      const retriable =
        /premature close|invalid response body|fetch failed|terminated|ECONNRESET|socket hang up|network|ETIMEDOUT/i.test(
          msg
        ) ||
        status === 429 ||
        (typeof status === "number" && status >= 500);
      if (!retriable || i === tries - 1) throw err;
      const wait = base * 2 ** i; // 0.8s → 1.6s → 3.2s ...
      console.warn(`· ${label} 실패(${msg}) — ${wait}ms 후 재시도 ${i + 1}/${tries - 1}`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

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
  const buf = await withRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status}`);
        e.status = res.status;
        throw e;
      }
      return Buffer.from(await res.arrayBuffer());
    },
    { label: `이미지 다운로드(${name})` }
  );
  await writeFile(resolve(dir, name), buf);
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
      if (a.italic) s = "*" + s + "*";
      if (a.bold) s = "**" + s + "**";
      return s;
    })
    .join("");

// 한 페이지의 모든 블록을 가져온다 (페이지네이션 + 중첩 자식 블록까지 재귀로 평탄화).
// 자식으로 들어간 블록은 부모 바로 뒤에 이어 붙여 읽기 순서를 보존하되,
// `_depth`(중첩 깊이)를 달아 둬서 마크다운에서 들여쓰기로 복원할 수 있게 한다.
async function fetchAllBlocks(blockId, depth = 0) {
  const blocks = [];
  let cursor;
  do {
    const res = await withRetry(
      () =>
        notion.blocks.children.list({
          block_id: blockId,
          start_cursor: cursor,
          page_size: 100,
        }),
      { label: "Notion 블록 조회" }
    );
    for (const b of res.results) {
      b._depth = depth;
      blocks.push(b);
      // 하위 페이지·DB는 별개 문서이므로 파고들지 않는다
      if (b.has_children && b.type !== "child_page" && b.type !== "child_database") {
        blocks.push(...(await fetchAllBlocks(b.id, depth + 1)));
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function blocksToMarkdown(blocks, postId) {
  const lines = [];
  let imgIndex = 0;
  // 숫자 목록은 깊이별로 연속 카운트를 매겨 1·2·3…을 살린다.
  const numCount = {}; // depth -> 현재 번호
  const resetNum = (depth) => { for (const d in numCount) if (+d >= depth) delete numCount[d]; };
  // 직전 "목록 항목"의 깊이(없으면 null) — 바로 뒤 이미지의 들여쓰기 판단용.
  let prevListDepth = null;
  // 표: table 블록을 만나면 모으기 시작하고, 뒤따르는 table_row를 셀로 쌓다가
  // 표가 끝나면(다른 블록을 만나거나 글 끝) 마크다운 표로 한꺼번에 flush 한다.
  let tableBuf = null; // { depth, hasHeader, rows: string[][] }
  const flushTable = () => {
    if (!tableBuf) return;
    const { depth, hasHeader, rows } = tableBuf;
    tableBuf = null;
    if (!rows.length) return;
    const tind = "  ".repeat(depth);
    const width = Math.max(...rows.map((r) => r.length));
    const esc = (c) => String(c).replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
    const toRow = (cells) => {
      const c = cells.slice();
      while (c.length < width) c.push("");
      return tind + "| " + c.map(esc).join(" | ") + " |";
    };
    const sep = tind + "| " + Array(width).fill("---").join(" | ") + " |";
    // 헤더 있으면 첫 행을 헤더로, 없으면 빈 헤더행을 넣어 마크다운 표 형식을 맞춘다.
    if (hasHeader) {
      lines.push(toRow(rows[0]), sep);
      for (let r = 1; r < rows.length; r++) lines.push(toRow(rows[r]));
    } else {
      lines.push(tind + "| " + Array(width).fill(" ").join(" | ") + " |", sep);
      for (const r of rows) lines.push(toRow(r));
    }
  };

  for (const b of blocks) {
    const t = b.type;
    const data = b[t];
    // table_row가 아닌 블록을 만나면 진행 중이던 표를 마감한다.
    if (t !== "table_row" && tableBuf) flushTable();
    let depth = b._depth || 0;
    // 노션에선 형제(top-level)지만 바로 위 목록 항목 바로 뒤(빈 줄 없이)에 온 이미지는
    // 그 항목에 속한 것으로 보고 한 단계 들여쓴다 → 웹에서 불릿 자식으로 렌더된다.
    if (t === "image" && prevListDepth === depth) depth += 1;
    const ind = "  ".repeat(depth); // 중첩 1단계 = 공백 2칸 (Body 파서와 약속)
    // 숫자 목록이 아닌 블록을 만나면 그 깊이 이후의 번호 카운트를 초기화.
    // 단, 빈 문단(엔터)은 항목 사이 간격일 뿐이므로 번호를 리셋하지 않는다
    // (노션처럼 빈 줄로 떨어진 항목도 1·2·3…이 이어지게).
    const isEmptyPara = t === "paragraph" && !(data.rich_text ?? []).some((r) => r.plain_text.trim());
    if (t !== "numbered_list_item" && !isEmptyPara) resetNum(depth);

    switch (t) {
      case "image": {
        const src = data.type === "external" ? data.external?.url : data.file?.url;
        if (!src) break;
        imgIndex += 1;
        const caption = richToMd(data.caption ?? []);
        try {
          const localPath = await saveImage(src, postId, imgIndex);
          lines.push(ind + `![${caption}](${localPath})`);
        } catch (e) {
          console.error(`  ⚠ 이미지 #${imgIndex} 건너뜀: ${e.message}`);
        }
        break;
      }
      case "heading_1":
        lines.push(ind + "# " + richToMd(data.rich_text));
        break;
      case "heading_2":
        lines.push(ind + "## " + richToMd(data.rich_text));
        break;
      case "heading_3":
        lines.push(ind + "### " + richToMd(data.rich_text));
        break;
      case "bulleted_list_item":
        lines.push(ind + "- " + richToMd(data.rich_text));
        break;
      case "numbered_list_item": {
        numCount[depth] = (numCount[depth] || 0) + 1;
        for (const d in numCount) if (+d > depth) delete numCount[d];
        lines.push(ind + numCount[depth] + ". " + richToMd(data.rich_text));
        break;
      }
      case "toggle":
        // ▸ 접두사로 토글임을 표시 → Body 파서가 <details>로 렌더
        lines.push(ind + "▸ " + richToMd(data.rich_text));
        break;
      case "quote":
        lines.push(ind + "> " + richToMd(data.rich_text));
        break;
      case "divider":
        lines.push("---");
        break;
      case "code": {
        // 코드펜스도 깊이만큼 들여쓴다 → 토글·목록 안의 코드가 자식으로 보존됨.
        // 내용은 마크다운 가공 없이 원문(plain_text) 그대로, 각 줄에 들여쓰기 부여.
        const lang = data.language && data.language !== "plain text" ? data.language : "";
        const code = (data.rich_text ?? []).map((t) => t.plain_text).join("");
        lines.push(ind + "```" + lang);
        for (const cl of code.split("\n")) lines.push(ind + cl);
        lines.push(ind + "```");
        break;
      }
      case "paragraph": {
        const md = richToMd(data.rich_text);
        // 빈 문단(엔터)도 깊이만큼 들여써서 보존 → 리스트/토글 안의 빈 줄이
        // 부모 밖으로 새어나가 다음 블록을 자식으로 삼키지 않게 한다.
        // (depth 0이면 ind=""이라 최상위 빈 줄은 그대로 빈 줄)
        lines.push(md ? ind + md : ind);
        break;
      }
      case "table":
        // 표 시작: 헤더 여부와 깊이만 기억하고, 셀은 뒤따르는 table_row에서 채운다.
        tableBuf = { depth, hasHeader: !!data.has_column_header, rows: [] };
        break;
      case "table_row":
        // 각 셀(rich_text 배열)을 인라인 마크다운으로 변환해 행에 쌓는다.
        if (tableBuf) tableBuf.rows.push((data.cells ?? []).map((cell) => richToMd(cell)));
        break;
      // 그 외 블록은 건너뜀 (현재 미지원)
      default:
        break;
    }
    // 다음 이미지 들여쓰기 판단: 목록 항목이면 깊이 기억, 이미지는 연결 유지(연속 이미지도 자식),
    // 그 외(빈 문단·헤딩 등)를 만나면 연결 끊김.
    if (t === "bulleted_list_item" || t === "numbered_list_item") prevListDepth = b._depth || 0;
    else if (t !== "image") prevListDepth = null;
  }
  flushTable(); // 글 끝에서 진행 중이던 표 마감
  // 과한 공백만 정리: 빈 줄 최대 6개까지 보존(연속 엔터를 더 충실히 반영)
  return lines.join("\n").replace(/\n{8,}/g, "\n\n\n\n\n\n\n").trim();
}

/* ── DB 쿼리 (Published == true 만, Date 내림차순) ─────── */

async function fetchPublishedPages() {
  const pages = [];
  let cursor;
  do {
    const res = await withRetry(
      () =>
        notion.databases.query({
          database_id: DB_ID,
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [{ property: "Date", direction: "descending" }],
          start_cursor: cursor,
          page_size: 100,
        }),
      { label: "Notion DB 쿼리" }
    );
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
