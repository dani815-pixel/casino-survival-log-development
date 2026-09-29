import { useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Card, Field, Money, NumInput, Pill, SectionTitle, Select, Stat, TextInput } from '../components/ui';
import { CURRENCIES, fmtMoney, fmtPct, todayStr } from '../utils/format';
import { computeProjectCumulativePL, rankAI } from '../utils/statistics';
import { aiColor } from '../components/charts';
import { Bot, Crown, FolderKanban, Play, Skull } from 'lucide-react';

function ProjectCreateForm() {
  const app = useApp();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [startCapital, setStartCapital] = useState<number | null>(1000);
  const [currency, setCurrency] = useState('USD');
  const [memo, setMemo] = useState('');
  return (
    <Card title="새 프로젝트 만들기" className="ring-[#f0c04a]/20">
      <div className="space-y-3">
        <Field label="프로젝트 이름"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 3월 생존기" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작일"><TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label="통화">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="프로젝트 시작 자금" hint="Daily Start Capital과는 완전히 별개의 데이터입니다">
          <NumInput value={startCapital} onChange={setStartCapital} />
        </Field>
        <Field label="메모"><TextInput value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택" /></Field>
        <Btn
          variant="gold"
          className="w-full"
          onClick={() => void app.createProject({ name, startDate, startCapital: startCapital ?? -1, currency, memo })}
        >
          <FolderKanban size={16} /> 프로젝트 만들기
        </Btn>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const app = useApp();
  const { project, session, userStats, aiStates, sessions, rounds, activeTable, activeShoe, settings, aiProfiles } = app;

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#1a2438] to-[#0e1420] p-5 ring-1 ring-[#f0c04a]/15">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f0c04a]/70">Casino Survival Diary</p>
          <h1 className="mt-1 text-2xl font-black text-slate-100">카지노 생존일지</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            실제 게임 기록 + AI 가상 플레이 + 외부 AI 분석을 하나의 데이터 흐름으로.
            모든 데이터는 이 기기의 IndexedDB에만 저장됩니다.
          </p>
        </div>
        <ProjectCreateForm />
      </div>
    );
  }

  const projectPL = computeProjectCumulativePL(
    sessions,
    session?.id ?? null,
    userStats?.actualProfitLoss ?? null,
  );
  const projectReturn = project.startCapital > 0
    ? (projectPL / project.startCapital) * 100
    : 0;
  const top3 = rankAI(aiStates, 'pl').slice(0, 3);
  const eliminated = aiStates.filter((s) => s.eliminated).length;
  const statusPill = !session ? <Pill tone="dim">세션 없음</Pill>
    : session.status === 'PLAYING' ? <Pill tone="good">PLAYING</Pill>
    : session.status === 'PAUSED' ? <Pill tone="warn">PAUSED</Pill>
    : <Pill tone="dim">ENDED</Pill>;
  const nextRound = rounds.reduce((m, r) => Math.max(m, r.roundNumber), 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f0c04a]/70">{project.startDate} ~</p>
          <h1 className="text-xl font-black text-slate-100">{project.name}</h1>
        </div>
        {statusPill}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="현재 잔액 (User)"
          value={userStats && session?.status !== 'ENDED'
            ? <Money value={userStats.currentBalance} currency={settings.currency} decimals={settings.decimals} />
            : session?.endBalance != null
              ? <Money value={session.endBalance} currency={settings.currency} decimals={settings.decimals} />
              : '-'}
          sub={session ? `Daily Start ${fmtMoney(session.startBalance, settings.currency, settings.decimals)}` : '세션을 시작하세요'}
        />
        <Stat
          label="오늘 P/L"
          value={userStats ? <Money value={userStats.todayPL} currency={settings.currency} decimals={settings.decimals} signed /> : '-'}
          tone={userStats && userStats.todayPL > 0 ? 'good' : userStats && userStats.todayPL < 0 ? 'bad' : 'default'}
          sub={userStats ? fmtPct(userStats.dailyReturn) : ''}
        />
        <Stat
          label="프로젝트 시작 자금"
          value={<Money value={project.startCapital} currency={project.currency} decimals={settings.decimals} />}
          sub="프로젝트 생성 시 최초 설정값 · Daily Start와 별개"
        />
        <Stat
          label="프로젝트 누적 P/L"
          value={<Money value={projectPL} currency={project.currency} decimals={settings.decimals} signed />}
          tone={projectPL > 0 ? 'good' : projectPL < 0 ? 'bad' : 'default'}
          sub={`실제 베팅 P/L만 합산 · ${sessions.length}일`}
        />
        <Stat
          label="프로젝트 수익률"
          value={fmtPct(projectReturn)}
          tone={projectReturn > 0 ? 'good' : projectReturn < 0 ? 'bad' : 'default'}
          sub="누적 P/L ÷ 프로젝트 시작 자금"
        />
        <Stat
          label="현재 라운드"
          value={session && session.status !== 'ENDED' ? `R${nextRound}` : rounds.length ? `R${rounds.length} (종료)` : '-'}
          sub={session ? `${session.gameId === 'baccarat' ? 'Baccarat' : 'Dragon Tiger'}` : ''}
        />
        <Stat label="테이블" value={activeTable?.table ?? session?.table ?? '-'} sub={session ? session.casino : ''} />
        <Stat label="Shoe" value={activeShoe ? `#${activeShoe.shoeNumber}` : '-'} sub="진행 중" />
      </div>

      <Btn
        variant="gold"
        className="w-full min-h-[52px] text-base"
        onClick={() => app.setTab('game')}
      >
        <Play size={18} /> {session && session.status !== 'ENDED' ? '게임 이어하기' : '새 세션 시작하기'}
      </Btn>

      <SectionTitle right={<Pill tone="gold"><Bot size={12} /> AI {aiProfiles.filter((p) => p.active).length}명</Pill>}>
        AI 현재 순위
      </SectionTitle>
      <Card>
        {aiStates.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">세션을 시작하면 AI 가상 플레이가 시작됩니다</p>
        ) : (
          <div className="space-y-2">
            {top3.map((s, i) => {
              const p = aiProfiles.find((x) => x.id === s.aiId);
              if (!p) return null;
              const idx = aiProfiles.indexOf(p);
              return (
                <div key={s.aiId} className="flex items-center gap-3 rounded-xl bg-[#0c1220] px-3 py-2.5 ring-1 ring-white/[0.05]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-[#0b0f17]" style={{ background: aiColor(idx) }}>
                    {i === 0 ? <Crown size={15} /> : <span className="text-xs font-black">{i + 1}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-100">{p.name}</p>
                    <p className="text-[10px] text-slate-500">적중률 {s.hitRate}% · 승{s.wins}/패{s.losses}/패스{s.passes}</p>
                  </div>
                  <div className="text-right">
                    <Money value={s.bankroll} currency={settings.currency} decimals={settings.decimals} className="text-sm" />
                    <div><Money value={s.pl} currency={settings.currency} decimals={settings.decimals} signed className="text-[11px]" /></div>
                  </div>
                </div>
              );
            })}
            {eliminated > 0 && (
              <p className="flex items-center gap-1.5 pt-1 text-[11px] text-rose-400/80">
                <Skull size={12} /> 오늘 탈락한 AI {eliminated}명 — 내일은 다시 Daily Start로 시작합니다
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
