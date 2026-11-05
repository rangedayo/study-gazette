// 노션을 읽는 부분과 캐시를 분리해 서버와 검증에서 같은 변환을 사용한다.
const text = (value = []) => value.map((t) => t.plain_text ?? t.text?.content ?? "").join("");
const rich = (props, name) => text(props[name]?.rich_text).trim();
const title = (props) => text(Object.values(props).find((p) => p.type === "title")?.title).trim();
const imageUrl = (image) => image?.external?.url || image?.file?.url;
const idOf = (page) => rich(page.properties, "Slug") || page.id.replace(/-/g, "");
const lines = (value) => value.split("\n").map((s) => s.trim()).filter(Boolean);

export function createContentReader({ notion, cache, posts: savedPosts = [], projects: savedProjects = [], postsDb, projectsDb, renderBlocks, now = Date.now }) {
  async function pages(database_id) {
    const result = [];
    let cursor;
    do {
      const page = await notion.databases.query({ database_id, filter: { property: "Published", checkbox: { equals: true } }, start_cursor: cursor, page_size: 100 });
      result.push(...page.results.filter((p) => !p.archived && !p.in_trash && p.properties.Published?.checkbox));
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return result;
  }
  // 분 단위 키를 사용해 오래 방문자가 없었어도 만료된 사진 주소를 먼저 반환하지 않는다.
  const catalog = cache(async (minute) => ({ posts: await pages(postsDb), projects: await pages(projectsDb) }), ["catalog", postsDb, projectsDb], 120);

  async function blocks(id, depth = 0) {
    const result = [];
    let cursor;
    do {
      const page = await notion.blocks.children.list({ block_id: id, start_cursor: cursor, page_size: 100 });
      for (const block of page.results) {
        result.push({ ...block, _depth: depth });
        if (block.has_children && !["child_page", "child_database"].includes(block.type)) result.push(...await blocks(block.id, depth + 1));
      }
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return result;
  }
  // last_edited_time도 키에 포함하므로 수정된 글만 새 본문을 읽는다.
  const loadBody = async (pageId, localImages = []) => {
    const images = new Map(localImages);
    return renderBlocks(await blocks(pageId), pageId, async (url, id, index) => images.get(index) || url);
  };
  const body = cache(async (pageId, revision, localImages) => {
    const markdown = await loadBody(pageId, localImages);
    return { markdown, loadedAt: now(), hasImages: /!\[[^\]]*\]\(https?:\/\//.test(markdown) };
  }, ["body", postsDb, projectsDb], false);
  // 사진 없는 글은 수정될 때까지 재사용한다. 임시 이미지 주소만 10분마다 갱신한다.
  const imageBody = cache(async (pageId, revision, imageWindow, localImages) => loadBody(pageId, localImages), ["image-body", postsDb, projectsDb], 1200);

  async function convert(page, kind, projectIds) {
    const props = page.properties;
    const id = idOf(page);
    const saved = (kind === "post" ? savedPosts : savedProjects).find((p) => p.id === id);
    const updated = Date.parse(page.last_edited_time);
    const created = Date.parse(props.Date?.date?.start || page.created_time);
    const data = { id, title: title(props), created, updated };
    if (kind === "post") {
      const related = props.Project?.relation || [];
      if (props.Project?.has_more || related.length > 1) throw new Error("글 하나에는 프로젝트 하나만 연결해 주세요.");
      if (related.length && !projectIds.has(related[0].id.replace(/-/g, ""))) return null;
      Object.assign(data, {
        category: props.Category?.select?.name || "기타", pinned: !!props.Pinned?.checkbox,
        tags: (props.Tags?.multi_select || []).map((t) => t.name),
        ...(related.length ? { projectId: projectIds.get(related[0].id.replace(/-/g, "")) } : {}),
        ...(imageUrl(page.cover) ? { thumb: saved?.updated === updated && saved.thumb ? saved.thumb : imageUrl(page.cover) } : {}),
      });
    } else {
      Object.assign(data, {
        kind: rich(props, "Kind"), summary: rich(props, "Summary"),
        highlights: lines(rich(props, "Highlights")), stack: (props.Stack?.multi_select || []).map((t) => t.name),
        links: lines(rich(props, "Links")).map((line) => { const [label, ...url] = line.split("|"); return { label: label.trim(), url: url.join("|").trim() }; }),
      });
    }
    // 구버전 JSON은 링크 주소를 보존하지 않아 본문 원본으로 재사용하지 않는다.
    // 노션에서 한 번 변환한 뒤에는 수정 날짜별 캐시를 계속 사용한다.
    const localImages = saved?.updated === updated
      ? [...(saved.body || "").matchAll(/!\[[^\]]*\]\((\/(?:posts|projects)\/[^)\s]*\/(\d+)\.[^)\s]+)\)/g)].map(m => [Number(m[2]), m[1]])
      : [];
    const cached = await body(page.id, page.last_edited_time, localImages);
    data.body = cached.hasImages && now() - cached.loadedAt >= 600000
      ? await imageBody(page.id, page.last_edited_time, Math.floor(now() / 600000), localImages)
      : cached.markdown;
    return data;
  }
  return async () => {
    const index = await catalog(Math.floor(now() / 60000));
    const projectIds = new Map(index.projects.map((p) => [p.id.replace(/-/g, ""), idOf(p)]));
    const projects = [];
    const posts = [];
    for (const page of index.projects) projects.push(await convert(page, "project", projectIds));
    for (const page of index.posts) { const post = await convert(page, "post", projectIds); if (post) posts.push(post); }
    return { posts, projects, source: "notion" };
  };
}
