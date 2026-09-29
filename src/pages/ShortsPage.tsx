import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Empty } from '../components/ui';
import { extractHighlights } from '../services/promptService';
import { rankAI } from '../utils/statistics';
import { aiColor } from '../components/charts';
import { optionLabel } from '../data/games';
import { fmtSigned } from '../utils/format';
import { Clapperboard, Lock, Skull } from 'lucide-react';

const SLIDE_BG = [
  'linear-gradient(160deg,#1a2a4a 0%,#0b0f17 70%)',
  'linear-gradient(160deg,#2a1f3f 0%,#0b0f17 70%)',
  'linear-gradient(160deg,#0f3a33 0%,#0b0f17 70%)',
  'linear-gradient(160deg,#3f2a12 0%,#0b0f17 70%)',
  'linear-gradient(160deg,#3f122a 0%,#0b0f17 70%)',
  'linear-gradient(160deg,#12303f 0%,#0b0f17 70%)',
];

export default function ShortsPage() {
  const app = useApp();
  const { project, session, game, rounds, aiProfiles, aiStates, reviews, settings, userStats } = app;
  const [cur, setCur] = useState(0);

  const analysis = useMemo(
    () => reviews
      .filter((r) => r.kind === 'DAILY_ANALYSIS' && r.sessionId === session?.id)
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
    [reviews, session?.id],
  );
  const highlights = useMemo(() => (analysis ? extractHighlights(analysis.rawText) : null), [analysis]);
  const summaryLines = useMemo(
    () => (analysis ? (analysis.parsedSummary || analysis.rawText).split('\n').filter(Boolean).slice(0, 6) : []),
    [analysis],
  );

  if (!project || !session || !game || !userStats) {
    return <Empty icon={<Clapperboard size={28} />} title="세션이 없습니다" desc="게임을 시작하고 기록을 쌓은 뒤 Shorts를 만드세요." action={<Btn variant="gold" onClick={() => app.setTab('game')}>게임 시작</Btn>} />;
  }
  if (!analysis) {
    return (
      <Empty
        icon={<Lock size={28} />}
        title="Shorts가 잠겨 있습니다"
        desc="Review 페이지에서 외부 AI 데일리 분석을 저장하면 9:16 Shorts Studio가 열립니다."
        action={<Btn variant="gold" onClick={() => app.setTab('review')}>Review로 이동</Btn>}
      />
    );
  }

  const bc = settings.broadcast;
  const moneyOrHide = (v: number) => (bc.showBalance ? `$${v}` : '비공개');
  const nameOf = (id: string) => {
    const p = aiProfiles.find((x) => x.id === id);
    if (!p) return 'AI';
    return bc.showAINames ? p.name : `AI ${String(aiProfiles.indexOf(p) + 1).padStart(2, '0')}`;
  };
  const ranked = rankAI(aiStates, 'pl');
  const ended = session.status === 'ENDED';
  const finalBalance = ended ? (session.endBalance ?? userStats.currentBalance) : userStats.currentBalance;
  const lastRound = rounds.length ? rounds.reduce((m, r) => (r.roundNumber > m.roundNumber ? r : m), rounds[0]!) : null;

  const foot = (
    <p className="mt-auto pt-4 text-center text-[9px] font-bold tracking-[0.25em] text-white/30">
      CASINO SURVIVAL DIARY · {session.date}
    </p>
  );

  const screens = [
    // 1. 오늘의 게임
    <div key="s1" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">TODAY'S GAME</p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-white">{game.name}</h2>
      <div className="mt-6 space-y-2.5 text-[15px] font-semibold text-slate-200">
        <p className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/50">날짜</span>{session.date}</p>
        <p className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/50">카지노</span>{session.casino}</p>
        <p className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/50">테이블</span>{session.table}</p>
        <p className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/50">오늘 시작 자금</span>{moneyOrHide(session.startBalance)}</p>
        <p className="flex justify-between"><span className="text-white/50">라운드</span>{rounds.length}R</p>
      </div>
      {lastRound && (
        <p className="mt-6 rounded-2xl bg-white/5 px-4 py-3 text-center text-sm font-bold text-white">
          최근 결과 <span className="text-[#ffd97a]">{optionLabel(game, lastRound.actualResult)}</span>
        </p>
      )}
      {foot}
    </div>,
    // 2. 오늘의 결과
    <div key="s2" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">TODAY'S RESULT</p>
      <p className="mt-6 text-center text-[11px] font-bold text-white/50">{ended ? '최종 P/L' : '현재 P/L (진행 중)'}</p>
      <p className={`mt-1 text-center text-5xl font-black tabular-nums ${userStats.todayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {bc.showBalance ? fmtSigned(userStats.todayPL, settings.currency, settings.decimals) : '비공개'}
      </p>
      <div className="mt-8 space-y-2.5 text-[15px] font-semibold text-slate-200">
        <p className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/50">시작</span>{moneyOrHide(session.startBalance)}</p>
        <p className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/50">{ended ? '종료' : '현재'}</span>{moneyOrHide(finalBalance)}</p>
        <p className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/50">수익률</span>{userStats.dailyReturn}%</p>
        <p className="flex justify-between"><span className="text-white/50">라운드</span>{rounds.length}R · 베팅 {bc.showBetAmount ? userStats.actualBetCount : '비공개'}</p>
      </div>
      {foot}
    </div>,
    // 3. AI Ranking
    <div key="s3" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">AI RANKING</p>
      {bc.showRanking ? (
        <>
          <div className="mt-5 space-y-2">
            {ranked.slice(0, 5).map((s, i) => (
              <div key={s.aiId} className="flex items-center gap-2.5 rounded-2xl bg-white/5 px-3.5 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-[#0b0f17]" style={{ background: aiColor(aiProfiles.findIndex((p) => p.id === s.aiId)) }}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{nameOf(s.aiId)}{s.eliminated && <Skull size={11} className="ml-1 inline text-rose-400" />}</span>
                <span className="text-right">
                  <span className="block text-[12px] font-black tabular-nums text-white">{bc.showBalance ? `$${s.bankroll}` : ''}</span>
                  <span className={`block text-[10px] font-bold tabular-nums ${s.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{bc.showBalance ? `${s.pl > 0 ? '+' : ''}${s.pl}` : '비공개'}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] font-semibold text-white/40">
            탈락 {ranked.filter((s) => s.eliminated).length}명 · 전체 {aiStates.length}명 가상 플레이
          </p>
        </>
      ) : (
        <p className="mt-10 text-center text-sm font-bold text-white/60">랭킹 비공개 설정</p>
      )}
      {foot}
    </div>,
    // 4. AI Flow
    <div key="s4" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">AI FLOW</p>
      <div className="mt-4 space-y-3 overflow-hidden">
        {highlights && highlights.good.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-black text-emerald-400">좋은 흐름</p>
            {highlights.good.slice(0, 2).map((l, i) => <p key={i} className="mb-1 rounded-xl bg-emerald-500/10 px-3 py-2 text-[10.5px] font-semibold leading-relaxed text-emerald-100">{l}</p>)}
          </div>
        )}
        {highlights && highlights.bad.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-black text-rose-400">부진 흐름</p>
            {highlights.bad.slice(0, 2).map((l, i) => <p key={i} className="mb-1 rounded-xl bg-rose-500/10 px-3 py-2 text-[10.5px] font-semibold leading-relaxed text-rose-100">{l}</p>)}
          </div>
        )}
        {highlights && highlights.notes.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-black text-amber-300">특이사항</p>
            {highlights.notes.slice(0, 2).map((l, i) => <p key={i} className="mb-1 rounded-xl bg-amber-500/10 px-3 py-2 text-[10.5px] font-semibold leading-relaxed text-amber-100">{l}</p>)}
          </div>
        )}
        {highlights && !highlights.good.length && !highlights.bad.length && !highlights.notes.length && (
          <p className="mt-8 text-center text-[11px] font-semibold text-white/50">저장된 분석 원문에서 흐름 키워드를 찾지 못했습니다.<br />원문은 다음 화면에서 확인하세요.</p>
        )}
      </div>
      {foot}
    </div>,
    // 5. Daily AI Review
    <div key="s5" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">DAILY AI REVIEW</p>
      <div className="mt-4 space-y-2 overflow-hidden">
        {summaryLines.map((l, i) => (
          <p key={i} className="rounded-xl bg-white/5 px-3.5 py-2.5 text-[10.5px] font-semibold leading-relaxed text-slate-100">{l}</p>
        ))}
      </div>
      <p className="mt-3 text-center text-[9px] font-semibold text-white/35">출처: 외부 AI 분석 (원문은 앱에 보존)</p>
      {foot}
    </div>,
    // 6. Day Complete
    <div key="s6" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">DAY COMPLETE</p>
      <div className="mt-5 rounded-2xl bg-white/5 p-4">
        <p className="text-[10px] font-bold text-white/50">USER</p>
        <p className={`mt-1 text-3xl font-black tabular-nums ${userStats.todayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {bc.showBalance ? fmtSigned(userStats.todayPL, settings.currency, settings.decimals) : '비공개'}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-white/60">{rounds.length}R · 예측 적중 {userStats.predictionHitRate}% · 베팅 승률 {userStats.actualBetWinRate}%</p>
      </div>
      <div className="mt-3 space-y-1.5">
        {ranked.slice(0, 3).map((s, i) => (
          <div key={s.aiId} className="flex items-center justify-between rounded-xl bg-white/5 px-3.5 py-2 text-[12px] font-bold text-white">
            <span>{i + 1}. {nameOf(s.aiId)}</span>
            <span className={s.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{bc.showBalance ? `${s.pl > 0 ? '+' : ''}${s.pl}` : '비공개'}</span>
          </div>
        ))}
      </div>
      {summaryLines[0] && (
        <p className="mt-4 rounded-2xl border border-[#f0c04a]/30 bg-[#f0c04a]/10 px-4 py-3 text-[11px] font-bold leading-relaxed text-[#ffe6a3]">
          오늘의 핵심: {summaryLines[0]}
        </p>
      )}
      {foot}
    </div>,
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-slate-100">Shorts Studio</h1>
        <span className="text-[11px] font-bold text-slate-500">{cur + 1} / 6 · 세로 9:16 캡처용</span>
      </div>

      <div className="shorts-stage">
        {screens.map((node, i) => (
          <div
            key={i}
            className="slide"
            style={{
              background: SLIDE_BG[i],
              transform: `translateY(${(i - cur) * 100}%)`,
              visibility: Math.abs(i - cur) > 1 ? 'hidden' : 'visible',
            }}
          >
            {node}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {screens.map((_, i) => (
          <button key={i} onClick={() => setCur(i)} className={`h-1.5 rounded-full transition-all ${i === cur ? 'w-6 bg-[#f0c04a]' : 'w-1.5 bg-white/15'}`} aria-label={`화면 ${i + 1}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Btn variant="ghost" disabled={cur === 0} onClick={() => setCur((c) => Math.max(0, c - 1))}>이전</Btn>
        <Btn variant="primary" disabled={cur === 5} onClick={() => setCur((c) => Math.min(5, c + 1))}>다음</Btn>
        <Btn
          variant="gold"
          onClick={() => { app.notify('오늘의 Shorts 완료. 각 화면을 캡처해서 사용하세요.'); setCur(0); }}
        >
          완료
        </Btn>
      </div>
    </div>
  );
}
