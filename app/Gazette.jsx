"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import "./gazette.css";
import POSTS_DATA from "../data/posts.json";
import PROJECTS_DATA from "../data/projects.json";

/* 승인된 문서형 디자인. 글·프로젝트 원고는 Notion 동기화 데이터를 그대로 읽는다. */
const C = {
  bg: "#FFFFFF", panel: "#F6F6F7", card: "#FFFFFF", ink: "#181818", body: "#303034", mute: "#66666C",
  rule: "#E6E6E8", frame: "#E6E6E8", hover: "#EFEFF0", accentD: "#386457", accentSoft: "#EDF4F0",
  mustard: "#4C5E68", brick: "#66666C", tintM: "#EFEFF0", tintB: "#F6F6F7",
};
const FD = "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FB = FD;
const FM = FD;
const FC = "'DM Mono', ui-monospace, 'Cascadia Code', Consolas, monospace";

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
  if (!s || s === "front") return { name: "home" };
  if (s === "search") return { name: "archive" };
  if (s === "profile") return { name: "about" };
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
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose",
          fontFamily: FB });
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
    if (n.kind === "h3") return <h3 key={k} id={n.headingId} className="g-h3">{inlineMd(n.text)}</h3>;
    if (n.kind === "h2") return <h2 key={k} id={n.headingId} className="g-h2">{inlineMd(n.text)}</h2>;
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
    items.push({ ...classifyLine(rawLines[i]), headingId: "section-" + i });
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

const clean = (b) => String(b || "").replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/^#{1,6}\s+.*$/gm, "").replace(/[*>`|]/g, "").replace(/\s+/g, " ").trim();
const fmt = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
const readMin = (b) => Math.max(1, Math.ceil(String(b || "").length / 600)) + "분 읽기";

