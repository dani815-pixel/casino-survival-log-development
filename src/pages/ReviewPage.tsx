import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Card, Empty, Pill, TextArea, copyText } from '../components/ui';
import { buildDailyAnalysisPrompt, buildScenarioPrompt, type PromptBundle } from '../services/promptService';
import { computeAllAIStates } from '../utils/statistics';
import { ClipboardCopy, ClipboardPaste, FileText, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { timeStr, dateStr } from '../utils/format';

export default function ReviewPage() {
  const app = useApp();
  const { project, session, game, rounds, aiProfiles, aiRecords, reviews, settings } = app;
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const analysisReviews = reviews.filter((r) => r.kind === 'DAILY_ANALYSIS');
  const scenarioReviews = reviews.filter((r) => r.kind === 'SCENARIO');
  const latestAnalysis = analysisReviews[0] ?? null;

  const bundle: PromptBundle | null = useMemo(() => {
    if (!project || !session || !game) return null;
    return {
      project, session, game, rounds,
      profiles: aiProfiles.filter((p) => p.active),
      aiRecords,
      aiStates: computeAllAIStates(aiProfiles.filter((p) => p.active).map((p) => p.id), aiRecords, session.startBalance),
      currency: settings.currency,
      decimals: settings.decimals,
    };
  }, [project, session, game, rounds, aiProfiles, aiRecords, settings]);

  const analysisPrompt = useMemo(
    () => (bundle ? buildDailyAnalysisPrompt(bundle, settings.promptTemplates.analysis) : ''),
    [bundle, settings.promptTemplates.analysis],
  );
  const scenarioPrompt = useMemo(
    () => (bundle && latestAnalysis ? buildScenarioPrompt(bundle, settings.promptTemplates.scenario, latestAnalysis.rawText) : ''),
    [bundle, latestAnalysis, settings.promptTemplates.scenario],
  );

  const copy = (text: string, label: string) => {
    void copyText(text).then((ok) => app.notify(ok ? `${label}를 클립보드에 복사했습니다` : '복사에 실패했습니다. 텍스트를 직접 선택해 복사하세요.'));
  };

  if (!project || !session) {
    return <Empty icon={<FileText size={28} />} title="세션이 없습니다" desc="게임을 시작하고 기록을 쌓은 뒤 분석 프롬프트를 생성하세요." action={<Btn variant="gold" onClick={() => app.setTab('game')}>게임 시작</Btn>} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-black text-slate-100">Review · 외부 AI 연동</h1>
      <p className="text-xs leading-relaxed text-slate-500">
        프롬프트 생성 → 복사 → 외부 AI에 붙여넣기 → 결과 복사 → 아래에 붙여넣기 → 저장. API 없이 클립보드로 연동합니다.
      </p>

      {/* 1. Daily Analysis Prompt */}
      <Card
        title="1. Daily Analysis Prompt"
        right={<Pill tone={rounds.length > 0 ? 'good' : 'dim'}>라운드 {rounds.length}개 데이터</Pill>}
      >
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          현재 세션에 실제 저장된 데이터(사용자 기록, 전체 AI 기록, 자산, 승/패, 적중률, 흐름, 의견 집중/분산, 탈락, 성향, dynamic state)만 포함됩니다.
        </p>
        <div className="flex gap-2">
          <Btn variant="primary" className="flex-1" onClick={() => setAnalysisOpen((v) => !v)} disabled={!bundle}>
            <Sparkles size={15} /> {analysisOpen ? '프롬프트 닫기' : 'Prompt 생성'}
          </Btn>
          <Btn variant="gold" className="flex-1" onClick={() => copy(analysisPrompt, '분석 프롬프트')} disabled={!bundle}>
            <ClipboardCopy size={15} /> 복사
          </Btn>
        </div>
        {analysisOpen && (
          <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#080d16] p-3 text-[11px] leading-relaxed text-slate-300 ring-1 ring-white/10">
            {analysisPrompt}
          </pre>
        )}
      </Card>

      {/* 2. External AI Result */}
      <Card title="2. 외부 AI 분석 결과 붙여넣기" right={latestAnalysis && <Pill tone="good">저장됨</Pill>}>
        <TextArea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="외부 AI 분석 결과를 붙여넣으세요. 완벽한 형식이 아니어도 원문이 그대로 보존됩니다."
          className="min-h-[130px]"
        />
        <div className="mt-2 flex gap-2">
          <Btn
            variant="gold"
            className="flex-1"
            onClick={() => {
              void app.saveReview(latestAnalysis ? 'SCENARIO' : 'DAILY_ANALYSIS', paste).then((ok) => { if (ok) setPaste(''); });
            }}
          >
            <ClipboardPaste size={15} /> 저장
          </Btn>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600">
          {latestAnalysis ? '데일리 분석이 이미 있으므로, 이번 저장은 시나리오 결과로 연결됩니다.' : '현재 Daily Session과 연결되어 저장됩니다. 다음 저장부터는 시나리오로 저장됩니다.'}
        </p>

        {(analysisReviews.length > 0 || scenarioReviews.length > 0) && (
          <div className="mt-3 space-y-2">
            {[...analysisReviews, ...scenarioReviews].map((r) => (
              <div key={r.id} className="rounded-xl bg-[#0c1220] p-3 ring-1 ring-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill tone={r.kind === 'DAILY_ANALYSIS' ? 'gold' : 'default'}>{r.kind === 'DAILY_ANALYSIS' ? '데일리 분석' : '시나리오'}</Pill>
                    <span className="text-[10px] text-slate-500">{dateStr(r.createdAt)} {timeStr(r.createdAt)}</span>
                  </div>
                  <button onClick={() => void app.deleteReview(r.id)} className="rounded-lg bg-rose-500/10 p-1.5 text-rose-300 active:scale-95" aria-label="삭제">
                    <Trash2 size={13} />
                  </button>
                </div>
                <button className="mt-2 w-full text-left" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                    {expanded === r.id ? r.rawText : r.parsedSummary || r.rawText.slice(0, 300)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-[#ffd97a]/70">{expanded === r.id ? '요약 보기' : '원문 전체 보기'}</p>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 3. Next-Day Scenario */}
      <Card
        title="3. Next-Day Scenario Prompt"
        right={latestAnalysis ? <Pill tone="good">활성</Pill> : <Pill tone="dim">분석 저장 후 활성화</Pill>}
      >
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          이전 세션 데이터 + 저장된 데일리 분석을 포함해 "조건 기반 시나리오"를 요청합니다. 미래 결과를 확정적으로 예측하지 않습니다.
        </p>
        <div className="flex gap-2">
          <Btn variant="primary" className="flex-1" disabled={!latestAnalysis} onClick={() => setScenarioOpen((v) => !v)}>
            <RefreshCw size={15} /> {scenarioOpen ? '프롬프트 닫기' : '시나리오 Prompt 생성'}
          </Btn>
          <Btn variant="gold" className="flex-1" disabled={!latestAnalysis} onClick={() => copy(scenarioPrompt, '시나리오 프롬프트')}>
            <ClipboardCopy size={15} /> 복사
          </Btn>
        </div>
        {scenarioOpen && latestAnalysis && (
          <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#080d16] p-3 text-[11px] leading-relaxed text-slate-300 ring-1 ring-white/10">
            {scenarioPrompt}
          </pre>
        )}
      </Card>
    </div>
  );
}
