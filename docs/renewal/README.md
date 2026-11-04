# Pick Team 리뉴얼 정본

이 디렉터리가 Pick Team 리뉴얼 기획의 정본이다. 로컬 PC, Vault, Notion에 흩어진 다른 사본보다 이 문서를 우선한다. cloud 세션도 이 저장소만으로 같은 기준을 읽을 수 있게 하려고 옮겨 왔다.

## 문서

| 파일 | 내용 |
| --- | --- |
| `pick-team-renewal-spec.md` | 종합 스펙. 전략, 현황 감사, 마일스톤(M0~M3), 열린 질문 |
| `spec/00-overview.md` | 개요와 문서 지도 |
| `spec/01-e2e-flows.md` | 역할별 E2E 흐름 |
| `spec/02-information-architecture.md` | 화면 인벤토리(약 30개)와 URL 체계 |
| `spec/10`~`17` | 도메인별 상세(인증·온보딩, PR 카드, 팀 빌딩, 워크스페이스 관리, 협업 도구, 커뮤니케이션, 알림, 정책·운영) |
| `spec/90-open-questions.md` | 미결 질문 |
| `mockups/*.html` | 화면 시안. 시각 방향의 근거이고, 시안 속 데이터와 가상 기능은 명세가 아니다 |

## 출처와 버전

- 원본은 mainpc `D:\Projects\active\pick-team-refactor\docs\`에 있었다. git으로 추적되지 않아서 이전 버전은 남아 있지 않다.
- 이 사본의 기준 시각: `pick-team-renewal-spec.md` 2026-07-05 02:37 수정본. `spec/`과 `mockups/`도 같은 시점의 파일이다.
- 2026-11-04에 이 저장소로 옮겼다. 이후 기획을 수정하면 이 디렉터리를 고치고 커밋한다. 다른 곳의 사본은 갱신하지 않는다.
- Notion 정본: [Pick Team 리뉴얼 기획 (MVP 2.0 정본)](https://app.notion.com/p/40e33611c09f810fb72bd71b1c99affd). 종합 스펙 원문과 이 문서의 구현 현황을 담고, 상세 스펙은 이 디렉터리를 가리킨다. 기획을 고치면 두 곳을 같이 고친다.
- Notion「파이널 프로젝트 기능 명세서」(Epic 1–5)는 2025년 원 프로젝트의 명세다. 리뉴얼 기준이 아니다.

## 구현 현황 (2026-11-04 소스 확인 기준)

실행 검증은 하지 않았고 소스만 읽은 결과다.

### 프론트엔드 브랜치 (`earlydreamer/pick-team-frontend-forked`)

| 브랜치 | 기준 문서 | 상태 |
| --- | --- | --- |
| `codex/frontend-redesign` | `DESIGN.md` | 디자인 시스템과 갤러리. 화면 구현은 기존 라우트 그대로다 |
| `claude/frontend-redesign-m1pujm` | Notion 기능 명세서 | codex 브랜치 위에 셸·인증·초대·홈을 실제 API로 재작성했다. 지원·스카우트·PR 카드 v2·알림 센터는 API가 없어서 제외했다. URL은 기존 체계 |
| `devin/renewal-v2` | 이 스펙 | IA 화면을 거의 전부 스펙 URL로 구현했다. 새 화면은 API 호출 없이 `RenewalContext` 하드코딩 데이터와 localStorage로 동작하는 데모다. `matchingEngine.ts`에 규칙 기반 매칭 v1이 있다 |

어느 브랜치를 구현 기반으로 삼을지는 아직 정하지 않았다.

### 백엔드 (`earlydreamer/pick-team-backend-forked`)

- 어느 브랜치(`main`, `codex/renewal`, `security/code-review-fixes`, `fix/test-drift`)에도 리뉴얼 도메인(팀 빌딩 세션, 지원·수락, 초대 링크 v2, PR 카드 v2 필드)이 없다. 그래서 M2는 백엔드에 막혀 있다.
- M0 0.2(Account-Id 헤더 인증 제거): `AnnouncementController`에 헤더 사용 3곳이 남아 있다.
- M0 0.3(Flyway): 도입되지 않았다.

## 저장소 경계

- 작업 대상은 개인 fork(`earlydreamer/pick-team-frontend-forked`, `earlydreamer/pick-team-backend-forked`)다. 원본 `KOSTA-295-pick-team/*`에는 push하지 않는다.
- fork의 `main`에 push하면 운영 배포(`deploy.yml`)가 실행된다. 리뉴얼 작업은 브랜치에서 한다.
