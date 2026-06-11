# The Study Gazette — 배포 안내

빈티지 신문 톤의 읽기 전용 개인 웹페이지(공부 정리 + 포트폴리오)를 Vercel에 올리기 위한 Next.js 프로젝트입니다. 디자인·기능은 기존 아티팩트와 동일하며, 배포를 위해 **데이터 읽기**와 **AI 검색** 두 군데만 외부 호스팅에 맞게 바꿨습니다.

## 무엇이 바뀌었나
- **데이터**: 아티팩트의 `window.storage` 대신 `data/posts.json`을 읽습니다. 지금은 데모 글 4건이 들어 있으니, 본인 글로 교체하면 됩니다.
- **AI 검색(Ask the Archivist)**: 브라우저가 Anthropic API를 직접 부르지 않고, 서버리스 함수 `app/api/search/route.js`를 거칩니다. API 키는 서버 환경변수에만 두므로 노출되지 않습니다.

## 폴더 구조
```
study-gazette-site/
├─ app/
│  ├─ Gazette.jsx          # 페이지 본체 (디자인·인터랙션 전부 그대로)
│  ├─ page.jsx             # 루트 페이지
│  ├─ layout.jsx           # 공통 레이아웃 (lang="ko")
│  └─ api/search/route.js  # AI 검색 서버리스 함수 (API 키 사용처)
├─ data/posts.json         # 글 데이터 (여기를 교체)
├─ .env.example            # 환경변수 예시
├─ package.json
└─ next.config.mjs
```

## 로컬에서 먼저 확인 (선택)
```bash
npm install
npm run dev        # http://localhost:3000
```
AI 검색까지 로컬에서 테스트하려면 `.env.example`을 `.env.local`로 복사하고 본인 키를 채운 뒤 `npm run dev`. 키가 없어도 페이지·글 보기는 정상 동작하며, 검색만 "아직 설정되지 않았어요" 안내가 뜹니다.

## 배포 — GitHub + Vercel (권장, 푸시하면 자동 재배포)
계정 생성·키 발급은 본인 계정으로 직접 하셔야 하는 부분입니다.

1. **Anthropic API 키 발급** — console.anthropic.com 에서 키를 하나 만들어 둡니다. (AI 검색은 검색 1회당 Claude Sonnet을 호출하므로 소량의 사용료가 듭니다.)
2. **GitHub에 올리기** — 이 폴더에서:
   ```bash
   git init
   git add .
   git commit -m "study gazette"
   ```
   GitHub에서 빈 저장소를 만든 뒤 안내되는 `git remote add ... && git push` 명령을 실행합니다.
3. **Vercel 연결** — vercel.com 로그인 → New Project → 방금 만든 GitHub 저장소 선택. 프레임워크는 Next.js로 자동 인식되며 빌드 설정은 건드릴 필요 없습니다.
4. **환경변수 등록** — 배포 화면(또는 Project → Settings → Environment Variables)에서:
   - Name: `ANTHROPIC_API_KEY`
   - Value: 1번에서 발급한 키
   저장 후 Deploy. (이미 배포했다면 환경변수 추가 후 한 번 Redeploy 해야 적용됩니다.)
5. 완료되면 `https://<프로젝트명>.vercel.app` 주소가 나옵니다. 커스텀 도메인은 Settings → Domains에서 추가.

## 배포 — Vercel CLI (더 빠른 길)
```bash
npm i -g vercel
vercel            # 안내에 따라 로그인 후 첫 배포
vercel env add ANTHROPIC_API_KEY    # 키 입력
vercel --prod     # 프로덕션 배포
```

## 글 교체 방법
`data/posts.json`은 객체 배열입니다. 각 글의 형식:
```json
{
  "id": "고유값",
  "title": "제목",
  "category": "AI 모델 이론",
  "pinned": false,
  "tags": ["태그1", "태그2"],
  "created": 1748736000000,
  "updated": 1748736000000,
  "body": "본문(마크다운: ## 제목, - 목록, **굵게**, `코드`, > 인용, ```코드블록``` 지원)"
}
```
- `pinned: true`인 글이 Front Page 상단 Featured로 노출됩니다(없으면 최신글).
- `created`/`updated`는 밀리초 단위 타임스탬프입니다. `new Date("2026-06-01").getTime()`으로 구할 수 있습니다.
- knowledge_garden 에디터에서 내보낸 글이 있으면 같은 형식으로 이 파일에 붙여넣으면 됩니다.
- 파일을 고치고 다시 push하면 Vercel이 자동으로 새로 빌드·배포합니다.

## 아직 남은 본문 채우기 (코드 안)
- `app/Gazette.jsx`의 About 페이지 — 이름·약력·연락처·사진이 `[ ]` 플레이스홀더로 남아 있습니다.
- `PROJECTS` 배열의 ①②번 프로젝트 GitHub 주소(현재 빈 문자열).
