import "server-only";
import { Client } from "@notionhq/client";
import { unstable_cache } from "next/cache";
import posts from "../data/posts.json";
import projects from "../data/projects.json";
import { createNotionFetch } from "../scripts/notion-fetch.mjs";
import { createContentReader } from "./notion-content.mjs";
import { blocksToMarkdown } from "./notion-markdown.mjs";

let reader;
let pending;
export async function getContent() {
  if (!process.env.NOTION_TOKEN) return { posts, projects, source: "snapshot" };
  if (!reader) {
    const notion = new Client({ auth: process.env.NOTION_TOKEN, fetch: createNotionFetch((url, init) => fetch(url, { ...init, cache: "no-store" })) });
    reader = createContentReader({
      notion, posts, projects, renderBlocks: blocksToMarkdown,
      postsDb: process.env.NOTION_DB_ID || "de67a995c5cf45f2bcddda857a9a30fa",
      projectsDb: process.env.NOTION_PROJECTS_DB_ID || "933578ac0f354cad99cd9736ba3f2e80",
      cache: (fn, keys, seconds) => unstable_cache(fn, ["gazette-notion-v1", ...keys], { revalidate: seconds }),
    });
  }
  if (!pending) pending = reader().finally(() => { pending = null; });
  return pending;
}
