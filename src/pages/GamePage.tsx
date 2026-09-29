import { useEffect, useState } from 'react';
import { useApp } from '../app/store';
import {
  Btn, Card, Empty, Field, Money, NumInput, Pill, Seg, Sheet, Stat, TextInput, Select,
} from '../components/ui';
import { GAMES, optionLabel } from '../data/games';
import { fmtMoney, fmtPct, timeStr, todayStr } from '../utils/format';
import { round2 } from '../utils/statistics';
import { aiColor } from '../components/charts';
import {
  AlertTriangle, ArrowRightLeft, Dices, Layers, Pencil, Play, Pause, Skull, Square, Trash2,
} from 'lucide-react';

// ===== 세션 시작 폼 =====

function SessionStartForm() {
  const app = useApp();
  const { settings } = app;
  const [date, setDate] = useState(todayStr());
  const [casino, setCasino] = useState('');
  const [gameId, setGameId] = useState(GAMES[0]!.id);
  const [table, setTable] = useState('');
  const [startBalance, setStartBalance] = useState<number | null>(100);
  const [stopLoss, setStopLoss] = useState<number | null>(settings.defaultStopLoss);
  const [winCut, setWinCut] = useState<number | null>(settings.defaultWinCut);
  const [memo, setMemo] = useState('');

  return (
    <Card title="게임 시작 (Daily Session)" className="ring-[#f0c04a]/20">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="날짜"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="카지노"><TextInput value={casino} onChange={(e) => setCasino(e.target.value)} placeholder="예: Paradise" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="게임">
            <Select value={gameId} onChange={(e) => setGameId(e.target.value)}>
              {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label="테이블"><TextInput value={table} onChange={(e) => setTable(e.target.value)} placeholder="예: T-12" /></Field>
        </div>
        <Field label="오늘 시작 자금 (Daily Start Capital)" hint="프로젝트 최초 자금과는 별개입니다. 사용자와 모든 활성 AI가 이 금액으로 시작하며 매일 리셋됩니다">
          <NumInput value={startBalance} onChange={setStartBalance} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stop Loss" hint="도달 시 경고만 표시 (자동 종료 없음)"><NumInput value={stopLoss} onChange={setStopLoss} placeholder="없음" /></Field>
          <Field label="Win Cut" hint="도달 시 경고만 표시 (자동 종료 없음)"><NumInput value={winCut} onChange={setWinCut} placeholder="없음" /></Field>
        </div>
        <Field label="메모"><TextInput value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택" /></Field>
        <Btn
          variant="gold"
          className="w-full min-h-[52px] text-base"
          onClick={() => void app.startSession({ date, casino, gameId, table, startBalance: startBalance ?? NaN, stopLoss, winCut, memo })}
        >
          <Play size={18} /> 게임 시작
        </Btn>
      </div>
    </Card>
  );
}

// ===== 라운드 입력 폼 (결과 → 예측 → 금액 → 저장) =====

function RoundForm({ initial, disabled, submitLabel, onSubmit }: {
  initial?: { actualResult: string; myPrediction: string | null; bettingAmount: number | null; memo: string };
  disabled: boolean;
  submitLabel: string;
  onSubmit: (v: { actualResult: string; myPrediction: string | null; bettingAmount: number | null; memo: string }) => Promise<boolean>;
}) {
  const { game } = useApp();
  const [result, setResult] = useState<string | null>(initial?.actualResult ?? null);
  const [pred, setPred] = useState<string | null>(initial?.myPrediction ?? null);
  const [bet, setBet] = useState<number | null>(initial?.bettingAmount ?? null);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  useEffect(() => {
    if (initial) {
      setResult(initial.actualResult);
      setPred(initial.myPrediction);
      setBet(initial.bettingAmount);
      setMemo(initial.memo);
    }
  }, [initial]);
  if (!game) return null;
  const opts = game.options.map((o) => ({ id: o.id, label: o.label }));
  return (
    <div className="space-y-3">
      <Field label="실제 결과">
        <Seg options={opts} value={result as string | null} onChange={(v) => setResult(v)} />
      </Field>
      <Field label="내 예측" hint="베팅이 없으면 예측만 기록됩니다 (통계 분리)">
        <Seg options={opts} value={pred} onChange={setPred} allowNone noneLabel="예측 없음" />
      </Field>
      <Field label="베팅 금액 (비우면 Prediction Only)">
        <div className="flex gap-2">
          <NumInput value={bet} onChange={setBet} placeholder="금액" className="flex-1" />
        </div>
        <div className="mt-2 flex gap-1.5">
          {[5, 10, 25, 50, 100].map((n) => (
            <button key={n} type="button" onClick={() => setBet(n)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold ring-1 transition active:scale-95 ${bet === n ? 'bg-[#f0c04a] text-[#241a05] ring-[#f0c04a]' : 'bg-[#0c1220] text-slate-400 ring-white/10'}`}>
              {n}
            </button>
          ))}
          <button type="button" onClick={() => setBet(null)}
            className="flex-1 rounded-lg bg-[#0c1220] py-2 text-xs font-bold text-slate-500 ring-1 ring-white/10 active:scale-95">
            지움
          </button>
        </div>
      </Field>
      <Field label="메모"><TextInput value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택" /></Field>
      <Btn
        variant="gold"
        className="w-full min-h-[54px] text-base"
        disabled={disabled || !result}
        onClick={() => {
          if (!result) return;
          void onSubmit({ actualResult: result, myPrediction: pred, bettingAmount: bet, memo }).then((ok) => {
            if (ok && !initial) { setResult(null); setPred(null); setBet(null); setMemo(''); }
          });
        }}
      >
        <Dices size={18} /> {submitLabel}
      </Btn>
    </div>
  );
}

// ===== 메인 페이지 =====

export default function GamePage() {
  const app = useApp();
  const { project, session, game, userStats, settings, rounds, aiStates, aiProfiles, activeShoe, activeTable } = app;
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [mvTable, setMvTable] = useState('');
  const [mvShoe, setMvShoe] = useState<number | null>(1);
  const [mvMemo, setMvMemo] = useState('');
  const [endBalance, setEndBalance] = useState<number | null>(null);

  if (!project) {
    return <Empty title="프로젝트가 없습니다" desc="홈에서 프로젝트를 먼저 만들어주세요." action={<Btn variant="gold" onClick={() => app.setTab('home')}>홈으로</Btn>} />;
  }
  if (!session || !game || !userStats) {
    return <SessionStartForm />;
  }
  if (session.status === 'ENDED') {
    return (
      <div className="space-y-4">
        <Card title="세션 종료됨">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="오늘 시작 자금" value={session.startBalance} />
            <Stat label="종료 잔액 (입력)" value={session.endBalance ?? '-'} />
            <Stat label="P/L" value={<Money value={session.actualProfitLoss} currency={settings.currency} decimals={settings.decimals} signed />} tone={session.actualProfitLoss >= 0 ? 'good' : 'bad'} />
            <Stat label="라운드" value={session.totalRounds} sub={`예측 ${session.predictionCount} · 베팅 ${session.actualBetCount}`} />
          </div>
          {session.calculatedEndBalance != null && session.endBalance != null && session.calculatedEndBalance !== session.endBalance && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/20">
              <AlertTriangle size={12} className="shrink-0" />
              계산된 종료 잔액({session.calculatedEndBalance})과 입력한 종료 잔액({session.endBalance})이 다릅니다. 두 값이 모두 보존됩니다.
            </p>
          )}
        </Card>
        <SessionStartForm />
      </div>
    );
  }

  const lastRound = rounds.length ? rounds.reduce((m, r) => (r.roundNumber > m.roundNumber ? r : m), rounds[0]!) : null;
  const nextRound = (lastRound?.roundNumber ?? 0) + 1;
  const pl = userStats.actualProfitLoss;
  const slHit = session.stopLoss != null && pl <= -session.stopLoss;
  const slNear = !slHit && session.stopLoss != null && pl <= -session.stopLoss * 0.8;
  const wcHit = session.winCut != null && pl >= session.winCut;
  const wcNear = !wcHit && session.winCut != null && pl >= session.winCut * 0.8;

  return (
    <div className="space-y-4">
      {/* 상태 스트립 */}
      <Card className="bg-gradient-to-br from-[#16203a] to-[#101828]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{session.date} · {session.casino}</p>
            <p className="mt-0.5 text-sm font-bold text-[#ffd97a]">{game.name} · 테이블 {activeTable?.table ?? session.table} · Shoe #{activeShoe?.shoeNumber ?? '-'}</p>
          </div>
          <Pill tone={session.status === 'PLAYING' ? 'good' : 'warn'}>{session.status}</Pill>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="현재 잔액" value={<Money value={userStats.currentBalance} currency={settings.currency} decimals={settings.decimals} />} sub={`오늘 시작 ${fmtMoney(session.startBalance, settings.currency, settings.decimals)}`} />
          <Stat label="오늘 P/L" value={<Money value={userStats.todayPL} currency={settings.currency} decimals={settings.decimals} signed />} tone={pl > 0 ? 'good' : pl < 0 ? 'bad' : 'default'} sub={fmtPct(userStats.dailyReturn)} />
          <Stat label="라운드" value={`R${rounds.length}`} sub={`예측 ${userStats.predictionCount} 베팅 ${userStats.actualBetCount}`} />
        </div>
      </Card>

      {/* Stop Loss / Win Cut 경고 (자동 종료 없음) */}
      {(slHit || slNear || wcHit || wcNear) && (
        <div className={`flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-semibold ring-1 ${slHit || wcHit ? 'bg-rose-500/15 text-rose-300 ring-rose-400/25' : 'bg-amber-500/10 text-amber-300 ring-amber-400/20'}`}>
          <AlertTriangle size={16} className="shrink-0" />
          {slHit ? 'Stop Loss에 도달했습니다. (자동 종료되지 않습니다)'
            : slNear ? 'Stop Loss에 접근했습니다.'
            : wcHit ? 'Win Cut에 도달했습니다. (자동 종료되지 않습니다)'
            : 'Win Cut에 접근했습니다.'}
        </div>
      )}
      {session.status === 'PAUSED' && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-3 text-sm font-semibold text-amber-300 ring-1 ring-amber-400/20">
          <Pause size={16} /> 일시정지 중 — 라운드 입력이 잠겨 있습니다
        </div>
      )}

      {/* 라운드 입력 */}
      <Card title={`Round ${nextRound} 입력`}>
        <RoundForm
          disabled={session.status !== 'PLAYING'}
          submitLabel={`R${nextRound} 저장`}
          onSubmit={(v) => app.addRound(v)}
        />
      </Card>

      {/* 컨트롤 */}
      <div className="grid grid-cols-4 gap-2">
        <Btn variant="ghost" className="flex-col !min-h-[56px] text-[11px]" onClick={() => { if (window.confirm(`Shoe ${activeShoe?.shoeNumber}을 종료하고 새 슈를 시작할까요? 기존 기록은 유지됩니다.`)) void app.doEndShoe(); }}>
          <Layers size={16} /> 슈 종료
        </Btn>
        <Btn variant="ghost" className="flex-col !min-h-[56px] text-[11px]" onClick={() => { setMvShoe((activeShoe?.shoeNumber ?? 0) + 1); setMoveOpen(true); }}>
          <ArrowRightLeft size={16} /> 테이블 이동
        </Btn>
        <Btn variant="ghost" className="flex-col !min-h-[56px] text-[11px]" onClick={() => void app.doTogglePause()}>
          {session.status === 'PLAYING' ? <><Pause size={16} /> 일시정지</> : <><Play size={16} /> 재개</>}
        </Btn>
        <Btn variant="danger" className="flex-col !min-h-[56px] text-[11px]" onClick={() => { setEndBalance(userStats.currentBalance); setEndOpen(true); }}>
          <Square size={16} /> 게임 종료
        </Btn>
      </div>

      {/* 최근 라운드 */}
      <Card title="최근 라운드" right={lastRound && (
        <div className="flex gap-1.5">
          <button onClick={() => setEditOpen(true)} className="rounded-lg bg-white/5 p-2 text-slate-300 active:scale-95" aria-label="수정"><Pencil size={14} /></button>
          <button onClick={() => { if (window.confirm(`R${lastRound.roundNumber}을 삭제할까요? 통계는 저장된 전체 데이터 기준으로 다시 계산됩니다.`)) void app.deleteLastRound(); }} className="rounded-lg bg-rose-500/10 p-2 text-rose-300 active:scale-95" aria-label="삭제"><Trash2 size={14} /></button>
        </div>
      )}>
        {rounds.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-500">아직 기록된 라운드가 없습니다. 위에서 첫 라운드를 저장하세요.</p>
        ) : (
          <div className="space-y-1.5">
            {[...rounds].slice(-8).reverse().map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg bg-[#0c1220] px-3 py-2 text-xs ring-1 ring-white/[0.04]">
                <span className="w-10 font-black text-slate-400">R{r.roundNumber}</span>
                <span className="font-bold text-[#ffd97a]">{optionLabel(game, r.actualResult)}</span>
                <span className="text-slate-500">예측 {optionLabel(game, r.myPrediction)}</span>
                <span className="ml-auto tabular-nums">
                  {r.bettingAmount != null
                    ? <Money value={r.actualProfitLoss ?? 0} currency={settings.currency} decimals={settings.decimals} signed />
                    : <span className="text-slate-600">관전</span>}
                </span>
                <span className="w-9 text-right text-[10px] text-slate-600">{timeStr(r.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI 라이브 스트립 */}
      <Card title="AI 가상 자산 (매일 리셋)">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {aiStates.map((s) => {
            const p = aiProfiles.find((x) => x.id === s.aiId);
            if (!p) return null;
            const idx = aiProfiles.indexOf(p);
            return (
              <div key={s.aiId} className={`min-w-[108px] rounded-xl px-3 py-2 ring-1 ${s.eliminated ? 'bg-[#1a1218] ring-rose-500/20 opacity-60' : 'bg-[#0c1220] ring-white/[0.06]'}`}>
                <p className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ background: aiColor(idx) }} />
                  <span className="truncate">{p.name}</span>
                  {s.eliminated && <Skull size={11} className="text-rose-400" />}
                </p>
                <p className="mt-1 text-sm font-black tabular-nums text-slate-100">${s.bankroll}</p>
                <p className={`text-[10px] font-bold tabular-nums ${s.pl > 0 ? 'text-emerald-400' : s.pl < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {s.pl > 0 ? '+' : ''}{s.pl}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 수정 시트 (최근 라운드만) */}
      <Sheet open={editOpen && !!lastRound} onClose={() => setEditOpen(false)} title={lastRound ? `R${lastRound.roundNumber} 수정` : ''}>
        {lastRound && (
          <RoundForm
            initial={{ actualResult: lastRound.actualResult, myPrediction: lastRound.myPrediction, bettingAmount: lastRound.bettingAmount, memo: lastRound.memo }}
            disabled={false}
            submitLabel="수정 저장"
            onSubmit={(v) => app.updateLastRound(v).then((ok) => { if (ok) setEditOpen(false); return ok; })}
          />
        )}
      </Sheet>

      {/* 테이블 이동 시트 */}
      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)} title="테이블 이동">
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-400">현재 테이블({activeTable?.table})과 슈는 종료 처리되며, 기존 기록은 모두 유지됩니다.</p>
          <Field label="새 테이블"><TextInput value={mvTable} onChange={(e) => setMvTable(e.target.value)} placeholder="예: T-21" /></Field>
          <Field label="새 슈 번호"><NumInput value={mvShoe} onChange={setMvShoe} /></Field>
          <Field label="이동 시점 잔액"><NumInput value={userStats.currentBalance} onChange={() => undefined} disabled /></Field>
          <Field label="메모"><TextInput value={mvMemo} onChange={(e) => setMvMemo(e.target.value)} placeholder="선택" /></Field>
          <Btn variant="gold" className="w-full" onClick={() => {
            void app.doMoveTable({ newTable: mvTable, newShoe: mvShoe ?? NaN, balanceAtMove: userStats.currentBalance, memo: mvMemo })
              .then((ok) => { if (ok) { setMoveOpen(false); setMvTable(''); setMvMemo(''); } });
          }}>이동 확정</Btn>
        </div>
      </Sheet>

      {/* 게임 종료 시트 */}
      <Sheet open={endOpen} onClose={() => setEndOpen(false)} title="게임 종료">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="총 라운드" value={rounds.length} />
            <Stat label="예측 / 베팅" value={`${userStats.predictionCount} / ${userStats.actualBetCount}`} />
            <Stat label="예측 적중률" value={fmtPct(userStats.predictionHitRate)} />
            <Stat label="베팅 승률" value={fmtPct(userStats.actualBetWinRate)} />
          </div>

          {/* 계산된 종료 잔액 = 오늘 시작 자금 + 실제 베팅 손익 (Prediction/AI 가상자산 미포함) */}
          <div className="rounded-xl bg-[#0c1220] p-3.5 ring-1 ring-[#f0c04a]/20">
            <p className="text-[11px] font-bold text-slate-400">계산된 종료 잔액 (오늘 시작 자금 + 실제 베팅 손익)</p>
            <p className="mt-1 text-lg font-black tabular-nums text-[#ffd97a]">
              {fmtMoney(userStats.currentBalance, settings.currency, settings.decimals)}
            </p>
            <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">
              = {fmtMoney(session.startBalance, settings.currency, settings.decimals)} (오늘 시작) + ({fmtMoney(userStats.actualProfitLoss, settings.currency, settings.decimals)}) 베팅 손익
            </p>
          </div>

          <Field label="종료 잔액 입력 (기본값: 계산된 잔액)" hint="계산값과 다르게 입력할 수 있지만, 차이가 있으면 경고가 표시되며 두 값이 모두 보존됩니다">
            <NumInput value={endBalance} onChange={setEndBalance} />
          </Field>

          {endBalance != null && round2(endBalance) !== userStats.currentBalance && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3.5 py-3 text-xs font-semibold leading-relaxed text-amber-200 ring-1 ring-amber-400/25">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                계산된 종료 잔액은 {fmtMoney(userStats.currentBalance, settings.currency, settings.decimals)}입니다.
                입력한 종료 잔액 {fmtMoney(endBalance, settings.currency, settings.decimals)}과(와) 차이가 있습니다.
                라운드 손익 또는 종료 잔액을 확인하세요.
              </span>
            </div>
          )}

          <Btn variant="danger" className="w-full min-h-[52px]" onClick={() => {
            void app.doEndSession(endBalance).then((ok) => { if (ok) setEndOpen(false); });
          }}>
            <Square size={16} /> 종료 확정 (요약 저장)
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}
