import type { DailySession, GameDefinition, Round, Shoe } from '../types';

// 모든 에러 메시지는 개발자용이 아니라 사용자가 이해할 수 있는 문장으로 작성한다.

export interface SessionInput {
  casino: string;
  gameId: string;
  table: string;
  startBalance: number;
  stopLoss: number | null;
  winCut: number | null;
}

export function validateSessionInput(input: SessionInput, gameExists: boolean): string[] {
  const errs: string[] = [];
  if (!gameExists) errs.push('게임 종류를 선택해주세요.');
  if (!input.casino.trim()) errs.push('카지노 이름을 입력해주세요.');
  if (!input.table.trim()) errs.push('테이블 번호를 입력해주세요.');
  if (!Number.isFinite(input.startBalance) || input.startBalance <= 0)
    errs.push('시작 금액은 0보다 큰 숫자여야 합니다.');
  if (input.stopLoss != null && (!Number.isFinite(input.stopLoss) || input.stopLoss <= 0))
    errs.push('Stop Loss는 0보다 큰 숫자여야 합니다.');
  else if (input.stopLoss != null && input.stopLoss > input.startBalance)
    errs.push('Stop Loss는 오늘 시작 금액보다 클 수 없습니다.');
  if (input.winCut != null && (!Number.isFinite(input.winCut) || input.winCut <= 0))
    errs.push('Win Cut은 0보다 큰 숫자여야 합니다.');
  return errs;
}

export interface RoundInput {
  actualResult: string;
  myPrediction: string | null;
  bettingAmount: number | null;
  memo: string;
}

export function validateRoundInput(args: {
  input: RoundInput;
  session: DailySession | null;
  shoe: Shoe | null;
  game: GameDefinition;
  rounds: Round[];
  currentBalance: number;
}): string[] {
  const { input, session, shoe, game, rounds, currentBalance } = args;
  const errs: string[] = [];
  if (!session) errs.push('진행 중인 세션이 없습니다. 먼저 게임을 시작하세요.');
  else if (session.status === 'PAUSED') errs.push('일시정지 중에는 라운드를 입력할 수 없습니다.');
  else if (session.status === 'ENDED') errs.push('이미 종료된 세션입니다.');
  if (session && (!shoe || shoe.status !== 'ACTIVE')) errs.push('진행 중인 슈가 없습니다.');
  if (!game.options.some((o) => o.id === input.actualResult)) errs.push('결과를 선택해주세요.');
  if (input.myPrediction != null && !game.options.some((o) => o.id === input.myPrediction))
    errs.push('예측이 이 게임의 선택지와 일치하지 않습니다.');
  if (input.bettingAmount != null) {
    if (!Number.isFinite(input.bettingAmount)) errs.push('베팅 금액은 숫자로 입력해주세요.');
    else if (input.bettingAmount < 0) errs.push('베팅 금액은 0 이상이어야 합니다.');
    else if (input.bettingAmount === 0) errs.push('0을 베팅할 수는 없습니다. 예측만 하려면 금액을 비워두세요.');
    else if (input.bettingAmount > currentBalance)
      errs.push(`현재 잔액(${currentBalance})보다 큰 금액은 베팅할 수 없습니다.`);
    if (input.myPrediction == null) errs.push('베팅하려면 예측을 먼저 선택해주세요.');
  }
  // roundNumber 중복 검증 (자동 채번이어도 데이터 무결성 차원에서 검사)
  if (rounds.some((r, i) => rounds.findIndex((x) => x.roundNumber === r.roundNumber) !== i))
    errs.push('중복된 라운드 번호가 데이터에 존재합니다. 백업 후 초기화를 권장합니다.');
  return errs;
}

// ===== Backup(JSON Import) 검증 =====

const REQUIRED_ARRAYS = ['projects', 'sessions', 'tables', 'shoes', 'rounds', 'aiProfiles', 'aiRecords'] as const;

