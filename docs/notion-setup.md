# Notion 글 동기화 설정 가이드

스터디 노트 글을 **Notion에서 작성/수정**하면, GitHub Action이 이를 읽어
`data/posts.json`으로 변환·커밋하고 Vercel이 자동 배포한다.
즉 **Notion이 원본(single source of truth)**, `data/posts.json`이 그 백업이다.

```
Notion 작성/수정 → (자동 1시간 주기 또는 수동 실행) GitHub Action
   → data/posts.json 생성·커밋 → Vercel 자동 배포 → 사이트 반영
```

---

## 1. Notion 데이터베이스 (이미 생성됨)

DB는 이미 만들어 두었다.

- 홈 페이지: **웹 노트 (Study Gazette)** — https://app.notion.com/p/3841dbb7727c81819529e8f8dbbe0761
- 글 DB: **글 (Posts)** — https://app.notion.com/p/de67a995c5cf45f2bcddda857a9a30fa
- **`NOTION_DB_ID` = `de67a995c5cf45f2bcddda857a9a30fa`**

DB 속성(컬럼)은 아래와 같이 구성돼 있다. (이름·타입을 바꾸면 동기화가 깨지니 그대로 둘 것)

| 속성 이름 | 타입 | 역할 | 필수 |
|-----------|------|------|------|
| `Name` (기본 title) | Title | 글 제목 | ✅ |
| `Category` | Select | 분류 (비전 모델/언어 모델/머신러닝 알고리즘/데이터 관리/테스트 · 디버깅/개발 인프라/기타) | ✅ |
| `Tags` | Multi-select | 태그 | 권장 |
| `Date` | Date | 발행일 (목록 정렬 기준) | ✅ |
| `Published` | Checkbox | **체크된 글만** 사이트에 노출 | ✅ |
| `Pinned` | Checkbox | 상단 고정 여부 | 선택 |
| `Slug` | Text | 글 URL id (비우면 자동 생성) | 선택 |

> - **본문**은 각 행(페이지)을 열고 그 안에 그냥 작성하면 된다.
> - 지원 서식: `#/##/###` 제목, **굵게**, `코드`, 코드블록, 인용, 글머리 목록.
>   그 외(이미지·표·토글 등)는 현재 **텍스트 전용** 정책상 사이트에 표시되지 않는다.
> - `Published` 체크를 풀면 → 다음 동기화 때 사이트에서 사라진다(초안 관리에 유용).

---

## 2. Notion Integration(토큰) 발급 & 연결

1. https://www.notion.so/my-integrations → **New integration** 생성
   - 이름 자유(예: `study-gazette-sync`), 권한은 **Read content**만 있으면 충분
2. 생성 후 표시되는 **Internal Integration Secret**(`secret_...`) 복사 → 이게 `NOTION_TOKEN`
3. 1번에서 만든 데이터베이스 페이지 우상단 **··· → Connections → (만든 integration 선택)**
   으로 DB를 integration에 **연결**한다. (이걸 안 하면 토큰이 있어도 DB를 못 읽음)

### Database ID 찾기

DB를 브라우저에서 열면 주소가 이렇게 생겼다:

```
https://www.notion.so/<워크스페이스>/<32자리_hex>?v=...
                                    └──────┬──────┘
                                       이게 NOTION_DB_ID
```

`?v=` 앞의 32자리(하이픈 포함/미포함 무관)가 `NOTION_DB_ID`다.

---

## 3. GitHub Secret 등록

저장소 → **Settings → Secrets and variables → Actions → New repository secret** 에서 2개 등록:

| Secret 이름 | 값 |
|-------------|-----|
| `NOTION_TOKEN` | 2번에서 복사한 `secret_...` |
| `NOTION_DB_ID` | 2번에서 찾은 32자리 ID |

---

## 3-b. 기존 글 28건 Notion으로 가져오기 (최초 1회)

지금 `data/posts.json`에 있는 글 28건을 위 DB로 한 번에 올린다.
(2번에서 만든 integration을 **DB에 Connections로 연결**한 뒤 실행해야 함)

```powershell
# PowerShell
$env:NOTION_TOKEN="secret_..."; $env:NOTION_DB_ID="de67a995c5cf45f2bcddda857a9a30fa"; npm run import:notion
```

