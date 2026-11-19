import test from "node:test";
import assert from "node:assert/strict";
import { blocksToMarkdown } from "./notion-markdown.mjs";
import { videoToMarkdown, parseVideoMarkdown, stripVideoMarkdown } from "./video-markdown.mjs";

const rich = (value) => [{ plain_text: value, annotations: {} }];
const paragraph = (value) => ({ type: "paragraph", paragraph: { rich_text: rich(value) } });

test("노션에 올린 영상을 앞뒤 문단 사이에 보존하고 캡션과 서명된 주소를 그대로 읽는다", async () => {
  const src = "https://files.example/transformer_(34s).mp4?signature=abc%2Fdef&expires=3600";
  const caption = "변압기 [원리] 100% — \"영상\"";
  const markdown = await blocksToMarkdown([
    paragraph("전자기 유도 설명"),
    { type: "video", video: { type: "file", file: { url: src }, caption: rich(caption) } },
    paragraph("코일을 감은 횟수"),
  ], "post");
  const lines = markdown.split("\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], "전자기 유도 설명");
  assert.deepEqual(parseVideoMarkdown(lines[1]), { src, caption });
  assert.equal(lines[2], "코일을 감은 횟수");
});

test("외부 영상도 보존하고 토글 안의 들여쓰기를 유지한다", async () => {
  const markdown = await blocksToMarkdown([
    { type: "toggle", toggle: { rich_text: rich("영상 보기") } },
    { type: "video", _depth: 1, video: { type: "external", external: { url: "https://cdn.example/clip.webm" }, caption: [] } },
  ], "post");
  assert.match(markdown, /^▸ 영상 보기\n  !video\[/);
  assert.deepEqual(parseVideoMarkdown(markdown.split("\n")[1].trim()), { src: "https://cdn.example/clip.webm", caption: "" });
});

test("영상을 추가해도 기존 사진 번호와 로컬 경로의 대응이 바뀌지 않는다", async () => {
  const image = (name) => ({ type: "image", image: { type: "file", file: { url: `https://files.example/${name}.png` }, caption: [] } });
  const calls = [];
  const markdown = await blocksToMarkdown([
    image("first"),
    { type: "video", video: { type: "file", file: { url: "https://files.example/clip.mp4" }, caption: [] } },
    image("second"),
  ], "post", async (url, id, index) => { calls.push([url, index]); return `/posts/${id}/${index}.png`; });
  assert.deepEqual(calls, [["https://files.example/first.png", 1], ["https://files.example/second.png", 2]]);
  assert.match(markdown, /^!\[\]\(\/posts\/post\/1.png\)\n!video\[/);
  assert.match(markdown, /!\[\]\(\/posts\/post\/2.png\)$/);
});

test("영상 주소가 없거나 HTTP(S)가 아니면 재생 주소로 사용하지 않는다", async () => {
  for (const src of [undefined, "javascript:alert(1)", "data:text/html,test", "file:///C:/secret.mp4", "not-a-url"]) {
    assert.equal(videoToMarkdown(src), null);
    assert.equal(parseVideoMarkdown(`!video[](${src})`), null);
    const markdown = await blocksToMarkdown([
      paragraph("앞"), { type: "video", video: { type: "file", file: { url: src }, caption: [] } }, paragraph("뒤"),
    ], "post");
    assert.equal(markdown, "앞\n뒤");
  }
  assert.equal(parseVideoMarkdown("!video[%ZZ](https://example.test/clip.mp4)"), null);
});

test("발췌에서는 영상 주소를 제외하고 일반 링크는 유지한다", () => {
  const video = videoToMarkdown("https://files.example/clip_(34s).mp4?signature=long-secret", "변압기");
  assert.equal(stripVideoMarkdown(`설명\n  ${video}\n[참고](https://example.test)`), "설명\n\n[참고](https://example.test)");
});
