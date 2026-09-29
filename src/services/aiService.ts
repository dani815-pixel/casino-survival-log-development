import type { AIProfile, AIRoundRecord, DailySession, GameDefinition, Round } from '../types';
import { computeDynamicState, round2, type AIDynamicState } from '../utils/statistics';
import { settleBet } from '../utils/settle';
import { uid } from '../utils/id';

// 순수 함수 기반 AI 가상 플레이 엔진. rng 주입으로 테스트 가능하다.
// 주의: AI 상태 변화는 가상 플레이의 서사/행동 변화를 위한 것이며 실제 확률이 변한다는 의미가 아니다.

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const pickOne = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)]!;

export interface DecideResult {
  selection: string | null; // null = Pass
  analysis: string;
}

export function decide(
  p: AIProfile,
  dyn: AIDynamicState,
  game: GameDefinition,
  prevResults: string[],
  rng: () => number,
): DecideResult {
  const passChance = clamp(
    (p.passPreference / 100) * (dyn.confidence < 35 ? 1.6 : dyn.confidence > 70 ? 0.55 : 1),
    0,
    0.9,
  );
  if (rng() < passChance) return { selection: null, analysis: '흐름이 애매해 이번 라운드는 관망' };

  const nonTie = game.options.filter((o) => o.id !== game.tieOptionId);
  const last = [...prevResults].reverse().find((r) => r !== game.tieOptionId);
  let streak = 1;
  for (let i = prevResults.length - 1; i > 0; i--) {
    if (prevResults[i] === prevResults[i - 1]) streak++;
    else break;
  }
  const weights = nonTie.map((o) => {
    let w = 1;
    if (last && o.id === last) w += p.trendFollowing / 50;
    if (last && o.id !== last) w += (p.reversalPreference / 50) * (streak >= 3 ? 1.6 : 1);
    w *= 1 + (100 - p.conservatism) / 200;
    return w;
  });
  let total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  let selection = nonTie[0]!.id;
  for (let i = 0; i < nonTie.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) { selection = nonTie[i]!.id; break; }
  }
  if (game.tieOptionId && rng() < (p.volatilityTolerance / 100) * 0.3) selection = game.tieOptionId;

  const why =
    selection === last ? '연속 흐름 추종'
    : last && streak >= 3 ? '긴 연속 뒤 반전 노림'
    : selection === game.tieOptionId ? '고배당 타이 노림'
    : '기본 확률 분산 선택';
  return { selection, analysis: `${why} · 확신도 ${Math.round(dyn.confidence)}` };
}

export function betSize(p: AIProfile, dyn: AIDynamicState, bankroll: number, rng: () => number): number {
  if (bankroll <= 1) return Math.max(0, Math.floor(bankroll));
  const base = bankroll * (0.02 + (p.aggression / 100) * 0.1);
  const vol = 0.5 + (p.volatilityTolerance / 100) * rng();
  const conf = 0.5 + dyn.confidence / 100;
  let amt = Math.round(base * vol * conf * (p.conservatism > 70 ? 0.6 : 1));
  return clamp(amt, 1, Math.max(1, Math.floor(bankroll * 0.6)));
}

export interface PlayCtx {
  profiles: AIProfile[];
  game: GameDefinition;
  session: DailySession;
  round: Round;
  allRecords: AIRoundRecord[]; // 해당 세션의 기존 AI 기록
  prevResults: string[];
  rng?: () => number;
}

// 사용자가 라운드를 저장하면 모든 활성 AI가 가상 플레이를 수행한다.
// Meeting 참여 여부와 무관하게 전체 활성 AI가 플레이한다.
// Pass는 승/패에 포함하지 않고, 기록이 없는 경우 loss로 처리하지 않는다(레코드 자체를 만들지 않음).
export function playForRound(ctx: PlayCtx): AIRoundRecord[] {
  const rng = ctx.rng ?? Math.random;
  const out: AIRoundRecord[] = [];
  for (const p of ctx.profiles) {
    if (!p.active) continue;
    const mine = ctx.allRecords.filter((r) => r.aiId === p.id).sort((a, b) => a.roundNumber - b.roundNumber);
    const last = mine[mine.length - 1];
    if (last?.eliminated) continue; // 탈락 AI는 그날 남은 라운드에 플레이하지 않음
    const bankroll = last ? last.bankrollAfter : ctx.session.startBalance; // 매일 Daily Start로 리셋
    if (bankroll <= 0) continue;
    const dyn = computeDynamicState(mine);
    const d = decide(p, dyn, ctx.game, ctx.prevResults, rng);
    let selection = d.selection;
    let virtualBet = 0;
    let resultPL = 0;
    if (selection) {
      virtualBet = Math.min(betSize(p, dyn, bankroll, rng), bankroll);
      if (virtualBet <= 0) selection = null;
      else resultPL = settleBet(ctx.game, selection, virtualBet, ctx.round.actualResult);
    }
    const after = round2(bankroll + resultPL);
    out.push({
      id: uid(),
      sessionId: ctx.session.id,
      roundId: ctx.round.id,
      roundNumber: ctx.round.roundNumber,
      aiId: p.id,
      roundResult: ctx.round.actualResult,
      analysis: d.analysis,
      selection,
      virtualBet,
      resultPL,
      bankrollAfter: after,
      agreeWithUser: selection && ctx.round.myPrediction ? selection === ctx.round.myPrediction : null,
      eliminated: after <= 0,
      createdAt: Date.now(),
    });
  }
  return out;
}

// ===== Meeting Room 대화 생성 =====

export function generateSpeech(
  p: AIProfile,
  dyn: AIDynamicState,
  ctx: { resultLabel?: string; lastPL?: number | null; rank?: number; externalAnalysis?: string },
  rng: () => number = Math.random,
): string {
  const opener = pickOne(p.commonExpressions.length ? p.commonExpressions : ['……'], rng);
  let body: string;
  if (ctx.lastPL != null && ctx.lastPL > 0) {
    body = `방금 ${ctx.resultLabel ?? '결과'} 적중. 내 방식대로면 이 흐름은 아직 끝나지 않았어.`;
  } else if (ctx.lastPL != null && ctx.lastPL < 0) {
    body = `${ctx.resultLabel ?? '이번 판'}은 읽지 못했어. 손실은 인정하고 다음 데이터를 보자.`;
  } else if (ctx.lastPL === 0) {
    body = '타이 구간. 무리해서 늘리기보다 흐름을 다시 재겠어.';
  } else if (p.dialogExamples.length) {
    body = pickOne(p.dialogExamples, rng);
  } else {
    body = '표본을 더 모으는 중이야.';
  }
  const extras: string[] = [];
  if (ctx.externalAnalysis?.trim()) {
    const insight = ctx.externalAnalysis.trim().replace(/\s+/g, ' ').slice(0, 180);
    extras.push(`외부 분석 메모: ${insight}`);
  }
  if (ctx.rank === 1) extras.push('현재 1위지만 방심은 없다.');
  if (dyn.streak >= 3) extras.push(`${dyn.streak}연속 적중 중.`);
  if (dyn.streak <= -3) extras.push(`${-dyn.streak}연패. 전략을 점검해야겠어.`);
  if (dyn.confidence < 30) extras.push('오늘은 확신이 낮아. 패스를 늘린다.');
  return [opener, body, ...extras.slice(0, 1)].join(' ');
}
