import { getContent } from "../../../lib/content";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    return Response.json(await getContent(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 노션의 원본 응답이나 인증 정보를 공개 API로 반환하지 않는다.
    console.error("Content refresh failed", error?.code || error?.name || "unknown");
    return Response.json({ error: "최신 글을 불러오지 못했습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
