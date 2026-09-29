import { useState } from 'react';
import type { AIProfile } from '../types';
import { Btn, Field, TextArea, TextInput, Toggle } from './ui';
import { Radar, RADAR_LABELS } from './charts';

const STAT_KEYS = [
  'aggression', 'conservatism', 'trendFollowing',
  'reversalPreference', 'volatilityTolerance', 'passPreference',
] as const;

export function aiStatValues(p: AIProfile): number[] {
  return STAT_KEYS.map((k) => p[k]);
}

export function AIEditor({ profile, onSave, onClose }: {
  profile: AIProfile;
  onSave: (p: AIProfile) => Promise<boolean> | boolean;
  onClose: () => void;
}) {
  const [p, setP] = useState<AIProfile>({ ...profile });
  const set = <K extends keyof AIProfile>(k: K, v: AIProfile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!p.name.trim()) return;
    const ok = await onSave({
      ...p,
      name: p.name.trim(),
      dialogExamples: p.dialogExamples.map((s) => s.trim()).filter(Boolean),
      commonExpressions: p.commonExpressions.map((s) => s.trim()).filter(Boolean),
    });
    if (ok !== false) onClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Radar values={aiStatValues(p)} size={170} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="이름"><TextInput value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="역할"><TextInput value={p.role} onChange={(e) => set('role', e.target.value)} /></Field>
      </div>
      <Field label="성격 (personality)"><TextArea value={p.personality} onChange={(e) => set('personality', e.target.value)} className="min-h-[70px]" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="말투 (speech style)"><TextInput value={p.speechStyle} onChange={(e) => set('speechStyle', e.target.value)} /></Field>
        <Field label="분석 스타일"><TextInput value={p.analysisStyle} onChange={(e) => set('analysisStyle', e.target.value)} /></Field>
      </div>

      <div className="space-y-3 rounded-xl bg-[#0c1220] p-3 ring-1 ring-white/[0.06]">
        <p className="text-xs font-bold text-slate-400">능력치 (0~100)</p>
        {STAT_KEYS.map((k, i) => (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">{RADAR_LABELS[i]}</span>
              <span className="font-bold tabular-nums text-[#ffd97a]">{p[k]}</span>
            </div>
            <input
              type="range" min={0} max={100} value={p[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              className="w-full accent-[#f0c04a]"
            />
          </div>
        ))}
      </div>

      <Field label="대화 예시 (줄바꿈으로 구분)" hint="Meeting Room 말풍선과 외부 AI 프롬프트에 반영됩니다">
        <TextArea
          value={p.dialogExamples.join('\n')}
          onChange={(e) => set('dialogExamples', e.target.value.split('\n'))}
        />
      </Field>
      <Field label="상용구 (줄바꿈으로 구분)">
        <TextArea
          value={p.commonExpressions.join('\n')}
          onChange={(e) => set('commonExpressions', e.target.value.split('\n'))}
          className="min-h-[70px]"
        />
      </Field>

      <Toggle checked={p.active} onChange={(v) => set('active', v)} label={p.active ? '활성 상태' : '보관(비활성) 상태'} desc="보관된 AI는 가상 플레이와 통계에서 제외됩니다" />

      <div className="flex gap-2 pt-1">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>취소</Btn>
        <Btn variant="gold" className="flex-[2]" onClick={() => void save()}>저장</Btn>
      </div>
    </div>
  );
}
