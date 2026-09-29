import { describe, it, expect } from 'vitest';
import { settleBet } from '../utils/settle';
import {
  computeUserStats, computeSessionSummary, computeAIState, computeDynamicState, rankAI,
} from '../utils/statistics';
import { validateBackup, validateRoundInput, validateSessionInput } from '../utils/validation';
import { playForRound } from '../services/aiService';
import { getGame } from '../data/games';
import type { AIProfile, AIRoundRecord, DailySession, Round } from '../types';

// ===== 테스트 픽스처 =====

const dt = getGame('dragon-tiger')!;
const bac = getGame('baccarat')!;

function mkSession(over: Partial<DailySession> = {}): DailySession {
  return {
    id: 's1', projectId: 'p1', date: '2026-01-01', casino: 'Test', gameId: 'dragon-tiger',
    table: 'T-1', startBalance: 100, stopLoss: null, winCut: null, memo: '',
    status: 'PLAYING', endBalance: null, endedAt: null,
    totalRounds: 0, predictionCount: 0, actualBetCount: 0, actualProfitLoss: 0,
    createdAt: 1, updatedAt: 1, ...over,
  };
}

function mkRound(over: Partial<Round>): Round {
  return {
    id: over.id ?? `r-${over.roundNumber ?? 1}`, sessionId: 's1', shoeId: 'sh1', tableSessionId: 't1',
    roundNumber: 1, actualResult: 'dragon', myPrediction: null, bettingAmount: null,
    actualProfitLoss: null, timestamp: 1, memo: '', ...over,
  };
}

function mkProfile(id: string, over: Partial<AIProfile> = {}): AIProfile {
  return {
    id, projectId: 'p1', name: id, role: 'test', personality: '', speechStyle: '', analysisStyle: '',
    aggression: 50, conservatism: 50, trendFollowing: 50, reversalPreference: 50,
    volatilityTolerance: 0, passPreference: 0,
    dialogExamples: [], commonExpressions: [], active: true, createdAt: 1, updatedAt: 1, ...over,
  };
}

function mkAIRecord(over: Partial<AIRoundRecord>): AIRoundRecord {
  return {
    id: `ar-${Math.random()}`, sessionId: 's1', roundId: 'r1', roundNumber: 1, aiId: 'a1',
    roundResult: 'dragon', analysis: '', selection: 'dragon', virtualBet: 10, resultPL: 10,
    bankrollAfter: 110, agreeWithUser: null, eliminated: false, createdAt: 1, ...over,
  };
}

// ===== 정산 (P/L 계산) =====

describe('settleBet (P/L 계산)', () => {
  it('Dragon Tiger 승리 시 1:1 정산', () => {
    expect(settleBet(dt, 'dragon', 10, 'dragon')).toBe(10);
  });
  it('Dragon Tiger 패배 시 베팅금 손실', () => {
    expect(settleBet(dt, 'dragon', 10, 'tiger')).toBe(-10);
  });
  it('Dragon Tiger 타이 시 비타이 베팅은 절반 손실', () => {
    expect(settleBet(dt, 'dragon', 10, 'tie')).toBe(-5);
  });
  it('Baccarat Banker 승리 시 5% 커미션', () => {
    expect(settleBet(bac, 'banker', 100, 'banker')).toBe(95);
  });
  it('Baccarat 타이 시 비타이 베팅은 push(0)', () => {
    expect(settleBet(bac, 'player', 50, 'tie')).toBe(0);
  });
});

// ===== 사용자 통계: Prediction / Actual Betting 분리 =====

describe('사용자 통계 (예측/실제베팅 분리)', () => {
  const rounds = [
    mkRound({ roundNumber: 1, actualResult: 'dragon', myPrediction: 'dragon' }), // 예측만, 적중
    mkRound({ roundNumber: 2, actualResult: 'tiger', myPrediction: 'dragon', bettingAmount: 10, actualProfitLoss: -10 }), // 베팅, 패
  ];
  const stats = computeUserStats(mkSession(), rounds);

  it('예측 기록과 베팅 기록의 개수가 분리된다', () => {
    expect(stats.predictionCount).toBe(2);
    expect(stats.actualBetCount).toBe(1);
  });
  it('예측 적중률은 베팅과 무관하게 계산된다', () => {
    expect(stats.predictionHitRate).toBe(50);
  });
  it('실제 자산은 베팅 P/L만 반영한다', () => {
    expect(stats.currentBalance).toBe(90);
    expect(stats.todayPL).toBe(-10);
    expect(stats.winCount).toBe(0);
    expect(stats.lossCount).toBe(1);
  });
  it('세션 종료 요약 계산', () => {
    const s = computeSessionSummary(rounds);
    expect(s.totalRounds).toBe(2);
    expect(s.predictionCount).toBe(2);
    expect(s.actualBetCount).toBe(1);
    expect(s.actualProfitLoss).toBe(-10);
  });
});

