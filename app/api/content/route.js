import { getContent } from "../../../lib/content";

export const dynamic = "force-dynamic";
// 변환 규칙이 바뀐 뒤 기존 글의 캐시를 처음 준비할 때도 끝까지 완료한다.
export const maxDuration = 180;

export async function GET() {
  try {
    return Response.json(await getContent(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 노션의 원본 응답이나 인증 정보를 공개 API로 반환하지 않는다.
    console.error("Content refresh failed", error?.code || error?.name || "unknown");
    return Response.json({ error: "최신 글을 불러오지 못했습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
