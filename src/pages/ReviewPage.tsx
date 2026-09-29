import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Card, Empty, Pill, TextArea, copyText } from '../components/ui';
import { buildDailyAnalysisPrompt, buildParticipantRecommendationPrompt, buildScenarioPrompt, selectRandomMeetingParticipants, type ParticipantRecommendation, type PromptBundle } from '../services/promptService';
import { computeAllAIStates } from '../utils/statistics';
import { Check, ClipboardCopy, ClipboardPaste, FileText, RefreshCw, Shuffle, Sparkles, Trash2, Users } from 'lucide-react';
import { timeStr, dateStr } from '../utils/format';

export default function ReviewPage() {
  const app = useApp();
  const { project, session, game, rounds, aiProfiles, aiRecords, reviews, settings } = app;
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'RANDOM' | 'MANUAL' | 'EXTERNAL_AI' | 'HYBRID'>('HYBRID');
  const [selectedAI, setSelectedAI] = useState<string[]>([]);
  const [recommendationPaste, setRecommendationPaste] = useState('');
  const [recommendations, setRecommendations] = useState<ParticipantRecommendation[]>([]);
  const [recommendationOpen, setRecommendationOpen] = useState(false);

  const analysisReviews = reviews.filter((r) => r.kind === 'DAILY_ANALYSIS').sort((a, b) => b.createdAt - a.createdAt);
  const scenarioReviews = reviews.filter((r) => r.kind === 'SCENARIO').sort((a, b) => b.createdAt - a.createdAt);
  const latestAnalysis = analysisReviews[0] ?? null;
  const latestScenario = scenarioReviews[0] ?? null;

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
  const participantPrompt = useMemo(
    () => (bundle ? buildParticipantRecommendationPrompt(bundle, aiProfiles.filter((p) => p.active), latestAnalysis?.rawText ?? '', latestScenario?.rawText ?? '') : ''),
    [bundle, aiProfiles, latestAnalysis, latestScenario],
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

      {/* 3. Next Meeting AI Selection */}
      <Card title="3. 다음 회의 AI 선정" right={<Pill tone="good">최대 4명</Pill>}>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          랜덤으로 선정하거나 외부 AI 추천을 참고해 직접 수정할 수 있습니다. 외부 AI 추천은 현재 세션의 분석/시나리오와 활성 AI 프로필을 기준으로 합니다.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="ghost" onClick={() => {
            const ids = selectRandomMeetingParticipants(aiProfiles.filter((p) => p.active).map((p) => p.id));
            setSelectedAI(ids);
            setSelectionMode('RANDOM');
          }}><Shuffle size={15} /> 랜덤 선택</Btn>
          <Btn variant="ghost" onClick={() => {
            setSelectedAI(app.settings.meeting.participants.filter((id) => aiProfiles.some((p) => p.active && p.id === id)));
            setSelectionMode('MANUAL');
          }}><Users size={15} /> 직접 선택</Btn>
        </div>
        <div className="mt-2 flex gap-2">
          <Btn variant="primary" className="flex-1" onClick={() => setRecommendationOpen((v) => !v)}>
            <Sparkles size={15} /> {recommendationOpen ? '추천 닫기' : '외부 AI 추천'}
          </Btn>
          <Btn variant="gold" className="flex-1" disabled={selectedAI.length === 0} onClick={() => {
            void app.selectMeetingParticipants(selectionMode, selectedAI, recommendations).then((ok) => {
              if (ok) setSelectedAI(app.settings.meeting.participants);
            });
          }}><Check size={15} /> 최종 확정</Btn>
        </div>
        {recommendationOpen && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Btn variant="gold" className="flex-1" onClick={() => copy(participantPrompt, '참가자 추천 프롬프트')} disabled={!bundle}>
                <ClipboardCopy size={15} /> 추천 Prompt 복사
              </Btn>
            </div>
            <TextArea value={recommendationPaste} onChange={(e) => setRecommendationPaste(e.target.value)} placeholder='외부 AI의 JSON 결과를 붙여넣으세요. 예: {"participants":[{"aiId":"AI01","reason":"..."}]}' className="min-h-[100px]" />
            <Btn className="w-full" onClick={() => {
              try {
                const parsed = JSON.parse(recommendationPaste) as { participants?: ParticipantRecommendation[] };
                const valid = Array.isArray(parsed.participants)
                  ? parsed.participants.filter((x) => x && typeof x.aiId === 'string' && typeof x.reason === 'string' && aiProfiles.some((p) => p.active && p.id === x.aiId)).slice(0, 4)
                  : [];
                if (!valid.length) throw new Error('유효한 AI 추천이 없습니다.');
                setRecommendations(valid);
                setSelectedAI(valid.map((x) => x.aiId));
                setSelectionMode('EXTERNAL_AI');
                setRecommendationPaste('');
                app.notify('외부 AI 추천을 불러왔습니다. 확인 후 최종 확정하세요.');
              } catch {
                app.notify('추천 JSON 형식을 확인하세요.');
              }
            }}>추천 결과 불러오기</Btn>
            {recommendations.length > 0 && (
              <div className="space-y-1.5">
                {recommendations.map((r) => (
                  <button key={r.aiId} type="button" className="w-full rounded-lg bg-[#0c1220] p-2 text-left ring-1 ring-white/10" onClick={() => setSelectedAI((prev) => prev.includes(r.aiId) ? prev.filter((id) => id !== r.aiId) : prev.length < 4 ? [...prev, r.aiId] : prev)}>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <span className={selectedAI.includes(r.aiId) ? 'text-emerald-300' : 'text-slate-500'}>{selectedAI.includes(r.aiId) ? '☑' : '☐'}</span>
                      {aiProfiles.find((p) => p.id === r.aiId)?.name ?? r.aiId}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{r.reason}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 space-y-1.5">
          {aiProfiles.filter((p) => p.active).map((p) => (
            <button key={p.id} type="button" className={`flex w-full items-center justify-between rounded-lg p-2 text-left ring-1 ${selectedAI.includes(p.id) ? 'bg-emerald-500/10 ring-emerald-400/30' : 'bg-[#0c1220] ring-white/10'}`} onClick={() => setSelectedAI((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : prev.length < 4 ? [...prev, p.id] : prev)}>
              <span className="text-xs font-bold text-slate-200">{p.name}</span>
              <span className="text-[10px] text-slate-500">{p.role}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-600">선택 {selectedAI.length}/4 · 확정 전에는 현재 회의 참여자가 변경되지 않습니다.</p>
      </Card>

      {/* 4. Next-Day Scenario */}
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
