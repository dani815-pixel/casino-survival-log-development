# 카지노 생존일지 V1 (Casino Survival Diary)

실제 게임 기록 + AI 가상 플레이 + 외부 AI 분석 + 2D 미팅룸 + Shorts 결과 화면을 **하나의 로컬 데이터 흐름**으로 연결하는 모바일 전용 웹앱입니다. 서버 없이 브라우저에서 독립적으로 실행되며, 모든 데이터는 기기의 **IndexedDB**에만 저장됩니다.

> 이 앱은 실제 카지노 결과를 예측하지 않습니다. AI의 가상 플레이와 상태 변화는 기록·관찰·리뷰를 위한 데이터이며, 미래 결과를 확정적으로 예측하는 표현을 사용하지 않습니다.

## 1. 주요 기능

- **프로젝트/세션 관리**: Project → DailySession → TableSession → Shoe → Round 계층 구조
- **빠른 라운드 기록**: 결과 → 예측 → 베팅금액 → 저장 (모바일 한 손 조작, Prediction과 Actual Betting 통계 완전 분리)
- **AI 가상 플레이**: 시드를 통해 생성된 AI(초기 12명, 무제한 추가 가능)가 사용자와 동일한 Daily Start로 매일 가상 플레이. Pass는 승/패 미포함, 자산 ≤ 0이면 그날 탈락(다음날 리셋), Career 통계는 프로젝트 기간 누적
- **2D Meeting Room**: 전체 AI가 근무하는 오피스, 최대 4명의 미팅 참여자는 앞 좌석 배치, 성향 기반 말풍선
- **차트**: 사용자 잔액 변화, 일별/누적 P/L, AI 자산·순위 변화, 승률, 커리어 비교 (외부 라이브러리 없는 SVG)
- **외부 AI 연동(클립보드)**: Daily Analysis Prompt 생성/복사 → 외부 AI → 결과 붙여넣기/저장 → Next-Day Scenario Prompt 생성
- **Shorts Studio**: 저장된 분석을 바탕으로 9:16 세로 카드 6화면 생성 (스크린샷용)
- **백업/복구**: 전체 데이터 JSON Export/Import(검증 포함), Round CSV Export, Archive 우선 정책

## 2. 기술 스택

React 19 · TypeScript · Vite · Tailwind CSS 4 · IndexedDB(네이티브 API 래퍼) · Vitest · Lucide Icons

백엔드/DB 서버/API 서버/외부 AI API/게임 엔진을 사용하지 않습니다.

## 3. 디렉터리 구조

```text
src/
├─ app/store.tsx          # 전역 상태(React Context) + 액션 (UI ↔ 서비스 연결)
├─ components/            # ui.tsx(공통 UI), charts.tsx(SVG 차트/레이더), AIEditor.tsx
├─ pages/                 # Home, Game, AI, Meeting, Charts, Review, Shorts, Settings
├─ services/
│  ├─ sessionService.ts   # 프로젝트/세션/슈/테이블/라운드 라이프사이클 (IndexedDB 쓰기)
│  ├─ aiService.ts        # AI 가상 플레이 엔진 + 대화 생성 (순수 함수, rng 주입)
│  ├─ promptService.ts    # 분석/시나리오 프롬프트 생성 + 외부 AI 결과 파싱
│  ├─ backupService.ts    # JSON Export/Import, CSV, 초기화
│  └─ queries.ts          # 프로젝트 전체 데이터 로드
├─ db/db.ts               # IndexedDB 래퍼 (schemaVersion, 인덱스)
├─ models == types/       # types/index.ts (모든 엔티티 타입)
├─ utils/                 # settle(정산), statistics(통계), validation(검증), format, id
├─ data/
│  ├─ games.ts            # 게임 정의 설정 데이터 (Dragon Tiger, Baccarat)
│  ├─ seedAI.ts           # 초기 AI 12명 seed
│  └─ defaults.ts         # 기본 설정 + 프롬프트 템플릿
└─ test/logic.test.ts     # Vitest 핵심 로직 테스트
```

