// ===== Core entity types (IndexedDB schema v1) =====

export type ID = string;

export type ProjectStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export interface Project {
  id: ID;
  name: string;
  startDate: string; // YYYY-MM-DD
  startCapital: number; // 프로젝트 시작 자금 (Daily Start와 완전히 별개)
  currency: string;
  memo: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = 'PLAYING' | 'PAUSED' | 'ENDED';

export interface DailySession {
  id: ID;
  projectId: ID;
  date: string; // YYYY-MM-DD
  casino: string;
  gameId: string;
  table: string;
  startBalance: number; // Daily Start Capital (User & AI 공통 시작 금액)
  stopLoss: number | null;
  winCut: number | null;
  memo: string;
  status: SessionStatus;
  endBalance: number | null;
  endedAt: number | null;
  // 종료 시 저장되는 요약
  totalRounds: number;
  predictionCount: number;
  actualBetCount: number;
  actualProfitLoss: number;
  createdAt: number;
  updatedAt: number;
}

export interface TableSession {
  id: ID;
  sessionId: ID;
  table: string;
  startedAt: number;
  endedAt: number | null;
  status: 'ACTIVE' | 'ENDED';
}

export interface Shoe {
  id: ID;
  tableSessionId: ID;
  sessionId: ID;
  shoeNumber: number;
  startedAt: number;
  endedAt: number | null;
  status: 'ACTIVE' | 'ENDED';
}

export interface Round {
  id: ID;
  sessionId: ID;
  shoeId: ID;
  tableSessionId: ID;
  roundNumber: number;
  actualResult: string; // game option id
  myPrediction: string | null; // null = 예측 없음
  bettingAmount: number | null; // null = Prediction Only
  actualProfitLoss: number | null; // 베팅 시 자동 정산
  timestamp: number;
  memo: string;
}

export interface AIProfile {
  id: ID;
  projectId: ID;
  name: string;
  role: string;
  personality: string;
  speechStyle: string;
  analysisStyle: string;
  aggression: number; // 0~100
  conservatism: number;
  trendFollowing: number;
  reversalPreference: number;
  volatilityTolerance: number;
  passPreference: number;
  dialogExamples: string[];
  commonExpressions: string[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AIRoundRecord {
  id: ID;
  sessionId: ID;
  roundId: ID;
  roundNumber: number;
  aiId: ID;
  roundResult: string; // 해당 라운드 실제 결과
  analysis: string;
  selection: string | null; // null = Pass (승/패에 포함하지 않음)
  virtualBet: number;
  resultPL: number;
  bankrollAfter: number;
  agreeWithUser: boolean | null;
  eliminated: boolean; // bankrollAfter <= 0 시 true
  createdAt: number;
}

export type EventType =
  | 'ROUND'
  | 'SHOE_STARTED'
  | 'SHOE_ENDED'
  | 'TABLE_CHANGED'
  | 'PAUSED'
  | 'RESUMED'
  | 'SESSION_ENDED';

export interface AppEvent {
  id: ID;
  sessionId: ID;
  type: EventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

export type ReviewKind = 'DAILY_ANALYSIS' | 'SCENARIO';

export interface ExternalReview {
  id: ID;
  sessionId: ID;
  kind: ReviewKind;
  createdAt: number;
  rawText: string;
  parsedSummary: string;
}

// ===== Game definition (configuration based) =====

export interface GameOption {
  id: string;
  label: string;
  payout: number; // 승리 시 순이익 배율 (예: 1, 0.95, 8)
}

export interface GameDefinition {
  id: string;
  name: string;
  options: GameOption[];
  tieOptionId: string | null;
  nonTieOnTie: 'half' | 'push' | 'lose'; // 타이 결과 시 비타이 베팅 처리
}

// ===== Settings =====

export interface PromptTemplates {
  analysis: string;
  scenario: string;
  meeting: string;
  content: string;
}

export interface BroadcastSettings {
  showBalance: boolean;
  showBetAmount: boolean;
  showAINames: boolean;
  showRanking: boolean;
}

export interface MeetingSettings {
  participants: ID[]; // 최대 4명
  showBubbles: boolean;
  speed: number; // 초
  animation: boolean;
}

export interface AppSettings {
  id: string; // 'app'
  currency: string;
  decimals: number;
  defaultStopLoss: number | null;
  defaultWinCut: number | null;
  promptTemplates: PromptTemplates;
  broadcast: BroadcastSettings;
  meeting: MeetingSettings;
  updatedAt: number;
}
