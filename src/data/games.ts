import type { GameDefinition } from '../types';

// 게임 종류는 코드가 아니라 설정 데이터로 관리한다.
// 새 게임 추가 시 이 배열에 정의만 추가하면 된다.
export const GAMES: GameDefinition[] = [
  {
    id: 'dragon-tiger',
    name: 'Dragon Tiger',
    options: [
      { id: 'dragon', label: 'Dragon', payout: 1 },
      { id: 'tiger', label: 'Tiger', payout: 1 },
      { id: 'tie', label: 'Tie', payout: 8 },
    ],
    tieOptionId: 'tie',
    nonTieOnTie: 'half', // 타이 시 Dragon/Tiger 베팅은 절반 손실
  },
  {
    id: 'baccarat',
    name: 'Baccarat',
    options: [
      { id: 'player', label: 'Player', payout: 1 },
      { id: 'banker', label: 'Banker', payout: 0.95 }, // 5% 커미션
      { id: 'tie', label: 'Tie', payout: 8 },
    ],
    tieOptionId: 'tie',
    nonTieOnTie: 'push', // 타이 시 Player/Banker 베팅은 환불
  },
];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}

export function optionLabel(game: GameDefinition | undefined, optionId: string | null | undefined): string {
  if (!game || !optionId) return '-';
  return game.options.find((o) => o.id === optionId)?.label ?? optionId;
}
