import * as db from '../db/db';
import type {
  AIProfile, AIRoundRecord, AppEvent, DailySession, Project, Round, Shoe, TableSession,
} from '../types';
import { uid } from '../utils/id';
import { buildSeedAIProfiles } from '../data/seedAI';
import { getGame } from '../data/games';
import { validateRoundInput, validateSessionInput, type RoundInput, type SessionInput } from '../utils/validation';
import { buildSessionEndSummary, computeUserStats } from '../utils/statistics';
import { settleBet } from '../utils/settle';
import { playForRound } from './aiService';

// 사용자 친화적 에러. UI는 이 message를 그대로 표시한다.
export class DomainError extends Error {}

const fail = (errs: string[]) => {
  if (errs.length) throw new DomainError(errs[0]!);
};

const ev = (sessionId: string, type: AppEvent['type'], payload: Record<string, unknown>): AppEvent => ({
  id: uid(),
  sessionId,
  type,
  timestamp: Date.now(),
  payload,
});

// ===== Project =====

export async function createProject(input: {
  name: string; startDate: string; startCapital: number; currency: string; memo: string;
}): Promise<Project> {
  if (!input.name.trim()) throw new DomainError('프로젝트 이름을 입력해주세요.');
  if (!Number.isFinite(input.startCapital) || input.startCapital < 0)
    throw new DomainError('프로젝트 시작 자금은 0 이상의 숫자여야 합니다.');
  const now = Date.now();
  const project: Project = {
    id: uid(),
    name: input.name.trim(),
    startDate: input.startDate,
    startCapital: input.startCapital,
    currency: input.currency,
    memo: input.memo.trim(),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await db.put('projects', project);
  await db.putMany('aiProfiles', buildSeedAIProfiles(project.id)); // 초기 AI 12명 seed
  return project;
}

export async function updateProject(project: Project): Promise<void> {
  await db.put('projects', { ...project, updatedAt: Date.now() });
}

// ===== Daily Session =====

export interface StartSessionInput extends SessionInput {
  date: string;
  memo: string;
}

export async function startSession(project: Project, input: StartSessionInput): Promise<DailySession> {
  const game = getGame(input.gameId);
  fail(validateSessionInput(input, !!game));
  const now = Date.now();
  const session: DailySession = {
    id: uid(),
    projectId: project.id,
    date: input.date,
    casino: input.casino.trim(),
    gameId: input.gameId,
    table: input.table.trim(),
    startBalance: input.startBalance,
    stopLoss: input.stopLoss,
    winCut: input.winCut,
    memo: input.memo.trim(),
    status: 'PLAYING',
    endBalance: null,
    calculatedEndBalance: null,
    endedAt: null,
    totalRounds: 0,
    predictionCount: 0,
    actualBetCount: 0,
    actualProfitLoss: 0,
    createdAt: now,
    updatedAt: now,
  };
  const table: TableSession = {
    id: uid(), sessionId: session.id, table: session.table, startedAt: now, endedAt: null, status: 'ACTIVE',
  };
  const shoe: Shoe = {
    id: uid(), tableSessionId: table.id, sessionId: session.id, shoeNumber: 1, startedAt: now, endedAt: null, status: 'ACTIVE',
  };
  await db.put('sessions', session);
  await db.put('tables', table);
  await db.put('shoes', shoe);
  await db.put('events', ev(session.id, 'SHOE_STARTED', { table: session.table, shoeNumber: 1 }));
  return session;
}

// ===== Round =====

export interface RoundCtx {
  session: DailySession;
  table: TableSession;
  shoe: Shoe;
  rounds: Round[];
  aiProfiles: AIProfile[];
  aiRecords: AIRoundRecord[];
}

function buildRound(ctx: RoundCtx, input: RoundInput, roundNumber: number): Round {
  const game = getGame(ctx.session.gameId)!;
  const bet = input.bettingAmount;
  const pl = bet != null && input.myPrediction ? settleBet(game, input.myPrediction, bet, input.actualResult) : null;
  return {
    id: uid(),
    sessionId: ctx.session.id,
    shoeId: ctx.shoe.id,
    tableSessionId: ctx.table.id,
    roundNumber,
    actualResult: input.actualResult,
    myPrediction: input.myPrediction,
    bettingAmount: bet,
    actualProfitLoss: pl,
    timestamp: Date.now(),
    memo: input.memo.trim(),
  };
}

export async function addRound(ctx: RoundCtx, input: RoundInput): Promise<{ round: Round; newAI: AIRoundRecord[] }> {
  const game = getGame(ctx.session.gameId);
  if (!game) throw new DomainError('게임 설정을 찾을 수 없습니다.');
  const stats = computeUserStats(ctx.session, ctx.rounds);
  fail(validateRoundInput({ input, session: ctx.session, shoe: ctx.shoe, game, rounds: ctx.rounds, currentBalance: stats.currentBalance }));
  const roundNumber = ctx.rounds.reduce((m, r) => Math.max(m, r.roundNumber), 0) + 1;
  const round = buildRound(ctx, input, roundNumber);
  const prevResults = [...ctx.rounds].sort((a, b) => a.roundNumber - b.roundNumber).slice(-10).map((r) => r.actualResult);
  const newAI = playForRound({ profiles: ctx.aiProfiles, game, session: ctx.session, round, allRecords: ctx.aiRecords, prevResults });
  await db.put('rounds', round);
  await db.putMany('aiRecords', newAI);
  await db.put('events', ev(ctx.session.id, 'ROUND', { roundNumber, result: round.actualResult }));
  return { round, newAI };
}

export async function updateLastRound(ctx: RoundCtx, round: Round, input: RoundInput): Promise<void> {
  const game = getGame(ctx.session.gameId);
  if (!game) throw new DomainError('게임 설정을 찾을 수 없습니다.');
  const others = ctx.rounds.filter((r) => r.id !== round.id);
  const stats = computeUserStats(ctx.session, others);
  fail(validateRoundInput({ input, session: ctx.session, shoe: ctx.shoe, game, rounds: others, currentBalance: stats.currentBalance }));
  const bet = input.bettingAmount;
  const pl = bet != null && input.myPrediction ? settleBet(game, input.myPrediction, bet, input.actualResult) : null;
  const updated: Round = {
    ...round,
    actualResult: input.actualResult,
    myPrediction: input.myPrediction,
    bettingAmount: bet,
    actualProfitLoss: pl,
    memo: input.memo.trim(),
  };
  // 해당 라운드의 AI 기록도 다시 생성한다.
  const remainingAI = ctx.aiRecords.filter((r) => r.roundId !== round.id);
  const removedIds = ctx.aiRecords.filter((r) => r.roundId === round.id).map((r) => r.id);
  const prevResults = others.sort((a, b) => a.roundNumber - b.roundNumber).slice(-10).map((r) => r.actualResult);
  const freshAI = playForRound({ profiles: ctx.aiProfiles, game, session: ctx.session, round: updated, allRecords: remainingAI, prevResults });
  await db.put('rounds', updated);
  await db.delMany('aiRecords', removedIds);
  await db.putMany('aiRecords', freshAI);
}

export async function deleteRound(round: Round): Promise<void> {
  const recs = await db.byIndex<AIRoundRecord>('aiRecords', 'roundId', round.id);
  await db.del('rounds', round.id);
  await db.delMany('aiRecords', recs.map((r) => r.id));
}

// ===== Shoe / Table =====

export async function endShoe(session: DailySession, shoe: Shoe): Promise<Shoe> {
  if (session.status === 'ENDED') throw new DomainError('이미 종료된 세션입니다.');
  if (shoe.status !== 'ACTIVE') throw new DomainError('이미 종료된 슈입니다.');
  const now = Date.now();
  await db.put('shoes', { ...shoe, status: 'ENDED', endedAt: now });
  const next: Shoe = {
    id: uid(), tableSessionId: shoe.tableSessionId, sessionId: session.id,
    shoeNumber: shoe.shoeNumber + 1, startedAt: now, endedAt: null, status: 'ACTIVE',
  };
  await db.put('shoes', next);
  await db.put('events', ev(session.id, 'SHOE_ENDED', { shoeNumber: shoe.shoeNumber }));
  await db.put('events', ev(session.id, 'SHOE_STARTED', { shoeNumber: next.shoeNumber }));
  return next;
}

export async function moveTable(
  session: DailySession,
  curTable: TableSession,
  curShoe: Shoe,
  input: { newTable: string; newShoe: number; balanceAtMove: number; memo: string },
): Promise<{ table: TableSession; shoe: Shoe }> {
  if (session.status === 'ENDED') throw new DomainError('이미 종료된 세션입니다.');
  if (!input.newTable.trim()) throw new DomainError('새 테이블 번호를 입력해주세요.');
  if (!Number.isFinite(input.newShoe) || input.newShoe <= 0) throw new DomainError('새 슈 번호는 1 이상의 숫자여야 합니다.');
  const now = Date.now();
  await db.put('shoes', { ...curShoe, status: 'ENDED', endedAt: now });
  await db.put('tables', { ...curTable, status: 'ENDED', endedAt: now });
  const table: TableSession = {
    id: uid(), sessionId: session.id, table: input.newTable.trim(), startedAt: now, endedAt: null, status: 'ACTIVE',
  };
  const shoe: Shoe = {
    id: uid(), tableSessionId: table.id, sessionId: session.id,
    shoeNumber: Math.floor(input.newShoe), startedAt: now, endedAt: null, status: 'ACTIVE',
  };
  await db.put('tables', table);
  await db.put('shoes', shoe);
  await db.put('events', ev(session.id, 'TABLE_CHANGED', {
    from: curTable.table, to: table.table, newShoe: shoe.shoeNumber,
    movedAt: now, balanceAtMove: input.balanceAtMove, memo: input.memo.trim(),
  }));
  return { table, shoe };
}

// ===== Pause / Resume / End =====

export async function togglePause(session: DailySession): Promise<DailySession> {
  if (session.status === 'ENDED') throw new DomainError('이미 종료된 세션입니다.');
  const next = session.status === 'PLAYING' ? 'PAUSED' : 'PLAYING';
  const updated: DailySession = { ...session, status: next as DailySession['status'], updatedAt: Date.now() };
  await db.put('sessions', updated);
  await db.put('events', ev(session.id, next === 'PAUSED' ? 'PAUSED' : 'RESUMED', {}));
  return updated;
}

// Stop Loss / Win Cut 도달 시 자동 종료하지 않는다. 종료는 항상 사용자가 직접 수행한다.
export async function endSession(session: DailySession, rounds: Round[], endBalance: number | null): Promise<DailySession> {
  if (session.status === 'ENDED') throw new DomainError('이미 종료된 세션입니다.');
  if (endBalance != null && (!Number.isFinite(endBalance) || endBalance < 0))
    throw new DomainError('종료 금액은 0 이상의 숫자여야 합니다.');
  // 계산된 종료 잔액( calculated = Daily Start + 실제 베팅 P/L )과 사용자 입력 잔액을 분리 보존한다.
  const s = buildSessionEndSummary(session, rounds, endBalance);
  const updated: DailySession = {
    ...session,
    status: 'ENDED',
    endedAt: Date.now(),
    endBalance: s.endBalance,
    calculatedEndBalance: s.calculatedEndBalance,
    totalRounds: s.totalRounds,
    predictionCount: s.predictionCount,
    actualBetCount: s.actualBetCount,
    actualProfitLoss: s.actualProfitLoss,
    updatedAt: Date.now(),
  };
  await db.put('sessions', updated);
  await db.put('events', ev(session.id, 'SESSION_ENDED', {
    endBalance: s.endBalance,
    calculatedEndBalance: s.calculatedEndBalance,
    endBalanceMismatch: s.endBalanceMismatch,
    totalRounds: s.totalRounds,
    predictionCount: s.predictionCount,
    actualBetCount: s.actualBetCount,
  }));
  return updated;
}
