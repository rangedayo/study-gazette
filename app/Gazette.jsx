"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import POSTS_DATA from "../data/posts.json";
import PROJECTS_DATA from "../data/projects.json";

/* ════════════════════════════════════════════════════════════
   The Study Gazette — 읽기 전용 전시 페이지 (포트폴리오 + 공부 정리)
   디자인: 활판 인쇄소(letterpress) 골격 + 차분한 슬레이트/그레이지 색감
   - 슬레이트블루 #5F7480 (메인) / 클레이 #9B7568 (포인트) / 쿨차콜 #2C313A (잉크)
   - 그레이지 바탕 #EBE9E3, 연한 그레이지 테두리 #C6C0B4, 이중 규칙선, 표제 구조
   - display: Playfair Display(블랙) / body: Inter / 캡션: DM Mono
   데이터: knowledge_garden 에디터의 저장소를 그대로 읽음 (글쓰기는 거기서)

   페이지 구성
   - Front Page : Featured + Latest 목록 + 사이드바(About 티저 · Categories)
   - About      : 편집자 소개 전용 페이지 (임시 내용, 추후 본인이 채움)
   - Archive    : AI 사서 챗봇 — 질문하면 관련 글을 카드로 추천
   - 상단 내비 아래 전용 검색 바(키워드 즉시 필터) · ⌘K 포커스
   ════════════════════════════════════════════════════════════ */

const C = {
  bg: "#F0EFEB", panel: "#FAF8F3", ink: "#2C313A", body: "#50545C", mute: "#928F86",
  rule: "#D5D1C8", mustard: "#5F7480", brick: "#9B7568", tintM: "#DEE3E3", tintB: "#E7DDD6",
  frame: "#C6C0B4", accentD: "#4C5E68",
};
const FD = "'Playfair Display', Georgia, serif";
const FB = "'Inter', -apple-system, system-ui, sans-serif";
const FM = "'DM Mono', ui-monospace, monospace";

const GitHubMark = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
  </svg>
);

const ExternalMark = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10"/>
    <path d="M9.5 2.5H13.5V6.5"/><path d="M7 9 13.5 2.5"/>
  </svg>
);

// 링크 label로 아이콘과 부제목을 고른다
const linkMeta = (label) => {
  if (/github/i.test(label)) return { Icon: GitHubMark, sub: "전체 코드와 파이프라인 보기" };
  if (/live/i.test(label)) return { Icon: ExternalMark, sub: "라이브 데모 열기" };
  if (/랜딩|landing/i.test(label)) return { Icon: ExternalMark, sub: "프로젝트 소개 페이지" };
  return { Icon: ExternalMark, sub: "바로가기" };
};

/* 화면(route) ↔ URL 해시 인코딩. 해시는 브라우저가 정확히 복원하므로
   App Router가 history.state를 덮어써도 뒤로/앞으로가 안전하게 동작한다. */
const SECTIONS = ["about", "archive", "projects"];
const encodeRoute = (r) => {
  if (!r || r.name === "home") return "";
  if (r.name === "cat") return "cat:" + encodeURIComponent(r.value);
  if (r.name === "post") return "post:" + r.id;
  if (r.name === "project") return "project:" + r.id;
  return r.name;
};
const decodeRoute = (hash) => {
  const s = (hash || "").replace(/^#/, "");
  if (!s) return { name: "home" };
  if (s.startsWith("cat:")) return { name: "cat", value: decodeURIComponent(s.slice(4)) };
  if (s.startsWith("post:")) return { name: "post", id: s.slice(5) };
  if (s.startsWith("project:")) return { name: "project", id: s.slice(8) };
  if (SECTIONS.includes(s)) return { name: s };
  return { name: "home" };
};

/* 생성 일러스트 — 이미지가 없는 글/프로젝트의 기본 썸네일 */
function Art({ seed }) {
  const h = [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const v = h % 5, a = (h % 50) - 25;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill={C.tintM} />
      {v === 0 && <><rect x="24" y="24" width="52" height="52" fill={C.mustard} opacity="0.9" /><circle cx="50" cy="50" r="20" fill="none" stroke={C.brick} strokeWidth="1.4" /><line x1="30" y1="50" x2="70" y2="50" stroke={C.ink} strokeWidth="1" /></>}
      {v === 1 && <><circle cx="56" cy="44" r={20 + (h % 6)} fill={C.mustard} opacity="0.85" /><path d={`M14 ${78 + a / 4} Q50 ${30 + a} 86 ${72 - a / 4}`} fill="none" stroke={C.ink} strokeWidth="1" opacity="0.6" /><circle cx="34" cy="62" r="9" fill="none" stroke={C.brick} strokeWidth="1.3" /></>}
      {v === 2 && <>{[...Array(4)].map((_, i) => <line key={i} x1={20 + i * 20} y1="22" x2={20 + i * 20 + a / 4} y2="78" stroke={C.ink} strokeWidth="0.9" opacity={0.3 + i * 0.12} />)}<rect x="38" y="40" width="24" height="24" fill={C.brick} opacity="0.7" /></>}
      {v === 3 && <><path d="M50 24 L72 64 L28 64 Z" fill={C.mustard} opacity="0.85" /><circle cx="50" cy="55" r="26" fill="none" stroke={C.brick} strokeWidth="1.3" strokeDasharray="3 3" /></>}
      {v === 4 && <><circle cx="50" cy="50" r="3" fill={C.brick} />{[...Array(3)].map((_, i) => <circle key={i} cx="50" cy="50" r={13 + i * 13} fill="none" stroke={C.ink} strokeWidth="0.8" opacity={0.45 - i * 0.12} />)}<rect x="62" y="20" width="16" height="16" fill={C.mustard} opacity="0.8" transform={`rotate(${a} 70 28)`} /></>}
    </svg>
  );
}

/* 이미지 + Art 폴백 (프로젝트 스크린샷·글 커버 공용) — src가 없거나 404면 Art로 안전하게 폴백 */
function ProjImage({ src, seed, alt, fit = "cover", pos = "top center" }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <Art seed={seed} />;
  const style = fit === "natural"
    ? { width: "100%", height: "auto", display: "block" }
    : { width: "100%", height: "100%", objectFit: fit, objectPosition: pos, display: "block" };
  return <img src={src} alt={alt} loading="lazy" onError={() => setErr(true)} style={style} />;
}

const DEMO = [
  { id: "d1", title: "PaLM-E: 로봇을 제어하는 멀티모달 지능", category: "AI 모델 이론", pinned: true,
    tags: ["멀티모달", "embodied", "디퓨전"], created: Date.now() - 5 * 864e5, updated: Date.now() - 5 * 864e5,
    body: "PaLM(거대 언어 모델) + Embodied(현실 세계)의 합성어. 시각·로봇 상태·텍스트를 모두 '단어'처럼 한 줄로 이어 LLM에 넣고, 다음 행동을 텍스트로 출력해 로봇 제어 명령으로 바꾼다.\n\n## 통합형 멀티모달\n모든 모달리티를 하나의 언어 공간에서 해석하므로 문맥에 맞는 도구 사용 결정에 능숙하다. 대신 거대 모델을 전체 튜닝해야 해 학습 비용이 크다." },
  { id: "d2", title: "이미지 생성모델의 시작 : GAN과 VAE", category: "AI 모델 이론", pinned: false,
    tags: ["LatentSpace", "StableDiffusion"], created: Date.now() - 4 * 864e5, updated: Date.now() - 4 * 864e5,
    body: "GAN은 Generator와 Discriminator가 대결하며 성능을 높인다. VAE는 데이터를 평균·표준편차를 따르는 정규분포 상의 점으로 변환해 잠재 공간을 연속적으로 만든다.\n\n최신 모델은 거대한 형체는 확산 모델로 잡고, 미세한 질감·색감 복원은 VAE로 처리한다." },
  { id: "d3", title: "AI 코딩 에이전트, 이렇게 길들인다", category: "AI 개발 도구", pinned: false,
    tags: ["Claude Code", "skill", "MCP"], created: Date.now() - 3 * 864e5, updated: Date.now() - 3 * 864e5,
    body: "agents.md에 프로젝트 규칙과 선호 도구를 적어두면 매번 같은 잔소리를 반복할 필요가 없다. Karpathy 가이드라인은 'AI 코딩의 잔병 치료제'로, CLAUDE.md 한 파일에 규칙 4개를 박는 가장 가벼운 형태다." },
  { id: "d4", title: "ML 배포 워크플로우 — 당신은 구글이 아닙니다", category: "MLOps / 배포", pinned: false,
    tags: ["MLOps", "배포", "FoundationModel"], created: Date.now() - 2 * 864e5, updated: Date.now() - 2 * 864e5,
    body: "핵심 질문은 '우리가 정말 이 문제를 ML로 풀어야 하는가?' 규칙 기반으로 80% 성능이 나오면 그게 더 경제적이다. 2026년 현재 많은 NLP 과제는 Foundation Model API 호출만으로 충분하다.\n\n처음부터 거대한 인프라를 구축하지 마라. 수동으로 주 1회 재학습도 훌륭한 초기 플라이휠이다." },
];

/* 프로젝트 스크린샷(히어로·썸네일)은 코드에서 관리 — projects.json(텍스트)와 id로 병합.
   스크린샷 교체는 이 맵을 수정하면 된다. */
const PROJECT_SHOTS = {
  p1: { thumb: "/projects/01-home.png", shots: ["/projects/01-home.png", "/projects/02-result.png", "/projects/03-refine.png", "/projects/04-refine-result.png", "/projects/05-myplants.png"] },
  p2: { thumb: "/projects/ess-dashboard.png", wide: "/projects/ess-dashboard.png" },
};
const PROJECTS = (Array.isArray(PROJECTS_DATA) ? [...PROJECTS_DATA] : [])
  .sort((a, b) => (b.created || 0) - (a.created || 0))
  .map((p) => ({ ...p, ...(PROJECT_SHOTS[p.id] || {}) }));

/* Mermaid 다이어그램 — 클라이언트에서만 동적 렌더. 로딩/실패 시 코드 블록으로 폴백 */
function Mermaid({ chart }) {
  const [svg, setSvg] = useState("");
  const idRef = useRef("mmd-" + Math.floor(Math.random() * 1e9).toString(36));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "loose",
          fontFamily: "'DM Mono', ui-monospace, monospace" });
        const { svg } = await mermaid.render(idRef.current, chart);
        if (!cancelled) setSvg(svg);
      } catch (e) { if (!cancelled) setSvg(""); }
    })();
    return () => { cancelled = true; };
  }, [chart]);
  if (!svg) return <pre className="g-pre">{chart}</pre>;
  return <div className="g-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* 인라인 마크다운(***굵은이태릭***·**굵게**·*이태릭*·`코드`) → React 노드 */