export function validateBackup(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return { ok: false, errors: ['JSON 형식이 올바르지 않습니다.'] };
  const root = data as { schemaVersion?: unknown; data?: Record<string, unknown> };
  if (root.schemaVersion !== 1) errors.push(`schemaVersion이 올바르지 않습니다. (지원 버전: 1, 파일: ${String(root.schemaVersion)})`);
  if (typeof root.data !== 'object' || root.data === null) errors.push('data 본문이 없습니다.');
  if (errors.length) return { ok: false, errors };

  const d = root.data!;
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(d[key])) errors.push(`필수 데이터(${key})가 없거나 배열이 아닙니다.`);
  }
  if (errors.length) return { ok: false, errors };

  const arr = (k: string) => d[k] as Record<string, unknown>[];
  for (const key of [...REQUIRED_ARRAYS, 'events', 'reviews', 'settings']) {
    const list = d[key];
    if (list == null) continue;
    if (!Array.isArray(list)) { errors.push(`${key} 데이터가 배열이 아닙니다.`); continue; }
    for (const item of list as Record<string, unknown>[]) {
      if (typeof item !== 'object' || item === null || typeof item.id !== 'string' || !item.id)
        errors.push(`${key}에 id가 없는 데이터가 있습니다.`);
    }
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 3) };

  // 타입 스팟 체크
  for (const s of arr('sessions')) {
    if (typeof s.startBalance !== 'number' || !Number.isFinite(s.startBalance)) errors.push('startBalance가 유효한 숫자가 아닌 세션이 있습니다.');
    for (const k of ['endBalance', 'calculatedEndBalance', 'actualProfitLoss']) {
      const value = s[k];
      if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) {
        errors.push(`${k}가 유효한 숫자가 아닌 세션이 있습니다.`);
      }
    }
    if (s.endBalanceMismatch != null && typeof s.endBalanceMismatch !== 'boolean') {
      errors.push('endBalanceMismatch가 boolean이 아닌 세션이 있습니다.');
    }
  }
  for (const r of arr('rounds')) {
    if (typeof r.roundNumber !== 'number' || !Number.isFinite(r.roundNumber)) errors.push('roundNumber가 유효한 숫자가 아닌 라운드가 있습니다.');
    if (typeof r.bettingAmount === 'number' && (!Number.isFinite(r.bettingAmount) || r.bettingAmount < 0)) errors.push('유효하지 않은 베팅 금액이 포함된 라운드가 있습니다.');
    if (r.actualProfitLoss != null && (typeof r.actualProfitLoss !== 'number' || !Number.isFinite(r.actualProfitLoss))) {
      errors.push('actualProfitLoss가 유효한 숫자가 아닌 라운드가 있습니다.');
    }
  }
  for (const p of arr('aiProfiles')) {
    for (const k of ['aggression', 'conservatism', 'trendFollowing', 'reversalPreference', 'volatilityTolerance', 'passPreference']) {
      const v = p[k];
      if (typeof v !== 'number' || v < 0 || v > 100) errors.push(`AI 능력치(${k})는 0~100 사이 숫자여야 합니다.`);
    }
  }

  // 관계 무결성
  const ids = (k: string) => new Set(arr(k).map((x) => x.id as string));
  const projects = ids('projects'), sessions = ids('sessions'), tables = ids('tables'), shoes = ids('shoes'), rounds = ids('rounds'), ais = ids('aiProfiles');
  for (const s of arr('sessions')) if (!projects.has(s.projectId as string)) errors.push('존재하지 않는 프로젝트를 참조하는 세션이 있습니다.');
  for (const t of arr('tables')) if (!sessions.has(t.sessionId as string)) errors.push('sessionId가 존재하지 않는 테이블 데이터가 있습니다.');
  for (const s of arr('shoes')) {
    if (!sessions.has(s.sessionId as string)) errors.push('sessionId가 존재하지 않는 슈 데이터가 있습니다.');
    if (!tables.has(s.tableSessionId as string)) errors.push('tableSessionId가 존재하지 않는 슈 데이터가 있습니다.');
  }
  const roundKey = new Set<string>();
  for (const r of arr('rounds')) {
    if (!sessions.has(r.sessionId as string)) errors.push('sessionId가 존재하지 않는 라운드가 있습니다.');
    if (!shoes.has(r.shoeId as string)) errors.push('shoeId가 존재하지 않는 라운드가 있습니다.');
    const key = `${r.sessionId as string}:${String(r.roundNumber)}`;
    if (roundKey.has(key)) errors.push('roundNumber가 중복된 라운드가 있습니다.');
    roundKey.add(key);
  }
  for (const r of arr('aiRecords')) {
    if (!rounds.has(r.roundId as string)) errors.push('roundId가 존재하지 않는 AI 기록이 있습니다.');
    if (!ais.has(r.aiId as string)) errors.push('존재하지 않는 AI의 기록이 있습니다.');
  }
  return { ok: errors.length === 0, errors: errors.slice(0, 5) };
}
