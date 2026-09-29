import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Card, Empty, Money, Pill, Select, Sheet, Stat } from '../components/ui';
import { Radar, aiColor } from '../components/charts';
import { AIEditor, aiStatValues } from '../components/AIEditor';
import { computeCareer, rankAI, type CareerStats, type RankCriterion } from '../utils/statistics';
import { getProjectBundle } from '../services/queries';
import { Bot, Pencil, Skull, Users } from 'lucide-react';
import { fmtPct } from '../utils/format';

const CRITERIA: { id: RankCriterion; label: string }[] = [
  { id: 'bankroll', label: '오늘 순자산' },
  { id: 'pl', label: '오늘 손익' },
  { id: 'return', label: '오늘 수익률' },
  { id: 'hitRate', label: '예측 적중률' },
  { id: 'betPL', label: '가상 베팅 성적' },
  { id: 'recent', label: '최근 흐름' },
  { id: 'careerPL', label: '프로젝트 누적 손익' },
];

export default function AIPage() {
  const app = useApp();
  const { project, aiProfiles, aiStates, settings, session } = app;
  const [criterion, setCriterion] = useState<RankCriterion>('pl');
  const [careers, setCareers] = useState<Map<string, CareerStats> | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    let dead = false;
    if (!project) return;
    void getProjectBundle(project.id).then((bundle) => {
      if (dead) return;
      const map = new Map<string, CareerStats>();
      for (const p of aiProfiles) map.set(p.id, computeCareer(p.id, bundle.aiRecords));
      setCareers(map);
    });
    return () => { dead = true; };
  }, [project, aiProfiles, session]);

  const careerPL = useMemo(() => {
    const m = new Map<string, number>();
    careers?.forEach((c, id) => m.set(id, c.careerPL));
    return m;
  }, [careers]);

  const ranked = rankAI(aiStates, criterion, careerPL);
  const archived = aiProfiles.filter((p) => !p.active);
  const detail = detailId ? aiProfiles.find((p) => p.id === detailId) ?? null : null;
  const detailState = detailId ? aiStates.find((s) => s.aiId === detailId) ?? null : null;
  const detailCareer = detailId ? careers?.get(detailId) ?? null : null;

  if (!project) {
    return <Empty icon={<Bot size={28} />} title="프로젝트가 없습니다" desc="홈에서 프로젝트를 먼저 만들어주세요." action={<Btn variant="gold" onClick={() => app.setTab('home')}>홈으로</Btn>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-black text-slate-100">AI 랭킹 & 비교</h1>
        <Select value={criterion} onChange={(e) => setCriterion(e.target.value as RankCriterion)} className="!w-40 !min-h-[40px] !py-2 text-xs">
          {CRITERIA.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </div>

      {!session ? (
        <Empty icon={<Bot size={28} />} title="세션이 없습니다" desc="게임을 시작하면 AI 가상 플레이 통계가 여기에 표시됩니다." action={<Btn variant="gold" onClick={() => app.setTab('game')}>게임 시작</Btn>} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {ranked.map((s, i) => {
            const p = aiProfiles.find((x) => x.id === s.aiId);
            if (!p) return null;
            const idx = aiProfiles.indexOf(p);
            const isMeeting = settings.meeting.participants.includes(p.id);
            return (
              <button
                key={s.aiId}
                onClick={() => setDetailId(p.id)}
                className="rounded-2xl bg-[#131b29]/90 p-3 text-left ring-1 ring-white/[0.06] transition active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-[#0b0f17]" style={{ background: aiColor(idx) }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-slate-100">{p.name}</p>
                    <p className="truncate text-[10px] text-slate-500">{p.role}</p>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <Radar values={aiStatValues(p)} size={76} showLabels={false} color={aiColor(idx)} />
                  <div className="space-y-0.5 text-right">
                    <p className="text-sm font-black tabular-nums text-slate-100">${s.bankroll}</p>
                    <Money value={s.pl} currency={settings.currency} decimals={settings.decimals} signed className="block text-[11px]" />
                    <p className="text-[10px] text-slate-500">적중 {s.hitRate}%</p>
                    <p className="text-[10px] text-slate-500">{s.wins}승 {s.losses}패 {s.passes}패스</p>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.eliminated && <Pill tone="bad"><Skull size={10} /> ELIMINATED</Pill>}
                  {isMeeting && <Pill tone="gold"><Users size={10} /> MEETING</Pill>}
                  {s.streak >= 3 && <Pill tone="good">{s.streak}연승</Pill>}
                  {s.streak <= -3 && <Pill tone="warn">{-s.streak}연패</Pill>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <Card title={`보관된 AI (${archived.length})`}>
          <div className="space-y-1.5">
            {archived.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#0c1220] px-3 py-2 ring-1 ring-white/[0.04]">
                <span className="text-xs font-semibold text-slate-500">{p.name} · {p.role}</span>
                <button onClick={() => { setDetailId(p.id); }} className="rounded-lg bg-white/5 p-1.5 text-slate-400 active:scale-95" aria-label="편집">
                  <Pencil size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 상세 시트 */}
      <Sheet open={!!detail && !editorOpen} onClose={() => setDetailId(null)} title={detail?.name ?? ''}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#ffd97a]">{detail.role}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail.personality}</p>
                <p className="mt-1 text-[11px] text-slate-500">말투: {detail.speechStyle} · {detail.analysisStyle}</p>
              </div>
              <Radar values={aiStatValues(detail)} size={120} color={aiColor(aiProfiles.indexOf(detail))} />
            </div>
            {detailState && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="가상 자산" value={`$${detailState.bankroll}`} tone={detailState.eliminated ? 'bad' : 'gold'} sub={detailState.eliminated ? 'ELIMINATED' : `P/L ${detailState.pl > 0 ? '+' : ''}${detailState.pl}`} />
                  <Stat label="적중률" value={fmtPct(detailState.hitRate)} sub={`${detailState.hits}/${detailState.bets}`} />
                  <Stat label="승/패/패스" value={`${detailState.wins}/${detailState.losses}/${detailState.passes}`} />
                </div>
                <div className="rounded-xl bg-[#0c1220] p-3 ring-1 ring-white/[0.06]">
                  <p className="mb-2 text-[11px] font-bold text-slate-400">Dynamic State (서사용, 실제 확률과 무관)</p>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="w-14 text-[10px] text-slate-500">확신도</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-[#f0c04a]" style={{ width: `${detailState.dyn.confidence}%` }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold text-[#ffd97a]">{detailState.dyn.confidence}</span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-slate-400">
                    <span>연속: <b className={detailState.streak >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{detailState.streak}</b></span>
                    <span>최근5 P/L: <b className="text-slate-200">{detailState.dyn.recentPerformance}</b></span>
                    <span>사용자 일치: <b className="text-slate-200">{Math.round(detailState.dyn.recentAgreement * 100)}%</b></span>
                  </div>
                </div>
              </>
            )}
            {detailCareer && (
              <div className="rounded-xl bg-[#0c1220] p-3 ring-1 ring-white/[0.06]">
                <p className="mb-2 text-[11px] font-bold text-slate-400">Career (프로젝트 누적 · 자산은 매일 리셋)</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
                  <span>참여 세션: <b className="text-slate-200">{detailCareer.sessions}일</b></span>
                  <span>총 라운드: <b className="text-slate-200">{detailCareer.totalRounds}</b></span>
                  <span>승/패/패스: <b className="text-slate-200">{detailCareer.wins}/{detailCareer.losses}/{detailCareer.passes}</b></span>
                  <span>예측 적중: <b className="text-slate-200">{detailCareer.predictionHits}회</b></span>
                  <span>가상 베팅: <b className="text-slate-200">{detailCareer.virtualBetCount}회</b></span>
                  <span>탈락: <b className={detailCareer.eliminationCount > 0 ? 'text-rose-400' : 'text-slate-200'}>{detailCareer.eliminationCount}회</b></span>
                  <span className="col-span-2">누적 손익: <Money value={detailCareer.careerPL} currency={settings.currency} decimals={settings.decimals} signed /></span>
                </div>
              </div>
            )}
            <Btn variant="primary" className="w-full" onClick={() => setEditorOpen(true)}>
              <Pencil size={15} /> 프로필 수정
            </Btn>
          </div>
        )}
      </Sheet>

      {/* 편집 시트 */}
      <Sheet open={editorOpen && !!detail} onClose={() => setEditorOpen(false)} title={`${detail?.name ?? ''} 수정`}>
        {detail && (
          <AIEditor
            profile={detail}
            onClose={() => setEditorOpen(false)}
            onSave={(p) => app.upsertAI(p)}
          />
        )}
      </Sheet>
    </div>
  );
}
