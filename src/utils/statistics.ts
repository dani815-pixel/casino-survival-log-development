import type { AIRoundRecord, Round } from '../types';

export const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ===== User statistics (Prediction / Actual Betting 완전 분리) =====

export interface UserStats {
  startBalance: number;
  currentBalance: number;
  endBalance: number | null;
  todayPL: number;
  dailyReturn: number;
  totalRounds: number;
  predictionCount: number;
  predictionHits: number;
  predictionHitRate: number;
  actualBetCount: number;
  actualBetWins: number;
  actualBetLosses: number;
  actualBetWinRate: number;
  actualProfitLoss: number;
  winCount: number;
  lossCount: number;
}

export function computeUserStats(
  session: { startBalance: number; endBalance: number | null },
  rounds: Round[],
): UserStats {
  const bets = rounds.filter((r) => r.bettingAmount != null && r.actualProfitLoss != null);
  const preds = rounds.filter((r) => r.myPrediction != null);
  const predictionHits = preds.filter((r) => r.myPrediction === r.actualResult).length;
  const wins = bets.filter((r) => (r.actualProfitLoss ?? 0) > 0).length;
  const losses = bets.filter((r) => (r.actualProfitLoss ?? 0) < 0).length;
  const pl = round2(sum(bets.map((r) => r.actualProfitLoss ?? 0)));
  const currentBalance = round2(session.startBalance + pl);
  // 오늘 손익과 수익률은 수동 입력 종료잔액이 아니라 실제 베팅 P/L을 기준으로 한다.
  // 종료잔액은 별도의 기록/불일치 검증용 값이며 손익 통계의 원천이 아니다.
  return {
    startBalance: session.startBalance,
    currentBalance,
    endBalance: session.endBalance,
    todayPL: pl,
    dailyReturn: session.startBalance > 0 ? round2((pl / session.startBalance) * 100) : 0,
    totalRounds: rounds.length,
    predictionCount: preds.length,
    predictionHits,
    predictionHitRate: preds.length > 0 ? round2((predictionHits / preds.length) * 100) : 0,
    actualBetCount: bets.length,
    actualBetWins: wins,
    actualBetLosses: losses,
    actualBetWinRate: bets.length > 0 ? round2((wins / bets.length) * 100) : 0,
    actualProfitLoss: pl,
    winCount: wins,
    lossCount: losses,
  };
}

export interface SessionSummary {
  totalRounds: number;
  predictionCount: number;
  actualBetCount: number;
  actualProfitLoss: number;
}

export function computeSessionSummary(rounds: Round[]): SessionSummary {
  const s = computeUserStats({ startBalance: 0, endBalance: null }, rounds);
  return {
    totalRounds: s.totalRounds,
    predictionCount: s.predictionCount,
    actualBetCount: s.actualBetCount,
    actualProfitLoss: s.actualProfitLoss,
  };
}

// ===== 세션 종료 요약 (UI와 분리된 순수 함수) =====

export interface SessionEndSummary {
  // 최종 저장 잔액: 사용자 입력값이 있으면 그 값, 없으면 계산값
  endBalance: number;
  // 계산된 종료 잔액 = Daily Start Capital + 실제 베팅 P/L 합계 (Prediction 제외)
  calculatedEndBalance: number;
  totalRounds: number;
  predictionCount: number;
  actualBetCount: number;
  actualProfitLoss: number;
  // 입력한 종료 잔액과 계산 잔액이 다른지 여부 (강제 덮어쓰기 없이 경고용)
  endBalanceMismatch: boolean;
}

export function buildSessionEndSummary(
  session: { startBalance: number },
  rounds: Round[],
  enteredEndBalance: number | null,
): SessionEndSummary {
  const stats = computeUserStats({ startBalance: session.startBalance, endBalance: null }, rounds);
  const calculatedEndBalance = stats.currentBalance;
  const endBalance = round2(enteredEndBalance ?? calculatedEndBalance);
  return {
    endBalance,
    calculatedEndBalance,
    totalRounds: stats.totalRounds,
    predictionCount: stats.predictionCount,
    actualBetCount: stats.actualBetCount,
    actualProfitLoss: stats.actualProfitLoss,
    endBalanceMismatch: enteredEndBalance != null && round2(enteredEndBalance) !== calculatedEndBalance,
  };
}

export function balanceSeries(session: { startBalance: number }, rounds: Round[]): { round: number; balance: number }[] {
  let b = session.startBalance;
  const pts = [{ round: 0, balance: b }];
  for (const r of [...rounds].sort((a, c) => a.roundNumber - c.roundNumber)) {
    if (r.bettingAmount != null && r.actualProfitLoss != null) b = round2(b + r.actualProfitLoss);
    pts.push({ round: r.roundNumber, balance: b });
  }
  return pts;
}

// ===== AI dynamic state =====

export interface AIDynamicState {
  confidence: number; // 0~100
  recentPerformance: number; // 최근 5라운드 P/L 합
  streak: number; // +연승 / -연패
  recentAgreement: number; // 0~1, 사용자와 최근 일치율
}

