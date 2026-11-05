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

test("Shift+Enter는 문단 안 줄바꿈으로, Enter는 별도 문단으로 보존한다", async () => {
  const md = await blocksToMarkdown([
    paragraph([rich("첫 줄\n둘째 줄\n\n넷째 줄")]),
    paragraph([rich("다음 문단")]),
  ], "post");
  assert.equal(md, "첫 줄<br>둘째 줄<br><br>넷째 줄\n다음 문단");
  assert.equal(parseInlineMarkdown(md).filter(n => n.type === "break").length, 3);
  assert.equal(inlinePlainText("첫 줄<br>둘째 줄"), "첫 줄 둘째 줄");
});

test("표 머리글과 셀의 줄바꿈을 보존하고 같은 행과 열을 유지한다", async () => {
  const md = await blocksToMarkdown([
    { type: "table", table: { has_column_header: true } },
    { type: "table_row", table_row: { cells: [[rich("평가\n지표")], [rich("설명")]] } },
    { type: "table_row", table_row: { cells: [[rich("운영효율점수")], [rich("• 낭비와 부족을 한 숫자로 묶음\n• 두 비율을 곱해 계산")]] } },
  ], "post");
  assert.equal(md.split("\n").length, 3);
  assert.match(md, /평가<br>지표/);
  assert.match(md, /묶음<br>• 두 비율/);
});

test("굵게·링크·인라인 코드에 들어간 줄바꿈도 서식과 함께 보존한다", async () => {
  for (const extra of [{ annotations: { bold: true } }, { href }, { annotations: { code: true } }]) {
    const md = await blocksToMarkdown([paragraph([rich("첫 줄\n둘째 줄", extra)])], "post");
    const nodes = parseInlineMarkdown(md);
    assert.equal(nodes[1].type, "break");
    assert.equal(nodes[0].type, nodes[2].type);
    assert.equal(inlinePlainText(md), "첫 줄 둘째 줄");
  }
  assert.equal(parseInlineMarkdown("`<br>`")[0].text, "<br>");
  assert.equal(parseInlineMarkdown("<br onclick=alert(1)>")[0].type, "text");
});

test("목록과 인용 안의 Shift+Enter는 새 항목을 만들지 않고 코드 블록은 원문을 유지한다", async () => {
  const md = await blocksToMarkdown([
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: [rich("항목\r\n이어지는 줄")] } },
    { type: "quote", quote: { rich_text: [rich("인용\n둘째 줄")] } },
    { type: "code", code: { language: "python", rich_text: [rich("a = 1\nb = 2")] } },
  ], "post");
  assert.match(md, /^- 항목<br>이어지는 줄\n> 인용<br>둘째 줄\n/);
  assert.match(md, /```python\na = 1\nb = 2\n```/);
});
