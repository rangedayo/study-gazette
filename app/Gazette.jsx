"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import POSTS_DATA from "../data/posts.json";

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

/* 프로젝트 스크린샷 — 파일이 없으면(404 등) Art로 안전하게 폴백 */
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

const PROJECTS = [
  {
    id: "p1", title: "식물진단 AI 서비스", kind: "AI 서비스 · 풀스택",
    thumb: "/projects/01-home.png",
    shots: ["/projects/01-home.png", "/projects/02-result.png", "/projects/03-refine.png", "/projects/04-refine-result.png", "/projects/05-myplants.png"],
    summary: "식물 사진 한 장을 올리면 모델이 1차 진단을 내리고, 이어지는 객관식 질문으로 답을 보정해 2차 진단까지 제공하는 진단 서비스입니다. Gemini 비전 모델과 RAG를 결합했습니다.",
    highlights: [
      "치명적 오진(아픈 식물을 건강으로 진단)을 0건으로 유지하면서, 오탐(건강한 식물을 아픔으로 진단)을 17.5 → 7.5로 절반 감축",
      "파이프라인: 사진 → Gemini Vision 분석 → ChromaDB RAG 검색 → 생성(gpt-4o-mini) → status 보정 가드 → 객관식 2차 보정 진단",
      "프롬프트 기반 환각(없는 병 지어내기) 억제를 4회 시도해 모두 효과 0임을 측정으로 확인하고, 출력 단계 후처리 가드로 우회 (라운드 기반 변수 격리 평가)",
      "검색 품질을 자체 골든셋으로 평가 (Hit@10 = 1.0 / MRR = 0.9)",
    ],
    stack: ["Gemini Vision", "ChromaDB RAG", "gpt-4o-mini", "FastAPI", "Next.js", "Firebase"],
    links: [{ label: "GitHub", url: "https://github.com/rangedayo/plant-diagnosis" }],
    body: `
## 화분이 시들어가는데, 이유를 모를 때

물을 더 줘야 할지 덜 줘야 할지, 아니면 병에 걸린 건지 모를 때가 많았습니다. 집에서 실내 식물을 여럿 키우다 보니 이런 막막함을 자주 겪었고, 사진 한 장으로 그 답을 줄 수 있으면 좋겠다는 생각에서 시작했습니다. Gemini 비전 모델로 식물과 증상을 읽고, 신뢰할 만한 원예 자료를 검색(RAG)해 진단을 만들어주는 서비스입니다.

## 가장 무서운 실수부터 정의했습니다

진단에서 위험한 건 단순한 오답률이 아니라 오진의 방향이라고 봤습니다. 아픈 식물을 "건강하다"고 진단하면 사용자는 그냥 넘어가 식물을 잃거나, 나중엔 진단 자체를 믿지 않게 됩니다. 반대로 건강한 식물을 아프다고 하면 헛걱정만 끼칩니다. 둘 다 줄여야 하지만 위험의 크기가 다르다고 판단해서, **아픈 식물을 건강으로 오진하는 경우만큼은 0건으로** 막는 것을 첫 번째 규칙으로 삼고, 그 선을 지키면서 헛걱정을 줄이는 쪽으로 방향을 잡았습니다.

## AI를 혼낼수록 오히려 더 눈치만 봤습니다

처음엔 AI가 없는 병을 지어내는 환각이 문제라고 보고, 프롬프트에 "소설 쓰지 마라", "병명 함부로 말하지 마라" 같은 규칙을 자꾸 더 넣었습니다. 그런데 규칙을 박을수록 AI는 위험을 피하려 모호한 말만 늘어놓았고, 정작 환각도 멈추지 않았습니다. 라운드마다 변수를 하나씩만 바꿔 측정해봤는데, 프롬프트를 다듬거나 모델을 최신형으로 바꾼 시도는 네 번 모두 효과가 없었습니다. 입력을 아무리 손봐도 풀리지 않는 영역이 있다는 걸 데이터로 확인한 순간이었습니다.

## 그래서 입력 대신 출력을 고쳤습니다

방향을 바꿨습니다. 먼저 강제로 박아둔 규칙은 꼭 필요한 세 가지(정해진 JSON 형식, status 다섯 단계, 한국어 출력)만 남기고 나머지는 권장으로 풀어, AI가 더 자연스럽게 답하게 했습니다. 그리고 **AI를 설득하길 포기하고, 답이 나온 뒤에 과한 진단을 교정하는 장치를 출력단에 붙였습니다.** 어떤 단어가 진짜 병변이고 어떤 게 가벼운 증상인지는 감으로 정하지 않고, 테스트 데이터에 실제로 나온 증상 표현을 전수로 훑어 분류선을 그었습니다. 고사, 마름, 황화, 반점 같은 병변 단어가 보이면 손대지 않고, 잎 끝의 옅은 변색처럼 위치와 변색이 겹친 가벼운 표현만 건강으로 정리했습니다. '잎 처짐'처럼 양쪽에 걸치는 모호한 단어는 놓치는 쪽이 더 위험하니 안전하게 병변으로 분류했습니다. 그 결과 치명적 오진은 0건을 지키면서 헛걱정(오탐)은 17.5건에서 7.5건으로 절반 줄었습니다.

가드를 붙이고 나니 새 문제가 보였습니다. status는 건강으로 내렸는데 설명문에는 여전히 "병해충이 의심된다"는 문장이 남아, 사용자에게 앞뒤가 안 맞는 진단서가 나갈 뻔한 겁니다. 설명을 전부 다시 생성하면 비용이 드니, 가드가 실제로 작동한 경우(한 번에 여덟 건 남짓)에만 짧게 다시 물어 설명을 새로 받도록 했습니다.

또 하나 바꾼 건 역할을 나눈 것입니다. 처음엔 사진을 보는 단계와 진단을 내리는 단계가 각각 건강·병해 판정을 따로 들고 있어 서로 어긋날 때가 있었는데, 이건 버그가 아니라 검색(RAG)이 새 정보를 가져와 생기는 정상적인 차이였습니다. 그래서 둘을 억지로 맞추는 대신, 사진 단계는 관찰만, 진단 단계는 진단만 맡도록 책임을 분리했습니다.

## 믿을 수 있는 자료에서만, 모르면 정직하게

진단의 근거가 되는 자료는 펜실베이니아주립대와 캘리포니아대의 병해충 자료, 미주리식물원, 농촌진흥청처럼 공신력 있는 출처에서 라이선스를 지켜 모았습니다. 그리고 증상만으로 검색하면 엉뚱한 식물의 정보가 끌려오기 때문에, 먼저 식물 종을 특정한 뒤 그 안에서 증상을 검색하도록 해 정확도를 높였습니다.

검색이 제대로 되는지는 직접 만든 골든셋으로 측정했는데, 정답지를 만들 때 검색 결과를 일부러 보지 않고 원문 자료만 보고 정답을 적었습니다. 내 검색기를 내가 채점하며 좋게 봐주는 편향을 막기 위해서였고, 오히려 점수가 깎이는 정정(엉뚱하게 매칭되던 키워드 제거 같은)도 근거와 함께 그대로 반영했습니다. 그렇게 다시 잰 검색 품질은 Hit@10 0.80에서 1.0으로, MRR 0.525에서 0.9로 올랐습니다. 자료를 못 찾으면 그럴듯한 답을 지어내지 않고, 정보를 가져오지 못했다고 솔직하게 알리도록 했습니다.

한 가지 더, 이 모든 수치의 바탕이 되는 평가용 사진을 모으는 일도 만만치 않았습니다. 처음엔 공개 데이터베이스에서 자동으로 모으려 했는데 실내 식물 도메인과 맞지 않아, 후보 사진 가운데 쓸 만한 게 20%도 되지 않았습니다. 그래서 직접 모으는 쪽으로 방향을 바꿨고, 모은 사진은 파일이 실제로 있는지, 식별자가 맞는지, 출처와 라이선스가 규칙에 맞는지 등 아홉 가지 항목으로 자동 검증한 뒤에야 평가셋에 넣었습니다.

## 진단 엔진의 전체 모습

지금까지의 단계를 하나로 모으면 진단 엔진은 이렇게 움직입니다. 사진 분석과 자료 검색은 1차 진단 때만 돌고, 2차 진단은 이미 본 사진을 다시 분석하지 않도록 그 단계를 건너뜁니다. 그림의 점선은 사진에서 관찰한 증상을 안전 게이트까지 그대로 들고 가, 생성된 진단을 교정할 때 근거로 쓴다는 뜻입니다.

\`\`\`mermaid
%%{init: {"themeVariables": {"fontSize": "11px"}}}%%
flowchart TB
    subgraph SKIP["비전 · RAG → 2차 땐 생략"]
        A["① 사진 분석<br/>Gemini · 증상 추출<br/>POST /diagnose"]
        K["② 키워드 정리<br/>증상 → 검색어"]
        RET["③ 자료 검색 RAG<br/>Chroma 벡터 DB"]
        A --> K --> RET
    end

    RET --> G["④ 진단 생성<br/>gpt-4o-mini"]
    G --> SG["⑤ 검사·교정 · 안전 게이트<br/>과한 진단 코드로 교정"]
    SG --> OUT["최종 진단"]

    REF["2차 진단 답변<br/>POST /diagnose/refine"] --> G
    A -. 관찰 증상 보존 .-> SG

    style SKIP fill:#F7F6F2,stroke:#B4B2A9
    classDef io fill:#F1EFE8,stroke:#888780,color:#444441
    classDef proc fill:#E6F1FB,stroke:#378ADD,color:#0C447C
    classDef gate fill:#E1F5EE,stroke:#1D9E75,color:#085041,stroke-width:2px
    classDef refine fill:#EEEDFE,stroke:#7F77DD,color:#3C3489

    class OUT io
    class A,K,RET,G proc
    class SG gate
    class REF refine
\`\`\`

## 진단을 넘어 서비스로

여기에 객관식 후속 질문으로 답을 보정하는 2차 진단을 더하고, 내가 키우는 식물이 나아지는지 나빠지는지 한눈에 따라갈 수 있도록 기록과 시간순 비교 기능도 얹었습니다. 비용도 같이 줄였는데, 식별과 묘사를 따로 부르던 것을 Gemini 하나로 합쳐 한 번 진단에 드는 외부 API 호출을 일곱 번에서 다섯 번으로 낮췄습니다. 바꿀 때마다 성능이 5%p 이상 떨어지면 통과하지 못하는 회귀 테스트를 두고, 눈대중이 아니라 숫자로 확인하며 고쳤습니다.

## 이 프로젝트로 단단해진 것

가장 크게 배운 것은, 잘 되는 것보다 안 되는 것을 정확히 측정하는 일의 가치였습니다. 프롬프트를 다듬거나 최신 모델로 바꾸는, 직관적으로 옳아 보이는 방법도 막상 데이터로 확인하면 효과가 없을 수 있었습니다. 그럴 때 고집을 부리기보다 측정 결과를 근거로 방향을 바꾸고, 입력에서 풀리지 않는 문제는 출력단처럼 다른 자리에서 푸는 법을 익혔습니다.

여기서는 생각의 흐름과 진단 파이프라인 위주로 풀었고, 실제 코드와 평가 스크립트, 전체 결과는 GitHub에 정리해 두었습니다.
`,
  },
  {
    id: "p2", title: "전국 17개 시도 태양광 발전량 예측 + ESS 운영 시뮬레이션", kind: "시계열 ML · 데이터 분석",
    thumb: "/projects/ess-dashboard.png",
    wide: "/projects/ess-dashboard.png",
    summary: "전국 17개 시도의 태양광 발전량을 예측해 ESS 충방전 운영 가치를 분석한 프로젝트로, Naive, XGBoost, LSTM, AutoGluon을 같은 파이프라인에서 평가하고, MPC(LP 최적화) 운영까지 도입했습니다.",
    highlights: [
      "XGBoost로 Naive 대비 MAE 55.8%↓ (21.74 → 9.61 MWh) — LSTM(17.82), 트랜스포머 앙상블 대비 우위",
      "모델 정확도의 한계효용 ≈ 0 — 완벽 예측(oracle)과 XGBoost의 운영 수익 차이는 0.08%. 반면 운영 구조를 MPC로 바꾸자 순수익 +49.5%(1,689억 → 2,526억원). 17지역×6정책으로 실증",
      "LSTM이 ESS 지표에서 좋아 보인 원인을 추적해 시뮬레이터 비대칭 분기 버그로 규명 (정확도 메트릭 ≠ 운영 성과)",
      "예측에 일부러 노이즈를 넣어 정확도를 떨어뜨려도 자급률은 79.05% → 79.92%로 오히려 미세 상승 — 정확도가 운영 가치로 자동 전환되지 않음을 27개 시뮬 점으로 정량화",
    ],
    stack: ["XGBoost", "LSTM", "AutoGluon", "scipy LP (MPC)", "FastAPI", "Streamlit"],
    links: [{ label: "GitHub", url: "https://github.com/rangedayo/energy-time-series-forecast" }],
    body: `
## "더 정확하면 더 이득"일까요?

태양광 발전량을 더 정확히 예측하면 배터리(ESS)를 더 잘 굴려 돈을 더 벌 수 있을 거라고 생각했습니다. 평소 환경을 위한 기술에 관심이 많아 태양광을 주제로 골랐고, 2017년부터 2023년까지 7년간 전국 17개 시도에서 시간 단위로 기록된 데이터(약 80만 행)로 예측 정확도가 정말 운영 수익으로 이어지는지 직접 확인해보고 싶었습니다. 시계열 데이터라 2017~2022년으로 학습하고 한 번도 보지 않은 2023년으로 평가해, 과거 구간에 미래 정보가 섞여 성능이 부풀지 않도록 주의했습니다.

먼저 적어두면, 이 가정은 틀렸습니다. 그리고 틀렸다는 것을 알아가는 과정이 이 프로젝트에서 제가 가장 많이 배운 부분이었습니다.

## 먼저 예측 모델부터 제대로 골랐습니다

Naive, XGBoost, LSTM을 같은 파이프라인에서 비교했고, XGBoost가 가장 정확했습니다(Naive 대비 오차 55.8% 감소, MAE 21.74 → 9.61). 그런데 모델을 비교하다 보니 한 가지가 눈에 들어왔습니다. 요즘 시계열에서 많이 쓰는 트랜스포머 계열(TFT, PatchTST)을 붙여봐도 정확도가 전혀 나아지지 않는다는 점이었습니다. AutoGluon으로 여러 모델을 자동으로 앙상블해보니 트리 계열(DirectTabular)에 0.73, SeasonalNaive에 0.27을 주고 트랜스포머 세 종류에는 0을 줬습니다. 직접 튜닝한 XGBoost는 이 자동 앙상블보다도 약 두 배 정확했습니다.

처음에는 의아했는데, 데이터를 들여다보니 이유를 알 수 있었습니다. 태양광 발전량은 그 시점의 일사량과 전운량이 거의 결정합니다. 어제 얼마나 발전했는지보다 지금 햇빛이 얼마나 드는지가 훨씬 중요한, 사실상 단순한 함수에 가까운 문제였습니다. 긴 시계열에서 복잡한 패턴을 찾아내는 트랜스포머의 강점이 여기서는 쓰일 자리가 없었고, 오히려 단순한 문제에 과한 구조가 방해가 됐습니다. 일사량 같은 값을 그대로 받아 조건을 나누는 트리 모델이 이 문제에는 더 잘 맞았습니다.

## LSTM은 왜 신경망인데도 졌을까

사실 XGBoost가 이겼다는 것보다, 더 무거운 LSTM이 왜 졌는지를 들여다보면서 더 많은 것을 알게 됐습니다. 원인은 17개 지역을 한 모델에 몰아넣은 통합 모델 구조에 있었습니다.

첫 번째는 스케일 불균형이었습니다. 전남은 시간당 최대 약 1,000MWh인데 서울은 약 3MWh로 규모가 수백 배 차이가 납니다. 이걸 같은 기준으로 정규화하고 학습하면 줄여야 할 오차의 대부분이 덩치 큰 전남에서 나오기 때문에, 모델 입장에서는 서울을 정확히 맞혀봐야 티가 안 나니 작은 지역은 대충 평균값으로 내놓게 됩니다. 실제로 서울과 대전에서 LSTM의 오차는 XGBoost보다 10~20배 컸습니다.

두 번째는 데이터 구조가 모델과 맞지 않았던 점입니다. 트리 모델은 "지역이 전남이고 어제 발전량이 이 정도라면"처럼 조건으로 바로 길을 나눠 서로 다른 지역을 따로 다룹니다. 반면 LSTM은 17개 지역을 하나의 이어진 흐름으로 읽다 보니, 지역이 바뀌어 맥락이 끊기는데도 한 줄기로 이해하려다 오히려 혼란스러워했습니다. 신경망인데도 어떤 지역에서는 어제값을 그대로 쓰는 Naive보다 못한 구간이 나온 이유였습니다. 이 분석을 근거로, 지금은 규모가 가장 큰 전남을 단독 모델로 떼어내는 작업을 이어가고 있습니다.

## 그런데 정확도가 수익으로 이어지지 않았습니다

좋은 모델을 골랐으니 운영 성과도 자연히 따라올 거라 기대했습니다. 그래서 모델 대신 2023년 실제값을 그대로 넣은 완벽한 예측(oracle)으로 운영해보며 이론적인 상한선을 재봤습니다. 그런데 완벽한 예측과 XGBoost의 운영 수익 차이가 **0.08%에 그쳤습니다**. 예측에 일부러 노이즈를 넣어 정확도를 떨어뜨려봐도 자급률은 79.05%에서 79.92%로 오히려 조금 올랐습니다.

원인은 모델이 아니라 운영 로직에 있었습니다. 처음 시뮬레이터는 잉여가 오면 채우고 부족하면 빼는 단순한 규칙이라, 지금 받지 않은 잉여는 그냥 사라지는 구조였습니다. 이렇게 되면 미래를 완벽히 알아도 할 수 있는 일이 "지금 덜 받기"밖에 없어서, 예측 정확도가 끼어들 자리 자체가 없었던 것입니다.

## 진짜 답은 시스템 구조에 있었습니다

그래서 모델은 그대로 두고, 운영이 의미를 가질 수 있는 조건을 먼저 만들기로 했습니다. 우선 시간대마다 전기요금이 다른 변동 요금(TOU)을 시뮬레이터에 넣었습니다(경부하는 약 87원, 최대부하는 약 222원/kWh). 가격 차이가 생기자 그제야 지금 저장해뒀다가 비싼 낮 시간에 팔까 같은 진짜 의사결정이 만들어졌습니다.

그 위에서 운영 방식을 MPC로 바꿨습니다. 한 시점만 보고 충방전하던 규칙을, 24시간 앞을 내다보고 충방전 시점을 통째로 계산하는 방식(매 시점 선형계획법으로 최적해를 푸는, 모두 96,437회)으로 교체했습니다. 그러자 같은 데이터, 같은 예측인데도 **순수익이 49.5% 올랐습니다**(1,689억 원에서 2,526억 원). 완벽한 예측으로 얻은 개선이 0.08%였던 것과 비교하면, **결과를 가른 것은 모델이 아니라 시스템 구조였습니다.**

MPC가 무엇을 했는지 들여다보니 운영 방식 자체가 달랐습니다. 기존 정책이 수요를 채우려고 충방전했다면, MPC는 가격 차이가 보이면 수요와 상관없이 사고팔며 거래량을 70~80% 늘렸습니다. 배터리를 단순히 수요를 메우는 장치가 아니라 차익을 만드는 자산으로 쓴 셈입니다.

한 가지 흥미로웠던 건, MPC를 적용한 뒤에도 XGBoost 예측과 완벽한 예측의 수익 차이가 다시 0.08%였다는 점입니다. 차익거래는 시간대별 가격이라는 정해진 구조에 기대기 때문에, 발전량을 몇 MWh까지 정확히 맞히느냐보다 이 시간대에 잉여가 대략 있을지 없을지만 알면 충분했던 것입니다. 정확도의 효용이 어느 선을 넘으면 거의 0에 가깝다는 처음의 발견이, 수익을 기준으로 봐도 다시 확인된 셈이었습니다.

## 전체 파이프라인은 이렇게 굴러갑니다

학습은 오프라인에서 끝내 모델 파일로 떨어뜨리고, FastAPI가 그 모델로 예측을 내주면, 운영 도구가 24시간 예측을 받아 MPC로 충방전 계획을 짭니다. 예측과 운영을 분리해 둔 덕분에, 모델을 바꿔도 운영 쪽은 건드리지 않고 실험할 수 있었습니다.

\`\`\`mermaid
flowchart TB
    subgraph TRAIN["학습 파이프라인 (오프라인)"]
        A[preprocess_national.py] --> B[feature_engineering]
        B --> C[train_xgboost_national.py]
        C --> D[(national_xgboost_model.json)]
    end

    subgraph API["FastAPI 서버"]
        D --> E["/predict (단일 시점)"]
        D --> F["/predict_horizon (멀티스텝 1~48)"]
    end

    subgraph UI["React 운영 도구"]
        G[운영자 입력<br/>region · SOC · start_time] --> H[orchestrator]
        H -. HTTP 1회 .-> F
        F -. 예측 48개 .-> H
        H --> I[MPC LP 솔버<br/>scipy.linprog]
        I --> J[3개 정책 비교 결과]
    end

    classDef io fill:#F1EFE8,stroke:#888780,color:#444441
    classDef proc fill:#E6F1FB,stroke:#378ADD,color:#0C447C
    classDef gate fill:#E1F5EE,stroke:#1D9E75,color:#085041,stroke-width:2px

    class A,B,C,E,F,H proc
    class D,G,J io
    class I gate

    style TRAIN fill:#F7F6F2,stroke:#B4B2A9
    style API fill:#F7F6F2,stroke:#B4B2A9
    style UI fill:#F7F6F2,stroke:#B4B2A9
\`\`\`

## 좋아 보이는 숫자일수록 한 번 더 의심했습니다

중간에 LSTM이 ESS 운영 지표에서 XGBoost보다 좋아 보이는 결과가 나온 적이 있었습니다. 전력이 부족했던 횟수가 LSTM은 426회로 XGBoost의 515회보다 적게 나온 것입니다. 정확도는 XGBoost가 훨씬 높은데 운영 지표는 LSTM이 낫다니, 그대로 받아들이면 그럴듯한 이야기였습니다.

그런데 **모델을 칭찬하기 전에 시뮬레이터부터 의심해** 코드를 뜯어보니, 부족 횟수가 방전 분기에서만 세어지고 있었습니다. 예측이 충전 쪽으로 틀린 경우에는 실제로는 부족한 상황인데도 부족으로 세지 않는, 한쪽으로 치우친 버그였습니다. 결국 보수적으로 낮게 예측하는 모델이 방전 분기에 더 자주 들어가 부족을 더 잘 세고 있었을 뿐, LSTM이 좋아 보인 건 운영 품질이 아니라 예측이 어느 방향으로 틀렸는가의 차이였습니다.

한계도 감추지 않고 남겨뒀습니다. MPC 최적화 과정에서 약 13%는 풀리지 않는(LP infeasible) 구간이었는데, 전국을 합산한 시뮬에서만 나오고 지역별 17개에서는 한 건도 없었습니다. 이 부분은 숨기기보다 시뮬레이터의 한계로 보고서에 그대로 적었습니다.

## 이 프로젝트로 단단해진 것

가장 크게 배운 것은, 잘 되는 것보다 안 되는 것을 정확히 측정하는 일의 가치였습니다. 더 정교한 모델이나 최신 트랜스포머처럼 직관적으로 옳아 보이는 방법도 막상 데이터로 확인하면 효과가 없을 수 있고, 그럴 때 고집을 부리기보다 측정 결과를 근거로 방향을 바꾸는 편이 낫다는 것을 몸으로 익혔습니다. 그리고 눈에 보이는 좋은 숫자일수록 그대로 믿지 않고 왜 그런지 끝까지 따라가 보는 습관이 생겼습니다. 변수가 많은 환경일수록 이런 태도가 더 필요하다고 생각합니다.

여기서는 생각의 흐름과 파이프라인 위주로 풀었고, 실제 코드와 학습 스크립트, 전체 결과는 GitHub에 정리해 두었습니다.
`,
  },
  {
    id: "p3", title: "심울림 — 발달장애인 감정·상태 전달 인터페이스", kind: "창업경진대회 · 팀 프로젝트",
    summary: "말로 표현하기 어려운 발달장애인의 감정과 상태를 웨어러블 HRV 신호로 감지해 보호자에게 전달하는 커뮤니케이션 솔루션. 2026 보건의료빅데이터·AI 활용 창업경진대회 출품작(팀 ‘프로젝트 헤일레이’).",
    highlights: [
      "HRV 기반 정서·각성 상태 추정",
      "모바일·웹 대시보드, 랜딩, 브로셔까지 Vercel 배포",
      "복지센터·자폐인 그룹활동·가정 내 적용 시나리오",
    ],
    stack: ["HRV 분석", "Wearable", "Next.js", "Vercel"],
    links: [
      { label: "Live · 모바일", url: "https://simullim.vercel.app/" },
      { label: "Live · 웹", url: "https://simullim-dashboard-web.vercel.app/" },
      { label: "랜딩", url: "https://simullim-landing.vercel.app/" },
    ],
    body: `
## 말로 표현하기 어려운 마음을 대신 전하기

발달장애인은 감정과 상태를 말로 표현하기 어려운 경우가 많고, 보호자는 돌발 행동을 늦게 알아차려 사고로 이어지기도 합니다. 심울림은 웨어러블의 심박변이도(HRV) 신호로 정서·각성 상태를 감지해 보호자에게 전하는 커뮤니케이션 솔루션입니다. 2026 보건의료빅데이터·AI 활용 창업경진대회 출품작(팀 '프로젝트 헤일레이')이에요.

## 제가 맡은 부분

팀 프로젝트에서 저는 **설문조사 데이터 분석, 공공데이터 기반 문제·시장 규모 추산, 전용 디바이스 디자인 시안, 기대효과 설계**를 담당했습니다. 기술 아이디어가 왜 필요한지를 데이터로 뒷받침하고, 그것을 사람들이 이해할 수 있는 제품 형태로 그려내는 역할이었어요.

## 배운 것

혼자 쓰는 코드와 달리, 여러 사람의 작업을 하나의 설득력 있는 제안으로 모으는 경험이었습니다. 대시보드·랜딩·브로셔까지 실제로 배포해, 아이디어를 끝까지 형태로 만드는 과정을 마쳤어요.

> 기술은 결국 사람의 문제를 풀기 위한 도구라는 걸, 가장 약한 사용자를 위한 설계에서 다시 한번 느꼈습니다.
`,
  },
];

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

