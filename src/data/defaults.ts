import type { AppSettings, PromptTemplates } from '../types';

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
  analysis: `당신은 카지노 게임 기록 분석가입니다.
아래는 오늘 하루의 실제 플레이 기록(사용자)과 AI 가상 플레이 기록입니다.
제공된 데이터에 근거해서만 분석하세요.

{{DATA}}

[분석 요청]
1. 오늘 전체 흐름 정리 (초반/중반/후반)
2. AI별 성과 요약과 그 이유로 보이는 관찰점
3. 최근 흐름 변화 (마지막 10라운드 기준)
4. 상승/하락 흐름이 나타난 구간
5. AI 의견이 집중된 구간과 분산된 구간
6. 특이사항 (탈락, 연승/연패, 사용자-AI 불일치 등)
7. 다음에 관찰할 포인트

[규칙]
- 미래 결과를 확정적으로 예측하지 마세요.
- 데이터에 없는 사실을 지어내지 마세요.
- 모든 판단은 "관찰"과 "조건 기반 해석"으로 표현하세요.`,
  scenario: `당신은 카지노 게임 기록 분석가입니다.
아래는 이전 세션 데이터와 외부 AI의 데일리 분석 결과입니다.
이를 바탕으로 "다음 세션을 관찰하기 위한 조건 기반 시나리오"를 작성하세요.

{{DATA}}

[작성 요청]
1. 조건 기반 시나리오 2~3개 (예: 초반에 특정 흐름이 나오면 어떤 관찰을 강화할지)
2. 각 시나리오별 관찰 조건
3. 확인해야 할 데이터 (어느 라운드 구간, 어떤 지표)
4. 시나리오가 무효화되는 조건
5. AI 의견 변화 관찰점 (어떤 AI의 태도 변화를 볼 것인지)

[규칙]
- 미래 결과를 확정적으로 예측하지 마세요.
- "~이 될 것이다" 대신 "~라면 ~를 관찰한다" 형태로 작성하세요.
- 데이터에 없는 사실을 지어내지 마세요.`,
  meeting: `다음 AI 멤버들의 오늘 성과와 성향을 바탕으로, 그들이 미팅에서 나눌 법한 대화를 작성해 주세요.
각 AI의 말투와 성격을 반영하세요.

{{DATA}}

[규칙]
- 과장된 예측이나 확정적 표현은 피하세요.
- 각 AI의 실제 기록 범위 안에서만 대화하세요.`,
  content: `아래 데이터를 바탕으로 짧은 세로 영상(Shorts)용 문구를 작성해 주세요.
페이지별로 2~4줄, 숫자는 제공된 값만 사용하세요.

{{DATA}}

[규칙]
- 데이터에 없는 숫자나 사실을 만들지 마세요.
- 결과를 과장하거나 미래를 예측하는 표현은 피하세요.`,
};

export function defaultSettings(): AppSettings {
  return {
    id: 'app',
    currency: 'USD',
    decimals: 2,
    defaultStopLoss: null,
    defaultWinCut: null,
    promptTemplates: { ...DEFAULT_PROMPT_TEMPLATES },
    broadcast: {
      showBalance: true,
      showBetAmount: true,
      showAINames: true,
      showRanking: true,
    },
    meeting: {
      participants: [],
      showBubbles: true,
      speed: 4,
      animation: true,
    },
    updatedAt: Date.now(),
  };
}
