// 외부 라이브러리 없이 SVG로 구현한 차트 컴포넌트
export interface Series {
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

export function LineChart({ series, height = 170, yFmt = (n) => String(n), invertY = false, yLabel = '' }: {
  series: Series[];
  height?: number;
  yFmt?: (n: number) => string;
  invertY?: boolean;
  yLabel?: string;
}) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) {
    return <div className="flex h-24 items-center justify-center text-xs text-slate-600">표시할 데이터가 없습니다</div>;
  }
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const pad = (yMax - yMin) * 0.12;
  yMin -= pad; yMax += pad;
  const spanX = Math.max(1, xMax - xMin);
  const width = Math.max(300, spanX * 30 + 56);
  const L = 46, R = 14, T = 12, B = 22;
  const px = (x: number) => L + ((x - xMin) / spanX) * (width - L - R);
  const pyRaw = (y: number) => T + (1 - (y - yMin) / (yMax - yMin)) * (height - T - B);
  const py = (y: number) => (invertY ? height - pyRaw(y) + T - B : pyRaw(y));
  const grid = [0.25, 0.5, 0.75].map((f) => yMin + (yMax - yMin) * f);

  return (
    <div>
      <div className="overflow-x-auto no-scrollbar">
        <svg width={width} height={height} className="block">
          {grid.map((g, i) => (
            <g key={i}>
              <line x1={L} x2={width - R} y1={py(g)} y2={py(g)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
              <text x={L - 6} y={py(g) + 3} textAnchor="end" fontSize="9" fill="#5b6a84">{yFmt(g)}</text>
            </g>
          ))}
          <text x={L - 6} y={T + 4} textAnchor="end" fontSize="9" fill="#5b6a84">{yFmt(yMax - pad)}</text>
          <text x={L - 6} y={height - B} textAnchor="end" fontSize="9" fill="#5b6a84">{yFmt(yMin + pad)}</text>
          {series.map((s) =>
            s.points.length > 0 && (
              <g key={s.name}>
                {s.points.length > 1 && (
                  <polyline
                    points={s.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
                    fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9"
                  />
                )}
                {s.points.map((p, i) => (
                  <circle key={i} cx={px(p.x)} cy={py(p.y)} r={i === s.points.length - 1 ? 3.5 : 1.4} fill={s.color} />
                ))}
              </g>
            ),
          )}
          {[xMin, Math.round((xMin + xMax) / 2), xMax].map((x, i) => (
            <text key={i} x={px(x)} y={height - 6} textAnchor="middle" fontSize="9" fill="#5b6a84">
              {yLabel}{x}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ items, valueFmt = (n) => String(n), maxItems = 14 }: {
  items: { label: string; value: number; color?: string; hint?: string }[];
  valueFmt?: (n: number) => string;
  maxItems?: number;
}) {
  const list = items.slice(0, maxItems);
  if (!list.length) {
    return <div className="flex h-24 items-center justify-center text-xs text-slate-600">표시할 데이터가 없습니다</div>;
  }
  const maxAbs = Math.max(...list.map((i) => Math.abs(i.value)), 1);
  return (
    <div className="space-y-1.5">
      {list.map((item, i) => {
        const w = Math.max(3, (Math.abs(item.value) / maxAbs) * 100);
        const color = item.color ?? (item.value >= 0 ? '#34d399' : '#fb7185');
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-slate-400">{item.label}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-white/[0.03]">
              <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${w}%`, background: color, opacity: 0.8 }} />
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-300">
              {valueFmt(item.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===== AI Personality Radar (6축 SVG) =====

export const RADAR_LABELS = ['공격성', '보수성', '트렌드', '역발상', '변동성', '패스'];

export function Radar({ values, size = 150, color = '#f0c04a', showLabels = true }: {
  values: number[]; // 6 values, 0~100
  size?: number;
  color?: string;
  showLabels?: boolean;
}) {
  const c = size / 2;
  const r = size / 2 - (showLabels ? 26 : 8);
  const pt = (i: number, v: number): [number, number] => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return [c + rr * Math.cos(a), c + rr * Math.sin(a)];
  };
  const hex = (f: number) =>
    [0, 1, 2, 3, 4, 5].map((i) => pt(i, f * 100).join(',')).join(' ');
  const poly = [0, 1, 2, 3, 4, 5].map((i) => pt(i, values[i] ?? 0).join(',')).join(' ');
  return (
    <svg width={size} height={size} className="block">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={hex(f)} fill="none" stroke="rgba(255,255,255,0.07)" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" />;
      })}
      <polygon points={poly} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const [x, y] = pt(i, values[i] ?? 0);
        return <circle key={i} cx={x} cy={y} r="2.4" fill={color} />;
      })}
      {showLabels &&
        [0, 1, 2, 3, 4, 5].map((i) => {
          const [x, y] = pt(i, 118);
          return (
            <text key={i} x={x} y={y + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#8b98ad">
              {RADAR_LABELS[i]}
            </text>
          );
        })}
    </svg>
  );
}

export const AI_COLORS = [
  '#ffd97a', '#6ee7b7', '#93c5fd', '#f9a8d4', '#fca5a5', '#c4b5fd',
  '#67e8f9', '#fdba74', '#a3e635', '#f0abfc', '#5eead4', '#fda4af',
  '#bef264', '#7dd3fc', '#d8b4fe', '#fde68a',
];

export function aiColor(index: number): string {
  return AI_COLORS[index % AI_COLORS.length]!;
}