function Body({ text, onImg }) {
  const segs = String(text).split("```");
  return segs.map((seg, si) => {
    if (si % 2 === 1) {
      if (/^mermaid\s/.test(seg)) return <Mermaid key={si} chart={seg.replace(/^mermaid\n/, "")} />;
      return <pre key={si} className="g-pre">{seg.replace(/^\w*\n/, "")}</pre>;
    }
    const lines = seg.split("\n"); const out = []; let list = [];
    const flush = (k) => { if (list.length) { out.push(<ul key={"u" + k} className="g-ul">{list}</ul>); list = []; } };
    const inline = (s) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p?.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> :
      p?.startsWith("`") ? <code key={i} className="g-code">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>);
    lines.forEach((ln, i) => {
      const k = si + "-" + i;
      if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(ln)) {
        flush(k);
        const [, alt, src] = ln.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        out.push(
          <figure key={k} className="g-fig">
            <img className="g-img" src={src} alt={alt} loading="lazy" onClick={onImg ? () => onImg(src) : undefined} />
            {alt ? <figcaption className="g-cap">{alt}</figcaption> : null}
          </figure>
        );
      }
      else if (/^### /.test(ln)) { flush(k); out.push(<h3 key={k} className="g-h3">{inline(ln.slice(4))}</h3>); }
      else if (/^## /.test(ln)) { flush(k); out.push(<h2 key={k} className="g-h2">{inline(ln.slice(3))}</h2>); }
      else if (/^# /.test(ln)) { flush(k); out.push(<h2 key={k} className="g-h2">{inline(ln.slice(2))}</h2>); }
      else if (/^> /.test(ln)) { flush(k); out.push(<blockquote key={k} className="g-quote">{inline(ln.slice(2))}</blockquote>); }
      else if (/^- /.test(ln)) { list.push(<li key={k}>{inline(ln.slice(2))}</li>); }
      else if (ln.trim() === "") { flush(k); }
      else { flush(k); out.push(<p key={k} className="g-p">{inline(ln)}</p>); }
    });
    flush("e" + si);
    return <div key={si}>{out}</div>;
  });
}

const clean = (b) => String(b).replace(/```[\s\S]*?```/g, " ").replace(/[#>*`\[\]]/g, "").replace(/\s+/g, " ").trim();
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
    .g-ul li{position:relative;padding-left:1.3rem;margin:.4rem 0;line-height:1.7}
    .g-ul li:before{content:"§";position:absolute;left:0;color:${C.mustard};font-weight:700}
    .g-bull li:before{content:"•"}
    .g-quote{border-left:3px solid ${C.mustard};margin:1.2rem 0;padding:.3rem 0 .3rem 1.1rem;color:${C.ink};font-style:italic;font-family:${FD};font-size:1.16rem}
    .g-code{background:${C.tintM};color:${C.ink};padding:.08em .4em;border-radius:2px;font-size:.9em;font-family:${FM}}
    .g-pre{background:${C.ink};color:${C.bg};padding:1rem;overflow-x:auto;font-size:.85rem;margin:1rem 0;font-family:${FM}}
    .g-fig{margin:1.7rem 0;text-align:center}
    .g-img{max-width:100%;height:auto;border:1px solid ${C.frame};border-radius:4px;cursor:zoom-in;box-shadow:0 6px 18px rgba(44,49,58,.12);display:block;margin:0 auto}
    .g-cap{margin-top:.5rem;font-family:${FM};font-size:.8rem;color:${C.ink};opacity:.7}
    .g-mermaid{margin:1.6rem 0;padding:1.2rem;background:${C.panel};border:1px solid ${C.frame};border-radius:3px;text-align:center;overflow-x:auto}
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
      <div style={{ height: 120, border: `1px solid ${C.frame}`, overflow: "hidden" }}><Art seed={p.id + p.title} /></div>
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
      <div style={{ height: 96, borderBottom: `1px solid ${C.frame}`, overflow: "hidden" }}><Art seed={p.id + p.title} /></div>
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
        <div className="kicker" style={{ marginBottom: ".9rem" }}>Est. 2026 — A Study Journal &amp; Portfolio</div>
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
          <button className={"navlink" + (route.name === "about" ? " on" : "")} onClick={() => goto("about")}>About</button>
          <button className={"navlink" + (route.name === "archive" ? " on" : "")} onClick={() => goto("archive")}>Ask the Archivist</button>
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
                    <Art seed={featured.id + "feat"} />
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
                <div className="eyebrow dbl-bot" style={{ paddingBottom: ".5rem", marginBottom: "1rem" }}>About the Editor</div>
                <div style={{ aspectRatio: "1 / 1", border: `1px solid ${C.frame}`, overflow: "hidden", marginBottom: "1rem", filter: "grayscale(.12)" }}><img src="/profile.jpg" alt="최사랑" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }} /></div>
                <p style={{ fontSize: ".87rem", lineHeight: 1.8, color: C.body, margin: 0 }}>
                  MLOps와 머신러닝 시스템을 공부하고 기록합니다. 읽은 논문, 만든 파이프라인, 정리한 개념을 한데 모은 작업실. 포트폴리오이자 공부 노트.
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
            <div className="eyebrow" style={{ marginBottom: "1rem" }}>About the Editor</div>
            <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(2rem,5vw,2.9rem)", color: C.ink, lineHeight: 1.1, margin: "0 0 .6rem" }}>최사랑</h1>
            <p style={{ fontFamily: FD, fontStyle: "italic", fontSize: "1.1rem", color: C.brick, margin: "0 0 1.8rem" }}>Editor · MLOps &amp; ML Systems</p>

            <div className="dbl-top" style={{ marginBottom: "2.2rem" }} />

            <div style={{ fontSize: "1.05rem" }}>
              <p className="g-p" style={{ fontFamily: FD, fontStyle: "italic", fontSize: "1.2rem", color: C.ink, lineHeight: 1.6 }}>
                완성된 결론보다 ‘이해해가는 과정’을 남기는 데 의미를 둡니다.
              </p>

              <h2 className="g-h2">이 저널에 대하여</h2>
              <p className="g-p">The Study Gazette는 제가 공부하며 정리한 머신러닝 시스템과 MLOps 지식을 모아두는 작업실입니다. 읽은 논문, 직접 구성한 파이프라인, 한 번에 와닿지 않았던 개념을 다시 제 언어로 풀어 쓴 기록들이 이곳에 쌓입니다. 누군가에게 보여주기 위한 글이기 이전에, 미래의 제가 다시 꺼내 읽을 노트입니다.</p>

              <h2 className="g-h2">관심 분야</h2>
              <ul className="g-ul">
                <li>MLOps 파이프라인 설계와 모델 배포 전략</li>
                <li>머신러닝 시스템 아키텍처와 인프라</li>
                <li>멀티모달 · 생성 모델의 동작 원리</li>
                <li>AI 개발 도구와 코딩 에이전트 활용</li>
              </ul>

              <h2 className="g-h2">약력</h2>
              <p className="g-p">비개발자로 출발해 AI 엔지니어링을 공부하며 AI 엔지니어 신입으로의 전향을 준비하고 있습니다. 식물 진단 AI 서비스와 태양광 발전량 예측·ESS 운영 시뮬레이션 등 세 개의 프로젝트를 직접 설계·구현했고, 화려한 모델보다 평가셋과 측정으로 AI 시스템의 동작을 끝까지 통제하는 방식으로 일합니다.</p>

              <h2 className="g-h2">연락</h2>
              <p className="g-p">이메일 <a href="mailto:rangedayo@naver.com" style={{ color: C.brick }}>rangedayo@naver.com</a> · GitHub <a href="https://github.com/rangedayo" target="_blank" rel="noreferrer" style={{ color: C.brick }}>github.com/rangedayo</a></p>

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
            <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: "clamp(2rem,5vw,2.9rem)", color: C.ink, lineHeight: 1.12, margin: "0 0 1.4rem" }}>{cur.title}</h1>
            <div className="dbl-top dbl-bot" style={{ height: 260, margin: "0 0 2rem", overflow: "hidden" }}><Art seed={cur.id + "hero"} /></div>
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
                          <div style={{ height: 120, borderBottom: `1px solid ${C.frame}`, overflow: "hidden" }}><Art seed={p.id + p.title} /></div>
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
