import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Card, Empty, Field, NumInput, TextArea, TextInput } from '../components/ui';
import { buildShortsReviewData, createDefaultShortsTimeline, extractHighlights, getNextEnabledShortsShotIndex } from '../services/promptService';
import { rankAI } from '../utils/statistics';
import { aiColor } from '../components/charts';
import { optionLabel } from '../data/games';
import { fmtSigned } from '../utils/format';
import { Clapperboard, Copy, Lock, MoveDown, MoveUp, Skull } from 'lucide-react';

const shortsReveal = "motion-safe:animate-[shortsIn_0.45s_ease-out_both]";
const shortsReveal2 = "motion-safe:animate-[shortsIn_0.45s_0.12s_ease-out_both]";
const shortsReveal3 = "motion-safe:animate-[shortsIn_0.45s_0.24s_ease-out_both]";

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
  const [timeline, setTimeline] = useState(() => createDefaultShortsTimeline(30));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [notice, setNotice] = useState('');
  const [captureMode, setCaptureMode] = useState(false);
  const [captureCountdown, setCaptureCountdown] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [previewRemaining, setPreviewRemaining] = useState(0);

  const analysis = useMemo(
    () => reviews
      .filter((r) => r.kind === 'DAILY_ANALYSIS' && r.sessionId === session?.id)
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
    [reviews, session?.id],
  );
  const highlights = useMemo(() => (analysis ? extractHighlights(analysis.rawText) : null), [analysis]);
  const reviewData = useMemo(() => buildShortsReviewData(rounds, analysis), [rounds, analysis]);
  useEffect(() => {
    setTitle(analysis?.shorts?.title ?? '');
    setDescription(analysis?.shorts?.description ?? '');
    setHashtags(analysis?.shorts?.hashtags?.join(' ') ?? '');
  }, [analysis?.id]);

  const updateShot = (index: number, patch: Partial<(typeof timeline.shots)[number]>) => {
    setTimeline((prev) => {
      const shots = prev.shots.map((shot, i) => i === index ? { ...shot, ...patch } : shot);
      const totalDuration = Math.round(shots.filter((s) => s.enabled).reduce((sum, s) => sum + s.duration, 0) * 10) / 10;
      return { shots, totalDuration };
    });
  };

  const moveShot = (index: number, direction: -1 | 1) => {
    setTimeline((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.shots.length) return prev;
      const shots = [...prev.shots];
      [shots[index], shots[target]] = [shots[target]!, shots[index]!];
      return { ...prev, shots: shots.map((shot, i) => ({ ...shot, order: i })) };
    });
  };

  const equalizeDurations = () => {
    setTimeline((prev) => {
      const enabled = prev.shots.filter((s) => s.enabled);
      if (!enabled.length) return { ...prev, totalDuration: 0 };
      const base = Math.floor((prev.totalDuration / enabled.length) * 10) / 10;
      const remainder = Math.round((prev.totalDuration - base * (enabled.length - 1)) * 10) / 10;
      let n = 0;
      const shots = prev.shots.map((shot) => shot.enabled ? { ...shot, duration: n++ === enabled.length - 1 ? remainder : base } : shot);
      return { shots, totalDuration: prev.totalDuration };
    });
  };

  const copyText = async (label: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(label + ' 복사 완료'); }
    catch { setNotice(label + ' 복사에 실패했습니다'); }
  };
  useEffect(() => {
    if (!previewing) {
      setPreviewRemaining(0);
      return;
    }
    const current = timeline.shots[cur];
    if (!current || !current.enabled) {
      const first = timeline.shots.findIndex((shot) => shot.enabled);
      if (first < 0) {
        setPreviewing(false);
        return;
      }
      setCur(first);
      return;
    }

    setPreviewRemaining(current.duration);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setPreviewRemaining(Math.max(0, Math.round((current.duration - elapsed) * 10) / 10));
    }, 100);

    const timer = window.setTimeout(() => {
      const next = getNextEnabledShortsShotIndex(timeline.shots, cur);
      if (next == null) {
        if (captureMode) {
          void exitCaptureMode();
        } else {
          setPreviewing(false);
          setPreviewRemaining(0);
          setCur(timeline.shots.findIndex((shot) => shot.enabled));
        }
      } else {
        setCur(next);
      }
    }, current.duration * 1000);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timer);
    };
  }, [previewing, cur, timeline.shots, captureMode]);

  const enterCaptureMode = async () => {
    const first = timeline.shots.findIndex((shot) => shot.enabled);
    if (first < 0) {
      setNotice('재생할 화면이 없습니다');
      return;
    }
    setPreviewing(false);
    setCur(first);
    setCaptureCountdown(3);
    setCaptureMode(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen permission may be unavailable; the capture layout still works.
    }
  };

  const exitCaptureMode = async () => {
    setCaptureMode(false);
    setCaptureCountdown(0);
    setPreviewing(false);
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    if (!captureMode || captureCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCaptureCountdown((value) => value - 1);
      if (captureCountdown === 1) setPreviewing(true);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [captureMode, captureCountdown]);

  useEffect(() => {
    if (!captureMode) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setCaptureMode(false);
        setCaptureCountdown(0);
        setPreviewing(false);
        setPreviewRemaining(0);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [captureMode]);

  const startPreview = () => {
    const first = timeline.shots.findIndex((shot) => shot.enabled);
    if (first < 0) {
      setNotice('재생할 화면이 없습니다');
      return;
    }
    setCur(first);
    setPreviewing(true);
  };

  const stopPreview = () => {
    setPreviewing(false);
    setPreviewRemaining(0);
  };


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
      <h2 className={`mt-3 text-4xl font-black leading-tight text-white ${shortsReveal}`}>{game.name}</h2>
       <div className={`mt-3 rounded-2xl border border-[#ffd97a]/20 ${shortsReveal2}` bg-[#ffd97a]/10 px-4 py-3 text-center"><p className="text-[9px] font-black tracking-[0.2em] text-[#ffd97a]/70">TODAY'S TABLE</p><p className="mt-1 text-xl font-black text-white">{rounds.length} ROUNDS</p></div>
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
      <p className="mt-6 text-center text-[10px] font-black tracking-[0.22em] text-white/40">{ended ? '최종 P/L' : '현재 P/L (진행 중)'}</p>
      <p className={`mt-2 text-center text-6xl font-black ${shortsReveal2} tabular-nums ${userStats.todayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {bc.showBalance ? fmtSigned(userStats.todayPL, settings.currency, settings.decimals) : '비공개'}
      </p>
      <div className={`mt-7 grid grid-cols-2 gap-2.5 text-center ${shortsReveal3}`}>
        <div className="rounded-2xl bg-white/5 px-3 py-4"><p className="text-[9px] font-black text-white/40">START</p><p className="mt-1 text-lg font-black text-white">{moneyOrHide(session.startBalance)}</p></div>
        <div className="rounded-2xl bg-white/5 px-3 py-4"><p className="text-[9px] font-black text-white/40">{ended ? 'FINAL' : 'NOW'}</p><p className="mt-1 text-lg font-black text-white">{moneyOrHide(finalBalance)}</p></div>
        <div className="col-span-2 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"><span className="text-[10px] font-black text-white/40">RETURN</span><span className="text-lg font-black text-white">{userStats.dailyReturn}%</span></div>
      </div>
      {foot}
    </div>,
    // 3. AI Ranking
    <div key="s3" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">AI RANKING</p>
      {bc.showRanking ? (
        <>
          <div className="mt-6 space-y-2.5">
            {ranked.slice(0, 5).map((s, i) => (
              <div key={s.aiId} className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 ring-1 ring-white/[0.05] ${i === 0 ? 'bg-[#ffd97a]/10 ring-[#ffd97a]/25' : 'bg-white/5'}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black text-[#0b0f17] ${i === 0 ? 'scale-110' : ''}`} style={{ background: aiColor(aiProfiles.findIndex((p) => p.id === s.aiId)) }}>{i + 1}</span>
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
      <p className={`mt-2 text-xl font-black text-white ${shortsReveal}`}>오늘 AI가 본 흐름</p>
      <div className={`mt-5 space-y-3 overflow-hidden ${shortsReveal2}`}>
        {highlights && highlights.good.length > 0 && (
          <div className="rounded-2xl bg-emerald-500/10 p-3">
            <p className="mb-2 text-[10px] font-black tracking-[0.18em] text-emerald-400">01 · GOOD FLOW</p>
            <p className="text-[11px] font-semibold leading-relaxed text-emerald-100">{highlights.good[0]}</p>
            {highlights.good[1] && <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-emerald-100/70">{highlights.good[1]}</p>}
          </div>
        )}
        {highlights && highlights.bad.length > 0 && (
          <div className="rounded-2xl bg-rose-500/10 p-3">
            <p className="mb-2 text-[10px] font-black tracking-[0.18em] text-rose-400">02 · RISK FLOW</p>
            <p className="text-[11px] font-semibold leading-relaxed text-rose-100">{highlights.bad[0]}</p>
            {highlights.bad[1] && <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-rose-100/70">{highlights.bad[1]}</p>}
          </div>
        )}
        {highlights && highlights.notes.length > 0 && (
          <div className="rounded-2xl bg-amber-500/10 p-3">
            <p className="mb-2 text-[10px] font-black tracking-[0.18em] text-amber-300">03 · KEY NOTE</p>
            <p className="text-[11px] font-semibold leading-relaxed text-amber-100">{highlights.notes[0]}</p>
            {highlights.notes[1] && <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-amber-100/70">{highlights.notes[1]}</p>}
          </div>
        )}
        {highlights && !highlights.good.length && !highlights.bad.length && !highlights.notes.length && (
          <div className="mt-8 rounded-2xl bg-white/5 p-4 text-center">
            <p className="text-sm font-black text-white">분석 흐름 없음</p>
            <p className="mt-1 text-[10px] font-semibold text-white/45">저장된 AI 분석에서 핵심 흐름을 찾지 못했습니다.</p>
          </div>
        )}
      </div>
      {foot}
    </div>,
    // 5. Daily AI Review
    <div key="s5" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">DAILY AI REVIEW</p>
      <p className={`mt-2 text-xl font-black text-white ${shortsReveal}`}>오늘의 기록과 복기</p>
      <div className={`mt-4 rounded-2xl bg-white/5 p-4 ${shortsReveal2}`}>
        <p className="text-[9px] font-black tracking-[0.18em] text-white/40">TODAY'S P/L</p>
        <p className={`mt-1 text-5xl font-black tabular-nums ${userStats.todayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {bc.showBalance ? fmtSigned(userStats.todayPL, settings.currency, settings.decimals) : '비공개'}
        </p>
        <p className="mt-1 text-[10px] font-semibold text-white/45">{rounds.length}R · {ended ? '세션 종료' : '세션 진행 중'}</p>
      </div>
      {reviewData.keyRound ? (
        <div className={`mt-3 rounded-2xl border border-[#ffd97a]/20 ${shortsReveal2}` bg-[#ffd97a]/5 p-3.5">
          <p className="text-[9px] font-black tracking-[0.18em] text-[#ffd97a]">KEY MOMENT · R{reviewData.keyRound.roundNumber}</p>
          <p className="mt-2 text-xl font-black text-white">{optionLabel(game, reviewData.keyRound.actualResult)}</p>
          {reviewData.keyRound.actualProfitLoss != null && (
            <p className={`mt-1 text-2xl font-black tabular-nums ${reviewData.keyRound.actualProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {bc.showBalance ? fmtSigned(reviewData.keyRound.actualProfitLoss, settings.currency, settings.decimals) : '비공개'}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/5 p-4 text-center text-[11px] font-semibold text-white/45">기록된 라운드가 없습니다.</p>
      )}
      <div className={`mt-3 space-y-1.5 overflow-hidden ${shortsReveal3}`}>
        {reviewData.summaryLines.length ? reviewData.summaryLines.map((l, i) => (
          <p key={i} className={`rounded-xl px-3 py-2 text-[10px] font-semibold leading-relaxed ${i === 0 ? 'bg-[#ffd97a]/10 text-[#ffe6a3]' : 'bg-white/5 text-slate-200'}`}>{l}</p>
        )) : (
          <p className="text-center text-[10px] font-semibold text-white/40">외부 AI 복기 요약이 없습니다.</p>
        )}
      </div>
      <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-center text-[9px] font-black tracking-wide text-white/45">AI ANALYSIS × REAL SESSION</p>
      {foot}
    </div>,
    // 6. Day Complete
    <div key="s6" className="flex h-full flex-col">
      <p className="text-[10px] font-black tracking-[0.3em] text-[#ffd97a]/80">DAY COMPLETE</p>
      <p className={`mt-2 text-2xl font-black text-white ${shortsReveal}`}>오늘의 생존 기록</p>
      <div className={`mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-center ${shortsReveal2}`}>
        <p className="text-[9px] font-black tracking-[0.2em] text-white/40">TODAY'S RESULT</p>
        <p className={`mt-2 text-5xl font-black tabular-nums ${userStats.todayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {bc.showBalance ? fmtSigned(userStats.todayPL, settings.currency, settings.decimals) : '비공개'}
        </p>
        <p className="mt-2 text-[11px] font-bold text-white/50">{rounds.length} ROUNDS</p>
      </div>
      {bc.showRanking && ranked[0] && (
        <div className="mt-3 rounded-2xl bg-[#ffd97a]/10 p-4">
          <p className="text-[9px] font-black tracking-[0.18em] text-[#ffd97a]/70">AI TOP 1</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-lg font-black text-white">{nameOf(ranked[0].aiId)}</span>
            <span className={`text-lg font-black tabular-nums ${ranked[0].pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{bc.showBalance ? `${ranked[0].pl > 0 ? '+' : ''}${ranked[0].pl}` : '비공개'}</span>
          </div>
        </div>
      )}
      {reviewData.summaryLines[0] && (
        <p className="mt-3 rounded-2xl border border-[#f0c04a]/30 bg-[#f0c04a]/10 px-4 py-3 text-[11px] font-bold leading-relaxed text-[#ffe6a3]">
          핵심 한 줄 · {reviewData.summaryLines[0]}
        </p>
      )}
      <p className={`mt-auto pt-5 text-center text-[10px] ${shortsReveal3} font-black tracking-[0.12em] text-white/35">오늘의 기록은 저장되었습니다</p>
      {foot}
    </div>,
  ];

  const shots = screens.map((node, index) => ({ ...timeline.shots[index]!, node }));

  return (
    <div className="space-y-4">
      <style>{`@keyframes shortsIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-slate-100">Shorts Studio</h1>
        <span className="text-[11px] font-bold text-slate-500">{cur + 1} / {shots.length} · {timeline.totalDuration}초 · 세로 9:16</span>
      </div>

      <Card title="쇼츠 화면 구성" right={<span className="text-[11px] font-bold text-[#ffd97a]">{timeline.totalDuration}초</span>}>
        <div className="space-y-2">
          {timeline.shots.map((shot, i) => (
            <div key={shot.id} className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.06]">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => updateShot(i, { enabled: !shot.enabled })} disabled={captureMode} className={'h-9 w-11 rounded-lg text-[11px] font-black ' + (shot.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-500')}>{shot.enabled ? 'ON' : 'OFF'}</button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{shot.title}</p>
                  <p className="text-[10px] text-slate-500">{shot.type}</p>
                </div>
                <div className="w-[82px]"><NumInput value={shot.duration} min={0.5} step={0.5} onChange={(v) => updateShot(i, { duration: v ?? 0.5 })} disabled={captureMode} aria-label={shot.title + ' 시간'} /></div>
                <button type="button" disabled={captureMode || i === 0} onClick={() => moveShot(i, -1)} className="rounded-lg p-2 text-slate-400 disabled:opacity-20" aria-label="위로"><MoveUp size={15} /></button>
                <button type="button" disabled={captureMode || i === timeline.shots.length - 1} onClick={() => moveShot(i, 1)} className="rounded-lg p-2 text-slate-400 disabled:opacity-20" aria-label="아래로"><MoveDown size={15} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2"><Btn variant="subtle" className="flex-1" onClick={equalizeDurations} disabled={previewing}>균등 배분</Btn><Btn variant="ghost" className="flex-1" onClick={() => { if (!captureMode) { stopPreview(); setTimeline(createDefaultShortsTimeline(30)); } }}>30초 초기화</Btn></div>
      </Card>

      <Card title="촬영 모드">
        <p className="text-[11px] leading-5 text-slate-400">휴대폰 화면녹화를 먼저 켠 뒤 촬영 모드를 시작하세요. 설정된 Timeline이 자동으로 재생됩니다.</p>
        <Btn variant="gold" className="mt-3 w-full" onClick={enterCaptureMode} disabled={captureMode}>🎬 세로 촬영 모드 시작</Btn>
      </Card>

      <Card title="업로드 정보">
        <div className="space-y-3">
          <Field label="쇼츠 제목"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AI가 생성한 쇼츠 제목" /></Field>
          <Btn variant="ghost" className="w-full" onClick={() => copyText('제목', title)} disabled={!title}><Copy size={15} /> 제목 복사</Btn>
          <Field label="설명"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="AI가 생성한 쇼츠 설명" /></Field>
          <Btn variant="ghost" className="w-full" onClick={() => copyText('설명', description)} disabled={!description}><Copy size={15} /> 설명 복사</Btn>
          <Field label="해시태그" hint="AI 추천 해시태그를 자유롭게 수정할 수 있습니다."><TextInput value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#카지노 #카지노생존일지" /></Field>
          <Btn variant="ghost" className="w-full" onClick={() => copyText('해시태그', hashtags)} disabled={!hashtags}><Copy size={15} /> 해시태그 복사</Btn>
          {notice && <p className="text-center text-[11px] font-bold text-emerald-300">{notice}</p>}
        </div>
      </Card>

      <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
        <div>
          <p className="text-xs font-black text-white">{previewing ? '▶ 자동 미리보기' : '미리보기 준비'}</p>
          <p className="text-[10px] text-slate-500">{previewing ? `${previewRemaining.toFixed(1)}초 후 다음 화면` : '설정한 시간대로 실제 촬영 순서를 미리 확인합니다.'}</p>
        </div>
        <Btn variant={previewing ? 'ghost' : 'gold'} onClick={previewing ? stopPreview : startPreview}>
          {previewing ? '미리보기 중지' : '▶ 미리보기'}
        </Btn>
      </div>

      <div className="shorts-stage">
        {shots.map(({ node }, i) => (
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
        {shots.map((_, i) => (
          <button key={i} onClick={() => setCur(i)} className={`h-1.5 rounded-full transition-all ${i === cur ? 'w-6 bg-[#f0c04a]' : 'w-1.5 bg-white/15'}`} aria-label={`화면 ${i + 1}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Btn variant="ghost" disabled={cur === 0} onClick={() => setCur((c) => Math.max(0, c - 1))}>이전</Btn>
        <Btn variant="primary" disabled={cur === shots.length - 1} onClick={() => setCur((c) => Math.min(shots.length - 1, c + 1))}>다음</Btn>
        <Btn
          variant="gold"
          onClick={() => { app.notify('오늘의 Shorts 완료. 각 화면을 캡처해서 사용하세요.'); setCur(0); }}
        >
          완료
        </Btn>
      </div>
    </div>
      {captureMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
          <div className="relative aspect-[9/16] h-full max-h-screen w-full max-w-[56.25vh] overflow-hidden bg-[#0b0f17]">
            {captureCountdown > 0 ? (
              <div className="flex h-full flex-col items-center justify-center bg-black px-8 text-center">
                <p className="text-xs font-black tracking-[0.25em] text-[#ffd97a]/80">SHORTS CAPTURE READY</p>
                <p className="mt-3 text-[11px] font-semibold leading-5 text-white/45">잠시 후 자동 재생됩니다.<br />화면녹화가 켜져 있는지 확인하세요.</p>
                <strong className="mt-3 text-8xl font-black text-white">{captureCountdown}</strong>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between px-4 py-3 text-[10px] font-black text-white/60">
                  <span className="rounded-full bg-white/10 px-2 py-1">{cur + 1} / {shots.length}</span>
                  <span className="rounded-full bg-[#ffd97a]/15 px-2 py-1 text-[#ffd97a]">{previewRemaining.toFixed(1)}s</span>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  {shots[cur]?.node}
                </div>
                <button type="button" onClick={exitCaptureMode} className="m-4 rounded-xl bg-white/10 py-3 text-xs font-black text-white/70">촬영 종료</button>
              </div>
            )}
          </div>
        </div>
      )}

  );
}