export function computeDynamicState(mine: AIRoundRecord[]): AIDynamicState {
  const sorted = [...mine].sort((a, b) => a.roundNumber - b.roundNumber);
  const played = sorted.filter((r) => r.selection != null);
  const recent10 = played.slice(-10);
  const wins = recent10.filter((r) => r.resultPL > 0).length;
  const winRate = recent10.length > 0 ? wins / recent10.length : 0.5;

  let streak = 0;
  for (let i = played.length - 1; i >= 0; i--) {
    const sign = played[i]!.resultPL > 0 ? 1 : played[i]!.resultPL < 0 ? -1 : 0;
    if (sign === 0) continue;
    if (streak === 0) streak = sign;
    else if (Math.sign(streak) === sign) streak += sign;
    else break;
  }

  const agree = sorted.slice(-10).filter((r) => r.agreeWithUser !== null);
  const recentAgreement = agree.length > 0 ? agree.filter((r) => r.agreeWithUser).length / agree.length : 0.5;
  const confidence = Math.max(5, Math.min(100, Math.round(50 + (winRate - 0.5) * 70 + streak * 6)));

  return {
    confidence,
    recentPerformance: round2(sum(played.slice(-5).map((r) => r.resultPL))),
    streak,
    recentAgreement: round2(recentAgreement),
  };
}

// ===== AI daily state =====

export interface DailyAIState {
  aiId: string;
  bankroll: number;
  pl: number;
  returnPct: number;
  rounds: number;
  bets: number;
  wins: number;
  losses: number;
  pushes: number;
  passes: number;
  betPL: number;
  hits: number;
  hitRate: number;
  winRate: number;
  eliminated: boolean;
  streak: number;
  recentPL: number[];
  dyn: AIDynamicState;
}

export function computeAIState(aiId: string, records: AIRoundRecord[], startBalance: number): DailyAIState {
  const mine = records.filter((r) => r.aiId === aiId).sort((a, b) => a.roundNumber - b.roundNumber);
  const last = mine[mine.length - 1];
  const played = mine.filter((r) => r.selection != null);
  const wins = played.filter((r) => r.resultPL > 0).length;
  const losses = played.filter((r) => r.resultPL < 0).length;
  const pushes = played.length - wins - losses;
  const passes = mine.length - played.length;
  const hits = played.filter((r) => r.selection === r.roundResult).length;
  const betPL = round2(sum(played.map((r) => r.resultPL)));
  const bankroll = last ? last.bankrollAfter : startBalance;
  const dyn = computeDynamicState(mine);
  return {
    aiId,
    bankroll,
    pl: round2(bankroll - startBalance),
    returnPct: startBalance > 0 ? round2(((bankroll - startBalance) / startBalance) * 100) : 0,
    rounds: mine.length,
    bets: played.length,
    wins,
    losses,
    pushes,
    passes,
    betPL,
    hits,
    hitRate: played.length > 0 ? round2((hits / played.length) * 100) : 0,
    winRate: played.length > 0 ? round2((wins / played.length) * 100) : 0,
    eliminated: last ? last.eliminated : bankroll <= 0,
    streak: dyn.streak,
    recentPL: played.slice(-5).map((r) => r.resultPL),
    dyn,
  };
}

export function computeAllAIStates(aiIds: string[], records: AIRoundRecord[], startBalance: number): DailyAIState[] {
  return aiIds.map((id) => computeAIState(id, records, startBalance));
}

export type RankCriterion = 'bankroll' | 'pl' | 'return' | 'hitRate' | 'betPL' | 'recent' | 'careerPL';

export function rankAI(states: DailyAIState[], criterion: RankCriterion, careerPL?: Map<string, number>): DailyAIState[] {
  const score = (s: DailyAIState): number => {
    switch (criterion) {
      case 'bankroll': return s.bankroll;
      case 'pl': return s.pl;
      case 'return': return s.returnPct;
      case 'hitRate': return s.hitRate;
      case 'betPL': return s.betPL;
      case 'recent': return sum(s.recentPL);
      case 'careerPL': return careerPL?.get(s.aiId) ?? 0;
    }
  };
  return [...states].sort((a, b) => score(b) - score(a));
}

// ===== AI career (프로젝트 기간 누적, 자산은 매일 리셋) =====

export interface CareerStats {
  sessions: number;
  totalRounds: number;
  wins: number;
  losses: number;
  passes: number;
  predictionHits: number;
  virtualBetCount: number;
  virtualBetPL: number;
  careerPL: number;
  eliminationCount: number;
}

export function computeCareer(aiId: string, allRecords: AIRoundRecord[]): CareerStats {
  const mine = allRecords.filter((r) => r.aiId === aiId);
  const played = mine.filter((r) => r.selection != null);
  return {
    sessions: new Set(mine.map((r) => r.sessionId)).size,
    totalRounds: mine.length,
    wins: played.filter((r) => r.resultPL > 0).length,
    losses: played.filter((r) => r.resultPL < 0).length,
    passes: mine.length - played.length,
    predictionHits: played.filter((r) => r.selection === r.roundResult).length,
    virtualBetCount: played.length,
    virtualBetPL: round2(sum(played.map((r) => r.resultPL))),
    careerPL: round2(sum(played.map((r) => r.resultPL))),
    eliminationCount: new Set(mine.filter((r) => r.eliminated).map((r) => r.sessionId)).size,
  };
}

// 라운드별 AI 순위 변화 (차트용)
export function rankSeriesPerRound(records: AIRoundRecord[], aiIds: string[]): Map<string, { round: number; rank: number }[]> {
  const byRound = new Map<number, AIRoundRecord[]>();
  for (const r of records) {
    const arr = byRound.get(r.roundNumber) ?? [];
    arr.push(r);
    byRound.set(r.roundNumber, arr);
  }
  const out = new Map<string, { round: number; rank: number }[]>(aiIds.map((id) => [id, []]));
  for (const rn of [...byRound.keys()].sort((a, b) => a - b)) {
    const list = byRound.get(rn)!.slice().sort((a, b) => b.bankrollAfter - a.bankrollAfter);
    list.forEach((r, i) => {
      const arr = out.get(r.aiId);
      if (arr) arr.push({ round: rn, rank: i + 1 });
    });
  }
  return out;
}
