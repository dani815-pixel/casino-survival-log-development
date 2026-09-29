# 카지노 생존일지 V1 (Casino Survival Diary)

모바일 전용 로컬 카지노 기록·분석·AI 가상 플레이·외부 AI 리뷰·2D Meeting Room·Shorts Studio 웹앱입니다.

> 실제 게임 기록은 로컬에 정확하게 저장하고, AI는 가상 플레이와 분석/연출을 담당하며, 외부 AI 결과는 사용자가 직접 붙여넣어 저장합니다.

실제 게임 결과의 미래 예측이나 수익을 보장하는 서비스가 아닙니다.

## 1. 현재 프로젝트 상태

| 항목 | 상태 |
|---|---|
| React / TypeScript / Vite | 사용 중 |
| 모바일 우선 UI | 구현 |
| IndexedDB 로컬 저장 | 구현 |
| Project / Daily Session | 구현 |
| Table / Shoe / Round | 구현 |
| 사용자 실제 P/L | 구현 |
| AI 가상 플레이 | 구현 |
| AI Ranking / Charts | 구현 |
| External AI Prompt / Paste | 구현 |
| Daily Analysis / Scenario | 구현 |
| Meeting Room | 구현 |
| Meeting 참여자 선택 | 구현 |
| Shorts Studio 6화면 | 구현 |
| Shorts Timeline / Preview | 구현 |
| Shorts 9:16 Capture Mode | 구현 |
| Shorts 제목/설명/해시태그 | 구현 |
| Backup / Restore | 구현 |
| 회귀 테스트 | 구현 |
| 실제 npm test / npm run build | 아직 이 저장소 환경에서 실행 확인하지 않음 |

## 2. 핵심 데이터 흐름

PROJECT → DAILY SESSION → TABLE SESSION → SHOE → ROUND

ROUND → USER ACTUAL P/L + AI VIRTUAL PLAY → AI DAILY STATE / RANKING

→ REVIEW PROMPT → 외부 AI 복사 → 결과 붙여넣기 → ExternalReview

ExternalReview → MEETING / SHORTS STUDIO → NEXT-DAY SCENARIO

외부 AI API를 앱에서 직접 호출하지 않습니다.

## 3. 주요 화면

HOME / GAME / AI / MEETING ROOM / CHARTS / REVIEW / SHORTS / SETTINGS

### HOME
- 프로젝트 정보
- Daily Start Capital
- 현재 세션 P/L
- 프로젝트 누적 P/L
- 현재 세션 상태

### GAME
- 카지노 / 게임 / 테이블
- Shoe 관리
- Round 기록
- Prediction과 Actual Betting 분리
- Round 수정/삭제
- Stop Loss / Win Cut 경고
- Pause / Resume / End

### AI
- 초기 12명 Seed
- AI 추가/수정/보관
- 성향 0~100
- AI 가상 플레이
- Dynamic State
- 일일 자산 / P/L
- Career 누적 통계
- 독립 기준 Ranking

### MEETING ROOM
- 2D 오피스
- 전체 AI 근무
- 최대 4명 미팅 참여
- 성향 기반 대화
- 말풍선
- 애니메이션
- 유효한 외부 AI 분석을 회의 컨텍스트로 사용

### CHARTS
- 사용자 실제 자산/P&L
- 프로젝트 누적 P/L
- AI 가상 자산/P&L
- AI Ranking
- 사용자와 AI 데이터 분리

### REVIEW
- 현재 세션 분석 Prompt 생성
- Prompt 복사
- 외부 AI 결과 붙여넣기
- Daily Analysis 저장
- 최신 분석 확인
- stale 상태 확인
- Next-Day Scenario Prompt

### SHORTS
6개 화면:
1. TODAY'S GAME
2. TODAY'S RESULT
3. AI RANKING
4. AI FLOW
5. DAILY AI REVIEW
6. DAY COMPLETE

기능:
- 화면 ON/OFF
- 화면별 재생 시간
- 화면 순서 변경
- 전체 재생 시간
- 균등 시간 배분
- Preview 자동 재생
- 3초 Capture Countdown
- 브라우저 Fullscreen
- 9:16 Capture Mode
- 마지막 화면 자동 종료
- 제목/설명/해시태그 각각 복사

## 4. Shorts Studio 동작

기본 전체 길이는 30초입니다.

화면 콘텐츠는 배열 위치가 아니라 ShortsShot.type으로 매핑합니다. 따라서 Timeline에서 순서를 변경해도 콘텐츠가 다른 화면과 섞이지 않습니다.

Preview:
- 활성화된 화면만 재생
- OFF 화면 자동 건너뜀
- 화면별 duration 사용
- 마지막 활성 화면에서 종료

Capture:
촬영 시작 → 3초 Countdown → 첫 활성 화면 → 자동 화면 전환 → 마지막 활성 화면 → 자동 종료

Fullscreen API가 unavailable이어도 9:16 Capture Layout은 유지합니다.

## 5. External AI 분석 계약

Daily Analysis Prompt는 사실 데이터와 해석을 구분하도록 요구합니다.

금지:
- 저장 데이터에 없는 숫자 생성
- 존재하지 않는 라운드 생성
- 실제 P/L 조작
- 이전 세션 데이터를 현재 세션 사실처럼 사용
- 미래 결과 보장
- 특정 베팅 결과 보장

### 핵심 사건

