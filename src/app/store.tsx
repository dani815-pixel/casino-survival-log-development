import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as db from '../db/db';
import type {
  AIProfile, AIRoundRecord, AppEvent, AppSettings, DailySession,
  ExternalReview, GameDefinition, Project, Round, Shoe, TableSession,
} from '../types';
import { defaultSettings } from '../data/defaults';
import { buildBlankAI } from '../data/seedAI';
import { getGame } from '../data/games';
import * as svc from '../services/sessionService';
import * as backup from '../services/backupService';
import { newReview, selectRandomMeetingParticipants, type MeetingParticipantSelectionMethod, type ParticipantRecommendation } from '../services/promptService';
import {
  computeAllAIStates, computeUserStats, type DailyAIState, type UserStats,
} from '../utils/statistics';
import type { RoundInput } from '../utils/validation';
import { todayStr } from '../utils/format';
import { uid } from '../utils/id';

export type Tab = 'home' | 'game' | 'ai' | 'meeting' | 'charts' | 'review' | 'shorts' | 'settings';

export function isLatestProjectLoad(requestId: number, currentRequestId: number): boolean {
  return requestId === currentRequestId;
}

export function normalizeMeetingParticipants(participants: string[], activeIds: string[]): string[] {
  const current = [...new Set(participants)].filter((id) => activeIds.includes(id)).slice(0, 4);
  return current.length > 0 ? current : activeIds.slice(0, 4);
}

export function resolveMeetingParticipants(
  method: MeetingParticipantSelectionMethod,
  ids: string[] | undefined,
  activeIds: string[],
): string[] {
  // Review 화면에서 미리 추첨한 RANDOM 결과가 있으면 그 결과를 그대로 확정한다.
  // ids가 없을 때만 새로 추첨해 화면 표시와 실제 저장값이 달라지는 것을 방지한다.
  return method === 'RANDOM' && !(ids?.length)
    ? selectRandomMeetingParticipants(activeIds)
    : normalizeMeetingParticipants(ids ?? [], activeIds);
}

export interface MoveTableInput {
  newTable: string; newShoe: number; balanceAtMove: number; memo: string;
}

export interface ProjectInput {
  name: string; startDate: string; startCapital: number; currency: string; memo: string;
}