// ===== 라운드 검증 =====

describe('라운드/세션 검증', () => {
  const base = {
    session: mkSession(), shoe: { id: 'sh1', tableSessionId: 't1', sessionId: 's1', shoeNumber: 1, startedAt: 1, endedAt: null, status: 'ACTIVE' as const },
    game: dt, rounds: [] as Round[], currentBalance: 100,
  };
  it('음수 베팅 금액 거부', () => {
    const errs = validateRoundInput({ ...base, input: { actualResult: 'dragon', myPrediction: 'dragon', bettingAmount: -5, memo: '' } });
    expect(errs.some((e) => e.includes('0 이상'))).toBe(true);
  });
  it('잔액보다 큰 베팅 거부', () => {
    const errs = validateRoundInput({ ...base, input: { actualResult: 'dragon', myPrediction: 'dragon', bettingAmount: 150, memo: '' } });
    expect(errs.some((e) => e.includes('잔액'))).toBe(true);
  });
  it('일시정지 상태에서는 입력 불가', () => {
    const errs = validateRoundInput({ ...base, session: mkSession({ status: 'PAUSED' }), input: { actualResult: 'dragon', myPrediction: null, bettingAmount: null, memo: '' } });
    expect(errs.some((e) => e.includes('일시정지'))).toBe(true);
  });
  it('잘못된 결과 옵션 거부', () => {
    const errs = validateRoundInput({ ...base, input: { actualResult: 'player', myPrediction: null, bettingAmount: null, memo: '' } });
    expect(errs.some((e) => e.includes('결과'))).toBe(true);
  });
  it('베팅 시 예측 필수', () => {
    const errs = validateRoundInput({ ...base, input: { actualResult: 'dragon', myPrediction: null, bettingAmount: 10, memo: '' } });
    expect(errs.some((e) => e.includes('예측'))).toBe(true);
  });
  it('잘못된 startBalance 거부', () => {
    const errs = validateSessionInput({ casino: 'A', gameId: 'dragon-tiger', table: 'T', startBalance: -5, stopLoss: null, winCut: null }, true);
    expect(errs.length).toBeGreaterThan(0);
  });
});

// ===== AI 가상 플레이 / Pass / 탈락 =====

