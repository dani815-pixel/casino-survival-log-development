# AI HANDOFF — 카지노 생존일지 V1

## 목적
다음 AI가 저장소를 처음 읽어도 현재 구현 상태와 변경 규칙을 빠르게 파악하도록 만든 인수인계 문서입니다.

## 현재 상태
- Repository: dani815-pixel/casino-survival-log-development
- React 19 / TypeScript / Vite 7 / Tailwind 4 / Vitest / IndexedDB
- 외부 AI API 직접 호출 없음. Prompt 생성 → 외부 AI 복사 → 결과 붙여넣기 방식.
- 현재 단계: 새 기능 추가보다 누적 변경의 실제 test/build 검증이 우선.

## 핵심 흐름
Game → Round → User Actual P/L + AI Virtual Play → Review Prompt → External AI → ExternalReview → Meeting / Shorts → Next-Day Scenario

## 절대 유지할 데이터 규칙

### 자금
Project Start Capital ≠ Daily Start Capital
User Actual Bankroll ≠ AI Virtual Bankroll

계산 잔고 = Daily Start + 실제 베팅 P/L

session.endBalance는 수동 기록값이며 P/L 원천이 아닙니다.
Shorts 최종 잔고는 userStats.currentBalance를 사용합니다.

### Prediction / Betting
- Prediction과 Actual Betting은 완전히 분리
- Prediction만 있으면 actual P/L 없음
- Prediction hit rate와 betting win rate 분리

### AI
- 매일 Daily Start에서 시작
- Pass는 승/패 제외
- AI record 없음 = loss 아님
- bankroll <= 0 = ELIMINATED
- Career 통계는 프로젝트 누적
- Dynamic State는 연출용이며 실제 확률을 의미하지 않음

### Session
- PLAYING: Round 추가/수정/삭제 가능
- PAUSED: Round 변경 차단
- ENDED: Round 변경 차단
- Stop Loss / Win Cut은 경고만, 자동 종료 없음

## 핵심 타입
src/types/index.ts:
Project, DailySession, TableSession, Shoe, Round, AIProfile, AIRoundRecord, AppEvent, ExternalReview, ShortsContent, ShortsShot, ShortsTimeline

DailySession.meetingParticipants가 해당 세션의 최종 회의 참여자입니다.

ExternalReview에는 storyType/storyReason을 별도 DB 필드로 만들지 않았습니다. 외부 AI 분석 계약 안에서 유지합니다.

## 핵심 파일

### src/app/store.tsx
전역 상태와 서비스 연결.
특히 project isolation, AI profile project 검증, meeting participant 저장, saveReview, backup/restore 연결을 담당합니다.

saveReview:
raw → newReview(session.id, kind, raw) → parseShortsContent(raw) → reviews 저장 → reloadChildren(session)

원문 rawText는 보존합니다.

### src/services/promptService.ts
Prompt/Parser의 핵심.
- Session data
- Daily Analysis
- Scenario
- Meeting
- Participant recommendation
- Previous session
- Review freshness
- Shorts timeline
- Shorts parser
- Shorts review data
- highlight extraction

Daily Analysis 계약에는 사실 보호, 핵심 사건, Story Type, Shorts JSON, 미래 결과 보장 금지가 포함됩니다.

### src/pages/ReviewPage.tsx
현재 session.id의 Daily Analysis만 선택하고 createdAt 최신 결과를 사용합니다.
Round 변경 후 기존 분석은 stale로 판정될 수 있습니다.

### src/pages/ShortsPage.tsx
현재 세션의 최신 Daily Analysis를 사용합니다.

6개 화면:
TODAY'S_GAME / TODAY'S_RESULT / AI_RANKING / AI_FLOW / DAILY_AI_REVIEW / DAY_COMPLETE

Timeline reorder 시 배열 index가 아니라 ShortsShot.type으로 콘텐츠를 매핑합니다.

Preview:
- OFF 화면 skip
- duration 기반 이동
- 마지막 활성 화면 종료

