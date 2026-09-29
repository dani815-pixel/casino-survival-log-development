import type {
  AIProfile, AIRoundRecord, DailySession, ExternalReview, GameDefinition, Project, Round, ShortsContent, ShortsShot, ShortsShotType, ShortsTimeline,
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
  L.push(`- 게임: ${g.name} / 테이블: ${b.session.table} / Daily Start: ${b.session.startBalance}`);
  const meetingParticipants = b.session.meetingParticipants ?? [];
  L.push(`- 회의 참여 AI: ${meetingParticipants.length ? meetingParticipants.join(', ') : '미정/기록 없음'}`);
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

export type MeetingParticipantSelectionMethod = 'RANDOM' | 'MANUAL' | 'EXTERNAL_AI' | 'HYBRID';

export interface ParticipantRecommendation {
  aiId: string;
  reason: string;
}

export function selectRandomMeetingParticipants(
  activeIds: string[],
  count = 4,
  rng: () => number = Math.random,
): string[] {
  const pool = [...new Set(activeIds)];
  const limit = Math.min(Math.max(0, Math.floor(count)), 4, pool.length);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, limit);
}

export const DEFAULT_SHORTS_SHOTS: Array<Pick<ShortsShot, 'type' | 'title'>> = [
  { type: 'TODAYS_GAME', title: '오늘의 게임' },
  { type: 'TODAYS_RESULT', title: '오늘의 결과' },
  { type: 'AI_RANKING', title: 'AI 랭킹' },
  { type: 'AI_FLOW', title: 'AI 흐름' },
  { type: 'DAILY_AI_REVIEW', title: '오늘의 AI 복기' },
  { type: 'DAY_COMPLETE', title: '하루 마무리' },
];

export function createDefaultShortsTimeline(duration = 30): ShortsTimeline {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 30;
  const count = DEFAULT_SHORTS_SHOTS.length;
  const base = Math.floor((safeDuration / count) * 10) / 10;
  const last = Math.round((safeDuration - base * (count - 1)) * 10) / 10;
  const shots = DEFAULT_SHORTS_SHOTS.map((shot, index) => ({
    id: `shot-${shot.type.toLowerCase()}`, type: shot.type, title: shot.title, order: index,
    duration: index === count - 1 ? last : base, enabled: true,
  }));
  return { shots, totalDuration: safeDuration };
}

export function normalizeShortsTimeline(shots: ShortsShot[]): ShortsTimeline {
  const normalized = shots.filter(Boolean).map((shot, index) => ({
    ...shot, order: index,
    duration: Number.isFinite(shot.duration) && shot.duration > 0 ? Math.round(shot.duration * 10) / 10 : 5,
    enabled: shot.enabled !== false,
  }));
  const totalDuration = Math.round(normalized.filter((s) => s.enabled).reduce((sum, s) => sum + s.duration, 0) * 10) / 10;
  return { shots: normalized, totalDuration };
}

function tryParseJSONObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch { return null; }
  }
}

export function parseShortsContent(raw: string): ShortsContent | undefined {
  const root = tryParseJSONObject(raw); const value = root?.shorts;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const shorts = value as Record<string, unknown>;
  const title = typeof shorts.title === 'string' ? shorts.title.trim() : '';
  const description = typeof shorts.description === 'string' ? shorts.description.trim() : '';
  const hashtags = Array.isArray(shorts.hashtags)
    ? shorts.hashtags.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
    : typeof shorts.hashtags === 'string' ? shorts.hashtags.split(/\s+/).map((x) => x.trim()).filter(Boolean) : [];
  if (!title && !description && hashtags.length === 0) return undefined;
  return { title, description, hashtags: [...new Set(hashtags)] };
}

