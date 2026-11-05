import test from "node:test";
import assert from "node:assert/strict";
import { parseInlineMarkdown, inlinePlainText } from "./inline-markdown.mjs";
import { blocksToMarkdown } from "./notion-markdown.mjs";

const rich = (text, extra = {}) => ({ plain_text: text, annotations: {}, ...extra });
const paragraph = rich_text => ({ type: "paragraph", paragraph: { rich_text } });
const href = "https://publikationen.bibliothek.kit.edu/1000195884";

test("노션의 단어 링크를 변환하고 원래 표시 문구와 주소를 함께 보존한다", async () => {
  for (const extra of [{ href }, { text: { link: { url: href } } }]) {
    const md = await blocksToMarkdown([paragraph([rich("가정용 태양광을 다룬 "), rich("KIT 연구", extra), rich("가 그 예다.")])], "post");
    const nodes = parseInlineMarkdown(md);
    assert.equal(nodes[1].type, "link");
    assert.equal(nodes[1].href, href);
    assert.equal(nodes[1].children[0].text, "KIT 연구");
    assert.equal(inlinePlainText(md), "가정용 태양광을 다룬 KIT 연구가 그 예다.");
  }
});

test("굵게·이탤릭·코드 서식이 있는 링크의 표시 문구를 보존한다", async () => {
  for (const annotations of [{ bold: true }, { italic: true }, { bold: true, italic: true }, { code: true }]) {
    const md = await blocksToMarkdown([paragraph([rich("KIT 연구", { href, annotations })])], "post");
    const [link] = parseInlineMarkdown(md);
    assert.equal(link.type, "link");
    assert.equal(link.href, href);
    assert.equal(inlinePlainText(md), "KIT 연구");
    assert.notEqual(link.children[0].type, "text");
  }
});

test("괄호와 쿼리가 있는 주소 및 대괄호가 있는 표시 문구를 보존한다", async () => {
  const url = "https://example.test/paper_(MPC)?a=1&b=2#result";
  const md = await blocksToMarkdown([paragraph([rich("자료 [1]", { href: url })])], "post");
  const [link] = parseInlineMarkdown(md);
  assert.equal(link.type, "link");
  assert.equal(decodeURI(link.href), url);
  assert.equal(inlinePlainText(md), "자료 [1]");
});

test("코드 안의 링크 문법은 코드로 남기고 실행 가능한 주소는 링크로 만들지 않는다", () => {
  assert.equal(parseInlineMarkdown('`[예시](https://example.test)`')[0].type, "code");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///secret", "//example.test"]) {
    assert.equal(parseInlineMarkdown(`[위험](${url})`).some(n => n.type === "link"), false);
  }
});

test("이미지 캡션의 링크는 대체 문구에 중첩된 링크 문법을 넣지 않는다", async () => {
  const md = await blocksToMarkdown([{ type: "image", image: { type: "external", external: { url: "https://example.test/photo.png" }, caption: [rich("출처", { href })] } }], "post");
  assert.equal(md, "![출처](https://example.test/photo.png)");
});

test("표의 링크와 파이프 문자는 열 구조를 유지한다", async () => {
  const md = await blocksToMarkdown([
    { type: "table", table: { has_column_header: true } },
    { type: "table_row", table_row: { cells: [[rich("참고")], [rich("내용")]] } },
    { type: "table_row", table_row: { cells: [[rich("KIT 연구", { href })], [rich("A | B")]] } },
  ], "post");
  assert.match(md, /\[KIT 연구\]\(https:\/\/publikationen/);
  assert.match(md, /A \\\| B/);
});