interface Ctx {
  ready: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  toast: { id: number; msg: string } | null;
  notify: (msg: string) => void;
  projects: Project[];
  project: Project | null;
  sessions: DailySession[];
  session: DailySession | null;
  activeTable: TableSession | null;
  activeShoe: Shoe | null;
  rounds: Round[];
  aiProfiles: AIProfile[];
  aiRecords: AIRoundRecord[];
  reviews: ExternalReview[];
  events: AppEvent[];
  settings: AppSettings;
  userStats: UserStats | null;
  aiStates: DailyAIState[];
  game: GameDefinition | undefined;
  // actions (성공 여부 boolean 반환)
  createProject: (input: ProjectInput) => Promise<boolean>;
  openProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<boolean>;
  updateProjectInfo: (patch: Partial<Project>) => Promise<boolean>;
  startSession: (input: svc.StartSessionInput) => Promise<boolean>;
  addRound: (input: RoundInput) => Promise<boolean>;
  updateLastRound: (input: RoundInput) => Promise<boolean>;
  deleteLastRound: () => Promise<boolean>;
  doEndShoe: () => Promise<boolean>;
  doMoveTable: (input: MoveTableInput) => Promise<boolean>;
  doTogglePause: () => Promise<boolean>;
  doEndSession: (endBalance: number | null) => Promise<boolean>;
  upsertAI: (p: AIProfile) => Promise<boolean>;
  addAI: () => Promise<boolean>;
  setMeetingParticipants: (ids: string[]) => Promise<void>;
  selectMeetingParticipants: (method: MeetingParticipantSelectionMethod, ids?: string[], recommendations?: ParticipantRecommendation[]) => Promise<boolean>;
  saveReview: (kind: ExternalReview['kind'], raw: string) => Promise<boolean>;
  deleteReview: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  exportJSON: () => Promise<void>;
  importJSON: (text: string) => Promise<backup.ImportReport>;
  exportCSV: () => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tab, setTabState] = useState<Tab>('home');
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const projectLoadRequestRef = useRef(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<DailySession[]>([]);
  const [session, setSession] = useState<DailySession | null>(null);
  const [activeTable, setActiveTable] = useState<TableSession | null>(null);
  const [activeShoe, setActiveShoe] = useState<Shoe | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>([]);
  const [aiRecords, setAiRecords] = useState<AIRoundRecord[]>([]);
  const [reviews, setReviews] = useState<ExternalReview[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());

  const notify = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);

  const run = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn();
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
        return false;
      }
    },
    [notify],
  );

  const reloadChildren = useCallback(async (s: DailySession, isCurrent: () => boolean = () => true) => {
    const [tables, shoes, rds, recs, evs, rvs] = await Promise.all([
      db.byIndex<TableSession>('tables', 'sessionId', s.id),
      db.byIndex<Shoe>('shoes', 'sessionId', s.id),
      db.byIndex<Round>('rounds', 'sessionId', s.id),
      db.byIndex<AIRoundRecord>('aiRecords', 'sessionId', s.id),
      db.byIndex<AppEvent>('events', 'sessionId', s.id),
      db.byIndex<ExternalReview>('reviews', 'sessionId', s.id),
    ]);
    if (!isCurrent()) return;
    const sortedRounds = rds.sort((a, b) => a.roundNumber - b.roundNumber);
    setRounds(sortedRounds);
    setAiRecords(recs);
    setEvents(evs.sort((a, b) => a.timestamp - b.timestamp));
    setReviews(rvs.sort((a, b) => b.createdAt - a.createdAt));
    const at = [...tables].reverse().find((t) => t.status === 'ACTIVE') ?? tables[tables.length - 1] ?? null;
    const as = [...shoes].reverse().find((x) => x.status === 'ACTIVE') ?? shoes[shoes.length - 1] ?? null;
    setActiveTable(at);
    setActiveShoe(as);
  }, []);

  const loadProjectData = useCallback(
    async (pid: string) => {
      const requestId = ++projectLoadRequestRef.current;
      const ss = (await db.byIndex<DailySession>('sessions', 'projectId', pid)).sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      const profs = (await db.byIndex<AIProfile>('aiProfiles', 'projectId', pid)).sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      if (!isLatestProjectLoad(requestId, projectLoadRequestRef.current)) return;
      setSessions(ss);
      setAiProfiles(profs);
      const cur = [...ss].reverse().find((s) => s.status !== 'ENDED') ?? ss[ss.length - 1] ?? null;
      setSession(cur);
      if (cur) await reloadChildren(cur, () => isLatestProjectLoad(requestId, projectLoadRequestRef.current));
      if (requestId !== projectLoadRequestRef.current) return;
      if (cur) {
        // reloadChildren may have completed after another project load started.
      } else {
        setRounds([]); setAiRecords([]); setReviews([]); setEvents([]);
        setActiveTable(null); setActiveShoe(null);
      }
    },
    [reloadChildren],
  );

  // ===== boot =====
  useEffect(() => {
    let dead = false;
    (async () => {
      await db.ensureSchema();
      let st = await db.get<AppSettings>('settings', 'app');
      if (!st) {
        st = defaultSettings();
        await db.put('settings', st);
      }
      if (dead) return;
      setSettings(st);
      const projs = (await db.getAll<Project>('projects')).sort((a, b) => a.createdAt - b.createdAt);
      if (dead) return;
      setProjects(projs);
      const lastId = localStorage.getItem('csj:lastProject');
      const pick =
        projs.find((p) => p.id === lastId && p.status !== 'ARCHIVED') ??
        projs.find((p) => p.status === 'ACTIVE') ??
        projs[0] ?? null;
      if (pick) {
        setProject(pick);
        await loadProjectData(pick.id);
      }
      if (dead) return;
      const lastTab = localStorage.getItem('csj:lastTab') as Tab | null;
      if (lastTab) setTabState(lastTab);
      setReady(true);
    })().catch((e) => {
      console.error(e);
      setReady(true);
    });
    return () => { dead = true; };
  }, [loadProjectData]);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    localStorage.setItem('csj:lastTab', t);
  }, []);

  // 미팅 참여자는 현재 프로젝트의 활성 AI만 참조한다.
  // 프로젝트 전환 시 이전 프로젝트 AI ID가 남아 있지 않도록 정리한다.
  useEffect(() => {
    if (!ready || aiProfiles.length === 0) return;
    const activeIds = aiProfiles.filter((p) => p.active).map((p) => p.id);
    const next = normalizeMeetingParticipants(settings.meeting.participants, activeIds);
    if (
      next.length === settings.meeting.participants.length &&
      next.every((id, i) => id === settings.meeting.participants[i])
    ) return;
    const merged: AppSettings = {
      ...settings,
      meeting: { ...settings.meeting, participants: next },
      updatedAt: Date.now(),
    };
    setSettings(merged);
    void db.put('settings', merged);
  }, [ready, aiProfiles, settings.meeting.participants]);
  // ===== derived =====
  const game = useMemo(() => (session ? getGame(session.gameId) : undefined), [session]);
  const userStats = useMemo(() => (session ? computeUserStats(session, rounds) : null), [session, rounds]);
  const aiStates = useMemo(
    () => (session ? computeAllAIStates(aiProfiles.filter((p) => p.active).map((p) => p.id), aiRecords, session.startBalance) : []),
    [session, aiProfiles, aiRecords],
  );

  // ===== actions =====
  const createProject = useCallback(
    (input: ProjectInput) =>
      run(async () => {
        const p = await svc.createProject(input);
        setProjects((prev) => [...prev, p]);
        setProject(p);
        localStorage.setItem('csj:lastProject', p.id);
        await loadProjectData(p.id);
        setTab('game');
        notify('프로젝트 생성 완료 · AI 12명이 배정되었습니다');
      }),
    [run, loadProjectData, notify, setTab],
  );

  const openProject = useCallback(
    async (id: string) => {
      const p = projects.find((x) => x.id === id);
      if (!p) return;
      setProject(p);
      localStorage.setItem('csj:lastProject', p.id);
      await loadProjectData(p.id);
    },
    [projects, loadProjectData],
  );

  const archiveProject = useCallback(
    (id: string) =>
      run(async () => {
        const target = projects.find((p) => p.id === id);
        if (!target) return;
        await svc.updateProject({ ...target, status: 'ARCHIVED' });
        const remaining = projects.map((p) => (p.id === id ? { ...p, status: 'ARCHIVED' as const } : p));
        setProjects(remaining);
        if (project?.id === id) {
          const next = remaining.find((p) => p.status === 'ACTIVE') ?? null;
          setProject(next);
          if (next) {
            localStorage.setItem('csj:lastProject', next.id);
            await loadProjectData(next.id);
          } else {
            localStorage.removeItem('csj:lastProject');
            setSession(null); setSessions([]); setRounds([]); setAiRecords([]);
            setAiProfiles([]); setReviews([]); setEvents([]); setActiveTable(null); setActiveShoe(null);
          }
        }
        notify('프로젝트를 보관했습니다');
      }),
    [projects, project, run, loadProjectData, notify],
  );

  const updateProjectInfo = useCallback(
    (patch: Partial<Project>) =>
      run(async () => {
        if (!project) return;
        const merged: Project = { ...project, ...patch, id: project.id };
        await svc.updateProject(merged);
        setProject(merged);
        setProjects((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
        notify('프로젝트 정보가 저장되었습니다');
      }),
    [project, run, notify],
  );

  const startSession = useCallback(
    (input: svc.StartSessionInput) =>
      run(async () => {
        if (!project) return;
        const previousSession = [...sessions]
          .filter((s) => s.projectId === project.id && s.status === 'ENDED')
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        await svc.startSession(project, input, previousSession);
        await loadProjectData(project.id);
        const aiCount = aiProfiles.filter((p) => p.active).length;
        notify(`세션 시작 · 사용자와 AI ${aiCount}명이 각각 시작 금액으로 출발합니다`);
      }),
    [project, sessions, aiProfiles, run, loadProjectData, notify],
  );

  const addRound = useCallback(
    (input: RoundInput) =>
      run(async () => {
        if (!session || !activeTable || !activeShoe) throw new Error('진행 중인 세션/슈가 없습니다.');
        const { round, newAI } = await svc.addRound(
          { session, table: activeTable, shoe: activeShoe, rounds, aiProfiles, aiRecords },
          input,
        );
        setRounds((prev) => [...prev, round]);
        setAiRecords((prev) => [...prev, ...newAI]);
        notify(`R${round.roundNumber} 저장됨`);
      }),
    [session, activeTable, activeShoe, rounds, aiProfiles, aiRecords, run, notify],
  );

  const latestRound = useCallback((): Round | null => {
    if (!rounds.length) return null;
    return rounds.reduce((m, r) => (r.roundNumber > m.roundNumber ? r : m), rounds[0]!);
  }, [rounds]);

  const updateLastRound = useCallback(
    (input: RoundInput) =>
      run(async () => {
        const target = latestRound();
        if (!session || !activeTable || !activeShoe || !target) throw new Error('수정할 라운드가 없습니다.');
        await svc.updateLastRound(
          { session, table: activeTable, shoe: activeShoe, rounds, aiProfiles, aiRecords },
          target,
          input,
        );
        await reloadChildren(session);
        notify(`R${target.roundNumber} 수정됨 (통계 재계산 완료)`);
      }),
    [session, activeTable, activeShoe, rounds, aiProfiles, aiRecords, latestRound, run, reloadChildren, notify],
  );

  const deleteLastRound = useCallback(
    () =>
      run(async () => {
        const target = latestRound();
        if (!session || !target) throw new Error('삭제할 라운드가 없습니다.');
        await svc.deleteRound(session, target);
        await reloadChildren(session);
        notify(`R${target.roundNumber} 삭제됨 (통계 재계산 완료)`);
      }),
    [session, latestRound, run, reloadChildren, notify],
  );

  const doEndShoe = useCallback(
    () =>
      run(async () => {
        if (!session || !activeShoe) throw new Error('진행 중인 슈가 없습니다.');
        const next = await svc.endShoe(session, activeShoe);
        await reloadChildren(session);
        notify(`Shoe ${activeShoe.shoeNumber} 종료 → Shoe ${next.shoeNumber} 시작 (기존 기록 유지)`);
      }),
    [session, activeShoe, run, reloadChildren, notify],
  );

  const doMoveTable = useCallback(
    (input: MoveTableInput) =>
      run(async () => {
        if (!session || !activeTable || !activeShoe) throw new Error('진행 중인 테이블이 없습니다.');
        await svc.moveTable(session, activeTable, activeShoe, input);
        await reloadChildren(session);
        notify(`테이블 ${activeTable.table} → ${input.newTable} 이동 완료`);
      }),
    [session, activeTable, activeShoe, run, reloadChildren, notify],
  );

  const doTogglePause = useCallback(
    () =>
      run(async () => {
        if (!session) return;
        const next = await svc.togglePause(session);
        setSession(next);
        notify(next.status === 'PAUSED' ? '일시정지 · 라운드 입력이 잠깁니다' : '재개되었습니다');
      }),
    [session, run, notify],
  );

  const doEndSession = useCallback(
    (endBalance: number | null) =>
      run(async () => {
        if (!session || !project) return;
        await svc.endSession(session, rounds, endBalance);
        await loadProjectData(project.id);
        notify('게임 종료 · 세션 요약이 저장되었습니다');
      }),
    [session, project, rounds, run, loadProjectData, notify],
  );

  const upsertAI = useCallback(
    (p: AIProfile) =>
      run(async () => {
        await db.put('aiProfiles', { ...p, updatedAt: Date.now() });
        setAiProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...p, updatedAt: Date.now() } : x)));
        notify(`${p.name} 저장됨`);
      }),
    [run, notify],
  );

  const addAI = useCallback(
    () =>
      run(async () => {
        if (!project) throw new Error('프로젝트를 먼저 만들어주세요.');
        const maxN = aiProfiles.reduce((m, p) => {
          const match = /AI(\d+)/.exec(p.name);
          return match ? Math.max(m, parseInt(match[1]!, 10)) : m;
        }, 0);
        const fresh = buildBlankAI(project.id, maxN + 1);
        await db.put('aiProfiles', fresh);
        setAiProfiles((prev) => [...prev, fresh]);
        notify(`${fresh.name} 추가됨 · Settings에서 성향을 설정하세요`);
      }),
    [project, aiProfiles, run, notify],
  );

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const merged: AppSettings = { ...settings, ...patch, id: 'app', updatedAt: Date.now() };
      setSettings(merged);
      await db.put('settings', merged);
    },
    [settings],
  );

  const setMeetingParticipants = useCallback(
    async (ids: string[]) => {
      const selected = ids.slice(0, 4);
      if (session) {
        const updatedSession: DailySession = { ...session, meetingParticipants: selected, updatedAt: Date.now() };
        await db.put('sessions', updatedSession);
        await db.put('events', {
          id: uid(),
          sessionId: session.id,
          type: 'MEETING_PARTICIPANTS_SELECTED',
          timestamp: Date.now(),
          payload: {
            method: 'MANUAL',
            selectedAI: selected,
            recommendations: [],
            source: 'MEETING_ROOM',
          },
        });
        setSession(updatedSession);
        await reloadChildren(updatedSession);
      }
      await updateSettings({ meeting: { ...settings.meeting, participants: selected } });
    },
    [session, settings.meeting, updateSettings, reloadChildren],
  );

  const selectMeetingParticipants = useCallback(
    (method: MeetingParticipantSelectionMethod, ids?: string[], recommendations: ParticipantRecommendation[] = []) =>
      run(async () => {
        if (!session) throw new Error('먼저 Daily Session을 시작하세요.');
        const activeIds = aiProfiles.filter((p) => p.active).map((p) => p.id);
        const selected = resolveMeetingParticipants(method, ids, activeIds);
        if (selected.length === 0) throw new Error('참여 가능한 활성 AI가 없습니다.');

        const updatedSession: DailySession = { ...session, meetingParticipants: selected, updatedAt: Date.now() };
        await db.put('sessions', updatedSession);
        setSession(updatedSession);
        await updateSettings({
          meeting: { ...settings.meeting, participants: selected },
        });
        await db.put('events', {
          id: uid(),
          sessionId: session.id,
          type: 'MEETING_PARTICIPANTS_SELECTED',
          timestamp: Date.now(),
          payload: {
            method,
            selectedAI: selected,
            recommendations: recommendations.slice(0, 4),
          },
        });
        await reloadChildren(updatedSession);
        notify(`다음 회의 참가 AI ${selected.length}명 확정`);
      }),
    [session, aiProfiles, settings.meeting, updateSettings, run, reloadChildren, notify],
  );

  const saveReview = useCallback(
    (kind: ExternalReview['kind'], raw: string) =>
      run(async () => {
        if (!session) throw new Error('먼저 세션을 시작하세요.');
        if (!raw.trim()) throw new Error('붙여넣을 내용이 비어 있습니다.');
        await db.put('reviews', newReview(session.id, kind, raw));
        await reloadChildren(session);
        notify(kind === 'DAILY_ANALYSIS' ? '외부 AI 분석 결과가 저장되었습니다' : '시나리오 결과가 저장되었습니다');
      }),
    [session, run, reloadChildren, notify],
  );

  const deleteReview = useCallback(
    async (id: string) => {
      await db.del('reviews', id);
      if (session) await reloadChildren(session);
      notify('삭제되었습니다');
    },
    [session, reloadChildren, notify],
  );

  const exportJSON = useCallback(async () => {
    const text = await backup.exportAllJSON();
    backup.downloadFile(`casino-survival-${todayStr()}.json`, text);
    notify('JSON 백업 파일을 다운로드했습니다');
  }, [notify]);

  const importJSON = useCallback(
    async (text: string): Promise<backup.ImportReport> => {
      const report = await backup.importAllJSON(text);
      if (report.ok) {
        const projs = (await db.getAll<Project>('projects')).sort((a, b) => a.createdAt - b.createdAt);
        setProjects(projs);
        const st = await db.get<AppSettings>('settings', 'app');
        if (st) setSettings(st);
        const pick = project && projs.some((p) => p.id === project.id)
          ? projs.find((p) => p.id === project.id)!
          : projs.find((p) => p.status === 'ACTIVE') ?? projs[0] ?? null;
        setProject(pick);
        if (pick) await loadProjectData(pick.id);
        else { setSession(null); setSessions([]); setRounds([]); setAiProfiles([]); setAiRecords([]); }
      }
      return report;
    },
    [project, loadProjectData],
  );

  const exportCSV = useCallback(async () => {
    if (!project) return;
    const csv = await backup.buildRoundsCSV(project.id);
    backup.downloadFile(`casino-rounds-${todayStr()}.csv`, csv, 'text/csv');
    notify('CSV 파일을 다운로드했습니다');
  }, [project, notify]);

  const resetAll = useCallback(async () => {
    await backup.resetAllData();
    const st = defaultSettings();
    await db.put('settings', st);
    setSettings(st);
    setProjects([]); setProject(null); setSessions([]); setSession(null);
    setRounds([]); setAiProfiles([]); setAiRecords([]); setReviews([]); setEvents([]);
    setActiveTable(null); setActiveShoe(null);
    localStorage.removeItem('csj:lastProject');
    setTab('home');
    notify('모든 데이터가 초기화되었습니다');
  }, [notify, setTab]);

  const value: Ctx = {
    ready, tab, setTab, toast, notify,
    projects, project, sessions, session, activeTable, activeShoe,
    rounds, aiProfiles, aiRecords, reviews, events, settings,
    userStats, aiStates, game,
    createProject, openProject, archiveProject, updateProjectInfo,
    startSession, addRound, updateLastRound, deleteLastRound,
    doEndShoe, doMoveTable, doTogglePause, doEndSession,
    upsertAI, addAI, setMeetingParticipants, selectMeetingParticipants,
    saveReview, deleteReview, updateSettings,
    exportJSON, importJSON, exportCSV, resetAll,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
