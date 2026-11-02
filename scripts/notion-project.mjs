// 글 DB의 Project 관계를 프로젝트 DB의 Slug(p1/p2 등)로 바꾼다.
export function createProjectResolver(loadPage) {
  const cache = new Map();
  return async (props) => {
    const project = props.Project;
    if (!project) return null; // Project 속성이 없는 기존 DB도 지원
    if (project.type !== "relation") throw new Error("Project 속성은 관계형이어야 합니다.");
    const relations = project.relation || [];
    if (project.has_more || relations.length > 1) throw new Error("글 하나에는 프로젝트 하나만 연결해 주세요.");
    if (!relations.length) return null;
    const pageId = relations[0].id;
    if (!cache.has(pageId)) {
      cache.set(pageId, loadPage(pageId).then((page) => {
        if (page.archived || page.in_trash) throw new Error("연결된 프로젝트가 휴지통에 있습니다.");
        const slug = (page.properties?.Slug?.rich_text || []).map((text) => text.plain_text).join("").trim();
        return slug || page.id.replace(/-/g, "");
      }));
    }
    return cache.get(pageId);
  };
}