describe('AI 가상 플레이', () => {
  const aggressive = mkProfile('a1', { aggression: 90, passPreference: 0, volatilityTolerance: 0, conservatism: 0 });
  const passive = mkProfile('a2', { passPreference: 100 });

  it('AI는 매일 Daily Start로 시작하고 가상 베팅한다', () => {
    const round = mkRound({ roundNumber: 1, actualResult: 'tiger' });
    const out = playForRound({
      profiles: [aggressive], game: dt, session: mkSession(), round, allRecords: [], prevResults: [],
      rng: () => 0.1,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.selection).toBe('dragon');
    expect(out[0]!.virtualBet).toBeGreaterThan(0);
    expect(out[0]!.bankrollAfter).toBeLessThan(100); // 패배 → 자산 감소
  });

  it('Pass는 승/패가 아니며 자산이 변하지 않는다', () => {
    const round = mkRound({ roundNumber: 1, actualResult: 'tiger' });
    const out = playForRound({
      profiles: [passive], game: dt, session: mkSession(), round, allRecords: [], prevResults: [],
      rng: () => 0.1,
    });
    expect(out[0]!.selection).toBeNull();
    expect(out[0]!.virtualBet).toBe(0);
    expect(out[0]!.resultPL).toBe(0);
    expect(out[0]!.bankrollAfter).toBe(100);
    const st = computeAIState('a2', out, 100);
    expect(st.wins).toBe(0);
    expect(st.losses).toBe(0);
    expect(st.passes).toBe(1);
  });

  it('자산이 0 이하가 되면 ELIMINATED, 이후 라운드는 플레이하지 않는다', () => {
    const prev = [mkAIRecord({ aiId: 'a1', roundNumber: 1, resultPL: -99, bankrollAfter: 1 })];
    const r2 = mkRound({ roundNumber: 2, actualResult: 'tiger' });
    const out2 = playForRound({
      profiles: [aggressive], game: dt, session: mkSession(), round: r2, allRecords: prev, prevResults: ['dragon'],
      rng: () => 0.1,
    });
    expect(out2[0]!.bankrollAfter).toBeLessThanOrEqual(0);
    expect(out2[0]!.eliminated).toBe(true);

    const r3 = mkRound({ roundNumber: 3, actualResult: 'tiger' });
    const out3 = playForRound({
      profiles: [aggressive], game: dt, session: mkSession(), round: r3,
      allRecords: [...prev, ...out2], prevResults: [], rng: () => 0.1,
    });
    expect(out3).toHaveLength(0); // 탈락 후 기록 없음 — loss로 처리하지 않음
  });

  it('AI 상태(dyn)는 연승/연패를 반영한다', () => {
    const wins = [1, 2, 3].map((n) => mkAIRecord({ roundNumber: n, resultPL: 5, bankrollAfter: 100 + n * 5 }));
    const dyn = computeDynamicState(wins);
    expect(dyn.streak).toBe(3);
    expect(dyn.confidence).toBeGreaterThan(50);
  });
});

// ===== 랭킹 =====

describe('AI 랭킹', () => {
  it('기준(criterion)에 따라 내림차순 정렬한다', () => {
    const states = [
      computeAIState('a1', [mkAIRecord({ aiId: 'a1', resultPL: 10, bankrollAfter: 110 })], 100),
      computeAIState('a2', [mkAIRecord({ aiId: 'a2', resultPL: 30, bankrollAfter: 130 })], 100),
      computeAIState('a3', [mkAIRecord({ aiId: 'a3', resultPL: -20, bankrollAfter: 80 })], 100),
    ];
    const byPL = rankAI(states, 'pl');
    expect(byPL.map((s) => s.aiId)).toEqual(['a2', 'a1', 'a3']);
    const byBankroll = rankAI(states, 'bankroll');
    expect(byBankroll[0]!.aiId).toBe('a2');
  });
});

// ===== JSON Import 검증 =====

describe('JSON Import 검증', () => {
  const valid = {
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    data: {
      projects: [{ id: 'p1' }],
      sessions: [{ id: 's1', projectId: 'p1', startBalance: 100 }],
      tables: [{ id: 't1', sessionId: 's1' }],
      shoes: [{ id: 'sh1', sessionId: 's1', tableSessionId: 't1' }],
      rounds: [{ id: 'r1', sessionId: 's1', shoeId: 'sh1', roundNumber: 1, bettingAmount: 10 }],
      aiProfiles: [{ id: 'a1', projectId: 'p1', aggression: 50, conservatism: 50, trendFollowing: 50, reversalPreference: 50, volatilityTolerance: 50, passPreference: 50 }],
      aiRecords: [{ id: 'ar1', roundId: 'r1', aiId: 'a1' }],
    },
  };
  it('정상 백업은 통과한다', () => {
    expect(validateBackup(valid).ok).toBe(true);
  });
  it('schemaVersion이 맞지 않으면 실패한다', () => {
    const v = validateBackup({ ...valid, schemaVersion: 2 });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain('schemaVersion');
  });
  it('존재하지 않는 sessionId를 참조하면 실패한다', () => {
    const bad = structuredClone(valid);
    bad.data.rounds[0]!.sessionId = 'nope';
    const v = validateBackup(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('sessionId'))).toBe(true);
  });
  it('roundNumber 중복은 실패한다', () => {
    const bad = structuredClone(valid);
    bad.data.rounds.push({ id: 'r2', sessionId: 's1', shoeId: 'sh1', roundNumber: 1, bettingAmount: 5 });
    expect(validateBackup(bad).ok).toBe(false);
  });
  it('음수 베팅 금액 데이터는 실패한다', () => {
    const bad = structuredClone(valid);
    bad.data.rounds[0]!.bettingAmount = -10;
    expect(validateBackup(bad).ok).toBe(false);
  });
  it('형식이 깨진 JSON은 실패한다', () => {
    expect(validateBackup('not-json').ok).toBe(false);
    expect(validateBackup({ schemaVersion: 1 }).ok).toBe(false);
  });
});