## 4. 설치 & 실행

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드 (dist/)
npx vitest run     # 테스트 실행
```

## 5. Netlify 배포

`netlify.toml`이 포함되어 있습니다. Build command `npm run build`, Publish `dist`, SPA fallback(`/* → /index.html`) 설정 완료. 저장소를 연결하면 바로 배포됩니다.

## 6. IndexedDB 구조

DB `casino-survival-db` (version = `schemaVersion: 1`, `meta` 스토어에 기록, 향후 마이그레이션 추가 가능)

| 스토어 | 내용 | 인덱스 |
|---|---|---|
| projects | Project (status: ACTIVE/CLOSED/ARCHIVED) | - |
| sessions | DailySession (종료 시 요약 필드 저장) | projectId |
| tables | TableSession | sessionId |
| shoes | Shoe | sessionId, tableSessionId |
| rounds | Round (사용자 기록) | sessionId, shoeId |
| aiProfiles | AIProfile (능력치 0~100, 성격/말투/대화 예시) | projectId |
| aiRecords | AIRoundRecord (AI 가상 플레이, Pass/탈락 포함) | sessionId, roundId, aiId |
| events | ROUND/SHOE_STARTED/SHOE_ENDED/TABLE_CHANGED/PAUSED/RESUMED/SESSION_ENDED | sessionId |
| reviews | 외부 AI 결과 (원문 rawText + parsedSummary) | sessionId |
| settings | 앱 설정(통화, 템플릿, 미팅, 브로드캐스트) | - |

LocalStorage는 마지막 탭/마지막 프로젝트 같은 가벼운 UI 상태에만 사용합니다.

## 7. 핵심 비즈니스 규칙

- `PROJECT START CAPITAL ≠ DAILY START CAPITAL` (프로젝트 시작 자금과 일일 시작 금액은 별개)
- `USER ACTUAL BANKROLL ≠ AI VIRTUAL BANKROLL` (AI 수익이 사용자 잔액에 영향 없음)
- `PREDICTION ≠ ACTUAL BET` (통계 완전 분리)
- AI 자산은 **매일 Daily Start로 리셋**, Career 통계는 **프로젝트 기간 누적**
- **Pass는 승/패 미포함**, AI 기록이 없는 라운드는 loss 처리하지 않음
- 자산 ≤ 0 → **ELIMINATED** (당일 플레이 중지)
- Stop Loss / Win Cut은 **경고만 표시, 자동 종료 없음**
- AI 수/미팅 참여자(최대 4명)/좌석 배치는 모두 데이터 기반 (하드코딩 없음)

## 8. Backup / Restore

- **JSON Export**: 전체 스토어를 `{ schemaVersion, exportedAt, data }` 형태로 다운로드
- **JSON Import**: JSON 형식 → schemaVersion → 필수 필드/타입 → 관계 무결성(존재하지 않는 sessionId/shoeId/roundId/aiId, roundNumber 중복, 음수 베팅 등) 검증 후, 중복 ID는 제외하고 신규만 삽입. 결과를 `Projects: 1 / Sessions: 3 / Rounds: 127...` 형태로 표시, 실패 시 원인 문장 표시
- **CSV Export**: `date, casino, game, table, shoe, round, actualResult, prediction, betAmount, profitLoss`
- **Archive 우선**: Project/AI는 삭제 대신 보관 상태로 전환

## 9. External AI Prompt 사용법

1. 게임을 기록한 뒤 **REVIEW** 탭으로 이동
2. **[Prompt 생성] → [복사]** (현재 세션에 실제 저장된 데이터만 포함: 사용자 기록, 전체 AI 기록/자산/손익/승패/적중률, 구간 흐름, 의견 집중/분산, 사용자-AI 일치율, 탈락, 성향, dynamic state)
3. 외부 AI에 붙여넣고 분석 요청 (미래 예측이 아닌 관찰/조건 기반 해석을 요청하는 템플릿)
4. 결과를 복사해 **텍스트 영역에 붙여넣기 → [저장]** (원문 보존 + 가능한 범위의 요약 추출)
5. 저장이 완료되면 **[시나리오 Prompt 생성]** 활성화 (이전 데이터 + 데일리 분석 기반 다음날 관찰 시나리오)

프롬프트 템플릿(Analysis/Scenario/Meeting/Content)은 **SETTINGS → 외부 AI**에서 수정할 수 있습니다. `{{DATA}}` 위치에 세션 데이터가 삽입됩니다.

## 10. Project / Session / Table / Shoe / Round 흐름

```text
Project 시작 → Daily Session 시작(User와 전체 활성 AI가 같은 금액으로 출발)
  → Round 입력 (즉시 IndexedDB 저장, 새로고침 후에도 유지)
  → [슈 종료] Shoe N → Shoe N+1 (기존 기록 유지)
  → [테이블 이동] 새 테이블/새 슈 생성 + TABLE_CHANGED 이벤트 (기존 기록 유지)
  → [일시정지/재개] (PAUSED 중 라운드 입력 차단)
  → [게임 종료] 종료 금액 + 요약 저장
최근 라운드는 수정/삭제 가능 — 통계는 저장된 전체 데이터 기준으로 재계산됩니다.
```

## 11. AI 시스템

- 초기 12명 seed(성향/능력치/말투/대화 예시 포함), 제한 없이 추가/수정/보관 가능 (SETTINGS → AI)
- 능력치 6종(공격성/보수성/트렌드추종/역발상/변동성/패스성향, 0~100) → SVG 레이더 차트
- 매 라운드 분석/선택/가상베팅/정산/현재자산 기록. Meeting 미참여 AI도 가상 플레이 계속
- Dynamic State(confidence/streak/recentAgreement 등)는 최근 결과로부터 계산 — **서사/행동 변화용이며 실제 확률 변화를 의미하지 않음**
- 랭킹은 단일 점수 없이 7개 기준(순자산/손익/수익률/적중률/베팅 성적/최근 흐름/누적 손익) 선택형

## 12. Meeting Room

- CSS/SVG 기반 2D 오피스. 좌석은 활성 AI 배열에 따라 자동 생성 (고정 HTML 없음)
- 미팅 참여자(최대 4명)는 앞 테이블에 배치, 참여자는 페이지 하단 칩으로 선택
- 캐릭터 상태: IDLE/WORKING/MEETING/WALKING/PAUSED/ELIMINATED + CSS 애니메이션(설정에서 끄기 가능)
- 말풍선: AI 이름 + 내용. 각자의 personality/speechStyle/dialogExamples/commonExpressions와 최근 성과를 반영해 생성, 대화 속도 설정 가능

## 13. Shorts Studio

- 데일리 분석이 저장된 세션에서만 열림 (9:16 세로 카드, 캡처 최적화)
- 6화면: ① 오늘의 게임 ② 오늘의 결과 ③ AI Ranking ④ AI Flow ⑤ Daily AI Review ⑥ Day Complete
- [이전]/[다음]/[완료] 네비게이션. 브로드캐스트 설정(잔액/베팅금액/AI 이름/랭킹 표시·숨김)이 반영됨

## 14. Testing

`npx vitest run`

P/L 정산(타이 규칙 포함), 예측/실제베팅 통계 분리, 라운드/세션 검증(음수·잔액 초과·일시정지·잘못된 옵션), AI 가상 플레이(시작 자산, Pass, 탈락 후 미참여), dynamic state, 랭킹 정렬, JSON Import 검증(schemaVersion/관계 무결성/중복/음수) — 핵심 로직은 UI와 독립된 순수 함수로 구현되어 있습니다.

## 15. 향후 확장 아이디어

- PWA(오프라인 설치) — 현재 구조는 서버 없이 동작하므로 manifest/service worker 추가로 확장 가능
- 이벤트 스토어 기반 타임라인/Activity Log 화면
- IndexedDB schemaVersion 마이그레이션 경로 추가
- games.ts에 새 게임 정의 추가 (결과 옵션/정산 규칙이 설정 데이터로 분리되어 있음)