const inlineMd = (s) =>
  String(s)
    .split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    .map((p, i) =>
      p?.startsWith("***") ? <strong key={i}><em>{p.slice(3, -3)}</em></strong> :
      p?.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> :
      p?.startsWith("*") ? <em key={i}>{p.slice(1, -1)}</em> :
      p?.startsWith("`") ? <code key={i} className="g-code">{p.slice(1, -1)}</code> :
      <span key={i}>{p}</span>
    );

/* 한 줄을 종류 + 들여쓰기 깊이(공백 2칸 = 1단계)로 분류 */
const classifyLine = (raw) => {
  const m = raw.match(/^([ \t]*)(.*)$/);
  const depth = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
  const s = m[2];
  if (s.trim() === "") return { kind: "blank", depth, text: "" };
  if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(s)) return { kind: "img", depth, text: s };
  if (/^### /.test(s)) return { kind: "h3", depth, text: s.slice(4) };
  if (/^## /.test(s)) return { kind: "h2", depth, text: s.slice(3) };
  if (/^# /.test(s)) return { kind: "h2", depth, text: s.slice(2) };
  if (/^> /.test(s)) return { kind: "quote", depth, text: s.slice(2) };
  if (/^▸ /.test(s)) return { kind: "toggle", depth, text: s.slice(2) };
  if (/^- /.test(s)) return { kind: "li", depth, text: s.slice(2) };
  const om = s.match(/^(\d+)\.\s+(.*)$/);
  if (om) return { kind: "oli", depth, text: om[2], num: parseInt(om[1], 10) };
  return { kind: "p", depth, text: s };
};

/* 들여쓰기 깊이로 트리 구성 (자식 = 뒤따르는 더 깊은 줄) */
const buildTree = (items, start, depth) => {
  const nodes = [];
  let i = start;
  while (i < items.length) {
    if (items[i].depth < depth) break;
    const node = { ...items[i], depth, children: [] };
    let j = i + 1;
    // 빈 줄은 단순 구분자 — 뒤따르는 더 깊은 줄을 자식으로 삼키지 않는다
    // (삼키면 렌더 시 빈 줄의 자식이 통째로 버려져 내용이 누락됨)
    if (items[i].kind !== "blank") {
      const childStart = j;
      while (j < items.length && items[j].depth > depth) j++;
      if (j > childStart) node.children = buildTree(items, childStart, depth + 1);
    }
    nodes.push(node);
    i = j;
  }
  return nodes;
};

function Body({ text, onImg }) {
  let uid = 0;

  const renderLeaf = (n) => {
    const k = "L" + uid++;
    if (n.kind === "mermaid") return <Mermaid key={k} chart={n.text} />;
    if (n.kind === "code") return <pre key={k} className="g-pre">{n.text}</pre>;
    if (n.kind === "img") {
      const [, rawAlt, src] = n.text.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      // 캡션 안의 너비 토큰 {50%}·{400px}·{w=60%} → 표시 너비로 적용하고 캡션에선 제거
      const wRe = /\{\s*(?:w\s*=\s*)?(\d+)\s*(%|px)?\s*\}/i;
      const wm = rawAlt.match(wRe);
      const width = wm ? wm[1] + (wm[2] || "px") : null;
      const alt = rawAlt.replace(wRe, "").trim();
      const imgStyle = width ? { width, maxWidth: "100%" } : undefined;
      return (
        <figure key={k} className="g-fig">
          <img className="g-img" style={imgStyle} src={src} alt={alt} loading="lazy" onClick={onImg ? () => onImg(src) : undefined} />
          {alt ? <figcaption className="g-cap">{alt}</figcaption> : null}
        </figure>
      );
    }
    if (n.kind === "table") {
      const hasHead = (n.header || []).some((c) => c.trim() !== "");
      return (
        <div key={k} className="g-table-wrap">
          <table className="g-table">
            {hasHead ? (
              <thead><tr>{n.header.map((c, ci) => <th key={ci}>{inlineMd(c)}</th>)}</tr></thead>
            ) : null}
            <tbody>
              {n.rows.map((row, ri) => (
                <tr key={ri}>{row.map((c, ci) => <td key={ci}>{inlineMd(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (n.kind === "h3") return <h3 key={k} className="g-h3">{inlineMd(n.text)}</h3>;
    if (n.kind === "h2") return <h2 key={k} className="g-h2">{inlineMd(n.text)}</h2>;
    if (n.kind === "quote") return <blockquote key={k} className="g-quote">{inlineMd(n.text)}</blockquote>;
    return <p key={k} className="g-p">{inlineMd(n.text)}</p>;
  };

  const renderNodes = (nodes) => {
    const out = [];
    let i = 0;
    while (i < nodes.length) {
      const n = nodes[i];
      // 불릿/숫자 목록: 같은 종류가 이어지면 한 ul/ol로 묶는다
      if (n.kind === "li" || n.kind === "oli") {
        const ordered = n.kind === "oli";
        const group = [];
        while (i < nodes.length && nodes[i].kind === (ordered ? "oli" : "li")) { group.push(nodes[i]); i++; }
        const items = group.map((g) => (
          <li key={"i" + uid++}>{inlineMd(g.text)}{g.children.length ? renderNodes(g.children) : null}</li>
        ));
        out.push(ordered
          ? <ol key={"o" + uid++} className="g-ol" start={group[0].num || 1}>{items}</ol>
          : <ul key={"u" + uid++} className="g-ul">{items}</ul>);
        continue;
      }
      // 토글: <details>로 접기/펼치기 (기본 접힘)
      if (n.kind === "toggle") {
        out.push(
          <details key={"t" + uid++} className="g-toggle">
            <summary>{inlineMd(n.text)}</summary>
            <div className="g-toggle-body">{renderNodes(n.children)}</div>
          </details>
        );
        i++; continue;
      }
      // 빈 줄: 노션의 빈 문단(엔터)을 실제 간격으로 보존 → 1줄도 보이게, 연속이면 그만큼
      if (n.kind === "blank") {
        let c = 0;
        while (i < nodes.length && nodes[i].kind === "blank") { c++; i++; }
        const h = Math.min(c, 6) * 1.05;
        out.push(<div key={"g" + uid++} className="g-gap" style={{ height: h + "rem" }} />);
        continue;
      }
      // 그 외(제목·인용·이미지·문단) + 들여쓴 자식은 g-sub로 들여쓰기
      out.push(renderLeaf(n));
      if (n.children.length) out.push(<div key={"s" + uid++} className="g-sub">{renderNodes(n.children)}</div>);
      i++;
    }
    return out;
  };

  // 줄 단위 렉싱: 코드펜스(들여쓰기 포함)를 하나의 code/mermaid 아이템으로 묶어
  // 토글·목록 안의 코드도 트리 자식으로 들어가게 한다(전역 ``` 분리 대신).
  const rawLines = String(text).split("\n");
  const items = [];
  for (let i = 0; i < rawLines.length; i++) {
    const fence = rawLines[i].match(/^([ \t]*)```(.*)$/);
    if (fence) {
      const indent = fence[1].replace(/\t/g, "  ");
      const depth = Math.floor(indent.length / 2);
      const lang = fence[2].trim();
      const buf = [];
      i++;
      while (i < rawLines.length && !/^[ \t]*```\s*$/.test(rawLines[i])) {
        const r = rawLines[i];
        buf.push(r.startsWith(indent) ? r.slice(indent.length) : r.replace(/^[ \t]+/, ""));
        i++;
      }
      items.push({ kind: lang === "mermaid" ? "mermaid" : "code", depth, text: buf.join("\n"), lang });
      continue;
    }
    // 표: 헤더행( |..|..| ) + 구분행( |---|---| ) + 본문행들을 하나의 table 아이템으로 묶는다
    const isPipe = (l) => l != null && /^[ \t]*\|.*\|[ \t]*$/.test(l);
    const isSep = (l) => l != null && /-/.test(l) && /^[ \t]*\|[ \t:|-]+\|[ \t]*$/.test(l);
    if (isPipe(rawLines[i]) && !isSep(rawLines[i]) && isSep(rawLines[i + 1])) {
      const indent = (rawLines[i].match(/^[ \t]*/)[0]).replace(/\t/g, "  ");
      const depth = Math.floor(indent.length / 2);
      const cells = (l) =>
        l.trim().replace(/^\|/, "").replace(/\|$/, "")
          .split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
      const header = cells(rawLines[i]);
      const rows = [];
      i += 2; // 헤더·구분행 건너뜀
      while (isPipe(rawLines[i])) { rows.push(cells(rawLines[i])); i++; }
      i--; // for 루프의 i++ 보정
      items.push({ kind: "table", depth, header, rows });
      continue;
    }
    items.push(classifyLine(rawLines[i]));
  }
  // 깊이가 한 번에 1단계 넘게 건너뛰지 않도록 정규화. 빈 줄도 클램프하되
  // prev(직전 깊이)는 비-빈줄에서만 갱신 — 빈 줄이 깊이 흐름을 흔들지 않게.
  let prev = 0;
  for (const it of items) {
    if (it.depth > prev + 1) it.depth = prev + 1;
    if (it.kind !== "blank") prev = it.depth;
  }
  // 빈 줄의 깊이를 "다음 실제 내용"의 깊이로 맞춘다. 노션이 항목 사이 빈 문단을
  // 얕은 깊이(0)로 줘도, 빈 줄이 부모를 조기에 닫아 뒤 내용을 밖으로 빼지 않게.
  for (let k = 0; k < items.length; k++) {
    if (items[k].kind !== "blank") continue;
    let n = k + 1;
    while (n < items.length && items[n].kind === "blank") n++;
    items[k].depth = n < items.length ? items[n].depth : 0;
  }
  return <>{renderNodes(buildTree(items, 0, 0))}</>;
}

const clean = (b) => String(b).replace(/```[\s\S]*?```/g, " ").replace(/[#>*`\[\]▸•]/g, "").replace(/\s+/g, " ").trim();
const fmt = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const readMin = (b) => Math.max(1, Math.round(clean(b).length / 350)) + " min read";

/* 돋보기 아이콘 */
const Magnifier = ({ size = 13, color = C.ink, sw = 1.3 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" stroke={color} strokeWidth={sw} />
    <line x1="9.5" y1="9.5" x2="13" y2="13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
  </svg>
);

export default function StudyGazette() {
  const [posts, setPosts] = useState(null);
  const [route, setRoute] = useState({ name: "home" });
  const [lightbox, setLightbox] = useState(null); // 원본 보기용 이미지 src

  /* Archive AI 챗봇 상태 */
  const [chatInput, setChatInput] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [chatResult, setChatResult] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  /* 검색창 태그 자동완성 */
  const [acOpen, setAcOpen] = useState(false);
  const [acIdx, setAcIdx] = useState(-1);

  useEffect(() => {
    const arr = Array.isArray(POSTS_DATA) && POSTS_DATA.length ? POSTS_DATA : DEMO;
    setPosts(arr.map((x) => ({ category: "기타", pinned: false, tags: [], ...x })));
  }, []);

  /* ⌘K / Ctrl+K → 메인 검색창 포커스 */
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); document.getElementById("gz-main-search")?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* 라이트박스: Esc로 닫기 */
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  /* 브라우저 뒤로/앞으로 가기 ↔ 화면(route) 상태 동기화 (URL 해시 기반) */
  useEffect(() => {
    const sync = () => { setRoute(decodeRoute(window.location.hash)); window.scrollTo({ top: 0 }); };
    sync(); // 새로고침/직접진입 시 해시로부터 화면 복원
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const sorted = useMemo(() => [...(posts || [])].sort((a, b) => b.updated - a.updated), [posts]);
  const featured = useMemo(() => sorted.find((p) => p.pinned) || sorted[0], [sorted]);
  const rest = useMemo(() => sorted.filter((p) => p.id !== featured?.id), [sorted, featured]);
  const cats = useMemo(() => {
    const m = {}; (posts || []).forEach((p) => (m[p.category] = (m[p.category] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  /* 전 글의 태그 모음 (빈도순) */
  const allTags = useMemo(() => {
    const m = {}; (posts || []).forEach((p) => (p.tags || []).forEach((t) => (m[t] = (m[t] || 0) + 1)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ tag: t, n }));
  }, [posts]);

  /* 입력값에 매칭되는 태그 (자동완성용, 최대 6개) */
  const acTags = useMemo(() => {
    const q = chatInput.trim().toLowerCase();
    if (!q) return [];
    return allTags.filter(({ tag }) => tag.toLowerCase().includes(q)).slice(0, 6);
  }, [chatInput, allTags]);

  /* 모든 화면 전환은 goTo를 거쳐 URL 해시에 기록 → 브라우저 뒤로가기가 정확히 복원 */
  const goTo = useCallback((r) => {
    const h = encodeRoute(r);
    const url = window.location.pathname + window.location.search + (h ? "#" + h : "");
    window.history.pushState(null, "", url);
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);
  const open = useCallback((id) => goTo({ name: "post", id }), [goTo]);
  const openProject = useCallback((id) => goTo({ name: "project", id }), [goTo]);
  const goHome = () => goTo({ name: "home" });
  const goto = (name) => goTo({ name });
  /* 인페이지 뒤로가기 = 브라우저 뒤로가기와 동일하게 직전 화면으로 */
  const goBack = () => { if (window.history.length > 1) window.history.back(); else goTo({ name: "home" }); };
  const backLabel = "← Back";
  const cur = (posts || []).find((p) => p.id === route.id);
  const curProj = PROJECTS.find((p) => p.id === route.id);
  const catPosts = route.name === "cat" ? sorted.filter((p) => p.category === route.value) : [];

  /* 현재 글이 속한 카테고리 안에서 이전·다음 글 (시간 역순 기준) */
  const sameCat = useMemo(() => (cur ? sorted.filter((p) => p.category === cur.category) : []), [sorted, cur]);
  const curIdx = cur ? sameCat.findIndex((p) => p.id === cur.id) : -1;
  const prevPost = curIdx > 0 ? sameCat[curIdx - 1] : null;
  const nextPost = curIdx >= 0 && curIdx < sameCat.length - 1 ? sameCat[curIdx + 1] : null;

  /* ── AI 사서: 질문 → 관련 글 id 추천 ── */
  const runAISearch = useCallback(async (q) => {
    const question = (q ?? chatInput).trim();
    if (!question || chatLoading) return;
    setChatLoading(true); setChatError(null); setChatResult(null); setChatQuery(question);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error("bad status " + res.status);
      const parsed = await res.json();
      const matched = (parsed.ids || []).map((id) => sorted.find((p) => p.id === id)).filter(Boolean);
      setChatResult({ message: parsed.message || "", posts: matched });
    } catch (e) {
      setChatError("검색을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, sorted]);

  const suggestions = ["언어모델 관련 글 보여줘", "MLOps 배포 이야기", "AI 코딩 도구 정리", "이미지 생성모델 글"];

  /* 메인 검색창에서 Archive로 이동하며 AI 검색 실행 */
  const submitFromMain = (q) => {
    const question = (q ?? chatInput).trim();
    if (!question) return;
    setAcOpen(false); setAcIdx(-1);
    goTo({ name: "archive" });
    setTimeout(() => runAISearch(question), 80);
  };

  /* 자동완성 키보드 조작 */
  const onMainKeyDown = (e) => {
    if (acOpen && acTags.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setAcIdx((i) => (i + 1) % acTags.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setAcIdx((i) => (i - 1 + acTags.length) % acTags.length); return; }
      if (e.key === "Enter" && acIdx >= 0) { e.preventDefault(); const t = acTags[acIdx].tag; setChatInput(t); submitFromMain(t); return; }
      if (e.key === "Escape") { setAcOpen(false); setAcIdx(-1); return; }
    }
    if (e.key === "Enter" && chatInput.trim()) submitFromMain();
  };

  if (!posts) return <div style={{ minHeight: "100vh", background: C.bg }} />;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
    .gz *{box-sizing:border-box} .gz{background:${C.bg};color:${C.body};font-family:${FB};-webkit-font-smoothing:antialiased;
      background-image:linear-gradient(${C.ink}08 1px,transparent 1px);background-size:100% 30px}
    .gz button{cursor:pointer;font-family:${FB}} .gz a{cursor:pointer}
    .eyebrow{font-family:${FB};font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:${C.brick};font-weight:600}
    .kicker{font-family:${FM};font-size:11px;letter-spacing:.12em;color:${C.mute};text-transform:uppercase}
    .dbl-top{border-top:3px double ${C.ink}} .dbl-bot{border-bottom:3px double ${C.ink}}
    .g-h2{font-family:${FD};font-weight:700;font-size:1.5rem;color:${C.ink};margin:1.9rem 0 .6rem;line-height:1.25}
    .g-h3{font-family:${FD};font-weight:700;font-size:1.2rem;color:${C.ink};margin:1.4rem 0 .4rem}
    .g-p{margin:.7rem 0;line-height:1.85;font-size:.97rem;color:${C.body}}
    .g-ul{margin:.6rem 0 1rem;padding:0;list-style:none}
    .g-ul>li{position:relative;padding-left:1.3rem;margin:.4rem 0;line-height:1.7;font-size:.97rem;color:${C.body}}
    .g-ul>li:before{content:"•";position:absolute;left:0;color:${C.mustard};font-weight:700}
    .g-bull>li:before{content:"•"}
    .g-ol{margin:.6rem 0 1rem;padding-left:1.55rem;list-style:decimal}
    .g-ol>li{margin:.4rem 0;line-height:1.7;padding-left:.2rem;font-size:.97rem;color:${C.body}}
    .g-ol>li::marker{color:${C.mustard};font-weight:700}
    .g-ul .g-ul,.g-ul .g-ol,.g-ol .g-ul,.g-ol .g-ol{margin:.3rem 0 .35rem}
    .g-sub{margin-left:1.3rem}
    .g-toggle{margin:.7rem 0;border-left:2px solid ${C.frame};padding:.05rem 0 .05rem .75rem}
    .g-toggle>summary{cursor:pointer;font-weight:600;color:${C.ink};font-size:.97rem;list-style:none;outline:none}
    .g-toggle>summary::-webkit-details-marker{display:none}
    .g-toggle>summary:before{content:"▸";color:${C.mustard};font-weight:700;margin-right:.45rem;display:inline-block;transition:transform .15s ease}
    .g-toggle[open]>summary:before{transform:rotate(90deg)}
    .g-toggle-body{margin:.35rem 0 .15rem}
    .g-quote{border-left:3px solid ${C.mustard};margin:1.2rem 0;padding:.3rem 0 .3rem 1.1rem;color:${C.ink};font-style:italic;font-family:${FD};font-size:1.16rem}
    .g-code{background:${C.tintM};color:${C.ink};padding:.08em .4em;border-radius:2px;font-size:.9em;font-family:${FM}}
    .g-pre{background:${C.panel};color:${C.ink};border:1px solid ${C.rule};border-radius:3px;padding:1rem;overflow-x:auto;font-size:.85rem;line-height:1.6;margin:1rem 0;font-family:${FM}}
    .g-fig{margin:1.7rem 0;text-align:center}
    .g-img{max-width:100%;height:auto;border:1px solid ${C.frame};border-radius:4px;cursor:zoom-in;box-shadow:0 6px 18px rgba(44,49,58,.12);display:block;margin:0 auto}
    .g-cap{margin-top:.5rem;font-family:${FM};font-size:.8rem;color:${C.ink};opacity:.7}
    .g-mermaid{margin:1.6rem 0;padding:1.2rem;background:${C.panel};border:1px solid ${C.frame};border-radius:3px;text-align:center;overflow-x:auto}
    .g-table-wrap{margin:1.5rem 0;overflow-x:auto;border:1px solid ${C.frame};border-radius:3px}
    .g-table{border-collapse:collapse;width:100%;font-family:${FB};font-size:.92rem;color:${C.body}}
    .g-table th,.g-table td{border:1px solid ${C.frame};padding:.5rem .75rem;text-align:left;vertical-align:top;line-height:1.6}
    .g-table th{background:${C.panel};color:${C.ink};font-family:${FD};font-weight:700;white-space:nowrap}
    .g-table tbody tr:nth-child(even) td{background:rgba(44,49,58,.025)}
    .g-mermaid svg{max-width:100%;height:auto}
    .navlink{font-family:${FB};font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${C.body};padding:.3rem 0;background:none;border:none;position:relative}
    .navlink:hover{color:${C.ink}} .navlink.on{color:${C.ink}}
    .navlink.on:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:${C.mustard}}
    .ed{background:${C.mustard};color:${C.bg};border:1.5px solid ${C.accentD};border-radius:2px;padding:11px 26px;font-family:${FB};font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;transition:background .3s ease}
    .ed:hover{background:${C.brick}} .ed:disabled{opacity:.55;cursor:default}
    .chip{font-family:${FM};font-size:12px;color:${C.body};background:${C.panel};border:1px solid ${C.rule};border-radius:2px;padding:6px 12px;transition:border-color .3s ease,color .3s ease,background .3s ease}
    .chip:hover{border-color:${C.ink};color:${C.ink};background:${C.tintM}}

    /* 글 카드 hover ③ — 떠오름 + 잉크 그림자 + 제목 색 */
    .hov{cursor:pointer;transition:transform .3s ease,box-shadow .3s ease}
    .hov .ttl{transition:color .3s ease}
    .hov:hover{transform:translateY(-4px);box-shadow:0 10px 24px rgba(44,49,58,.12)}
    .hov:hover .ttl{color:${C.brick} !important}

    /* 프로젝트 카드 hover ③ — 떠오름 + 잉크 그림자 + 화살표 */
    .proj{cursor:pointer;transition:transform .3s ease,box-shadow .3s ease}
    .proj:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(44,49,58,.13)}
    .proj h2{transition:color .3s ease}
    .proj:hover h2{color:${C.brick} !important}
    .proj .proj-go{font-family:${FM};font-size:12px;color:${C.mustard};opacity:0;transform:translateX(-6px);transition:opacity .3s ease,transform .3s ease}
    .proj:hover .proj-go{opacity:1;transform:translateX(0)}
    .proj-thumb{position:relative;overflow:hidden;border-right:1px solid ${C.frame};min-height:220px;background:${C.panel}}
    .proj-thumb svg{width:100%;height:100%;display:block}
    .proj-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
    /* 프로젝트 스크린샷 페이퍼 타일 (상세 히어로) */
    .proj-shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:12px;align-items:start;background:${C.panel};padding:22px 18px;margin:0 0 2rem;overflow:hidden}
    .proj-shots .tile{width:100%;aspect-ratio:9/16;padding:0;border:1px solid ${C.frame};border-radius:7px;overflow:hidden;background:#fff;box-shadow:0 6px 18px rgba(44,49,58,.13);cursor:zoom-in;transition:transform .2s ease,box-shadow .2s ease}
    .proj-shots .tile:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(44,49,58,.2)}
    .proj-shots .tile img,.proj-shots .tile svg{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
    /* 가로형 대시보드 (상세 히어로, 풀폭 한 장) */
    .proj-wide{display:block;width:100%;padding:0;border-left:none;border-right:none;background:${C.panel};margin:0 0 2rem;cursor:zoom-in;overflow:hidden}
    .proj-wide img{display:block;width:100%;height:auto}
    .proj-wide svg{display:block;width:100%;height:300px}
    /* 라이트박스 (원본 보기) */
    .lb{position:fixed;inset:0;z-index:100;background:rgba(20,22,26,.85);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:36px 20px;cursor:zoom-out;animation:lbfade .18s ease}
    @keyframes lbfade{from{opacity:0}to{opacity:1}}
    .lb img{max-width:min(1800px,97vw);max-height:96vh;width:auto;height:auto;border-radius:8px;box-shadow:0 24px 70px rgba(0,0,0,.55);cursor:default}
    .lb-close{position:fixed;top:14px;right:20px;width:42px;height:42px;border:none;background:rgba(255,255,255,.12);color:#fff;font-size:26px;line-height:1;border-radius:50%;cursor:pointer;transition:background .2s ease}
    .lb-close:hover{background:rgba(255,255,255,.25)}
    .proj-link{font-family:${FM};font-size:12px;letter-spacing:.04em;color:${C.brick};border-bottom:1.5px solid ${C.brick};padding-bottom:1px;text-decoration:none;transition:color .3s ease,border-color .3s ease}
    .proj-link:hover{color:${C.ink};border-color:${C.ink}}
    .proj-link.off{color:${C.mute};border-color:${C.rule};cursor:default}
    .lnk-cta{display:flex;align-items:center;gap:14px;text-decoration:none;border:1.5px solid ${C.frame};background:${C.panel};border-radius:3px;padding:14px 18px;transition:border-color .25s ease,background .25s ease,box-shadow .25s ease}
    .lnk-cta:hover{border-color:${C.accentD};background:#FCFBF8;box-shadow:0 4px 14px rgba(44,49,58,.08)}
    .lnk-cta .ic{flex:none;width:38px;height:38px;border-radius:50%;background:${C.ink};color:${C.bg};display:flex;align-items:center;justify-content:center;transition:background .25s ease}
    .lnk-cta:hover .ic{background:${C.accentD}}
    .lnk-cta .ic svg{width:20px;height:20px;display:block}
    .lnk-cta .tx{flex:1;min-width:0}
    .lnk-cta .t1{font-family:${FB};font-weight:600;color:${C.ink};font-size:.98rem;letter-spacing:.01em}
    .lnk-cta .t2{font-size:.8rem;color:${C.body};margin-top:1px}
    .lnk-cta .arr{flex:none;color:${C.brick};font-size:1.15rem;transition:transform .25s ease}
    .lnk-cta:hover .arr{transform:translate(2px,-2px)}
    .lnk-cta.off{cursor:default;opacity:.6}
    .lnk-cta.off:hover{border-color:${C.frame};background:${C.panel};box-shadow:none}
    .lnk-cta.off .ic{background:${C.mute}}
    @media(max-width:760px){.proj{grid-template-columns:1fr !important}.proj-thumb{border-right:none !important;border-bottom:1px solid ${C.frame};min-height:160px}}

    /* Read more / Categories / nav 부드러운 색 전환 */
    .readmore{transition:color .3s ease,border-color .3s ease}
    .readmore:hover{color:${C.ink} !important;border-color:${C.ink} !important}
    .cat-row{transition:color .3s ease,padding-left .3s ease}
    .cat-row .cat-name{transition:color .3s ease}
    .cat-row:hover{padding-left:6px}
    .cat-row:hover .cat-name{color:${C.brick} !important}
    .navlink{transition:color .25s ease}

    /* 검색 자동완성 드롭다운 */
    .ac-wrap{position:relative}
    .ac-list{position:absolute;left:0;right:0;top:calc(100% + 4px);background:${C.panel};border:1.5px solid ${C.frame};border-radius:2px;z-index:40;max-height:240px;overflow-y:auto;box-shadow:0 8px 22px rgba(44,49,58,.10)}
    .ac-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid ${C.rule};padding:9px 14px;font-family:${FM};font-size:13px;color:${C.body};cursor:pointer;transition:background .2s ease}
    .ac-item:last-child{border-bottom:none}
    .ac-item:hover,.ac-item.act{background:${C.tintM};color:${C.ink}}
    .ac-hash{color:${C.mustard};font-weight:600}

    /* 이전/다음 글 카드 — hover ② 좌측 머스터드 바 */
    .pn-card{position:relative;display:flex;flex-direction:column;border:1px solid ${C.frame};background:${C.panel};cursor:pointer;overflow:hidden}
    .pn-card .pn-bar{position:absolute;left:0;top:0;bottom:0;width:0;background:${C.mustard};z-index:3;transition:width .3s ease}
    .pn-card .pn-body{transition:padding-left .3s ease}
    .pn-card .ttl{transition:color .3s ease}
    .pn-card:hover .pn-bar{width:6px}
    .pn-card:hover .pn-body{padding-left:6px}
    .pn-card:hover .ttl{color:${C.brick} !important}

    .search-cta:hover{background:${C.tintM}}
    .ai-btn{transition:background .3s ease}
    .ai-btn:hover{background:${C.ink} !important}
    .gz-input{border:none;background:transparent;outline:none;color:${C.ink};font-family:${FB};letter-spacing:.01em;width:100%}
    .gz-input::placeholder{color:${C.mute}}
    /* 검색바 포커스 — 바탕 밝아짐 + 슬레이트 링 (쓰는 중 인지) */
    .searchbar{transition:background .25s ease,border-color .25s ease,box-shadow .25s ease}
    .searchbar:focus-within{background:#FCFBF8 !important;border-color:${C.accentD} !important;box-shadow:0 0 0 3px rgba(95,116,128,.16)}
    .blink{animation:bk 1s steps(2,start) infinite} @keyframes bk{to{opacity:.2}}
    @media(max-width:820px){.grid2{grid-template-columns:1fr !important}.hide-sm{display:none !important}.masthead h1{font-size:2.6rem !important}}
  `;

  /* 머스터드/벽돌 톤 추상 동판화 일러스트 (실사진 대체, 제목에서 결정) */
  /* Art, ProjImage 는 모듈 레벨로 이동 (파일 상단) */

  /* 가로형 목록 아이템 (Front Page / 카테고리 / 검색 결과) */
  const ListItem = ({ p }) => (
    <article className="hov" style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "1.5rem", padding: "1.4rem", marginBottom: "1.1rem", border: `1px solid ${C.frame}`, background: C.panel }} onClick={() => open(p.id)}>
      <div style={{ height: 120, border: `1px solid ${C.frame}`, overflow: "hidden" }}><ProjImage src={p.thumb} seed={p.id + p.title} alt={p.title} /></div>
      <div>
        <div className="kicker" style={{ marginBottom: 8 }}>{p.category} · {fmt(p.updated)}</div>
        <h3 className="ttl" style={{ fontFamily: FD, fontWeight: 700, fontSize: "1.34rem", color: C.ink, lineHeight: 1.2, margin: "0 0 .5rem" }}>{p.title}</h3>
        <p style={{ margin: 0, color: C.body, fontSize: ".9rem", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{clean(p.body).slice(0, 150)}</p>
        <div style={{ marginTop: ".7rem" }}>{(p.tags || []).slice(0, 3).map((t) => <span key={t} style={{ fontFamily: FM, fontSize: 11, color: C.mute, marginRight: 12 }}>#{t}</span>)}</div>
      </div>
    </article>
  );

  /* 세로형 카드 (AI 사서 추천 결과) */
  const ResultCard = ({ p }) => (
    <div className="hov" onClick={() => open(p.id)} style={{ background: C.panel, border: `1px solid ${C.frame}`, borderRadius: 2, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 96, borderBottom: `1px solid ${C.frame}`, overflow: "hidden" }}><ProjImage src={p.thumb} seed={p.id + p.title} alt={p.title} /></div>
      <div style={{ padding: "10px 13px 13px" }}>
        <div className="kicker" style={{ marginBottom: 6, fontSize: 10 }}>{p.category}</div>
        <h3 className="ttl" style={{ fontFamily: FD, fontWeight: 700, fontSize: "1.08rem", color: C.ink, lineHeight: 1.25, margin: "0 0 .4rem" }}>{p.title}</h3>
        <p style={{ margin: 0, fontSize: ".86rem", color: C.body, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{clean(p.body).slice(0, 96)}</p>
        <div style={{ marginTop: 8 }}>{(p.tags || []).slice(0, 3).map((t) => <span key={t} style={{ fontFamily: FM, fontSize: 10, color: C.mute, marginRight: 10 }}>#{t}</span>)}</div>
      </div>
    </div>
  );

  return (
    <div className="gz">
      <style>{css}</style>

      {/* ── 마스트헤드 (신문 제호 + 검색창) ── */}
      <header className="masthead dbl-bot" style={{ textAlign: "center", padding: "2.4rem 1.5rem 1.6rem" }}>
        <div className="kicker" style={{ marginBottom: ".9rem" }}>Est. 2026 — Study Notes &amp; Portfolio</div>
        <h1 onClick={goHome} style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(2.6rem,7vw,4.6rem)", color: C.ink, margin: 0, letterSpacing: "-.01em", lineHeight: .98, cursor: "pointer" }}>The Study Gazette</h1>
        <div style={{ fontFamily: FD, fontStyle: "italic", fontSize: "1.05rem", color: C.brick, marginTop: ".7rem" }}>Papers, projects &amp; half-formed theories</div>

        {route.name === "home" && (
        <div className="ac-wrap" style={{ maxWidth: 600, margin: "1.5rem auto 0", textAlign: "left" }}>
          <div className="searchbar" style={{ display: "flex", alignItems: "stretch", gap: 0, background: C.panel, border: `1.5px solid ${C.mustard}`, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "0 16px" }}>
              <Magnifier size={15} color={C.mustard} sw={1.5} />
              <input id="gz-main-search" className="gz-input" value={chatInput}
                onChange={(e) => { setChatInput(e.target.value); setAcOpen(true); setAcIdx(-1); }}
                onKeyDown={onMainKeyDown}
                onFocus={() => setAcOpen(true)}
                onBlur={() => setTimeout(() => setAcOpen(false), 150)}
                placeholder="키워드, 또는 '파이썬 공부 기록 보여줘' 처럼 질문해주세요"
                style={{ fontSize: 12, padding: "12px 0" }} />
            </div>
            <button onClick={() => submitFromMain()} className="ai-btn"
              style={{ background: C.mustard, border: "none", color: C.bg, fontFamily: FM, fontSize: 13, letterSpacing: ".06em", padding: "0 20px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, opacity: .85 }}>✦</span> AI 검색
            </button>
          </div>

          {acOpen && acTags.length > 0 && (
            <div className="ac-list">
              {acTags.map(({ tag, n }, i) => (
                <button key={tag} className={"ac-item" + (i === acIdx ? " act" : "")}
                  onMouseDown={(e) => { e.preventDefault(); setChatInput(tag); submitFromMain(tag); }}
                  onMouseEnter={() => setAcIdx(i)}>
                  <span className="ac-hash">#</span>
                  <span style={{ flex: 1 }}>{tag}</span>
                  <span style={{ color: C.mute, fontSize: 11 }}>{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </header>

      {/* ── 내비 (sticky, 링크 전용) ── */}
      <nav className="dbl-bot" style={{ position: "sticky", top: 0, zIndex: 20, background: C.bg }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "1.8rem", height: 50 }}>
          <button className={"navlink" + (route.name === "home" ? " on" : "")} onClick={goHome}>Front Page</button>
          <button className={"navlink" + (route.name === "about" ? " on" : "")} onClick={() => goto("about")}>Profile</button>
          <button className={"navlink" + (route.name === "archive" ? " on" : "")} onClick={() => goto("archive")}>AI Search</button>
          <button className={"navlink" + (route.name === "projects" ? " on" : "")} onClick={() => goto("projects")}>Projects</button>
          <span className="kicker hide-sm" style={{ marginLeft: "auto" }}>{posts.length} entries on file</span>
        </div>
      </nav>

      <main style={{ maxWidth: 1060, margin: "0 auto", padding: "0 1.5rem" }}>

        {/* ── 프론트 페이지 ── */}
        {route.name === "home" && (<>
          <section className="grid2" style={{ display: "grid", gridTemplateColumns: "1fr 225px", gap: "3rem", padding: "2.4rem 0 4rem", alignItems: "start" }}>
            <div id="writing">
              {featured && (
                <div className="hov" style={{ border: `1px solid ${C.frame}`, background: C.panel, marginBottom: "2.2rem" }} onClick={() => open(featured.id)}>
                  <div style={{ height: 280, borderBottom: `1px solid ${C.frame}`, overflow: "hidden", position: "relative" }}>
                    <ProjImage src={featured.thumb} seed={featured.id + "feat"} alt={featured.title} />
                    <div style={{ position: "absolute", top: 14, left: 14, background: C.bg, border: `1.5px solid ${C.frame}`, padding: "3px 12px" }} className="eyebrow">Featured Study</div>
                  </div>
                  <div style={{ padding: "1.5rem 1.8rem 1.8rem" }}>
                    <div className="kicker" style={{ marginBottom: 10 }}>{featured.category} · {fmt(featured.updated)} · {readMin(featured.body)}</div>
                    <h2 className="ttl" style={{ fontFamily: FD, fontWeight: 900, fontSize: "1.9rem", color: C.ink, margin: "0 0 .6rem", lineHeight: 1.12 }}>{featured.title}</h2>
                    <p style={{ margin: 0, color: C.body, lineHeight: 1.8, fontSize: ".97rem" }}>{clean(featured.body).slice(0, 190)}…</p>
                    <button className="ed" style={{ marginTop: "1.3rem" }}>Read the issue</button>
                  </div>
                </div>
              )}
              <div className="dbl-bot" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: ".6rem", marginBottom: ".4rem" }}>
                <span className="eyebrow">Latest Issues</span>
                <button onClick={() => goto("archive")} style={{ background: "none", border: "none", fontFamily: FM, fontSize: 11, letterSpacing: ".06em", color: C.brick, textTransform: "uppercase" }}>Ask the Archive →</button>
              </div>
              {rest.length === 0 ? <p style={{ color: C.mute, padding: "2rem 0" }}>아직 다른 글이 없습니다.</p>
                : rest.slice(0, 2).map((p) => <ListItem key={p.id} p={p} />)}
            </div>

            <aside className="hide-sm">
              <div id="about" style={{ marginBottom: "2.4rem" }}>
                <div className="eyebrow dbl-bot" style={{ paddingBottom: ".5rem", marginBottom: "1rem" }}>The Editor</div>
                <div style={{ aspectRatio: "1 / 1", border: `1px solid ${C.frame}`, overflow: "hidden", marginBottom: "1rem", filter: "grayscale(.12)" }}><img src="/profile.jpg" alt="최사랑" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }} /></div>
                <p style={{ fontSize: ".87rem", lineHeight: 1.8, color: C.body, margin: 0 }}>
                  AI 엔지니어링을 공부하며 남기는 기록장입니다. 논문 읽다 막힌 부분, 직접 만들어본 파이프라인, 헷갈리던 개념을 그때그때 담아두는 개인적인 공간이에요.
                </p>
                <button onClick={() => goto("about")} className="readmore" style={{ marginTop: "1rem", background: "none", border: "none", padding: 0, fontFamily: FB, fontSize: 12, letterSpacing: ".1em", color: C.brick, textTransform: "uppercase", fontWeight: 600, borderBottom: `1.5px solid ${C.brick}`, cursor: "pointer" }}>Read more →</button>
              </div>

              <div>
                <div className="eyebrow dbl-bot" style={{ paddingBottom: ".5rem", marginBottom: "1rem" }}>Categories</div>
                {cats.map(([c, n]) => (
                  <button key={c} className="cat-row" onClick={() => goTo({ name: "cat", value: c })}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%", background: "none", border: "none", padding: ".55rem 0", borderBottom: `1px solid ${C.rule}`, color: C.body, fontSize: ".94rem", cursor: "pointer" }}>
                    <span className="cat-name" style={{ fontFamily: FD, fontWeight: 700, color: C.ink }}>{c}</span>
                    <span style={{ fontFamily: FM, fontSize: 12, color: C.mustard }}>{String(n).padStart(2, "0")}</span>
                  </button>
                ))}
              </div>
            </aside>
          </section>
        </>)}

        {/* ── About 페이지 (임시 내용 — 추후 본인이 채움) ── */}
        {route.name === "about" && (
          <article style={{ maxWidth: 720, margin: "0 auto", padding: "2.8rem 0 4rem" }}>
            <button onClick={goHome} className="eyebrow" style={{ background: "none", border: "none", padding: 0, marginBottom: "1.8rem" }}>← Back to front page</button>
            <div className="eyebrow" style={{ marginBottom: "1rem" }}>The Editor</div>
            <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(2rem,5vw,2.9rem)", color: C.ink, lineHeight: 1.1, margin: "0 0 .6rem" }}>최사랑</h1>
            <p style={{ fontFamily: FD, fontStyle: "italic", fontSize: "1.1rem", color: C.brick, margin: "0 0 1.8rem" }}>Editor · MLOps &amp; ML Systems</p>

            <div className="dbl-top" style={{ marginBottom: "2.2rem" }} />

            <div style={{ fontSize: "1.05rem" }}>
              <p className="g-p" style={{ fontFamily: FD, fontStyle: "italic", fontSize: "1.2rem", color: C.ink, lineHeight: 1.6 }}>
                완성된 결론보다 ‘이해해가는 과정’을 남기는 데 의미를 둡니다.
              </p>

              <p className="g-p">비전공자로 출발해 AI 엔지니어링을 공부하며 AI 엔지니어로의 커리어 전환을 준비하고 있습니다. 매일 논문과 개념을 하나씩 제 것으로 만들며 기초부터 차근차근 과정을 밟아가고 있습니다. 화려한 모델을 좇기보다, 평가셋과 정량적 측정을 통해 시스템의 동작을 끝까지 검증하고 통제하는 방식을 지향합니다.</p>

              <h2 className="g-h2">기록에 대하여</h2>
              <p className="g-p">이곳에 쌓이는 기록은 대개 읽은 논문, 직접 구성한 파이프라인, 한 번에 이해되지 않았던 개념을 제 언어로 다시 풀어 쓴 글들입니다.</p>

              <h2 className="g-h2">관심 분야</h2>
              <ul className="g-ul">
                <li>MLOps 파이프라인 설계와 모델 배포 전략</li>
                <li>머신러닝 시스템 아키텍처와 인프라</li>
                <li>멀티모달 · 생성 모델의 동작 원리</li>
                <li>AI 개발 도구와 코딩 에이전트 활용</li>
              </ul>

              <h2 className="g-h2">연락</h2>
              <p className="g-p">이메일 : <a href="mailto:rangedayo@naver.com" style={{ color: C.brick }}>rangedayo@naver.com</a><br />GitHub : <a href="https://github.com/rangedayo" target="_blank" rel="noreferrer" style={{ color: C.brick }}>github.com/rangedayo</a></p>

            </div>
          </article>
        )}

        {/* ── Archive 페이지 (AI 사서 챗봇) ── */}
        {route.name === "archive" && (
          <section style={{ maxWidth: 760, margin: "0 auto", padding: "2.8rem 0 4rem" }}>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>The Archive</div>
              <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(1.9rem,4.5vw,2.6rem)", color: C.ink, lineHeight: 1.1, margin: "0 0 .5rem" }}>무엇이 궁금하신가요?</h1>
              <p style={{ fontFamily: FD, fontStyle: "italic", fontSize: "1.05rem", color: C.mute, margin: 0 }}>작성된 글 전체를 AI 사서에게 물어보세요</p>
            </div>

            {/* 입력창 */}
            <div className="searchbar" style={{ display: "flex", alignItems: "center", gap: 0, background: C.panel, border: `1.5px solid ${C.mustard}`, borderRadius: 2, marginBottom: "1.1rem", overflow: "hidden" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, padding: "11px 14px" }}>
                <Magnifier size={15} color={C.mustard} sw={1.5} />
                <input className="gz-input" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runAISearch(); }}
                  placeholder="찾고 싶은 내용을 문장이나 키워드로…" style={{ fontSize: 13 }} />
              </div>
              <button onClick={() => runAISearch()} disabled={chatLoading} className={chatLoading ? "" : "ai-btn"}
                style={{ background: chatLoading ? C.mute : C.mustard, border: "none", borderLeft: `1.5px solid ${C.mustard}`, color: C.bg, fontFamily: FM, fontSize: 13, letterSpacing: ".08em", padding: "0 22px", minHeight: 50, cursor: chatLoading ? "default" : "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                {chatLoading ? "검색 중…" : "AI 검색"}
              </button>
            </div>

            {/* 추천 질문 칩 (첫 진입 시) */}
            {!chatResult && !chatLoading && !chatError && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
                {suggestions.map((s) => (
                  <button key={s} className="chip" onClick={() => { setChatInput(s); runAISearch(s); }}>{s}</button>
                ))}
              </div>
            )}

            {/* 로딩 */}
            {chatLoading && (
              <div style={{ border: `1px solid ${C.rule}`, background: C.panel, padding: "1.1rem 1.2rem", borderRadius: 2, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.ink, color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FM, fontSize: 9, flexShrink: 0 }}>G</span>
                <span style={{ fontFamily: FD, fontStyle: "italic", color: C.mute, fontSize: ".98rem" }}>서가를 살펴보는 중<span className="blink">…</span></span>
              </div>
            )}

            {/* 에러 */}
            {chatError && (
              <div style={{ border: `1px solid ${C.brick}`, background: C.tintB, padding: "1rem 1.2rem", borderRadius: 2 }}>
                <p style={{ margin: 0, color: C.brick, fontSize: ".95rem" }}>{chatError}</p>
              </div>
            )}

            {/* 결과 */}
            {chatResult && (
              <div>
                <div style={{ border: `1px solid ${C.rule}`, background: C.panel, padding: "1rem 1.2rem", borderRadius: 2, display: "flex", gap: 10, alignItems: "flex-start", marginBottom: "1.2rem" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.ink, color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FM, fontSize: 9, flexShrink: 0, marginTop: 2 }}>G</span>
                  <p style={{ margin: 0, fontFamily: FD, fontStyle: "italic", fontSize: "1.02rem", color: C.ink, lineHeight: 1.6 }}>{chatResult.message}</p>
                </div>

                {chatResult.posts.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                    {chatResult.posts.map((p) => <ResultCard key={p.id} p={p} />)}
                  </div>
                )}
              </div>
            )}

            {/* 전체 보관소 (펼치기) */}
            <div className="dbl-top" style={{ marginTop: "2.8rem", paddingTop: "1.4rem" }}>
              <button onClick={() => setShowAll((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", padding: ".2rem 0" }}>
                <span className="eyebrow">전체 보관소 · {sorted.length} entries</span>
                <span style={{ fontFamily: FM, fontSize: 13, color: C.mustard }}>{showAll ? "− 접기" : "+ 전체 보기"}</span>
              </button>
              {showAll && (
                <div style={{ marginTop: ".6rem" }}>
                  {sorted.map((p) => <ListItem key={p.id} p={p} />)}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Projects 페이지 (포트폴리오) ── */}
        {route.name === "projects" && (
          <section style={{ padding: "2.4rem 0 4rem" }}>
            <div style={{ textAlign: "center", marginBottom: "2.2rem" }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Projects</div>
              <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(1.9rem,4.5vw,2.6rem)", color: C.ink, lineHeight: 1.1, margin: "0 0 .5rem" }}>빌드 노트</h1>
              <p style={{ fontFamily: FD, fontStyle: "italic", color: C.mute, fontSize: "1.05rem", margin: 0 }}>공부가 코드와 제품이 된 기록</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {PROJECTS.map((pr, i) => (
                <article key={pr.id} className="proj" onClick={() => openProject(pr.id)} style={{ border: `1px solid ${C.frame}`, background: C.panel, display: "grid", gridTemplateColumns: "300px 1fr" }}>
                  <div className="proj-thumb">
                    <ProjImage src={pr.thumb} seed={pr.id + pr.title} alt={pr.title} fit="cover" pos="top center" />
                    <div className="kicker" style={{ position: "absolute", top: 12, left: 12, background: C.bg, border: `1.5px solid ${C.frame}`, padding: "3px 11px" }}>No. {String(i + 1).padStart(2, "0")}</div>
                  </div>
                  <div style={{ padding: "1.6rem 1.8rem" }}>
                    <div className="kicker" style={{ marginBottom: 8 }}>{pr.kind}</div>
                    <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: "1.45rem", color: C.ink, lineHeight: 1.2, margin: "0 0 .7rem" }}>{pr.title}</h2>
                    <p style={{ margin: "0 0 1rem", color: C.body, lineHeight: 1.75, fontSize: "1rem" }}>{pr.summary}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1rem" }}>
                      {pr.stack.map((s) => <span key={s} style={{ fontFamily: FM, fontSize: 11, color: C.ink, background: C.tintM, padding: "3px 9px", borderRadius: 2 }}>{s}</span>)}
                    </div>
                    <span className="proj-go">프로젝트 자세히 보기 →</span>
                  </div>
                </article>
              ))}
            </div>

          </section>
        )}

        {/* ── 프로젝트 상세 페이지 ── */}
        {route.name === "project" && curProj && (
          <article style={{ maxWidth: 760, margin: "0 auto", padding: "2.8rem 0 4rem" }}>
            <button onClick={goBack} className="eyebrow" style={{ background: "none", border: "none", padding: 0, marginBottom: "1.8rem", cursor: "pointer" }}>← Back to projects</button>
            <div className="kicker" style={{ marginBottom: "1rem" }}>{curProj.kind}</div>
            <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(1.9rem,4.5vw,2.7rem)", color: C.ink, lineHeight: 1.15, margin: "0 0 1.4rem" }}>{curProj.title}</h1>
            {curProj.shots?.length
              ? <div className="dbl-top dbl-bot proj-shots">
                  {curProj.shots.map((s, i) => (
                    <button className="tile" key={i} onClick={() => setLightbox(s)} aria-label={`${curProj.title} 화면 ${i + 1} 원본 보기`}>
                      <ProjImage src={s} seed={curProj.id + i} alt={`${curProj.title} 화면 ${i + 1}`} />
                    </button>
                  ))}
                </div>
              : curProj.wide
                ? <button type="button" className="dbl-top dbl-bot proj-wide" onClick={() => setLightbox(curProj.wide)} aria-label={`${curProj.title} 대시보드 원본 보기`}>
                    <ProjImage src={curProj.wide} seed={curProj.id + curProj.title} alt={`${curProj.title} 대시보드`} fit="natural" />
                  </button>
                : <div className="dbl-top dbl-bot" style={{ height: 280, margin: "0 0 2rem", overflow: "hidden" }}><Art seed={curProj.id + curProj.title} /></div>}

            <p style={{ fontSize: ".97rem", color: C.body, lineHeight: 1.85, margin: "0 0 1.8rem" }}>{curProj.summary}</p>

            {curProj.body && <div style={{ fontSize: "1.05rem", marginBottom: "2.4rem" }}><Body text={curProj.body} onImg={setLightbox} /></div>}

            <div className="eyebrow dbl-bot" style={{ paddingBottom: ".5rem", marginBottom: "1rem" }}>Highlights</div>
            <ul className="g-ul g-bull" style={{ margin: "0 0 2rem" }}>
              {curProj.highlights.map((h, j) => <li key={j} style={{ fontSize: ".97rem", color: C.body }}>{h}</li>)}
            </ul>

            <div className="eyebrow dbl-bot" style={{ paddingBottom: ".5rem", marginBottom: "1rem" }}>Stack</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: "2rem" }}>
              {curProj.stack.map((s) => <span key={s} style={{ fontFamily: FM, fontSize: 12, color: C.ink, background: C.tintM, padding: "4px 11px", borderRadius: 2 }}>{s}</span>)}
            </div>

            <div className="eyebrow dbl-bot" style={{ paddingBottom: ".5rem", marginBottom: "1rem" }}>Links</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
              {curProj.links.map((lnk) => {
                const { Icon, sub } = linkMeta(lnk.label);
                return lnk.url ? (
                  <a key={lnk.label} href={lnk.url} target="_blank" rel="noreferrer" className="lnk-cta">
                    <span className="ic"><Icon /></span>
                    <span className="tx"><span className="t1">{lnk.label}</span><span className="t2">{sub}</span></span>
                    <span className="arr">↗</span>
                  </a>
                ) : (
                  <span key={lnk.label} className="lnk-cta off">
                    <span className="ic"><Icon /></span>
                    <span className="tx"><span className="t1">{lnk.label}</span><span className="t2">준비 중</span></span>
                  </span>
                );
              })}
            </div>
          </article>
        )}

        {/* ── 섹션(카테고리) ── */}
        {route.name === "cat" && (
          <section style={{ padding: "2.4rem 0 4rem" }}>
            <button onClick={goHome} className="eyebrow" style={{ background: "none", border: "none", padding: 0, marginBottom: "1.3rem" }}>← Front page</button>
            <h2 className="dbl-bot" style={{ fontFamily: FD, fontWeight: 900, fontSize: "2.5rem", color: C.ink, margin: "0 0 1.6rem", paddingBottom: ".6rem" }}>{route.value}</h2>
            {catPosts.map((p) => <ListItem key={p.id} p={p} />)}
          </section>
        )}

        {/* ── 글 읽기 ── */}
        {route.name === "post" && cur && (
          <article style={{ maxWidth: 720, margin: "0 auto", padding: "2.8rem 0 4rem" }}>
            <button onClick={goBack} className="eyebrow" style={{ background: "none", border: "none", padding: 0, marginBottom: "1.8rem", cursor: "pointer" }}>{backLabel}</button>
            <div className="kicker" style={{ marginBottom: "1rem" }}>
              <button onClick={() => goTo({ name: "cat", value: cur.category })} style={{ background: "none", border: "none", padding: 0, fontFamily: FM, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 11, color: C.brick, cursor: "pointer" }}>{cur.category}</button>
              {"  ·  " + fmt(cur.created) + "  ·  " + readMin(cur.body)}
            </div>
            <h1 className="dbl-bot" style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(2rem,5vw,2.9rem)", color: C.ink, lineHeight: 1.12, margin: "0 0 1.6rem", paddingBottom: "1rem" }}>{cur.title}</h1>
            <div style={{ fontSize: "1.05rem" }}><Body text={cur.body} onImg={setLightbox} /></div>
            {(cur.tags || []).length > 0 && (
              <div style={{ marginTop: "2.4rem", paddingTop: "1.1rem", borderTop: `1px solid ${C.rule}` }}>
                {cur.tags.map((t) => <span key={t} style={{ fontFamily: FM, fontSize: 12, color: C.mute, marginRight: 16 }}>#{t}</span>)}
              </div>
            )}
            <div style={{ marginTop: "2.8rem", paddingTop: "1.6rem" }} className="dbl-top">
              <div className="eyebrow" style={{ marginBottom: "1.3rem" }}>More in {cur.category}</div>
              {(prevPost || nextPost) ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[{ p: prevPost, dir: "← 이전 글" }, { p: nextPost, dir: "다음 글 →" }].map(({ p, dir }, i) => (
                    p ? (
                      <div key={p.id} className="pn-card" onClick={() => open(p.id)}>
                        <span className="pn-bar" />
                        <div className="pn-body">
                          <div style={{ height: 120, borderBottom: `1px solid ${C.frame}`, overflow: "hidden" }}><ProjImage src={p.thumb} seed={p.id + p.title} alt={p.title} /></div>
                          <div style={{ padding: "11px 13px 13px" }}>
                            <div className="kicker" style={{ marginBottom: 6, fontSize: 10, color: C.brick }}>{dir}</div>
                            <h3 className="ttl" style={{ fontFamily: FD, fontWeight: 700, fontSize: "1.04rem", color: C.ink, lineHeight: 1.25, margin: 0 }}>{p.title}</h3>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={i} style={{ border: `1px dashed ${C.rule}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontFamily: FM, fontSize: 12, minHeight: 120 }}>
                        {i === 0 ? "이 카테고리의 첫 글" : "이 카테고리의 마지막 글"}
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <p style={{ color: C.mute, fontSize: ".94rem" }}>이 카테고리에는 아직 다른 글이 없습니다.</p>
              )}
            </div>
          </article>
        )}
      </main>

      {/* ── 꼬리말 ── */}
      <footer className="dbl-top" style={{ marginTop: "1rem", background: C.bg }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "2rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontFamily: FD, fontWeight: 900, fontSize: "1.3rem", color: C.ink }}>The Study Gazette</span>
          <span className="kicker">Printed in good faith · {posts.length} entries on file</span>
        </div>
      </footer>

      {lightbox && (
        <div className="lb" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button className="lb-close" onClick={() => setLightbox(null)} aria-label="닫기">×</button>
          <img src={lightbox} alt="원본 화면" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
// study gazette
