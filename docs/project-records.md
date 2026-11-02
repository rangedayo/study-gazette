# 프로젝트 기록 올리기

프로젝트 소개는 기존 노션 **프로젝트 (Projects)** DB에서 관리한다. 새 실험 글은 **글 (Posts)** DB에 별도 페이지로 작성하고 `Project`에 해당 프로젝트를 연결한다.

## energy-forecast에 첫 글 올리기

1. [준비된 비공개 초안](https://app.notion.com/p/40c1dbb7727c81f39f40f0b2e051ace1)을 연다.
2. 제목을 바꾸고, 페이지 본문에 작성한 글을 붙여 넣는다. `Project`는 태양광·ESS 프로젝트로 연결되어 있다.
3. `Date`에 발행일을 입력한다. 카테고리와 태그, 페이지 커버는 필요할 때 추가한다.
4. 공개할 준비가 되면 `Published`를 체크한다. 다음 동기화와 배포 후 프로젝트 소개 하단과 왼쪽 메뉴에 글이 표시된다.

글을 더 쓸 때는 [energy-forecast · 실험 기록 보기](https://app.notion.com/p/de67a995c5cf45f2bcddda857a9a30fa?v=40c1dbb7727c813db14b000c81d804f8)에서 새 페이지를 만든다. `Project`가 태양광·ESS 프로젝트에 연결되어 있는지 확인한다.

식물 진단 프로젝트 글은 [plant-diagnosis · 개발 기록 보기](https://app.notion.com/p/de67a995c5cf45f2bcddda857a9a30fa?v=40c1dbb7727c8123b130000ca6862b9a)에서 같은 방법으로 작성한다.

## 소개와 게시글의 구분

| 작성할 내용 | 노션 위치 |
|---|---|
| 프로젝트 전체 소개 수정 | 기존 프로젝트 (Projects) DB의 해당 페이지 |
| 프로젝트에 추가할 실험·개발 기록 | 글 (Posts) DB의 새 페이지, `Project`에 해당 프로젝트 연결 |
| 일반 Study Notes | 글 (Posts) DB의 새 페이지, `Project`는 비워 둠 |

`Project`에는 글 하나당 프로젝트 하나만 연결한다. 프로젝트 기록은 Study Notes 카테고리 목록과 구분되며, 같은 프로젝트의 글끼리 이전·다음 글로 이동한다. 소개 하단의 GitHub 등 기존 Links는 그대로 유지한다.

## 사이트 반영

- 자동 동기화: 매주 월요일 한국 시간 00:00.
- 바로 반영: 저장소 GitHub Actions에서 `Sync Notion → posts.json / projects.json`의 `Run workflow` 실행. 봇 커밋 후 기존 배포가 진행된다.
- `Date` 내림차순으로 ‘최근 글부터’ 정렬한다. `Date`가 비어 있으면 노션 페이지 생성일을 사용한다.
- `Published`를 해제하면 다음 동기화에서 사이트 목록에서 빠진다.

`data/posts.json`은 생성물이므로 직접 수정하지 않는다. `scripts/sync-notion.mjs`가 `Project` 관계에서 연결된 프로젝트의 `Slug`(현재 `p2`/`p1`)를 읽어 `projectId`로 저장한다. 프로젝트 연결을 해제하면 다음 동기화부터 일반 Study Notes로 분류된다.