- 각 글의 원래 id(`n01`..)가 `Slug`에 들어가 사이트 URL이 그대로 유지된다.
- ⚠️ **한 번만 실행**할 것. 다시 돌리면 같은 글이 중복 생성된다.
- 끝나면 Notion DB에서 28건이 보이고, 본문/태그/발행일이 채워져 있다.

---

## 4. 동기화 실행

- **자동**: 매시 정각에 GitHub Action(`Sync Notion → posts.json`)이 돌며 변경분만 커밋.
- **수동(즉시)**: 저장소 **Actions 탭 → Sync Notion → posts.json → Run workflow** 클릭.
  2~3분 뒤 Vercel 배포까지 끝나면 사이트에 반영된다.

### 로컬에서 테스트하려면

```bash
# PowerShell
$env:NOTION_TOKEN="secret_..."; $env:NOTION_DB_ID="32자리id"; npm run sync:notion
```

실행하면 `data/posts.json`이 갱신된다. (커밋은 수동으로 하거나 Action에 맡기면 된다)

---

## 동작/주의 메모

- **백업**: 매 동기화가 `data/posts.json`을 git에 커밋하므로, Notion이 사라져도
  글 원본이 저장소 + git 히스토리에 남는다.
- **삭제 동작**: Notion에서 글을 지우거나 `Published`를 풀면 사이트에서도 사라진다.
  실수 시 Notion 휴지통(기본 30일) 또는 git 히스토리에서 복구 가능.
- **글 id**: `Slug`를 비우면 Notion 페이지 id로 자동 생성된다. 한번 발행한 글의
  공유 URL을 안정적으로 유지하려면 `Slug`(예: `clip-intro`)를 채워두는 걸 권장.

---

## 5. 프로젝트(빌드 노트) 동기화

프로젝트 **텍스트**도 글과 같은 방식으로 Notion에서 작성·수정한다.
스크린샷(카드 썸네일·상세 히어로)은 Notion이 아니라 **코드(`app/Gazette.jsx`의 `PROJECT_SHOTS` 맵 + `public/projects/`)** 에서 관리한다(거의 안 바뀌므로). 스크린샷 교체가 필요하면 코드에서 바꾼다.

- 프로젝트 DB: **프로젝트 (Projects)** — https://app.notion.com/p/933578ac0f354cad99cd9736ba3f2e80
- DB id는 동기화 스크립트에 기본값으로 들어 있어 **별도 GitHub Secret이 필요 없다**(원하면 `NOTION_PROJECTS_DB_ID`로 덮어쓰기 가능).

| 속성 | 타입 | 역할 |
|------|------|------|
| `Name` | Title | 프로젝트 제목 |
| `Kind` | Text | 부제 (예: `AI 서비스 · 풀스택`) |
| `Summary` | Text | 카드·상세 상단 요약 |
| `Stack` | Multi-select | 기술 스택 |
| `Highlights` | Text | 성과 불릿 — **한 줄에 하나** |
| `Links` | Text | `라벨 \| url` 형식 — **한 줄에 하나** |
| `Date` | Date | 목록 정렬 기준(내림차순) |
| `Published` | Checkbox | 체크된 것만 사이트 노출 |
| `Pinned` | Checkbox | 상단 고정 |
| `Slug` | Text | URL id (`p1`/`p2`/`p3`) |

본문은 각 페이지를 열어 작성한다. 머메이드 다이어그램은 **코드블록 언어를 `mermaid`로** 두면 사이트에서 그대로 렌더된다.

### 최초 1회 설정

1. **integration 연결**: 위 프로젝트 DB 페이지 우상단 **··· → Connections → (글 DB에 쓰던 integration 선택)**.
   (이걸 안 하면 GitHub Action이 토큰이 있어도 프로젝트 DB를 못 읽는다.)
2. **기존 3개 가져오기** (`data/projects.json` → Notion):
   ```powershell
   $env:NOTION_TOKEN="secret_..."; npm run import:projects
   ```
   ⚠️ **한 번만 실행** — 다시 돌리면 중복 생성된다.

### 동기화

- **자동**: 매시 정각 GitHub Action이 글과 함께 프로젝트도 동기화(`sync-projects.mjs` → `data/projects.json`).
- **수동(즉시)**: Actions 탭 → Run workflow.
- **로컬 테스트**: `$env:NOTION_TOKEN="secret_..."; npm run sync:projects`
