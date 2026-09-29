import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Card, Empty, Pill } from '../components/ui';
import { generateSpeech } from '../services/aiService';
import { rankAI, computeDynamicState } from '../utils/statistics';
import { optionLabel } from '../data/games';
import { aiColor } from '../components/charts';
import type { AIProfile, AIRoundRecord } from '../types';
import { Mic2, Pause, Skull, Users } from 'lucide-react';

type CharState = 'IDLE' | 'WORKING' | 'MEETING' | 'WALKING' | 'PAUSED' | 'ELIMINATED';

function Character({ profile, state, speaking, bubble, showName, color, onClick }: {
  profile: AIProfile;
  state: CharState;
  speaking: boolean;
  bubble: string | null;
  showName: boolean;
  color: string;
  onClick: () => void;
}) {
  const eliminated = state === 'ELIMINATED';
  return (
    <button type="button" onClick={onClick} className={`char ${speaking ? 'speaking' : ''}`} aria-label={profile.name}>
      {speaking && bubble && <span className="speech-bubble">{bubble}</span>}
      <span className={`char-body state-${state.toLowerCase()}`} style={{ ['--hair' as string]: eliminated ? '#3a4254' : color }}>
        <span className="char-head">
          <span className="char-eyes">{eliminated ? '× ×' : '• •'}</span>
        </span>
        <span className="char-torso" />
      </span>
      <span className="char-desk" />
      <span className="char-name">{showName ? profile.name.split(' ').slice(-1)[0] : 'AI'}{eliminated && <Skull size={9} className="ml-0.5 inline text-rose-400" />}</span>
    </button>
  );
}

