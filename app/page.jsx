import Gazette from "./Gazette";
import { getContent } from "../lib/content";

// 최신 공개 글을 담은 화면을 재사용하고, 만료 후에는 뒤에서 다시 준비한다.
export const revalidate = 60;
export const dynamic = "force-static";
export const maxDuration = 60;

export default async function Page() {
  return <Gazette initialContent={await getContent()} />;
}
