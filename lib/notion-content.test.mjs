import test from "node:test";
import assert from "node:assert/strict";
import { createContentReader } from "./notion-content.mjs";
import { blocksToMarkdown } from "./notion-markdown.mjs";

const rich = (value) => [{ plain_text: value, annotations: {} }];
const revision = "2026-11-03T00:00:00.000Z";
function page(id, slug, extra = {}) {
  return { id, created_time: revision, last_edited_time: revision, properties: {
    Name: { type: "title", title: rich(slug) }, Slug: { type: "rich_text", rich_text: rich(slug) },
    Published: { type: "checkbox", checkbox: true }, ...extra,
  } };
}
const paragraph = (value) => ({ type: "paragraph", paragraph: { rich_text: rich(value) } });
function fixture() {
  let time = 0;
  const rows = { posts: [page("post-page", "new-post", { Project: { relation: [{ id: "project-page" }] } })], projects: [page("project-page", "p2")] };
  const content = { "post-page": [paragraph("수정한 본문")], "project-page": [paragraph("소개")] };
  const reads = [];
  const queries = [];
  const notion = {
    databases: { query: async ({ database_id }) => { queries.push(database_id); return { results: rows[database_id], has_more: false }; } },
    blocks: { children: { list: async ({ block_id }) => { reads.push(block_id); return { results: content[block_id] || [], has_more: false }; } } },
  };
  const cache = (fn) => {
    const values = new Map();
    return (...args) => { const key = JSON.stringify(args); if (!values.has(key)) values.set(key, fn(...args)); return values.get(key); };
  };
  const options = { notion, cache, postsDb: "posts", projectsDb: "projects", renderBlocks: blocksToMarkdown, now: () => time };
  return { rows, content, reads, queries, options, advance: (ms) => { time += ms; } };
}

test("공개 글과 프로젝트를 연결하고 같은 수정본의 본문을 재사용한다", async () => {
  const f = fixture();
  const read = createContentReader(f.options);
  const first = await read();
  assert.equal(first.posts[0].projectId, "p2");
  assert.equal(first.posts[0].body, "수정한 본문");
  f.advance(60000);
  await read();
  assert.equal(f.queries.length, 4);
  assert.deepEqual(f.reads, ["project-page", "post-page"]);
});

test("새 수정 날짜에서는 해당 글 본문만 새로 읽는다", async () => {
  const f = fixture();
  const read = createContentReader(f.options);
  await read();
  f.rows.posts[0] = { ...f.rows.posts[0], last_edited_time: "2026-11-03T00:01:00.000Z" };
  f.content["post-page"] = [paragraph("새 내용")];
  f.advance(60000);
  assert.equal((await read()).posts[0].body, "새 내용");
  assert.deepEqual(f.reads, ["project-page", "post-page", "post-page"]);
});

test("정확히 같은 수정본인 기존 스냅샷은 파일과 이미지를 그대로 재사용한다", async () => {
  const f = fixture();
  const read = createContentReader({ ...f.options, posts: [{ id: "new-post", updated: Date.parse(revision), body: "저장된 글\n![사진](/posts/old/01.png)" }], projects: [{ id: "p2", updated: Date.parse(revision), body: "저장된 소개" }] });
  assert.match((await read()).posts[0].body, /저장된 글/);
  assert.deepEqual(f.reads, []);
});

test("공개 해제, 삭제, 비공개 프로젝트의 글은 캐시된 본문이 있어도 노출하지 않는다", async () => {
  const f = fixture();
  const read = createContentReader(f.options);
  await read();
  f.rows.posts[0] = page("post-page", "new-post", { Published: { checkbox: false } });
  f.advance(60000);
  assert.deepEqual((await read()).posts, []);
  f.rows.posts = [];
  f.advance(60000);
  assert.deepEqual((await read()).posts, []);
  f.rows.posts = [page("private-record", "hidden", { Project: { relation: [{ id: "unpublished-project" }] } })];
  f.advance(60000);
  assert.deepEqual((await read()).posts, []);
  assert.equal(f.reads.includes("private-record"), false);
});

test("목록과 중첩 본문을 페이지네이션하며 표, 코드, 토글, 사진을 보존한다", async () => {
  const f = fixture();
  f.content["post-page"] = [
    { id: "nested", type: "toggle", has_children: true, toggle: { rich_text: rich("내용 보기") } },
    { id: "table", type: "table", has_children: true, table: { has_column_header: true } },
    { type: "code", code: { language: "mermaid", rich_text: rich("A --> B") } },
    { type: "image", image: { type: "file", file: { url: "https://images.example/temporary.png" }, caption: rich("사진 {50%}") } },
  ];
  f.content.nested = [paragraph("안쪽 문단")];
  f.content.table = [{ type: "table_row", table_row: { cells: [rich("연도"), rich("발전량")] } }, { type: "table_row", table_row: { cells: [rich("2022"), rich("3만")] } }];
  const query = f.options.notion.databases.query;
  f.options.notion.databases.query = async (args) => args.database_id === "posts" && !args.start_cursor ? { results: [], has_more: true, next_cursor: "next" } : query(args);
  const list = f.options.notion.blocks.children.list;
  f.options.notion.blocks.children.list = async (args) => args.block_id === "nested" && !args.start_cursor ? { results: [], has_more: true, next_cursor: "next-block" } : list(args);
  const body = (await createContentReader(f.options)()).posts[0].body;
  assert.match(body, /▸ 내용 보기\n  안쪽 문단/);
  assert.match(body, /\| 연도 \| 발전량 \|/);
  assert.match(body, /```mermaid\nA --> B\n```/);
  assert.match(body, /!\[사진 \{50%\}\]\(https:\/\/images.example\/temporary.png\)/);
});

test("시간이 지나 만료될 수 있는 본문 사진 주소를 새로 가져온다", async () => {
  const f = fixture();
  f.content["post-page"] = [{ type: "image", image: { type: "file", file: { url: "https://example.test/temporary.png" }, caption: [] } }];
  const read = createContentReader(f.options);
  await read();
  f.advance(600000);
  await read();
  assert.deepEqual(f.reads, ["project-page", "post-page", "post-page"]);
});

test("서버 오류는 실패로 전달하며 빈 공개 목록을 이전 글로 대체하지 않는다", async () => {
  const f = fixture();
  f.rows.posts = []; f.rows.projects = [];
  assert.deepEqual(await createContentReader(f.options)(), { posts: [], projects: [], source: "notion" });
  f.options.notion.databases.query = async () => { throw new Error("denied"); };
  await assert.rejects(createContentReader(f.options)(), /denied/);
});