export function buildDailyAnalysisPrompt(b: PromptBundle, template: string): string {
  const base = template.replace('{{DATA}}', buildSessionDataSection(b));
  return base + [
    '',
    '[쇼츠 콘텐츠 생성]',
    'Daily Analysis 결과에 아래 JSON을 추가하세요. 앱이 자동으로 읽어 쇼츠 제목/설명/해시태그에 사용합니다.',
    '"shorts": {',
    '  "title": "쇼츠 제목",',
    '  "description": "쇼츠 설명",',
    '  "hashtags": ["#카지노", "#카지노생존일지"]',
    '}',
    '제목과 설명은 실제 오늘 기록에 근거해 작성하고, 과장된 사실이나 확정적인 미래 예측은 만들지 마세요.',
    '일반 분석을 함께 제공하더라도 위 shorts 객체는 JSON 안에 포함하세요.',
  ].join('\n');
}
export function parseParticipantRecommendations(
  raw: string,
  activeIds: string[],
): { recommendations: ParticipantRecommendation[]; error: string | null } {
  try {
    const parsed = JSON.parse(raw) as { participants?: unknown };
    if (!Array.isArray(parsed.participants)) {
      return { recommendations: [], error: 'participants 배열이 없습니다.' };
    }
    const active = new Set(activeIds);
    const seen = new Set<string>();
    const recommendations: ParticipantRecommendation[] = [];
    for (const item of parsed.participants) {
      if (!item || typeof item !== 'object') continue;
      const value = item as { aiId?: unknown; reason?: unknown };
      if (typeof value.aiId !== 'string' || typeof value.reason !== 'string') continue;
      const aiId = value.aiId.trim();
      const reason = value.reason.trim();
      if (!aiId || !reason || !active.has(aiId) || seen.has(aiId)) continue;
      seen.add(aiId);
      recommendations.push({ aiId, reason });
      if (recommendations.length === 4) break;
    }
    if (recommendations.length === 0) {
      return { recommendations: [], error: '활성 AI에 해당하는 유효한 추천이 없습니다.' };
    }
    return { recommendations, error: null };
  } catch {
    return { recommendations: [], error: 'JSON 형식이 올바르지 않습니다.' };
  }
}

export function getPreviousEndedSession(
  sessions: DailySession[],
  currentSessionId: string,
  currentProjectId?: string,
): DailySession | null {
  return [...sessions]
    .filter((s) =>
      s.id !== currentSessionId &&
      s.status === 'ENDED' &&
      (!currentProjectId || s.projectId === currentProjectId)
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export function buildParticipantRecommendationPrompt(
  b: PromptBundle,
  activeProfiles: AIProfile[],
  previousAnalysis = '',
  previousScenario = '',
  previousParticipants: string[] = [],
): string {
  const candidates = activeProfiles.map((p) =>
    `- ${p.id} | ${p.name} | 역할: ${p.role} | 성향: ${p.personality} | 분석: ${p.analysisStyle} | 공격 ${p.aggression} / 보수 ${p.conservatism} / 추세 ${p.trendFollowing} / 역발상 ${p.reversalPreference} / 변동성 ${p.volatilityTolerance} / 패스 ${p.passPreference}`,
  ).join('\\n');

  return `당신은 카지노 생존일지의 다음 회의 참가 AI를 추천하는 분석가입니다.
아래 실제 저장 데이터와 AI 프로필만 사용하세요.

[추천 기준 Daily Session 데이터]
${buildSessionDataSection(b)}

[추천 기준 세션의 이전 외부 분석]
${previousAnalysis.trim() ? previousAnalysis.trim().slice(0, 5000) : '없음'}

[추천 기준 세션의 이전 시나리오]
${previousScenario.trim() ? previousScenario.trim().slice(0, 5000) : '없음'}

[직전 회의 참여 AI]
${previousParticipants.length ? previousParticipants.join(', ') : '기록 없음'}

[참가 후보 AI]
${candidates || '활성 AI 없음'}

[요청]
1. 다음 회의에 참여할 AI를 최대 4명 추천하세요.
2. 추천 기준은 위 Daily Session의 실제 기록과 외부 분석/시나리오입니다.
3. 직전 회의 참여 AI를 참고하되, 같은 AI만 반복 추천하지 말고 관점의 다양성도 고려하세요.
4. 각 AI마다 왜 이번 회의에 적합한지 데이터 기반으로 설명하세요.
5. 미래 결과를 확정적으로 예측하지 마세요.
6. 후보에 없는 AI를 만들지 마세요.

[출력 형식]
JSON 하나만 출력하세요.
{
  "participants": [
    { "aiId": "AI_ID", "reason": "추천 이유" }
  ]
}`;
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

export function isReviewStale(review: ExternalReview | null, events: AppEvent[], sessionId: string): boolean {
  if (!review || review.kind !== 'DAILY_ANALYSIS') return false;
  return events.some(
    (event) =>
      event.sessionId === sessionId &&
      event.type === 'ROUND' &&
      event.timestamp > review.createdAt,
  );
}

export function getLatestDailyAnalysis(reviews: ExternalReview[], sessionId: string): string {
  return reviews
    .filter((r) => r.sessionId === sessionId && r.kind === 'DAILY_ANALYSIS')
    .sort((a, b) => b.createdAt - a.createdAt)[0]?.rawText ?? '';
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