// Body와 같은 줄 번호를 사용한다. 코드 블록 안의 #은 목차에서 제외한다.
const headingsFor = (text) => {
  let inCode = false;
  return String(text || "").split("\n").flatMap((line, index) => {
    if (/^[ \t]*```/.test(line)) { inCode = !inCode; return []; }
    if (inCode) return [];
    const item = classifyLine(line);
    return ["h2", "h3"].includes(item.kind) ? [{ id: "section-" + index, text: item.text, level: item.kind }] : [];
  });
};

function RouteLink({ to, goTo, children, onClick, ...props }) {
  return <a {...props} href={"#" + (encodeRoute(to) || "front")} onClick={(e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); goTo(to); onClick?.(e);
  }}>{children}</a>;
}

function PostCard({ p, goTo }) {
  return <RouteLink className={"post-card" + (p.thumb ? "" : " no-image")} to={{ name: "post", id: p.id }} goTo={goTo}>
    <div><div className="card-meta">{fmt(p.updated)} · {readMin(p.body)}</div><h2>{p.title}</h2>
      <p className="card-excerpt">{clean(p.body).slice(0, 210)}</p>
      <div className="card-tags">{(p.tags || []).slice(0, 3).map(t => <span key={t}>#{t}</span>)}</div>
    </div>
    {p.thumb && <div className="thumbnail"><ProjImage src={p.thumb} seed={p.id} alt={p.title + " 커버"} /></div>}
  </RouteLink>;
}

function TocLinks({ headings, active }) {
  return headings.map(h => <a key={h.id} href={"#" + h.id} className={active === h.id ? "active" : undefined} aria-current={active === h.id ? "location" : undefined} onClick={e => {
    e.preventDefault();
    const target = document.getElementById(h.id);
    if (!target) return;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true;
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    target.tabIndex = -1; target.focus({ preventScroll: true });
  }}>{inlineMd(h.text)}</a>);
}

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
  const [activeHeading, setActiveHeading] = useState(null);

  useEffect(() => {
    const arr = Array.isArray(POSTS_DATA) && POSTS_DATA.length ? POSTS_DATA : DEMO;
    setPosts(arr.map((x) => ({ category: "기타", pinned: false, tags: [], ...x })));
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

  /* 모든 화면 전환은 goTo를 거쳐 URL 해시에 기록 → 브라우저 뒤로가기가 정확히 복원 */
  const goTo = useCallback((r) => {
    const h = encodeRoute(r);
    const url = window.location.pathname + window.location.search + (h ? "#" + h : "");
    window.history.pushState(null, "", url);
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);
  /* 인페이지 뒤로가기 = 브라우저 뒤로가기와 동일하게 직전 화면으로 */
  const goBack = () => { if (window.history.length > 1) window.history.back(); else goTo({ name: "home" }); };
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
    if (chatLoading) return;
    if (!question) { setChatQuery(""); setChatResult(null); setChatError(null); return; }
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

  const reading = route.name === "post" || route.name === "project";
  const inCategory = route.name === "cat";
  const activeCategory = inCategory ? route.value : cur?.category;
  const studyCategory = activeCategory || (cats.some(([c]) => c === "비전 모델") ? "비전 모델" : cats[0]?.[0]);
  const headings = useMemo(() => {
    if (route.name === "post") return headingsFor(cur?.body);
    if (route.name === "project" && curProj) return [
      ...headingsFor(curProj.body),
      ...(curProj.highlights?.length ? [{ id: "project-highlights", text: "Highlights" }] : []),
      ...(curProj.stack?.length ? [{ id: "project-stack", text: "Stack" }] : []),
      ...(curProj.links?.length ? [{ id: "project-links", text: "Links" }] : []),
    ];
    return [];
  }, [route.name, cur, curProj]);

  useEffect(() => {
    setActiveHeading(headings[0]?.id || null);
    if (!headings.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) setActiveHeading(visible[0].target.id);
    }, { rootMargin: "-5% 0px -65% 0px" });
    headings.forEach(h => { const el = document.getElementById(h.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [headings]);

  useEffect(() => {
    const shortcut = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); goTo({ name: "archive" });
        requestAnimationFrame(() => document.getElementById("archive-query")?.focus());
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [goTo]);

  if (!posts) return <div style={{ minHeight: "100vh", background: C.bg }} />;

  const theme = {
    "--bg": C.bg, "--panel": C.panel, "--card": C.card, "--ink": C.ink, "--body": C.body,
    "--muted": C.mute, "--line": C.rule, "--hover": C.hover, "--accent": C.accentD, "--accent-soft": C.accentSoft,
    "--sans": FB, "--heading-font": FD, "--label-font": FM, "--code-font": FC,
  };
  const studyRoute = { name: "cat", value: studyCategory };
  const navItems = [
    { label: "Front Page", to: { name: "home" }, active: route.name === "home" },
    { label: "Study Notes", to: studyRoute, active: inCategory || route.name === "post" },
    { label: "Projects", to: { name: "projects" }, active: route.name === "projects" || route.name === "project" },
    { label: "Profile", to: { name: "about" }, active: route.name === "about" },
    { label: "Search", to: { name: "archive" }, active: route.name === "archive" },
  ];

  return <div className={"gz" + (!reading && !inCategory ? " wide-mode" : "") + (inCategory ? " category-mode" : "")} style={theme}>
    <header className="masthead">
      <div className="est">EST. 2026 — STUDY NOTES &amp; PORTFOLIO</div>
      <RouteLink className="brand" to={{ name: "home" }} goTo={goTo}>The Study Gazette</RouteLink>
      <div className="tagline">Papers, projects &amp; half-formed theories</div>
    </header>
    <nav className="site-nav" aria-label="사이트 탐색"><div className="nav-inner">
      {navItems.map(n => <RouteLink key={n.label} to={n.to} goTo={goTo} className={n.active ? "on" : undefined} aria-current={n.active ? "page" : undefined}>{n.label}</RouteLink>)}
      <span className="nav-count">{posts.length} entries on file</span>
    </div></nav>

    <div className="workspace">
      {(reading || inCategory) && <aside className="sidebar" aria-label="카테고리와 글 탐색">
        <div className="side-group"><div className="side-title">{route.name === "project" ? "Projects" : "Study Notes"}</div>
          {route.name === "project"
            ? <RouteLink to={{ name: "projects" }} goTo={goTo}>프로젝트 목록</RouteLink>
            : cats.map(([c]) => <RouteLink key={c} className={activeCategory === c ? "active" : undefined} to={{ name: "cat", value: c }} goTo={goTo}>{c}</RouteLink>)}
        </div>
        <div className="side-group"><div className="side-title">{route.name === "project" ? "빌드 노트" : activeCategory}</div>
          {route.name === "project" ? PROJECTS.map(p => <RouteLink key={p.id} className={"post-link" + (curProj?.id === p.id ? " active" : "")} to={{ name: "project", id: p.id }} goTo={goTo}>{p.title}</RouteLink>)
            : sorted.filter(p => p.category === activeCategory).slice(0, 5).map(p => <RouteLink key={p.id} className={"post-link" + (cur?.id === p.id ? " active" : "")} to={{ name: "post", id: p.id }} goTo={goTo}>{p.title}</RouteLink>)}
        </div>
      </aside>}

      <main className="content">
        {route.name === "home" && <section className="page-section" id="home-view">
          <header className="page-header"><h1 className="page-title">Front Page</h1><p className="page-intro">AI 엔지니어링을 공부하며 남기는 기록장입니다.</p></header>
          <div className="front-layout"><div className="front-feed">
            {featured && <RouteLink className="featured" to={{ name: "post", id: featured.id }} goTo={goTo}>
              {featured.thumb && <div className="featured-image"><ProjImage src={featured.thumb} seed={featured.id} alt={featured.title + " 커버"} /></div>}
              <div className="featured-content"><div className="featured-label"><span className="featured-badge">대표 글</span><span className="featured-category">{featured.category}</span></div>
                <h2>{featured.title}</h2><p>{clean(featured.body).slice(0, 210)}</p><span className="read-issue">글 읽기 →</span>
              </div>
            </RouteLink>}
            <div className="section-head"><h2 className="section-title">Latest Issues</h2><RouteLink className="quiet-link" to={studyRoute} goTo={goTo}>Study Notes 보기 →</RouteLink></div>
            <div className="issue-grid">{rest.slice(0, 4).map(p => <RouteLink key={p.id} className="issue-card" to={{ name: "post", id: p.id }} goTo={goTo}>
              <div className="card-meta">{p.category} · {fmt(p.updated)}</div><h3>{p.title}</h3><p>{clean(p.body).slice(0, 150)}</p>
              <div className="card-tags">{(p.tags || []).slice(0, 2).map(t => <span key={t}>#{t}</span>)}</div>
            </RouteLink>)}</div>
            {PROJECTS.length > 0 && <><div className="section-head"><h2 className="section-title">Projects</h2><RouteLink className="quiet-link" to={{ name: "projects" }} goTo={goTo}>빌드 노트 보기 →</RouteLink></div>
              <div className="issue-grid">{PROJECTS.map(p => <RouteLink key={p.id} className="issue-card" to={{ name: "project", id: p.id }} goTo={goTo}>
                <div className="card-meta">{p.kind}</div><h3>{p.title}</h3><p>{p.summary}</p><span className="quiet-link">프로젝트 보기 →</span>
              </RouteLink>)}</div></>}
          </div><aside className="front-sidebar">
            <div className="editor-box"><h2 className="section-title">The Editor</h2><img className="editor-photo" src="/profile.jpg" alt="최사랑" /><strong>최사랑</strong>
              <p>논문 읽다 막힌 부분, 직접 만들어본 파이프라인, 헷갈리던 개념을 그때그때 담아두는 개인적인 공간이에요.</p>
              <RouteLink className="quiet-link" to={{ name: "about" }} goTo={goTo}>Profile →</RouteLink>
            </div>
            <div><h2 className="section-title">Categories</h2><div className="category-menu">{cats.map(([c, count]) => <RouteLink key={c} to={{ name: "cat", value: c }} goTo={goTo}>{c}<span>{count}</span></RouteLink>)}</div></div>
          </aside></div>
        </section>}

        {route.name === "about" && <article className="page-section" id="profile-view">
          <header className="page-header"><h1 className="page-title">최사랑</h1><p className="page-intro">Editor · MLOps &amp; ML Systems</p></header>
          <div className="profile-layout"><img className="profile-portrait" src="/profile.jpg" alt="최사랑" /><div className="profile-content article-body">
            <p>완성된 결론보다 ‘이해해가는 과정’을 남기는 데 의미를 둡니다.</p>
            <p>비전공자로 출발해 AI 엔지니어로의 전환을 준비하고 있습니다. 매일 논문과 개념을 하나씩 제 것으로 만들며, 기초부터 차근차근 밟아가는 중입니다. 화려함을 좇기보다 객관적인 평가를 통해 시스템의 동작을 끝까지 검증하고 통제하는 방식을 지향합니다.</p>
            <h2>관심 분야</h2><ul><li>MLOps 파이프라인 설계와 모델 배포 전략</li><li>머신러닝 시스템 아키텍처와 인프라</li><li>멀티모달 · 생성 모델의 동작 원리</li><li>AI 개발 도구와 코딩 에이전트 활용</li></ul>
            <h2>연락</h2><div className="profile-contact"><a href="mailto:rangedayo@naver.com">rangedayo@naver.com</a><a href="https://github.com/rangedayo" target="_blank" rel="noreferrer">GitHub ↗</a></div>
          </div></div>
        </article>}

        {route.name === "archive" && <section className="page-section" id="search-view">
          <header className="page-header"><h1 className="page-title">무엇이 궁금하신가요?</h1><p className="page-intro">공부 기록에서 필요한 글을 찾아보세요.</p></header>
          <form className="search-form" onSubmit={e => { e.preventDefault(); runAISearch(); }}>
            <input id="archive-query" aria-label="공부 기록 검색" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="예: 트랜스포머, 멀티모달, 모델 배포" />
            <button type="submit" disabled={chatLoading}>{chatLoading ? "검색 중…" : "검색"}</button>
          </form>
          <p className="search-hint">찾고 싶은 개념이나 질문을 입력하면 관련 글을 찾아드립니다.</p>
          {!chatResult && !chatLoading && !chatError && <div className="search-chips">{suggestions.map(s => <button type="button" key={s} onClick={() => { setChatInput(s); runAISearch(s); }}>{s}</button>)}</div>}
          <div className="search-feedback" aria-live="polite" aria-busy={chatLoading}>
            {chatLoading && <p className="search-answer">관련 글을 찾고 있습니다…</p>}
            {chatError && <p className="search-answer" role="alert">{chatError}</p>}
            {chatResult && <>
              <div className="search-results-label">“{chatQuery}” · {chatResult.posts.length}개의 기록</div>
              {chatResult.message && <p className="search-answer">{chatResult.message}</p>}
              <div className="post-list">{chatResult.posts.map(p => <PostCard key={p.id} p={p} goTo={goTo} />)}</div>
              {!chatResult.posts.length && !chatResult.message && <p className="empty-result">관련 글이 없습니다. 다른 키워드로 찾아보세요.</p>}
            </>}
          </div>
        </section>}

        {route.name === "projects" && <section className="page-section" id="projects-view">
          <header className="page-header"><h1 className="page-title">빌드 노트</h1><p className="page-intro">공부가 코드와 제품이 된 기록</p></header>
          <div className="project-grid">{PROJECTS.map(p => <RouteLink key={p.id} className="project-card" to={{ name: "project", id: p.id }} goTo={goTo}>
            <div className="project-cover"><ProjImage src={p.thumb} seed={p.id} alt={p.title + " 화면"} fit="contain" /></div>
            <div className="project-card-content"><div className="project-kind">{p.kind}</div><h2>{p.title}</h2><p>{p.summary}</p>
              <div className="stack-tags">{(p.stack || []).map(t => <span className="tag" key={t}>{t}</span>)}</div><span className="read-issue">프로젝트 자세히 보기 →</span>
            </div>
          </RouteLink>)}</div>
        </section>}

        {route.name === "project" && curProj && <article className="page-section" id="project-view">
          <div className="breadcrumbs"><button className="text-button" onClick={goBack}>← 뒤로</button><RouteLink to={{ name: "projects" }} goTo={goTo}>Projects</RouteLink><span className="slash">/</span><span>{curProj.kind}</span></div>
          <header className="article-head"><h1 className="article-title">{curProj.title}</h1></header>
          {!!headings.length && <details className="mobile-toc"><summary>이 글의 목차</summary><TocLinks headings={headings} active={activeHeading} /></details>}
          <div className={"project-hero" + (!curProj.shots?.length ? " single" : "")}>
            {(curProj.shots?.length ? curProj.shots : [curProj.wide || curProj.thumb]).map((src, i) => <button key={src || i} type="button" aria-label={"프로젝트 화면 " + (i + 1) + " 확대"} onClick={() => src && setLightbox(src)}><ProjImage src={src} seed={curProj.id} alt={curProj.title + " 화면 " + (i + 1)} fit="contain" /></button>)}
          </div>
          <p className="project-detail-summary">{curProj.summary}</p>
          <div className="article-body"><Body key={curProj.id} text={curProj.body || ""} onImg={setLightbox} />
            {!!curProj.highlights?.length && <><h2 id="project-highlights">Highlights</h2><ul>{curProj.highlights.map((h, i) => <li key={i}>{inlineMd(h)}</li>)}</ul></>}
            {!!curProj.stack?.length && <><h2 id="project-stack">Stack</h2><div className="stack-tags">{curProj.stack.map(t => <span className="tag" key={t}>{t}</span>)}</div></>}
            {!!curProj.links?.length && <><h2 id="project-links">Links</h2><div className="project-links">{curProj.links.map((l, i) => {
              const { Icon, sub } = linkMeta(l.label);
              return l.url ? <a key={i} href={l.url} target="_blank" rel="noreferrer" title={sub}><Icon />{l.label} ↗</a> : <span key={i} className="tag">{l.label} · 준비 중</span>;
            })}</div></>}
          </div>
          <RouteLink className="return-link" to={{ name: "projects" }} goTo={goTo}>← 프로젝트 목록으로</RouteLink>
        </article>}

        {inCategory && <section id="category-view">
          <div className="breadcrumbs"><RouteLink to={{ name: "home" }} goTo={goTo}>Front Page</RouteLink><span className="slash">/</span><span>Study Notes</span></div>
          <header className="category-header"><h1 className="category-title">{route.value}</h1><p className="category-description">{route.value === "비전 모델" ? "이미지와 멀티모달 모델을 공부하며 남긴 기록." : "이 주제로 공부하며 남긴 기록."}</p></header>
          <div className="list-meta"><span>{catPosts.length}개의 기록</span><span>최근 수정순</span></div>
          <div className="post-list">{catPosts.map(p => <PostCard key={p.id} p={p} goTo={goTo} />)}</div>
        </section>}

        {route.name === "post" && cur && <article id="article-view">
          <div className="breadcrumbs"><button className="text-button" onClick={goBack}>← 뒤로</button><RouteLink to={{ name: "cat", value: cur.category }} goTo={goTo}>Study Notes</RouteLink><span className="slash">/</span><RouteLink to={{ name: "cat", value: cur.category }} goTo={goTo}>{cur.category}</RouteLink></div>
          <header className="article-head"><h1 className="article-title">{cur.title}</h1><div className="metadata"><span>{fmt(cur.created || cur.updated)}</span><span className="separator" /><span>{readMin(cur.body)}</span><span className="separator" /><span>Study Notes</span></div></header>
          {!!headings.length && <details className="mobile-toc"><summary>이 글의 목차</summary><TocLinks headings={headings} active={activeHeading} /></details>}
          {cur.thumb && <button className="article-cover" aria-label="글 커버 확대" onClick={() => setLightbox(cur.thumb)}><ProjImage src={cur.thumb} seed={cur.id} alt={cur.title + " 커버"} fit="natural" /></button>}
          <div className="article-body"><Body key={cur.id} text={cur.body} onImg={setLightbox} /></div>
          <div className="post-tags">{(cur.tags || []).map(t => <span className="tag" key={t}>#{t}</span>)}</div>
          <RouteLink className="return-link" to={{ name: "cat", value: cur.category }} goTo={goTo}>← 카테고리 목록으로</RouteLink>
          {(prevPost || nextPost) && <><h2 className="next-heading">같은 카테고리에서 더 읽기</h2><div className="next-cards">
            {[{ p: prevPost, label: "이전 글" }, { p: nextPost, label: "다음 글" }].filter(x => x.p).map(({ p, label }) => <RouteLink key={p.id} className="next-card" to={{ name: "post", id: p.id }} goTo={goTo}><small>{label} · {p.category}</small><strong>{p.title}</strong></RouteLink>)}
          </div></>}
        </article>}
        {((route.name === "post" && !cur) || (route.name === "project" && !curProj)) && <p className="empty-result">기록을 찾을 수 없습니다. <RouteLink to={{ name: "home" }} goTo={goTo}>첫 화면으로 이동</RouteLink></p>}
      </main>

      {reading && !!headings.length && <aside className="toc" aria-label="이 글의 목차"><div className="toc-title">On this page</div><div className="toc-links"><TocLinks headings={headings} active={activeHeading} /></div></aside>}
      {inCategory && <aside className="category-aside"><strong>{route.value}</strong><p>공부하며 남긴 기록들을 모았습니다.</p><RouteLink to={{ name: "archive" }} goTo={goTo}>필요한 글 검색하기 →</RouteLink></aside>}
    </div>
    <footer className="footer"><span>The Study Gazette</span><span>{posts.length} study notes · {PROJECTS.length} projects</span></footer>
    {lightbox && <div className="lb" role="dialog" aria-modal="true" aria-label="이미지 원본" onClick={() => setLightbox(null)}><button autoFocus className="lb-close" onClick={() => setLightbox(null)} aria-label="닫기">×</button><img src={lightbox} alt="이미지 원본" onClick={e => e.stopPropagation()} /></div>}
  </div>;
}
