import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { fmtMoney, fmtSigned } from '../utils/format';

// ===== 공통 UI 컴포넌트 (모바일 우선, 큰 터치 영역) =====

export function Card({ title, right, children, className = '' }: {
  title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-[#131b29]/90 ring-1 ring-white/[0.06] backdrop-blur p-4 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold tracking-wide text-slate-300 uppercase">{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnVariant = 'gold' | 'primary' | 'ghost' | 'danger' | 'subtle';

export function Btn({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none min-h-[44px] px-4 text-sm';
  const styles: Record<BtnVariant, string> = {
    gold: 'bg-gradient-to-b from-[#ffd97a] to-[#e0a93b] text-[#241a05] shadow-[0_4px_18px_rgba(240,192,74,0.35)]',
    primary: 'bg-[#243349] text-slate-100 ring-1 ring-white/10',
    ghost: 'bg-transparent text-slate-300 ring-1 ring-white/10',
    danger: 'bg-[#3a1622] text-rose-300 ring-1 ring-rose-500/20',
    subtle: 'bg-white/[0.04] text-slate-300',
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl bg-[#0c1220] px-3.5 py-3 text-[15px] text-slate-100 ring-1 ring-white/10 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-[#f0c04a]/60 min-h-[46px]';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function NumInput({ value, onChange, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null; onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => { setText(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      {...rest}
      inputMode="decimal"
      className={`${inputCls} ${rest.className ?? ''}`}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.\-]/g, '');
        setText(t);
        if (t.trim() === '') onChange(null);
        else {
          const n = Number(t);
          if (Number.isFinite(n)) onChange(n);
        }
      }}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[110px] resize-y leading-relaxed ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} appearance-none ${props.className ?? ''}`} />;
}

export function Seg<T extends string>({ options, value, onChange, allowNone = false, noneLabel = '없음' }: {
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 min-h-[52px] rounded-xl text-sm font-bold transition active:scale-[0.97] ${
            value === o.id
              ? 'bg-gradient-to-b from-[#ffd97a] to-[#e0a93b] text-[#241a05] shadow-[0_4px_16px_rgba(240,192,74,0.3)]'
              : 'bg-[#0c1220] text-slate-300 ring-1 ring-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex-1 min-h-[52px] rounded-xl text-sm font-bold transition active:scale-[0.97] ${
            value === null ? 'bg-[#33445e] text-slate-100 ring-1 ring-white/20' : 'bg-[#0c1220] text-slate-500 ring-1 ring-white/10'
          }`}
        >
          {noneLabel}
        </button>
      )}
    </div>
  );
}

type Tone = 'default' | 'good' | 'bad' | 'warn' | 'gold' | 'dim';

export function Pill({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    default: 'bg-[#243349] text-slate-200',
    good: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20',
    bad: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20',
    warn: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20',
    gold: 'bg-[#f0c04a]/15 text-[#ffd97a] ring-1 ring-[#f0c04a]/25',
    dim: 'bg-white/[0.04] text-slate-500',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[tone]}`}>{children}</span>;
}

export function Money({ value, currency, decimals, signed = false, className = '' }: {
  value: number; currency: string; decimals: number; signed?: boolean; className?: string;
}) {
  const tone = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-rose-400' : 'text-slate-300';
  return (
    <span className={`${signed ? tone : 'text-slate-100'} font-bold tabular-nums ${className}`}>
      {signed ? fmtSigned(value, currency, decimals) : fmtMoney(value, currency, decimals)}
    </span>
  );
}

export function Stat({ label, value, sub, tone = 'default' }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: Tone;
}) {
  const toneCls: Record<Tone, string> = {
    default: 'text-slate-100', good: 'text-emerald-400', bad: 'text-rose-400',
    warn: 'text-amber-300', gold: 'text-[#ffd97a]', dim: 'text-slate-500',
  };
  return (
    <div className="rounded-xl bg-[#0c1220] px-3 py-2.5 ring-1 ring-white/[0.06]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-[15px] font-bold tabular-nums ${toneCls[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-in relative z-10 max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-[#101828] p-5 pb-8 ring-1 ring-white/10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-white/5 p-2 text-slate-400 active:scale-95" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, title, desc, action }: {
  icon?: ReactNode; title: string; desc?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#131b29]/60 px-6 py-12 text-center ring-1 ring-dashed ring-white/10">
      {icon && <div className="text-[#f0c04a]/70">{icon}</div>}
      <p className="text-[15px] font-bold text-slate-200">{title}</p>
      {desc && <p className="text-xs leading-relaxed text-slate-500">{desc}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#0c1220] px-3.5 py-3 ring-1 ring-white/[0.06] min-h-[48px] text-left"
    >
      <span>
        <span className="block text-sm font-semibold text-slate-200">{label}</span>
        {desc && <span className="mt-0.5 block text-[11px] text-slate-500">{desc}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#f0c04a]' : 'bg-[#2a3649]'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#f0c04a]/80">{children}</h2>
      {right}
    </div>
  );
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
