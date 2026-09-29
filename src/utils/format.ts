const SYMBOLS: Record<string, string> = {
  USD: '$', KRW: '₩', JPY: '¥', HKD: 'HK$', EUR: '€', CNY: '¥', GBP: '£',
};

export function symbolOf(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

export function fmtMoney(n: number, currency = 'USD', decimals = 2): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const num = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${sign}${symbolOf(currency)}${num}`;
}

export function fmtSigned(n: number, currency = 'USD', decimals = 2): string {
  if (n > 0) return `+${fmtMoney(n, currency, decimals)}`;
  return fmtMoney(n, currency, decimals);
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(digits)}%`;
}

export const CURRENCIES = ['USD', 'KRW', 'JPY', 'HKD', 'EUR', 'CNY', 'GBP'];

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function timeStr(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dateStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
