# SKILL SPEC — 카지노 생존일지 V1

## 01. Project / Session
입력: Project 정보 + Daily Session 정보.
규칙:
- Project Start Capital과 Daily Start Capital은 별개
- Daily Session은 Project에 귀속
- 다른 Project 데이터 혼합 금지

## 02. Table / Shoe / Round
흐름: Session → TableSession → Shoe → Round

Round 저장 시 결과/Prediction/Betting amount/잔액 초과를 검증하고 IndexedDB에 저장한 뒤 AI virtual play를 갱신합니다.

Session 상태:
- PLAYING: Add/Update/Delete 허용
- PAUSED: Round 변경 차단
- ENDED: Round 변경 차단

## 03. User Actual P/L
actualProfitLoss = 실제 베팅 Round P/L 합계
currentBalance = Daily Start + actualProfitLoss

Prediction만 있는 Round는 실제 P/L에 포함하지 않습니다.

Prediction Hit Rate / Actual Betting Win Rate / Actual P/L / Calculated End Balance / Manual End Balance는 분리합니다.

Manual endBalance는 P/L 원천이 아닙니다.

## 04. Stop Loss / Win Cut
- warning only
- 자동 종료 금지
- Stop Loss > Daily Start 금지
- Stop Loss = Daily Start 허용
- Win Cut은 양수
- Win Cut 인위적 상한 없음

## 05. AI Virtual Play
매일 Daily Start에서 시작합니다.

Round별 기록:
analysis / selection 또는 Pass / virtualBet / resultPL / bankrollAfter

Pass는 win/loss 제외.
bankrollAfter <= 0이면 ELIMINATED.
다음날 Daily Start로 리셋.
Career 통계는 프로젝트 누적.

AI virtual bankroll을 User bankroll에 합산하지 않습니다.

## 06. AI Dynamic State / Ranking
Dynamic State는 confidence, streak, recentPerformance, recentAgreement 등이며 행동/대화 연출용입니다. 실제 확률 변화가 아닙니다.

Ranking은 단일 종합점수가 아닙니다.
독립 기준: 순자산, P/L, 수익률, 적중률, 베팅 성적, 최근 흐름, 누적 P/L.

## 07. Meeting Participant
현재 Project의 active AI만 Pool입니다.
최대 4명.
방식: RANDOM / MANUAL / EXTERNAL_AI / HYBRID.
최종 결과는 DailySession.meetingParticipants에 저장합니다.

Global settings의 오래된 AI ID를 무조건 사용하지 않습니다.

## 08. Review / External AI
Prompt는 현재 세션의 실제 저장 데이터에 기반합니다.

외부 AI가 임의 생성하면 안 되는 것:
- 숫자
- Round number
- P/L
- 실제 결과
- 미래 결과
- 존재하지 않는 원인

데이터 부족은 기록 부족으로 표시합니다.

## 09. 핵심 사건 / Story Type
핵심 사건 후보:
1. 최대 실제 P/L swing
2. User vs AI disagreement
3. streak
4. AI opinion concentration/dispersion
5. AI elimination / large bankroll change

뚜렷한 후보가 없으면 "뚜렷한 핵심 사건 없음".

Story Type:
TURNAROUND / AI_CLASH / STREAK / AI_ELIMINATION / BIG_SWING / STEADY / MIXED

실제 기록에 근거해야 하며 별도 DB 필드를 만들지 않습니다.

## 10. ExternalReview 저장
rawText → newReview → parseShortsContent → reviews IndexedDB → reloadChildren

원문 rawText를 보존합니다.
shorts가 없어도 저장 실패시키지 않습니다.

## 11. Review Freshness
Daily Analysis 저장 이후 Round 변경 이벤트 timestamp가 review.createdAt보다 크면 stale입니다.

Stale 분석은 표시하고 Meeting에서 유효 분석으로 사용하지 않습니다.

## 12. Meeting
현재 Session + 최대 4명 + AI profile + 최근 성과 + 최신 유효 Daily Analysis를 사용합니다.
미참여 AI도 Office/Virtual Play에는 남을 수 있습니다.

## 13. Shorts Content
6개:
1. TODAY'S_GAME
2. TODAY'S_RESULT
3. AI_RANKING
4. AI_FLOW
5. DAILY_AI_REVIEW
6. DAY_COMPLETE

TODAY'S_GAME: game/date/casino/table/start balance/round count/recent result
TODAY'S_RESULT: todayPL/currentBalance/dailyReturn
AI_RANKING: 현재 세션 AI state
AI_FLOW: 외부 AI highlights를 짧게 표현
DAILY_AI_REVIEW: actual P/L + 최대 실제 P/L swing Round + 외부 AI 요약
DAY_COMPLETE: 오늘 결과 + Round 수 + AI TOP 1 + 외부 AI 요약

Shorts final balance는 userStats.currentBalance 기준입니다.

## 14. Shorts Timeline
기본 30초, 6화면, 모두 ON.

Shot 데이터:
id / type / title / order / duration / enabled

콘텐츠 매핑은 배열 index가 아니라 ShortsShot.type 기준입니다.

Preview:
- disabled skip
- duration 기반 이동
- 마지막 활성 화면 종료

## 15. Shorts Capture
Start → 3초 countdown → Preview engine → 활성 화면 순차 재생 → 마지막 화면 → 종료

Capture 중 Timeline ON/OFF, duration, reorder, reset, 중복 Preview start를 허용하지 않습니다.

Fullscreen 해제 시 Capture 상태를 정리합니다.

## 16. Shorts Metadata
외부 AI 구조:
{
  "shorts": {
    "title": "...",
    "description": "...",
    "hashtags": ["#카지노"]
  }
}

Parser:
- title/description은 문자열만
- hashtags는 문자열만
- 빈 값 제거
- 중복 제거
- 전부 비면 undefined

UI에서 제목/설명/해시태그를 각각 복사합니다.

## 17. Backup / Restore
Backup: 전체 IndexedDB stores + schemaVersion + exportedAt

Restore는 Project/Session/Table/Shoe/Round/AI/Review/Event 관계, 숫자, ID, 중복을 검증합니다.

깨진 관계 데이터를 그대로 삽입하지 않습니다.

## 18. Project Isolation
다음 관계를 반드시 유지합니다:
AIProfile.projectId
DailySession.projectId
Round.sessionId
AIRoundRecord.sessionId
AIRoundRecord.roundId
ExternalReview.sessionId
AppEvent.sessionId

빠른 Project 전환에서 이전 async response가 현재 Project를 덮어쓰면 안 됩니다.

## 19. Regression Test
순수 로직 변경 시 src/test/logic.test.ts에 회귀 테스트를 추가합니다.

주요 테스트 영역:
settle / user statistics / session validation / AI virtual play / ranking / participant selection / review freshness / project isolation / backup validation / Shorts timeline / Shorts parser / Shorts review / Story Type prompt contract / Shorts metadata contract

## 20. 개발 작업 절차
모든 수정은:
수정 요청 → 수정 기획서 → 현재 코드 재조회 → 원인 확인 → 최소 수정 → regression test → 파일 재조회 → test/build 실행 여부 기록 → 다음 작업 요약

최우선 원칙:
문제가 없는 코드는 수정하지 않습니다.
기존 구조를 존중하고 필요한 파일만 변경합니다.
