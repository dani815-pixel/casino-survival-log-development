import * as db from '../db/db';
import { SCHEMA_VERSION } from '../db/db';
import { validateBackup } from '../utils/validation';
import { getProjectBundle } from './queries';
import { getGame } from '../data/games';

// ===== JSON Export (최상위에 schemaVersion, exportedAt 포함) =====

export async function exportAllJSON(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const s of db.DATA_STORES) data[s] = await db.getAll(s);
  return JSON.stringify(
    { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}

// ===== JSON Import (중복 ID는 건너뜀) =====

export interface ImportReport {
  ok: boolean;
  message: string;
  counts: Record<string, number>;
}

const LABELS: Record<string, string> = {
  projects: 'Projects', sessions: 'Sessions', tables: 'Tables', shoes: 'Shoes', rounds: 'Rounds',
  aiProfiles: 'AI Profiles', aiRecords: 'AI Records', events: 'Events', reviews: 'Reviews', settings: 'Settings',
};

export async function importAllJSON(text: string): Promise<ImportReport> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: '가져오기 실패\n원인: JSON 형식이 올바르지 않습니다.', counts: {} };
  }
  const v = validateBackup(parsed);
  if (!v.ok) return { ok: false, message: `가져오기 실패\n원인: ${v.errors[0]}`, counts: {} };

  const d = (parsed as { data: Record<string, Array<{ id: string }>> }).data;
  const counts: Record<string, number> = {};
  let skipped = 0;
  for (const s of db.DATA_STORES) {
    const arr = (d[s] ?? []) as Array<{ id: string }>;
    const existing = new Set((await db.getAll<{ id: string }>(s)).map((x) => x.id));
    const fresh = arr.filter((x) => !existing.has(x.id));
    skipped += arr.length - fresh.length;
    if (fresh.length) await db.putMany(s, fresh as never);
    counts[s] = fresh.length;
  }
  const lines = ['가져오기 완료'];
  for (const s of db.DATA_STORES) if ((counts[s] ?? 0) > 0) lines.push(`${LABELS[s]}: ${counts[s]}`);
  if (skipped > 0) lines.push(`(기존 데이터와 중복된 ${skipped}건은 건너뛰었습니다)`);
  return { ok: true, message: lines.join('\n'), counts };
}

// ===== CSV Export (Round 기록) =====

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function buildRoundsCSV(projectId: string): Promise<string> {
  const bundle = await getProjectBundle(projectId);
  const sessionMap = new Map(bundle.sessions.map((s) => [s.id, s]));
  const tableMap = new Map(bundle.tables.map((t) => [t.id, t]));
  const shoeMap = new Map(bundle.shoes.map((s) => [s.id, s]));
  const header = ['date', 'casino', 'game', 'table', 'shoe', 'round', 'actualResult', 'prediction', 'betAmount', 'profitLoss'];
  const rows = [...bundle.rounds]
    .sort((a, b) => {
      const sa = sessionMap.get(a.sessionId), sb = sessionMap.get(b.sessionId);
      const d = (sa?.date ?? '').localeCompare(sb?.date ?? '');
      return d !== 0 ? d : a.roundNumber - b.roundNumber;
    })
    .map((r) => {
      const s = sessionMap.get(r.sessionId);
      const game = s ? getGame(s.gameId) : undefined;
      const label = (id: string | null) => (id ? (game?.options.find((o) => o.id === id)?.label ?? id) : '');
      return [
        s?.date ?? '', s?.casino ?? '', game?.name ?? s?.gameId ?? '',
        tableMap.get(r.tableSessionId)?.table ?? '',
        shoeMap.get(r.shoeId)?.shoeNumber ?? '',
        r.roundNumber, label(r.actualResult), label(r.myPrediction),
        r.bettingAmount ?? '', r.actualProfitLoss ?? '',
      ].map(csvCell).join(',');
    });
  return [header.join(','), ...rows].join('\n');
}

export async function resetAllData(): Promise<void> {
  for (const s of db.DATA_STORES) await db.clear(s);
}

export function downloadFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
