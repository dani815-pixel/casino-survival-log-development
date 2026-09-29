import * as db from '../db/db';
import type {
  AIRoundRecord, DailySession, ExternalReview, Round, Shoe, TableSession,
} from '../types';

export interface ProjectBundle {
  sessions: DailySession[];
  tables: TableSession[];
  shoes: Shoe[];
  rounds: Round[];
  aiRecords: AIRoundRecord[];
  reviews: ExternalReview[];
}

// 프로젝트 전체 데이터를 한 번에 로드 (차트, 커리어 통계, CSV 등에서 사용)
export async function getProjectBundle(projectId: string): Promise<ProjectBundle> {
  const sessions = (await db.byIndex<DailySession>('sessions', 'projectId', projectId)).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const ids = new Set(sessions.map((s) => s.id));
  const [tables, shoes, rounds, aiRecords, reviews] = await Promise.all([
    db.getAll<TableSession>('tables'),
    db.getAll<Shoe>('shoes'),
    db.getAll<Round>('rounds'),
    db.getAll<AIRoundRecord>('aiRecords'),
    db.getAll<ExternalReview>('reviews'),
  ]);
  return {
    sessions,
    tables: tables.filter((t) => ids.has(t.sessionId)),
    shoes: shoes.filter((s) => ids.has(s.sessionId)),
    rounds: rounds.filter((r) => ids.has(r.sessionId)),
    aiRecords: aiRecords.filter((r) => ids.has(r.sessionId)),
    reviews: reviews.filter((r) => ids.has(r.sessionId)),
  };
}