export default function MeetingPage() {
  const app = useApp();
  const { project, session, settings, aiProfiles, aiStates, aiRecords, rounds, game, reviews } = app;
  const participants = useMemo(
    () => settings.meeting.participants
      .map((id) => aiProfiles.find((p) => p.id === id))
      .filter((p): p is AIProfile => !!p && p.active)
      .slice(0, 4),
    [settings.meeting.participants, aiProfiles],
  );
  const others = useMemo(
    () => aiProfiles.filter((p) => p.active && !participants.some((x) => x.id === p.id)),
    [aiProfiles, participants],
  );
  const [speech, setSpeech] = useState<{ aiId: string; text: string } | null>(null);
  const [walkIdx, setWalkIdx] = useState(0);
  const turnRef = useRef(0);

  const latestDailyAnalysis = useMemo(
    () => reviews.find((r) => r.kind === 'DAILY_ANALYSIS')?.rawText ?? '',
    [reviews],
  );
  const rankedByPL = useMemo(() => rankAI(aiStates, 'pl'), [aiStates]);
  const lastRound = rounds.length ? rounds.reduce((m, r) => (r.roundNumber > m.roundNumber ? r : m), rounds[0]!) : null;
  const lastResultLabel = game && lastRound ? optionLabel(game, lastRound.actualResult) : undefined;

  const myRecords = (aiId: string): AIRoundRecord[] =>
    aiRecords.filter((r) => r.aiId === aiId).sort((a, b) => a.roundNumber - b.roundNumber);

  const speak = (p: AIProfile) => {
    const mine = myRecords(p.id);
    const dyn = computeDynamicState(mine);
    const last = [...mine].reverse().find((r) => r.selection != null) ?? null;
    const rank = rankedByPL.findIndex((s) => s.aiId === p.id) + 1;
    setSpeech({
      aiId: p.id,
      text: generateSpeech(p, dyn, {
        resultLabel: lastResultLabel,
        lastPL: last ? last.resultPL : null,
        rank: rank || undefined,
        externalAnalysis: latestDailyAnalysis,
      }),
    });
  };

  // 참여자 순회 발화 (대화 속도 설정 반영)
  useEffect(() => {
    if (!settings.meeting.showBubbles || participants.length === 0 || !session) return;
    const t = window.setInterval(() => {
      const p = participants[turnRef.current % participants.length]!;
      turnRef.current += 1;
      const st = aiStates.find((s) => s.aiId === p.id);
      if (st?.eliminated) return;
      speak(p);
    }, Math.max(2, settings.meeting.speed) * 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.meeting.showBubbles, settings.meeting.speed, participants.map((p) => p.id).join(','), aiRecords.length, session?.status, latestDailyAnalysis]);

  // 비참여자 중 한 명이 오피스를 걸어다님
  useEffect(() => {
    if (!settings.meeting.animation || others.length === 0) return;
    const t = window.setInterval(() => setWalkIdx((i) => (i + 1) % Math.max(1, others.length)), 5000);
    return () => window.clearInterval(t);
  }, [settings.meeting.animation, others.length]);

  if (!project) {
    return <Empty icon={<Users size={28} />} title="프로젝트가 없습니다" desc="홈에서 프로젝트를 먼저 만들어주세요." action={<Btn variant="gold" onClick={() => app.setTab('home')}>홈으로</Btn>} />;
  }

  const stateOf = (p: AIProfile, isParticipant: boolean, isWalker: boolean): CharState => {
    const st = aiStates.find((s) => s.aiId === p.id);
    if (st?.eliminated) return 'ELIMINATED';
    if (session?.status === 'PAUSED') return 'PAUSED';
    if (isParticipant) return 'MEETING';
    if (settings.meeting.animation && isWalker) return 'WALKING';
    return st && st.bets > 0 ? 'WORKING' : 'IDLE';
  };

  const toggleParticipant = (p: AIProfile) => {
    const cur = settings.meeting.participants;
    if (cur.includes(p.id)) {
      void app.setMeetingParticipants(cur.filter((x) => x !== p.id));
    } else {
      if (cur.length >= 4) {
        app.notify('미팅 참여는 최대 4명까지입니다. 먼저 한 명을 해제하세요.');
        return;
      }
      void app.setMeetingParticipants([...cur, p.id]);
    }
  };

  const speaker = speech ? aiProfiles.find((p) => p.id === speech.aiId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-slate-100">Meeting Room</h1>
        <Pill tone="gold"><Users size={12} /> 참여 {participants.length}/4 · 전체 AI {aiProfiles.filter((p) => p.active).length}명 근무 중</Pill>
      </div>

      {!session ? (
        <Empty icon={<Users size={28} />} title="세션이 없습니다" desc="게임을 시작하면 오피스가 활성화됩니다." action={<Btn variant="gold" onClick={() => app.setTab('game')}>게임 시작</Btn>} />
      ) : (
        <>
          <div className={`office ${settings.meeting.animation ? '' : 'no-anim'}`}>
            <div className="office-lights" />
            {/* 앞쪽: 미팅 참여자 테이블 */}
            <div className="office-front">
              <div className="meeting-table">
                {participants.map((p) => (
                  <Character
                    key={p.id}
                    profile={p}
                    color={aiColor(aiProfiles.indexOf(p))}
                    state={stateOf(p, true, false)}
                    speaking={settings.meeting.showBubbles && speech?.aiId === p.id}
                    bubble={settings.meeting.showBubbles && speech?.aiId === p.id ? speech.text : null}
                    showName={settings.broadcast.showAINames}
                    onClick={() => speak(p)}
                  />
                ))}
                {participants.length === 0 && <p className="py-4 text-xs text-slate-600">아래에서 미팅 참여 AI를 선택하세요 (최대 4명)</p>}
              </div>
            </div>
            {/* 뒤쪽: 나머지 AI 좌석 (데이터 기반 자동 배치) */}
            <div className="office-grid" style={{ gridTemplateColumns: `repeat(${Math.min(6, Math.max(3, Math.ceil(Math.sqrt(others.length + participants.length))))}, 1fr)` }}>
              {others.map((p, i) => (
                <Character
                  key={p.id}
                  profile={p}
                  color={aiColor(aiProfiles.indexOf(p))}
                  state={stateOf(p, false, i === walkIdx)}
                  speaking={settings.meeting.showBubbles && speech?.aiId === p.id}
                  bubble={settings.meeting.showBubbles && speech?.aiId === p.id ? speech.text : null}
                  showName={settings.broadcast.showAINames}
                  onClick={() => speak(p)}
                />
              ))}
            </div>
          </div>

          {/* 현재 발언자 정보 */}
          {speaker && (
            <Card className="ring-[#f0c04a]/25">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: aiColor(aiProfiles.indexOf(speaker)) }}>
                  <Mic2 size={17} className="text-[#0b0f17]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-100">{settings.broadcast.showAINames ? speaker.name : 'AI'}</p>
                  <p className="text-[10px] text-slate-500">{speaker.role} · {speaker.speechStyle}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{speech?.text}</p>
                </div>
              </div>
            </Card>
          )}

          {session.status === 'PAUSED' && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/20">
              <Pause size={14} /> 세션 일시정지 중 — 전원 대기 상태입니다
            </p>
          )}

          {/* 참여자 선택 */}
          <Card title="미팅 참여 선택 (최대 4명 · 앞 좌석 배치)">
            <div className="flex flex-wrap gap-1.5">
              {aiProfiles.filter((p) => p.active).map((p) => {
                const on = settings.meeting.participants.includes(p.id);
                const idx = aiProfiles.indexOf(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleParticipant(p)}
                    className={`rounded-full px-3 py-2 text-[11px] font-bold ring-1 transition active:scale-95 ${on ? 'bg-[#f0c04a]/20 text-[#ffd97a] ring-[#f0c04a]/40' : 'bg-[#0c1220] text-slate-400 ring-white/10'}`}
                  >
                    <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: aiColor(idx) }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
              미팅에 참여하지 않는 AI도 가상 플레이는 계속 수행합니다. 말투·대화 예시는 Settings → AI에서 수정할 수 있습니다.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
