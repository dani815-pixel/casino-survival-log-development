import { useRef, useState } from 'react';
import { useApp } from '../app/store';
import {
  Btn, Card, Empty, Field, NumInput, Pill, SectionTitle, Select, Sheet, TextArea, TextInput, Toggle,
} from '../components/ui';
import { AIEditor } from '../components/AIEditor';
import { DEFAULT_PROMPT_TEMPLATES } from '../data/defaults';
import { CURRENCIES } from '../utils/format';
import type { AIProfile } from '../types';
import { Bot, Database, Download, FolderKanban, Plus, Radio, Settings2, Upload, Users } from 'lucide-react';

export default function SettingsPage() {
  const app = useApp();
  const { project, projects, settings, aiProfiles } = app;

  // 프로젝트 편집
  const [pName, setPName] = useState(project?.name ?? '');
  const [pCapital, setPCapital] = useState<number | null>(project?.startCapital ?? null);
  const [pMemo, setPMemo] = useState(project?.memo ?? '');
  const [pSynced, setPSynced] = useState(project?.id ?? '');
  if (project && pSynced !== project.id) {
    setPName(project.name); setPCapital(project.startCapital); setPMemo(project.memo); setPSynced(project.id);
  }

  // 프롬프트 템플릿 draft
  const [tpl, setTpl] = useState({ ...settings.promptTemplates });
  const [tplSynced, setTplSynced] = useState(settings.updatedAt);
  if (settings.updatedAt !== tplSynced) { setTpl({ ...settings.promptTemplates }); setTplSynced(settings.updatedAt); }

  // AI 편집
  const [editing, setEditing] = useState<AIProfile | null>(null);

  // Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<string | null>(null);

  if (!project) {
    return <Empty title="프로젝트가 없습니다" desc="설정은 프로젝트 생성 후에 사용할 수 있습니다." action={<Btn variant="gold" onClick={() => app.setTab('home')}>프로젝트 만들기</Btn>} />;
  }

  return (
    <div className="space-y-2 pb-4">
      <h1 className="mb-3 text-lg font-black text-slate-100">Settings</h1>

      {/* ===== Project ===== */}
      <SectionTitle><span className="inline-flex items-center gap-1.5"><FolderKanban size={13} /> 프로젝트</span></SectionTitle>
      <Card>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름"><TextInput value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
            <Field label="시작 자금"><NumInput value={pCapital} onChange={setPCapital} /></Field>
          </div>
          <Field label="메모"><TextInput value={pMemo} onChange={(e) => setPMemo(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Btn variant="primary" className="flex-1" onClick={() => void app.updateProjectInfo({ name: pName.trim() || project.name, startCapital: pCapital ?? project.startCapital, memo: pMemo })}>저장</Btn>
            <Btn variant="ghost" className="flex-1" onClick={() => app.setTab('home')}>새 프로젝트 만들기</Btn>
          </div>
          <div className="space-y-1.5 pt-1">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg bg-[#0c1220] px-3 py-2 ring-1 ring-white/[0.05]">
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">{p.name}</span>
                <Pill tone={p.status === 'ACTIVE' ? 'good' : 'dim'}>{p.status}</Pill>
                {p.id !== project.id && p.status !== 'ARCHIVED' && (
                  <Btn variant="subtle" className="!min-h-[32px] !px-2.5 text-[11px]" onClick={() => void app.openProject(p.id)}>열기</Btn>
                )}
                {p.status !== 'ARCHIVED' && (
                  <Btn variant="danger" className="!min-h-[32px] !px-2.5 text-[11px]" onClick={() => { if (window.confirm(`'${p.name}' 프로젝트를 보관할까요? 데이터는 삭제되지 않습니다.`)) void app.archiveProject(p.id); }}>보관</Btn>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ===== Game / 통화 ===== */}
      <SectionTitle><span className="inline-flex items-center gap-1.5"><Settings2 size={13} /> 게임</span></SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="통화">
            <Select value={settings.currency} onChange={(e) => void app.updateSettings({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="소수점">
            <Select value={String(settings.decimals)} onChange={(e) => void app.updateSettings({ decimals: Number(e.target.value) })}>
              <option value="0">0자리</option>
              <option value="2">2자리</option>
            </Select>
          </Field>
          <Field label="기본 Stop Loss"><NumInput value={settings.defaultStopLoss} onChange={(v) => void app.updateSettings({ defaultStopLoss: v })} placeholder="없음" /></Field>
          <Field label="기본 Win Cut"><NumInput value={settings.defaultWinCut} onChange={(v) => void app.updateSettings({ defaultWinCut: v })} placeholder="없음" /></Field>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">게임 종류(Dragon Tiger, Baccarat)와 결과 옵션·정산 규칙은 설정 데이터(src/data/games.ts)로 관리되며, 새 게임을 쉽게 추가할 수 있습니다.</p>
      </Card>

      {/* ===== AI ===== */}
      <SectionTitle right={<Btn variant="subtle" className="!min-h-[32px] !px-3 text-[11px]" onClick={() => void app.addAI()}><Plus size={13} /> AI 추가</Btn>}>
        <span className="inline-flex items-center gap-1.5"><Bot size={13} /> AI 관리 ({aiProfiles.length}명)</span>
      </SectionTitle>
      <Card>
        <div className="space-y-1.5">
          {aiProfiles.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-[#0c1220] px-3 py-2 ring-1 ring-white/[0.05]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-100">{p.name}</p>
                <p className="truncate text-[10px] text-slate-500">{p.role} · 공격{p.aggression}/보수{p.conservatism}</p>
              </div>
              <button
                onClick={() => void app.upsertAI({ ...p, active: !p.active })}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${p.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-500'}`}
              >
                {p.active ? '활성' : '보관'}
              </button>
              <Btn variant="subtle" className="!min-h-[32px] !px-2.5 text-[11px]" onClick={() => setEditing(p)}>편집</Btn>
            </div>
          ))}
        </div>
      </Card>

      {/* ===== Meeting Room ===== */}
      <SectionTitle><span className="inline-flex items-center gap-1.5"><Users size={13} /> 미팅룸</span></SectionTitle>
      <Card>
        <div className="space-y-2">
          <Toggle checked={settings.meeting.showBubbles} onChange={(v) => void app.updateSettings({ meeting: { ...settings.meeting, showBubbles: v } })} label="말풍선 표시" />
          <Toggle checked={settings.meeting.animation} onChange={(v) => void app.updateSettings({ meeting: { ...settings.meeting, animation: v } })} label="캐릭터 애니메이션" />
          <div className="rounded-xl bg-[#0c1220] px-3.5 py-3 ring-1 ring-white/[0.06]">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">대화 속도</span>
              <span className="font-bold text-[#ffd97a]">{settings.meeting.speed}초</span>
            </div>
            <input type="range" min={2} max={10} step={1} value={settings.meeting.speed} onChange={(e) => void app.updateSettings({ meeting: { ...settings.meeting, speed: Number(e.target.value) } })} className="w-full accent-[#f0c04a]" />
          </div>
          <p className="text-[10px] text-slate-600">미팅 참여 AI(최대 4명)는 MEETING ROOM 페이지에서 선택합니다.</p>
        </div>
      </Card>

      {/* ===== External AI Prompt Templates ===== */}
      <SectionTitle><span className="inline-flex items-center gap-1.5"><Radio size={13} /> 외부 AI 프롬프트 템플릿</span></SectionTitle>
      <Card>
        <div className="space-y-3">
          <Field label="Analysis Prompt" hint="{{DATA}} 위치에 세션 데이터가 삽입됩니다">
            <TextArea value={tpl.analysis} onChange={(e) => setTpl({ ...tpl, analysis: e.target.value })} className="min-h-[120px] text-xs" />
          </Field>
          <Field label="Scenario Prompt"><TextArea value={tpl.scenario} onChange={(e) => setTpl({ ...tpl, scenario: e.target.value })} className="min-h-[100px] text-xs" /></Field>
          <Field label="Meeting Prompt"><TextArea value={tpl.meeting} onChange={(e) => setTpl({ ...tpl, meeting: e.target.value })} className="min-h-[80px] text-xs" /></Field>
          <Field label="Content Prompt"><TextArea value={tpl.content} onChange={(e) => setTpl({ ...tpl, content: e.target.value })} className="min-h-[80px] text-xs" /></Field>
          <div className="flex gap-2">
            <Btn variant="ghost" className="flex-1" onClick={() => setTpl({ ...DEFAULT_PROMPT_TEMPLATES })}>기본값으로</Btn>
            <Btn variant="primary" className="flex-1" onClick={() => { void app.updateSettings({ promptTemplates: { ...tpl } }).then(() => app.notify('템플릿이 저장되었습니다')); }}>템플릿 저장</Btn>
          </div>
        </div>
      </Card>

      {/* ===== Broadcast ===== */}
      <SectionTitle><span className="inline-flex items-center gap-1.5"><Radio size={13} /> 브로드캐스트 (Shorts/Office 표시)</span></SectionTitle>
      <Card>
        <div className="space-y-2">
          <Toggle checked={settings.broadcast.showBalance} onChange={(v) => void app.updateSettings({ broadcast: { ...settings.broadcast, showBalance: v } })} label="실제 잔액 표시" />
          <Toggle checked={settings.broadcast.showBetAmount} onChange={(v) => void app.updateSettings({ broadcast: { ...settings.broadcast, showBetAmount: v } })} label="베팅금액 표시" />
          <Toggle checked={settings.broadcast.showAINames} onChange={(v) => void app.updateSettings({ broadcast: { ...settings.broadcast, showAINames: v } })} label="AI 이름 표시" />
          <Toggle checked={settings.broadcast.showRanking} onChange={(v) => void app.updateSettings({ broadcast: { ...settings.broadcast, showRanking: v } })} label="랭킹 표시" />
        </div>
      </Card>

      {/* ===== Data ===== */}
      <SectionTitle><span className="inline-flex items-center gap-1.5"><Database size={13} /> 데이터</span></SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="primary" onClick={() => void app.exportJSON()}><Download size={15} /> JSON 백업 다운로드</Btn>
          <Btn variant="primary" onClick={() => void app.exportCSV()}><Download size={15} /> CSV 다운로드</Btn>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}><Upload size={15} /> JSON 가져오기</Btn>
          <Btn variant="danger" onClick={() => {
            if (window.confirm('모든 데이터를 초기화할까요? 먼저 JSON으로 백업하는 것을 권장합니다.')) {
              void app.resetAll().then(() => setReport(null));
            }
          }}>데이터 초기화</Btn>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then(async (text) => {
              const rep = await app.importJSON(text);
              setReport(rep.message);
            });
            e.target.value = '';
          }}
        />
        {report && (
          <pre className={`mt-3 whitespace-pre-wrap rounded-xl p-3 text-[11px] font-semibold leading-relaxed ring-1 ${report.startsWith('가져오기 완료') ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/20' : 'bg-rose-500/10 text-rose-200 ring-rose-400/20'}`}>
            {report}
          </pre>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
          Export는 전체 IndexedDB를 JSON(schemaVersion 포함)으로 저장합니다. Import는 형식·버전·관계 무결성을 검증하며, 중복 ID는 제외하고 가져옵니다. 삭제 대신 Archive를 우선합니다.
        </p>
      </Card>

      {/* AI 편집 시트 */}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.name} 수정` : ''}>
        {editing && <AIEditor profile={editing} onClose={() => setEditing(null)} onSave={(p) => app.upsertAI(p)} />}
      </Sheet>
    </div>
  );
}
