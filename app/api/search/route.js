import posts from "../../../data/posts.json";

// 본문에서 마크다운 기호를 걷어내 검색용 발췌를 만든다 (컴포넌트의 clean과 동일 규칙)
const clean = (b) =>
  String(b)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export async function POST(req) {
  try {
    const { question } = await req.json();
    if (!question || !String(question).trim()) {
      return Response.json({ message: "질문을 입력해 주세요.", ids: [] }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // 키가 설정되지 않은 경우: 검색을 막지 말고 안내만 반환
      return Response.json(
        { message: "AI 검색이 아직 설정되지 않았어요. (서버에 ANTHROPIC_API_KEY 필요)", ids: [] },
        { status: 200 }
      );
    }

    const catalog = posts.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      tags: p.tags || [],
      excerpt: clean(p.body).slice(0, 220),
    }));

    const system =
      "너는 'The Study Gazette'라는 개인 공부 저널의 사서다. 주어진 글 목록에서 사용자 질문과 관련된 글을 고른다. " +
      "관련도가 높은 순서로 정렬한다. 반드시 JSON 객체 하나만 출력하고, 그 외의 텍스트나 마크다운 코드블록 표시는 절대 출력하지 마라. " +
      '형식: {"message": "한국어 안내 한두 문장", "ids": ["글id", ...]}. ' +
      "관련 글이 전혀 없으면 ids는 빈 배열로 두고 message로 없다고 정중히 안내한다.";

    const userContent = `[글 목록]\n${JSON.stringify(catalog)}\n\n[사용자 질문]\n${question}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic API error", res.status, detail);
      return Response.json({ message: "검색 처리 중 오류가 났어요.", ids: [] }, { status: 502 });
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((i) => i.type === "text")
      .map((i) => i.text)
      .join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return Response.json({ message: parsed.message || "", ids: parsed.ids || [] });
  } catch (e) {
    console.error("search route error", e);
    return Response.json({ message: "검색을 처리하지 못했어요.", ids: [] }, { status: 500 });
  }
}
