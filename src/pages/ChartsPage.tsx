import { useEffect, useState } from 'react';
import { useApp } from '../app/store';
import { Btn, Card, Empty, SectionTitle, Stat } from '../components/ui';
import { BarChart, LineChart, aiColor, type Series } from '../components/charts';
import { getProjectBundle, type ProjectBundle } from '../services/queries';
import {
  balanceSeries, computeAIState, computeCareer, computeUserStats, rankSeriesPerRound, round2,
} from '../utils/statistics';
import { ChartLine } from 'lucide-react';

export default function ChartsPage() {
  const app = useApp();
  const { project, session, rounds, aiProfiles, aiRecords } = app;
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);

  useEffect(() => {
    let dead = false;
    if (!project) return;
    void getProjectBundle(project.id).then((b) => { if (!dead) setBundle(b); });
    return () => { dead = true; };
  }, [project, session, rounds.length, aiRecords.length]);

  if (!project) {
    return <Empty icon={<ChartLine size={28} />} title="프로젝트가 없습니다" desc="홈에서 프로젝트를 먼저 만들어주세요." action={<Btn variant="gold" onClick={() => app.setTab('home')}>홈으로</Btn>} />;
  }

  const moneySingle = (n: number) => `$${Math.abs(n) < 1000 ? n.toFixed(0) : (n / 1000).toFixed(1) + 'k'}`;

  // ===== User 차트 =====
  const userBalancePts = session ? balanceSeries(session, rounds).map((p) => ({ x: p.round, y: p.balance })) : [];
  const dailyPL = (bundle?.sessions ?? []).map((s) => {
    if (s.status === 'ENDED') return { label: s.date.slice(5), value: s.actualProfitLoss };
    if (s.id === session?.id) return { label: `${s.date.slice(5)}·진행`, value: computeUserStats(s, rounds).actualProfitLoss };
    return { label: s.date.slice(5), value: 0 };
  });
  let acc = 0;
  const cumulativePts = (bundle?.sessions ?? []).map((s, i) => {
    const pl = s.status === 'ENDED' ? s.actualProfitLoss : s.id === session?.id ? computeUserStats(s, rounds).actualProfitLoss : 0;
    acc = round2(acc + pl);
    return { x: i + 1, y: acc };
  });

  // ===== AI 차트 (현재 세션) =====
  const activeIds = aiProfiles.filter((p) => p.active).map((p) => p.id);
  const aiDailyStates = session ? activeIds.map((id) => computeAIState(id, aiRecords, session.startBalance)) : [];
  const top6 = [...aiDailyStates].sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl)).slice(0, 6);
  const aiAssetSeries: Series[] = top6.map((s) => {
    const idx = aiProfiles.findIndex((p) => p.id === s.aiId);
    const mine = aiRecords.filter((r) => r.aiId === s.aiId).sort((a, b) => a.roundNumber - b.roundNumber);
    return {
      name: aiProfiles.find((p) => p.id === s.aiId)?.name.split(' ').slice(-1)[0] ?? s.aiId.slice(0, 4),
      color: aiColor(idx),
      points: [{ x: 0, y: session?.startBalance ?? 0 }, ...mine.map((r) => ({ x: r.roundNumber, y: r.bankrollAfter }))],
    };
  });
  const rankMap = rankSeriesPerRound(aiRecords, top6.slice(0, 5).map((s) => s.aiId));
  const rankSeries: Series[] = top6.slice(0, 5).map((s) => {
    const idx = aiProfiles.findIndex((p) => p.id === s.aiId);
    return {
      name: aiProfiles.find((p) => p.id === s.aiId)?.name.split(' ').slice(-1)[0] ?? '',
      color: aiColor(idx),
      points: (rankMap.get(s.aiId) ?? []).map((p) => ({ x: p.round, y: p.rank })),
    };
  });

  // 커리어 (누적)
  const careerBars = aiProfiles.filter((p) => p.active).map((p) => {
    const c = computeCareer(p.id, bundle?.aiRecords ?? []);
    return { label: p.name.split(' ').slice(-1)[0] ?? p.name, value: c.careerPL, hint: `${c.sessions}일` };
  });
  const winRateBars = aiDailyStates
    .filter((s) => s.bets > 0)
    .map((s) => ({ label: aiProfiles.find((p) => p.id === s.aiId)?.name.split(' ').slice(-1)[0] ?? '', value: s.winRate, color: '#93c5fd' }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-black text-slate-100">Charts</h1>

      {!session && <Empty icon={<ChartLine size={28} />} title="아직 세션 기록이 없습니다" desc="게임을 시작하면 차트가 채워집니다." action={<Btn variant="gold" onClick={() => app.setTab('game')}>게임 시작</Btn>} />}

      {session && (
        <>
          <SectionTitle>User (실제 자산)</SectionTitle>
          <Card title="잔액 변화 (오늘)">
            <LineChart
              series={[{ name: 'User 잔액', color: '#ffd97a', points: userBalancePts }]}
              yFmt={moneySingle}
              yLabel="R"
            />
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Card title="일별 P/L">
              <BarChart items={dailyPL} valueFmt={(n) => `${n > 0 ? '+' : ''}${n}`} />
            </Card>
            <Card title="프로젝트 누적 P/L">
              {cumulativePts.length ? (
                <LineChart series={[{ name: '누적', color: '#6ee7b7', points: cumulativePts }]} yFmt={moneySingle} height={150} />
              ) : (
                <p className="py-4 text-center text-xs text-slate-600">데이터 없음</p>
              )}
            </Card>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="예측 적중률" value={`${computeUserStats(session, rounds).predictionHitRate}%`} sub="Prediction Only 분리" />
            <Stat label="베팅 승률" value={`${computeUserStats(session, rounds).actualBetWinRate}%`} sub={`${computeUserStats(session, rounds).winCount}승 ${computeUserStats(session, rounds).lossCount}패`} />
            <Stat label="오늘 수익률" value={`${computeUserStats(session, rounds).dailyReturn}%`} />
          </div>

          <SectionTitle>AI (가상 자산 · 사용자 자산과 분리)</SectionTitle>
          <Card title="AI별 자산 변화 (상위 6 · 오늘)">
            <LineChart series={aiAssetSeries} yFmt={moneySingle} yLabel="R" />
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Card title="AI 순위 변화 (Top 5)">
              {rankSeries.some((s) => s.points.length > 0) ? (
                <LineChart series={rankSeries} yFmt={(n) => `${Math.round(n)}위`} invertY height={160} yLabel="R" />
              ) : (
                <p className="py-4 text-center text-xs text-slate-600">라운드 데이터 없음</p>
              )}
            </Card>
            <Card title="AI 승률 (오늘)">
              <BarChart items={winRateBars} valueFmt={(n) => `${n}%`} />
            </Card>
          </div>
          <Card title="AI 누적 P/L (Career · 전체 세션)">
            <BarChart items={careerBars} valueFmt={(n) => `${n > 0 ? '+' : ''}${n}`} />
          </Card>
        </>
      )}
    </div>
  );
}
