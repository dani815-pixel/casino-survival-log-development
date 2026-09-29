import type { GameDefinition } from '../types';

const r2 = (n: number) => Math.round(n * 100) / 100;

// 게임 설정 기반 정산. 순손익(net P/L)을 반환한다.
export function settleBet(game: GameDefinition, betOn: string, amount: number, result: string): number {
  const opt = game.options.find((o) => o.id === betOn);
  if (!opt || amount <= 0) return 0;
  if (betOn === result) return r2(amount * opt.payout);
  if (game.tieOptionId && result === game.tieOptionId && betOn !== game.tieOptionId) {
    if (game.nonTieOnTie === 'push') return 0;
    if (game.nonTieOnTie === 'half') return r2(-amount / 2);
    return -amount;
  }
  return -amount;
}

export function outcomeOf(pl: number): 'win' | 'loss' | 'push' {
  if (pl > 0) return 'win';
  if (pl < 0) return 'loss';
  return 'push';
}