후보:
- 가장 큰 실제 손익 변동
- 사용자와 AI의 선택 충돌
- 연속 결과/연승/연패
- AI 의견 집중/분산
- AI 탈락 또는 큰 잔고 변화

후보가 없으면 "뚜렷한 핵심 사건 없음"으로 표시합니다.

### Story Type

TURNAROUND / AI_CLASH / STREAK / AI_ELIMINATION / BIG_SWING / STEADY / MIXED

실제 기록에 가장 적합한 하나를 선택하며 별도 DB 필드로 저장하지 않습니다.

### Shorts JSON

{
  "shorts": {
    "title": "짧고 구체적인 제목",
    "description": "오늘 실제 기록 기반 설명",
    "hashtags": ["#카지노", "#카지노생존일지", "#카지노기록"]
  }
}

앱은 shorts를 선택적으로 파싱합니다. 구형 AI 결과처럼 Shorts 객체가 없어도 rawText는 보존됩니다.

## 6. 핵심 비즈니스 규칙

Project Start Capital ≠ Daily Start Capital

User Actual Bankroll ≠ AI Virtual Bankroll

사용자 계산 잔고:
Daily Start + 실제 베팅 P/L

수동 session.endBalance는 기록/비교용이며 실제 P/L 원천이 아닙니다.

Shorts 최종 잔고도 userStats.currentBalance를 사용합니다.

Prediction과 Actual Betting은 완전히 분리합니다.

AI:
- 매일 Daily Start에서 시작
- Pass는 승/패에 포함하지 않음
- AI 기록이 없는 라운드는 loss 처리하지 않음
- 자산이 0 이하이면 ELIMINATED
- Career 통계는 프로젝트 기간 누적
- Dynamic State는 연출/행동 변화용이며 실제 확률을 의미하지 않음

Stop Loss / Win Cut:
- 경고만 표시
- 자동 종료 없음

## 7. Meeting 참여자

활성 AI 전체가 Pool입니다.

최대 4명이며 RANDOM / MANUAL / EXTERNAL_AI / HYBRID 방식을 지원합니다.

최종 선택은 DailySession.meetingParticipants에 저장됩니다.

현재 Project의 active AI만 선택하도록 프로젝트 격리가 적용됩니다.

## 8. 데이터 저장

IndexedDB가 주요 저장소입니다.

Store:
- projects
- sessions
- tables
- shoes
- rounds
- aiProfiles
- aiRecords
- events
- reviews
- settings

LocalStorage는 마지막 탭/프로젝트 같은 가벼운 UI 상태에만 사용합니다.

## 9. Backup / Restore

JSON Backup은 전체 데이터와 schemaVersion을 저장합니다.

Restore 시 Project, Session, Table, Shoe, Round, AI, Review, Event 관계와 숫자/ID/중복/음수 데이터를 검증합니다.

Project와 AI는 삭제보다 Archive 우선 정책을 사용합니다.

## 10. 기술 구조

src/
- app/store.tsx: 전역 상태와 UI ↔ 서비스 연결
- components/: 공통 UI/차트
- pages/: Home, Game, AI, Meeting, Charts, Review, Shorts, Settings
- services/sessionService.ts: Session/Shoe/Round lifecycle
- services/aiService.ts: AI 가상 플레이/대화
- services/promptService.ts: Prompt/Parser/Shorts 변환
- services/backupService.ts: Export/Import
- services/queries.ts: 데이터 로드
- db/db.ts: IndexedDB
- types/index.ts: 핵심 타입
- utils/statistics.ts: 통계
- utils/validation.ts: 검증
- utils/settle.ts: 게임 정산
- data/games.ts: 게임 정의
- data/seedAI.ts: 초기 AI
- data/defaults.ts: 기본 설정/프롬프트
- test/logic.test.ts: 핵심 로직 테스트

## 11. 개발 명령

npm install
npm run dev
npm test
npm run build

현재 문서 작성 시점에는 이 환경에서 실제 npm test와 npm run build를 실행해 성공 여부를 확인하지 않았습니다.

## 12. 개발 원칙

1. 수정 전에 수정 기획서를 먼저 작성합니다.
2. 관련 현재 파일을 다시 조회합니다.
3. 실제 결함이 있는 파일만 수정합니다.
4. 데이터 규칙을 먼저 확인하고 UI를 수정합니다.
5. 순수 로직 변경에는 회귀 테스트를 추가합니다.
6. 수정 후 GitHub 파일을 다시 조회합니다.
7. 실제 실행하지 않은 테스트/build를 성공했다고 말하지 않습니다.
8. 기존 데이터와 구형 AI 결과 호환성을 유지합니다.
9. Project 간 데이터 혼합을 허용하지 않습니다.
10. 수동 endBalance를 P/L 원천으로 사용하지 않습니다.
11. 외부 AI 결과에 없는 숫자를 앱이 임의 생성하지 않습니다.
12. Shorts 콘텐츠를 배열 index에 고정하지 않습니다.
13. 문제 없는 기능까지 대규모 리팩터링하지 않습니다.

## 13. 다음 작업

최우선:
1. 실제 환경에서 npm test 실행
2. 실제 환경에서 npm run build 실행
3. 오류 발생 시 오류별 수정 기획서 작성
4. 모바일 실제 화면에서 Shorts Capture 확인
5. 필요하면 Netlify 배포 검증

다음 AI는 새 기능을 추가하기 전에 docs/AI_HANDOFF.md를 먼저 읽고, 기능별 상세 규칙은 docs/SKILL_SPEC.md를 읽으세요.