Capture:
- 3초 countdown
- fullscreen 시도
- 9:16 overlay
- 마지막 화면 자동 종료
- fullscreen 해제 시 상태 정리

### src/utils/statistics.ts
사용자/AI 통계 원천. UI에서 별도 P/L 계산을 만들지 않습니다.

### src/services/sessionService.ts
Session/Shoe/Round lifecycle 원천.
Round update/delete 시 관련 AI record도 일관되게 재계산/정리해야 합니다.

## Shorts 외부 AI 계약
{
  "shorts": {
    "title": "...",
    "description": "...",
    "hashtags": ["#카지노", "#카지노생존일지"]
  }
}

parseShortsContent는 JSON 또는 텍스트 안의 JSON을 가능한 범위에서 파싱합니다.
shorts가 없는 구형 결과도 rawText를 보존하며 정상 처리합니다.

## 최근 작업 요약

### 1~6차
사용자 P/L, Stop Loss/Win Cut, Project cumulative P/L, Session/Project data flow, Charts를 정리했습니다.

### 7~12차
Backup validation, AI ranking/data, Session/AI flow, Meeting/Review/External AI, Shorts timeline/preview/capture, Shorts 복기와 visual hierarchy, static stability를 정리했습니다.

### 13~16차
Daily Analysis 사실 보호, 핵심 사건, Story Type, Review → Meeting → Shorts → Next Session 연결성을 강화하고 계약 regression test를 추가했습니다.

### 17차
Review → External AI → Shorts 흐름을 점검했습니다.
Shorts metadata의 잘못된 타입/중복 hashtag를 방어하는 회귀 테스트를 추가했습니다.

### 18차
Shorts 실제 데이터 표현을 점검했습니다.
- TODAY'S GAME JSX 오류 수정
- final balance를 userStats.currentBalance로 통일
- 수동 endBalance와 계산잔고 분리 테스트

### 19차
누적 변경 후 정적 전체 점검을 수행했고 TODAY'S GAME에 남아 있던 malformed JSX를 수정했습니다.

실제 npm test / npm run build는 아직 실행하지 않았습니다.

## 마지막 확인 SHA
- ShortsPage.tsx: 7d687745d88bac1073194ee96c9e731f77c5ff0d
- promptService.ts: a2aa83b77b6261c318438a68a1d0b2087b96c053
- types/index.ts: 7684e56b80dcd5d18734a2530c0f1dce23982f43
- app/store.tsx: 21d1761eb9911027b24e50872d3c32abd2511df3
- ReviewPage.tsx: 21cbb214cd26b36450f528c81e83b2bbb07cec01
- logic.test.ts: 72905e72741d18aad4913a3c8be6f1ab6f6afeea

SHA는 기준점일 뿐입니다. 작업 전 현재 main을 다시 조회하세요.

## 다음 작업
1. 최신 저장소 상태 재조회
2. npm test
3. npm run build
4. 실패 시 오류별 수정 기획서 작성
5. 최소 수정 + regression test
6. 실제 모바일 UI 확인
7. Shorts Capture 실제 녹화 확인
8. 필요하면 Netlify 배포 확인

## 필수 수정 프로토콜
수정 요청 → 수정 기획서 → 현재 파일 재조회 → 원인 확인 → 최소 수정 → regression test → 파일 재조회 → test/build 실행 여부 기록 → 다음 작업 요약

## 금지
- 계획 없이 코드 수정
- 대규모 재작성
- 기존 데이터 모델 임의 변경
- Project isolation 약화
- User P/L과 AI P/L 혼합
- endBalance를 P/L 원천으로 변경
- 외부 AI 숫자를 검증 없이 사실로 사용
- Shorts 콘텐츠를 배열 index에 고정
- 실행하지 않은 test/build를 통과했다고 표현

## 빠른 시작
README.md → docs/AI_HANDOFF.md → docs/SKILL_SPEC.md 순으로 읽고, 그 다음 요청과 관련된 소스만 재조회하세요.
