// 사이트와 기존 동기화에서 사용하는 노션 본문 변환. 기본 이미지는 노션 URL을 사용한다.
import { safeHttpUrl } from "./inline-markdown.mjs";

const richToMd = (rich = [], includeLinks = true, lineBreak = "<br>") =>
  rich
    .map((t) => t.plain_text.split(/\r\n?|\n/).map((part) => {
      let s = part;
      if (!s) return "";
      const a = t.annotations ?? {};
      if (a.code) s = "`" + s + "`";
      if (a.italic) s = "*" + s + "*";
      if (a.bold) s = "**" + s + "**";
      const href = includeLinks && safeHttpUrl(t.href || t.text?.link?.url);
      if (href) {
        const label = s.replace(/\\/g, "\\\\").replace(/([\[\]])/g, "\\$1");
        const destination = href.replace(/\(/g, "%28").replace(/\)/g, "%29");
        s = `[${label}](${destination})`;
      }
      return s;
    }).join(lineBreak))
    .join("");

export async function blocksToMarkdown(blocks, postId, saveImage = async (url) => url) {
  const lines = [];
  let imgIndex = 0;
  // 숫자 목록은 깊이별로 연속 카운트를 매겨 1·2·3…을 살린다.
  const numCount = {}; // depth -> 현재 번호
  const resetNum = (depth) => { for (const d in numCount) if (+d >= depth) delete numCount[d]; };
  // 직전 "목록 항목"의 깊이(없으면 null) — 바로 뒤 이미지의 들여쓰기 판단용.
  let prevListDepth = null;
  // 표: table 블록을 만나면 모으기 시작하고, 뒤따르는 table_row를 셀로 쌓다가
  // 표가 끝나면(다른 블록을 만나거나 글 끝) 마크다운 표로 한꺼번에 flush 한다.
  let tableBuf = null; // { depth, hasHeader, rows: string[][] }
  const flushTable = () => {
    if (!tableBuf) return;
    const { depth, hasHeader, rows } = tableBuf;
    tableBuf = null;
    if (!rows.length) return;
    const tind = "  ".repeat(depth);
    const width = Math.max(...rows.map((r) => r.length));
    const esc = (c) => String(c).replace(/\|/g, "\\|").trim();
    const toRow = (cells) => {
      const c = cells.slice();
      while (c.length < width) c.push("");
      return tind + "| " + c.map(esc).join(" | ") + " |";
    };
    const sep = tind + "| " + Array(width).fill("---").join(" | ") + " |";
    // 헤더 있으면 첫 행을 헤더로, 없으면 빈 헤더행을 넣어 마크다운 표 형식을 맞춘다.
    if (hasHeader) {
      lines.push(toRow(rows[0]), sep);
      for (let r = 1; r < rows.length; r++) lines.push(toRow(rows[r]));
    } else {
      lines.push(tind + "| " + Array(width).fill(" ").join(" | ") + " |", sep);
      for (const r of rows) lines.push(toRow(r));
    }
  };

  for (const b of blocks) {
    const t = b.type;
    const data = b[t];
    // table_row가 아닌 블록을 만나면 진행 중이던 표를 마감한다.
    if (t !== "table_row" && tableBuf) flushTable();
    let depth = b._depth || 0;
    // 노션에선 형제(top-level)지만 바로 위 목록 항목 바로 뒤(빈 줄 없이)에 온 이미지는
    // 그 항목에 속한 것으로 보고 한 단계 들여쓴다 → 웹에서 불릿 자식으로 렌더된다.
    if (t === "image" && prevListDepth === depth) depth += 1;
    const ind = "  ".repeat(depth); // 중첩 1단계 = 공백 2칸 (Body 파서와 약속)
    // 숫자 목록이 아닌 블록을 만나면 그 깊이 이후의 번호 카운트를 초기화.
    // 단, 빈 문단(엔터)은 항목 사이 간격일 뿐이므로 번호를 리셋하지 않는다
    // (노션처럼 빈 줄로 떨어진 항목도 1·2·3…이 이어지게).
    const isEmptyPara = t === "paragraph" && !(data.rich_text ?? []).some((r) => r.plain_text.trim());
    if (t !== "numbered_list_item" && !isEmptyPara) resetNum(depth);

    switch (t) {
      case "image": {
        const src = data.type === "external" ? data.external?.url : data.file?.url;
        if (!src) break;
        imgIndex += 1;
        const caption = richToMd(data.caption ?? [], false, " ");
        try {
          const localPath = await saveImage(src, postId, imgIndex);
          lines.push(ind + `![${caption}](${localPath})`);
        } catch (e) {
          console.error(`  ⚠ 이미지 #${imgIndex} 건너뜀: ${e.message}`);
        }
        break;
      }
      case "heading_1":
        lines.push(ind + "# " + richToMd(data.rich_text));
        break;
      case "heading_2":
        lines.push(ind + "## " + richToMd(data.rich_text));
        break;
      case "heading_3":
        lines.push(ind + "### " + richToMd(data.rich_text));
        break;
      case "bulleted_list_item":
        lines.push(ind + "- " + richToMd(data.rich_text));
        break;
      case "numbered_list_item": {
        numCount[depth] = (numCount[depth] || 0) + 1;
        for (const d in numCount) if (+d > depth) delete numCount[d];
        lines.push(ind + numCount[depth] + ". " + richToMd(data.rich_text));
        break;
      }
      case "toggle":
        // ▸ 접두사로 토글임을 표시 → Body 파서가 <details>로 렌더
        lines.push(ind + "▸ " + richToMd(data.rich_text));
        break;
      case "quote":
        lines.push(ind + "> " + richToMd(data.rich_text));
        break;
      case "divider":
        lines.push("---");
        break;
      case "code": {
        // 코드펜스도 깊이만큼 들여쓴다 → 토글·목록 안의 코드가 자식으로 보존됨.
        // 내용은 마크다운 가공 없이 원문(plain_text) 그대로, 각 줄에 들여쓰기 부여.
        const lang = data.language && data.language !== "plain text" ? data.language : "";
        const code = (data.rich_text ?? []).map((t) => t.plain_text).join("");
        lines.push(ind + "```" + lang);
        for (const cl of code.split("\n")) lines.push(ind + cl);
        lines.push(ind + "```");
        break;
      }
      case "paragraph": {
        const md = richToMd(data.rich_text);
        // 빈 문단(엔터)도 깊이만큼 들여써서 보존 → 리스트/토글 안의 빈 줄이
        // 부모 밖으로 새어나가 다음 블록을 자식으로 삼키지 않게 한다.
        // (depth 0이면 ind=""이라 최상위 빈 줄은 그대로 빈 줄)
        lines.push(md ? ind + md : ind);
        break;
      }
      case "table":
        // 표 시작: 헤더 여부와 깊이만 기억하고, 셀은 뒤따르는 table_row에서 채운다.
        tableBuf = { depth, hasHeader: !!data.has_column_header, rows: [] };
        break;
      case "table_row":
        // 각 셀(rich_text 배열)을 인라인 마크다운으로 변환해 행에 쌓는다.
        if (tableBuf) tableBuf.rows.push((data.cells ?? []).map((cell) => richToMd(cell)));
        break;
      // 그 외 블록은 건너뜀 (현재 미지원)
      default:
        break;
    }
    // 다음 이미지 들여쓰기 판단: 목록 항목이면 깊이 기억, 이미지는 연결 유지(연속 이미지도 자식),
    // 그 외(빈 문단·헤딩 등)를 만나면 연결 끊김.
    if (t === "bulleted_list_item" || t === "numbered_list_item") prevListDepth = b._depth || 0;
    else if (t !== "image") prevListDepth = null;
  }
  flushTable(); // 글 끝에서 진행 중이던 표 마감
  // 과한 공백만 정리: 빈 줄 최대 6개까지 보존(연속 엔터를 더 충실히 반영)
  return lines.join("\n").replace(/\n{8,}/g, "\n\n\n\n\n\n\n").trim();
}
