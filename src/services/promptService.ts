import type {
  AIProfile, AIRoundRecord, DailySession, GameDefinition, Project, Round,
} from '../types';
import { optionLabel } from '../data/games';
import { computeUserStats, type DailyAIState } from '../utils/statistics';
import { uid } from '../utils/id';

// 프롬프트 생성은 UI와 분리한다. 현재 세션에 "실제 저장된 데이터"만 사용한다.
// 미래 결과를 확정적으로 예측하도록 요청하지 않는다.

export interface PromptBundle {
  project: Project;
  session: DailySession;
  game: GameDefinition;
  rounds: Round[];
  profiles: AIProfile[];
  aiRecords: AIRoundRecord[];
  aiStates: DailyAIState[];
  currency: string;
  decimals: number;
}

const money = (n: number, b: PromptBundle) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(b.decimals)}`;

function segmentOf(roundNumber: number, total: number): '초반' | '중반' | '후반' {
  if (roundNumber <= total / 3) return '초반';
  if (roundNumber <= (total * 2) / 3) return '중반';
  return '후반';
}

export function buildSessionDataSection(b: PromptBundle): string {
  const L: string[] = [];
  const stats = computeUserStats(b.session, b.rounds);
  const total = b.rounds.length;
  const g = b.game;

  L.push('■ 기본 정보');
  L.push(`- 프로젝트: ${b.project.name} / 날짜: ${b.session.date} / 카지노: ${b.session.casino}`);
  L.push(`- 게임: ${g.name} / 테이블: ${b.session.table} / Daily Start: $${b.session.startBalance}`);
  L.push(`- 현재 사용자 잔액: $${stats.currentBalance} (오늘 P/L ${money(stats.actualProfitLoss, b)}, ${stats.dailyReturn}%)`);
  L.push(`- 총 라운드: ${total} / 예측 기록: ${stats.predictionCount} / 실제 베팅: ${stats.actualBetCount}`);
  L.push(`- 예측 적중률: ${stats.predictionHitRate}% (${stats.predictionHits}/${stats.predictionCount}) / 베팅 승률: ${stats.actualBetWinRate}%`);
  if (b.session.stopLoss != null) L.push(`- Stop Loss: $${b.session.stopLoss} / Win Cut: $${b.session.winCut ?? '-'}`);
  L.push('');

  L.push('■ 사용자 라운드 기록 (예측과 실제 베팅은 별개 데이터)');
  for (const r of [...b.rounds].sort((a, c) => a.roundNumber - c.roundNumber)) {
    const result = optionLabel(g, r.actualResult);
    const pred = r.myPrediction ? optionLabel(g, r.myPrediction) : '없음';
    const bet = r.bettingAmount != null ? `$${r.bettingAmount} (${money(r.actualProfitLoss ?? 0, b)})` : '관전(예측만)';
    L.push(`- R${r.roundNumber} [${segmentOf(r.roundNumber, total)}] 결과 ${result} / 예측 ${pred} / ${bet}${r.memo ? ` / 메모:${r.memo}` : ''}`);
  }
  L.push('');

  L.push('■ AI별 가상 플레이 결과 (가상 자산, 사용자 실제 자산과 무관)');
  for (const s of b.aiStates) {
    const p = b.profiles.find((x) => x.id === s.aiId);
    if (!p) continue;
    L.push(
      `- ${p.name}(${p.role}): 자산 $${s.bankroll} (P/L ${money(s.pl, b)}, ${s.returnPct}%) / 승 ${s.wins} · 패 ${s.losses} · 패스 ${s.passes} / 적중률 ${s.hitRate}%${s.eliminated ? ' / ☠ 탈락' : ''}`,
    );
  }
  L.push('');

  L.push('■ AI 성향 (능력치 0~100: 공격성/보수성/트렌드추종/역발상/변동성/패스성향)');
  for (const p of b.profiles.filter((x) => x.active)) {
    L.push(`- ${p.name}: ${p.aggression}/${p.conservatism}/${p.trendFollowing}/${p.reversalPreference}/${p.volatilityTolerance}/${p.passPreference} · 스타일: ${p.analysisStyle}`);
  }
  L.push('');

  L.push('■ AI 남부 상태 (dynamic state)');
  for (const s of b.aiStates) {
    const p = b.profiles.find((x) => x.id === s.aiId);
    if (!p) continue;
    L.push(`- ${p.name}: 확신도 ${s.dyn.confidence} / 연속 ${s.dyn.streak} / 최근5 P/L ${money(s.dyn.recentPerformance, b)} / 사용자 일치율 ${Math.round(s.dyn.recentAgreement * 100)}%`);
  }
  L.push('');

  // 구간별 흐름 + 의견 집중/분산
  const segs: Array<'초반' | '중반' | '후반'> = ['초반', '중반', '후반'];
  L.push('■ 구간별 흐름');
  for (const seg of segs) {
    const rs = b.rounds.filter((r) => segmentOf(r.roundNumber, total) === seg);
    if (!rs.length) continue;
    const userPL = rs.reduce((a, r) => a + (r.actualProfitLoss ?? 0), 0);
    const recs = b.aiRecords.filter((x) => rs.some((r) => r.id === x.roundId) && x.selection != null);
    const agreeRows: string[] = [];
    for (const r of rs) {
      const sel = b.aiRecords.filter((x) => x.roundId === r.id && x.selection != null);
      if (!sel.length) continue;
      const counts = new Map<string, number>();
      sel.forEach((x) => counts.set(x.selection!, (counts.get(x.selection!) ?? 0) + 1));
      const top = [...counts.entries()].sort((a, c) => c[1] - a[1])[0]!;
      agreeRows.push(`R${r.roundNumber}:${optionLabel(g, top[0])} ${Math.round((top[1] / sel.length) * 100)}%`);
    }
    L.push(`- ${seg}: R${rs[0]!.roundNumber}~R${rs[rs.length - 1]!.roundNumber} / 사용자 P/L ${money(userPL, b)} / AI 선택 ${recs.length}건`);
    if (agreeRows.length) L.push(`  의견 분포: ${agreeRows.join(' | ')}`);
  }
  L.push('');

  const agreeList = b.aiRecords.filter((r) => r.agreeWithUser !== null);
  const agreePct = agreeList.length ? Math.round((agreeList.filter((r) => r.agreeWithUser).length / agreeList.length) * 100) : 0;
  const eliminated = b.aiStates.filter((s) => s.eliminated).map((s) => b.profiles.find((p) => p.id === s.aiId)?.name ?? s.aiId);
  L.push(`■ 사용자-AI 일치율: ${agreePct}%`);
  L.push(`■ 탈락 AI: ${eliminated.length ? eliminated.join(', ') : '없음'}`);
  return L.join('\n');
}

export function buildDailyAnalysisPrompt(b: PromptBundle, template: string): string {
  return template.replace('{{DATA}}', buildSessionDataSection(b));
}

export function buildScenarioPrompt(
  b: PromptBundle,
  template: string,
  prevAnalysisRaw: string,
): string {
  const data = `${buildSessionDataSection(b)}\n\n■ 이전 외부 AI 데일리 분석 결과 (원문)\n${prevAnalysisRaw.slice(0, 4000)}`;
  return template.replace('{{DATA}}', data);
}

// ===== 외부 AI 결과 파싱 (원문은 항상 보존, 구조화는 가능한 범위만) =====

export function parseExternalResult(raw: string): string {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*▪◦#>\d]+[.\)\s]/.test(l) || /(요약|핵심|흐름|특이|포인트|결론)/.test(l));
  const picked = (bullets.length >= 3 ? bullets : lines).slice(0, 10);
  return picked.join('\n').slice(0, 1200);
}

export interface Highlights {
  good: string[];
  bad: string[];
  notes: string[];
}

export function extractHighlights(raw: string): Highlights {
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 4);
  const good: string[] = [];
  const bad: string[] = [];
  const notes: string[] = [];
  for (const l of lines) {
    if (/(상승|좋|강세|적중|개선|회복)/.test(l) && good.length < 4) good.push(l);
    else if (/(하락|부진|약세|손실|악화|위험)/.test(l) && bad.length < 4) bad.push(l);
    else if (/(특이|포인트|주의|관찰|변화)/.test(l) && notes.length < 4) notes.push(l);
  }
  return { good, bad, notes };
}

export function newReview(sessionId: string, kind: 'DAILY_ANALYSIS' | 'SCENARIO', rawText: string) {
  return {
    id: uid(),
    sessionId,
    kind,
    createdAt: Date.now(),
    rawText,
    parsedSummary: parseExternalResult(rawText),
  };
}
