import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useChain } from "@/lib/chain-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon,
  Gauge, Zap, ArrowUpDown, Eye, Download, Layers, Target, Flame, Ghost,
} from "lucide-react";
import {
  formatBalance, formatBalanceChange, formatCompact, truncateAddress,
  formatGini, getGiniLabel, getGiniColor,
  formatHHI, getHHILabel,
  formatWAI, getWAILevel, getWAIColor,
  formatTrend, getTrendColor,
  formatStreak, getStreakColor,
  formatVolatility, getVolatilityLevel,
  formatSignedChange, getChangeColor,
  getCategoryColor,
  getWealthSpreadLevel, getWealthSpreadPct, getWealthSpreadDescription,
  formatSupplyPct, ELA_TOTAL_SUPPLY,
} from "@/lib/utils";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConcentrationMetric {
  date: string;
  timeSlot: string;
  giniCoefficient: number | null;
  hhi: number | null;
  top10Pct: number | null;
  top20Pct: number | null;
  top50Pct: number | null;
  netFlow: number | null;
  totalInflow: number | null;
  totalOutflow: number | null;
  whaleActivityIndex: number | null;
  activeWallets: number | null;
  totalBalance: number | null;
  newEntryCount: number | null;
  dropoutCount: number | null;
}

interface OverviewData {
  current: ConcentrationMetric | null;
  trends: {
    gini24h: number | null;
    gini7d: number | null;
    wai24h: number | null;
    netFlow24h: number | null;
  };
  history: ConcentrationMetric[];
  weeklySummaries: Array<{
    weekStart: string;
    weekEnd: string;
    giniStart: number | null;
    giniEnd: number | null;
    giniChange: number | null;
    netFlowTotal: number | null;
    avgWhaleActivityIndex: number | null;
    totalNewEntries: number | null;
    totalDropouts: number | null;
    snapshotCount: number | null;
  }>;
}

interface AccumulationData {
  summary: {
    accumulating: number;
    distributing: number;
    holding: number;
    erratic: number;
    unknown: number;
  };
  wallets: Array<{
    address: string;
    rank: number;
    balance: number;
    balanceTrend: string | null;
    balanceStreak: number | null;
    rankStreak: number | null;
    rankVolatility: number | null;
    balanceChange: number | null;
    label: string | null;
    category: string | null;
  }>;
}

interface StreakData {
  type: string;
  leaders: Array<{
    address: string;
    rank: number;
    balance: number;
    streak: number | null;
    rankVolatility: number | null;
    balanceTrend: string | null;
    label: string | null;
    category: string | null;
  }>;
}

interface NetFlowData {
  flows: Array<{
    date: string;
    timeSlot: string;
    netFlow: number | null;
    totalInflow: number | null;
    totalOutflow: number | null;
    totalBalance: number | null;
    whaleActivityIndex: number | null;
  }>;
}

interface DormantData {
  wallets: Array<{
    address: string;
    label: string | null;
    category: string | null;
    first_seen: string;
    last_seen: string;
    appearances: number;
    total_snapshots: number;
    missed_snapshots: number;
  }>;
}

interface GhostWalletsData {
  maxAppearances: number;
  total: number;
  byStintLength: Record<number, number>;
  wallets: Array<{
    address: string;
    label: string | null;
    category: string | null;
    total_appearances: number;
    first_seen: string;
    last_seen: string;
    avg_balance: number;
    peak_balance: number;
    best_rank: number;
    worst_rank: number;
    ghost_score: number;
  }>;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

const tickStyle = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
const axisStroke = "hsl(var(--muted-foreground))";

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const [trendFilter, setTrendFilter] = useState<string | null>(null);
  const [streakType, setStreakType] = useState<"rank" | "balance">("rank");
  const [ghostMaxAppearances, setGhostMaxAppearances] = useState(3);
  const { chain, chainInfo } = useChain();
  const topN = chainInfo.topN;
  const chainSuffix = chain !== "mainchain" ? `chain=${chain}` : "";

  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewData>({
    queryKey: ["/api/analytics/overview", ...(chainSuffix ? [`?${chainSuffix}`] : [])],
    refetchInterval: 300000,
  });

  const { data: accumulation, isLoading: accLoading } = useQuery<AccumulationData>({
    queryKey: ["/api/analytics/accumulation", ...(chainSuffix ? [`?${chainSuffix}`] : [])],
    enabled: activeTab === "accumulation",
  });

  const { data: streaks, isLoading: streaksLoading } = useQuery<StreakData>({
    queryKey: ["/api/analytics/streaks", `?type=${streakType}${chainSuffix ? `&${chainSuffix}` : ""}`],
    enabled: activeTab === "streaks",
  });

  const { data: netFlows, isLoading: flowsLoading } = useQuery<NetFlowData>({
    queryKey: ["/api/analytics/net-flows", ...(chainSuffix ? [`?${chainSuffix}`] : [])],
    enabled: activeTab === "flows",
  });

  const { data: dormant, isLoading: dormantLoading } = useQuery<DormantData>({
    queryKey: ["/api/analytics/dormant", ...(chainSuffix ? [`?${chainSuffix}`] : [])],
    enabled: activeTab === "dormant",
  });

  const { data: ghosts, isLoading: ghostsLoading } = useQuery<GhostWalletsData>({
    queryKey: ["/api/analytics/ghost-wallets", `?maxAppearances=${ghostMaxAppearances}${chainSuffix ? `&${chainSuffix}` : ""}`],
    enabled: activeTab === "ghosts",
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Advanced Analytics</h2>
          <p className="text-xs text-muted-foreground">Deep insights into whale behavior and wealth distribution</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/export/analytics?format=csv" target="_blank" rel="noopener">
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ghosts">Ghost Wallets</TabsTrigger>
          <TabsTrigger value="accumulation">Accumulation</TabsTrigger>
          <TabsTrigger value="streaks">Streaks</TabsTrigger>
          <TabsTrigger value="flows">Net Flows</TabsTrigger>
          <TabsTrigger value="dormant">Dormancy</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          {overviewLoading ? <AnalyticsSkeleton /> : overview ? (
            <>
              {/* Key Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Wealth Spread — plain-English Gini */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="w-4 h-4 text-blue-400" />
                      <p className="text-xs text-muted-foreground">Wealth Spread</p>
                    </div>
                    <p className="text-lg font-semibold">{getWealthSpreadLevel(overview.current?.giniCoefficient)}</p>
                    <div className="mt-2">
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${getWealthSpreadPct(overview.current?.giniCoefficient)}%`,
                            background: "linear-gradient(90deg, #22c55e, #eab308 50%, #ef4444)",
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>Even</span>
                        <span className="font-mono">{formatGini(overview.current?.giniCoefficient)}</span>
                        <span>Concentrated</span>
                      </div>
                    </div>
                    {overview.trends.gini24h !== null && (
                      <p className={`text-[10px] font-mono mt-1 ${overview.trends.gini24h === 0 ? "text-muted-foreground" : overview.trends.gini24h > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        24h: {formatSignedChange(overview.trends.gini24h).text}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Whale Activity */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <p className="text-xs text-muted-foreground">Whale Activity</p>
                    </div>
                    <p className={`text-2xl font-bold font-mono ${getWAIColor(overview.current?.whaleActivityIndex)}`}>
                      {formatWAI(overview.current?.whaleActivityIndex)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{getWAILevel(overview.current?.whaleActivityIndex)}</p>
                  </CardContent>
                </Card>

                {/* Net Flow */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUpDown className="w-4 h-4 text-emerald-400" />
                      <p className="text-xs text-muted-foreground">Net Flow (Latest)</p>
                    </div>
                    <p className={`text-2xl font-bold font-mono ${getChangeColor(overview.current?.netFlow)}`}>
                      {overview.current?.netFlow !== null && overview.current?.netFlow !== undefined
                        ? formatCompact(overview.current.netFlow)
                        : "—"
                      }
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {overview.current?.totalInflow !== null && overview.current?.totalInflow !== undefined && overview.current.totalInflow >= 1 && (
                        <span className="text-xs text-emerald-400">↑{formatCompact(overview.current.totalInflow)}</span>
                      )}
                      {overview.current?.totalOutflow !== null && overview.current?.totalOutflow !== undefined && overview.current.totalOutflow >= 1 && (
                        <span className="text-xs text-red-400">↓{formatCompact(overview.current.totalOutflow)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Supply Context — replaces raw HHI */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <p className="text-xs text-muted-foreground">Supply Held by Top {topN}</p>
                    </div>
                    <p className="text-2xl font-bold font-mono">
                      {overview.current?.totalBalance
                        ? formatSupplyPct(overview.current.totalBalance)
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {overview.current?.totalBalance
                        ? `${formatBalance(overview.current.totalBalance)} of ~${(ELA_TOTAL_SUPPLY / 1000000).toFixed(1)}M ELA`
                        : ""}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gini Coefficient Over Time */}
              {overview.history.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-blue-400" />
                      Is Wealth Spreading or Concentrating?
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">Higher = more concentrated in fewer wallets. Lower = more evenly spread.</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={overview.history} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={tickStyle} stroke={axisStroke} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} labelFormatter={(l) => `Date: ${l}`} />
                        <Line type="monotone" dataKey="giniCoefficient" name="Gini" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* WAI + Active Wallets Over Time */}
              {overview.history.length > 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        How Active Are Whales?
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={overview.history} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={tickStyle} stroke={axisStroke} />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} labelFormatter={(l) => `Date: ${l}`} />
                          <Area type="monotone" dataKey="whaleActivityIndex" name="WAI" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        Who Holds the Most? (Top 10 / 20 / 50)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={overview.history} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={tickStyle} stroke={axisStroke} unit="%" />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} labelFormatter={(l) => `Date: ${l}`} />
                          <Area type="monotone" dataKey="top10Pct" name="Top 10" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                          <Area type="monotone" dataKey="top20Pct" name="Top 20" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={1.5} />
                          <Area type="monotone" dataKey="top50Pct" name="Top 50" stroke="#6b7280" fill="#6b728010" strokeWidth={1} />
                          <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Weekly Summaries */}
              {overview.weeklySummaries.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      Weekly Summaries
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Week</TableHead>
                            <TableHead className="text-center">Snapshots</TableHead>
                            <TableHead className="text-right">Net Flow</TableHead>
                            <TableHead className="text-right">Avg WAI</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Gini Change</TableHead>
                            <TableHead className="text-center hidden md:table-cell">New</TableHead>
                            <TableHead className="text-center hidden md:table-cell">Dropped</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overview.weeklySummaries.map((w) => (
                            <TableRow key={w.weekStart}>
                              <TableCell className="font-mono text-xs">{w.weekStart}</TableCell>
                              <TableCell className="text-center text-xs">{w.snapshotCount}</TableCell>
                              <TableCell className={`text-right font-mono text-xs ${getChangeColor(w.netFlowTotal)}`}>
                                {w.netFlowTotal !== null ? formatCompact(w.netFlowTotal) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">{w.avgWhaleActivityIndex?.toFixed(2) ?? "—"}</TableCell>
                              <TableCell className={`text-right font-mono text-xs hidden md:table-cell ${w.giniChange === null || w.giniChange === undefined || w.giniChange === 0 ? "text-muted-foreground" : w.giniChange > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                {w.giniChange !== null ? formatSignedChange(w.giniChange).text : "—"}
                              </TableCell>
                              <TableCell className="text-center text-xs text-emerald-400 hidden md:table-cell">{w.totalNewEntries ?? 0}</TableCell>
                              <TableCell className="text-center text-xs text-red-400 hidden md:table-cell">{w.totalDropouts ?? 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-sm font-semibold mb-2">No Analytics Data Yet</h3>
                <p className="text-xs text-muted-foreground">Analytics are computed after each snapshot. Take a snapshot to start generating data.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── GHOST WALLETS TAB ─────────────────────────────────────── */}
        <TabsContent value="ghosts" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Ghost className="w-4 h-4 text-violet-400" />
                Shadow Entries
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Wallets that briefly entered the top {topN} then vanished — possible attempts to move large funds without sustained visibility.
              </p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 5].map((n) => (
                <Button
                  key={n}
                  variant={ghostMaxAppearances === n ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setGhostMaxAppearances(n)}
                >
                  {n === 1 ? "1 snapshot" : `≤${n} snapshots`}
                </Button>
              ))}
            </div>
          </div>

          {ghostsLoading ? <AnalyticsSkeleton /> : ghosts ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Ghost className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold font-mono text-violet-400">{ghosts.total}</p>
                    <p className="text-xs text-muted-foreground">Ghost Wallets Found</p>
                  </CardContent>
                </Card>
                {Object.entries(ghosts.byStintLength)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .slice(0, 3)
                  .map(([length, count]) => (
                  <Card key={length}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold font-mono">{count}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number(length) === 1 ? "Single snapshot" : `${length} snapshots`}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Ghost Wallets Table */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Ghost className="w-4 h-4 text-violet-400" />
                      Shadow Entry Log
                    </CardTitle>
                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                      Sorted by suspicion score
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead className="text-center">Sightings</TableHead>
                          <TableHead className="text-center hidden md:table-cell">Best Rank</TableHead>
                          <TableHead className="text-right">Peak Balance</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Avg Balance</TableHead>
                          <TableHead>First Seen</TableHead>
                          <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ghosts.wallets.map((g, i) => (
                          <TableRow key={g.address} className="cursor-pointer hover-elevate">
                            <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <Link href={`/${chain}/address/${g.address}`}>
                                <div className="min-w-0">
                                  {g.label && (
                                    <Badge variant="outline" className={`text-[10px] mr-1 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(g.category)}`}>
                                      {g.label}
                                    </Badge>
                                  )}
                                  <span className="font-mono text-xs text-muted-foreground">{truncateAddress(g.address, 6)}</span>
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${
                                  g.total_appearances === 1
                                    ? "text-red-400 border-red-400/20 bg-red-400/10"
                                    : g.total_appearances === 2
                                    ? "text-amber-400 border-amber-400/20 bg-amber-400/10"
                                    : "text-yellow-400 border-yellow-400/20 bg-yellow-400/10"
                                }`}
                              >
                                {g.total_appearances === 1 ? "Once" : `${g.total_appearances}x`}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs hidden md:table-cell">
                              #{g.best_rank}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatBalance(g.peak_balance)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                              {formatBalance(g.avg_balance)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{g.first_seen}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground hidden lg:table-cell">{g.last_seen}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={`font-mono text-[10px] no-default-hover-elevate no-default-active-elevate ${
                                  g.ghost_score > 100
                                    ? "text-red-400 border-red-400/20 bg-red-400/10"
                                    : g.ghost_score > 30
                                    ? "text-amber-400 border-amber-400/20 bg-amber-400/10"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {g.ghost_score.toFixed(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {ghosts.wallets.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                              <Ghost className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              No ghost wallets detected yet. Need more snapshots for pattern detection.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* What to look for */}
              <Card className="border-violet-400/20 bg-violet-400/5">
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-violet-400 mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    What Makes a Shadow Entry Suspicious?
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground mb-1">Single-Snapshot Appearances</p>
                      <p>Wallet appears once then vanishes. Could indicate a large fund transfer being routed through the address momentarily.</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground mb-1">High Balance, Low Duration</p>
                      <p>Moving significant amounts through an address without maintaining presence suggests intentional brevity.</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground mb-1">Ghost Score</p>
                      <p>Combines peak balance and brevity. Higher score = more suspicious. Scores above 100 warrant close inspection.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Ghost className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-xs text-muted-foreground">No data yet. Ghost wallets are detected after multiple snapshots.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── ACCUMULATION TAB ─────────────────────────────────────── */}
        <TabsContent value="accumulation" className="space-y-6">
          {accLoading ? <AnalyticsSkeleton /> : accumulation ? (
            <>
              {/* Trend Distribution Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { key: "accumulating", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                  { key: "distributing", icon: TrendingDown, color: "text-red-400", bg: "bg-red-400/10" },
                  { key: "holding", icon: Target, color: "text-blue-400", bg: "bg-blue-400/10" },
                  { key: "erratic", icon: Activity, color: "text-amber-400", bg: "bg-amber-400/10" },
                  { key: "unknown", icon: Eye, color: "text-muted-foreground", bg: "bg-muted/50" },
                ].map(({ key, icon: Icon, color, bg }) => (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all ${trendFilter === key ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setTrendFilter(trendFilter === key ? null : key)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center mx-auto mb-2`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <p className={`text-2xl font-bold font-mono ${color}`}>
                        {accumulation.summary[key as keyof typeof accumulation.summary]}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{key}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Accumulation Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Wallet Behavior Classification
                    {trendFilter && (
                      <Badge variant="outline" className="ml-2 text-xs capitalize">
                        {trendFilter}
                        <button className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => setTrendFilter(null)}>×</button>
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-14 text-center">#</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead className="text-center">Trend</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-center hidden md:table-cell">Bal Streak</TableHead>
                          <TableHead className="text-center hidden md:table-cell">Rank Streak</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Volatility</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accumulation.wallets
                          .filter(w => !trendFilter || w.balanceTrend === trendFilter || (trendFilter === "unknown" && !w.balanceTrend))
                          .map((w) => (
                          <TableRow key={w.address} className="cursor-pointer hover-elevate">
                            <TableCell className="text-center font-mono text-sm">
                              <Link href={`/${chain}/address/${w.address}`}>{w.rank}</Link>
                            </TableCell>
                            <TableCell>
                              <Link href={`/${chain}/address/${w.address}`}>
                                <div className="min-w-0">
                                  {w.label && (
                                    <Badge variant="outline" className={`text-[10px] mr-1 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(w.category)}`}>
                                      {w.label}
                                    </Badge>
                                  )}
                                  <span className="font-mono text-xs text-muted-foreground">{truncateAddress(w.address, 6)}</span>
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${getTrendColor(w.balanceTrend)}`}>
                                {formatTrend(w.balanceTrend)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              <Link href={`/${chain}/address/${w.address}`}>{formatBalance(w.balance)}</Link>
                            </TableCell>
                            <TableCell className={`text-center font-mono text-xs hidden md:table-cell ${getStreakColor(w.balanceStreak)}`}>
                              {formatStreak(w.balanceStreak)}
                            </TableCell>
                            <TableCell className={`text-center font-mono text-xs hidden md:table-cell ${getStreakColor(w.rankStreak)}`}>
                              {formatStreak(w.rankStreak)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs hidden lg:table-cell">
                              <span className="text-muted-foreground">{formatVolatility(w.rankVolatility)}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">{getVolatilityLevel(w.rankVolatility)}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ─── STREAKS TAB ──────────────────────────────────────────── */}
        <TabsContent value="streaks" className="space-y-6">
          <div className="flex gap-2">
            <Button
              variant={streakType === "rank" ? "default" : "secondary"}
              size="sm"
              onClick={() => setStreakType("rank")}
            >
              Rank Streaks
            </Button>
            <Button
              variant={streakType === "balance" ? "default" : "secondary"}
              size="sm"
              onClick={() => setStreakType("balance")}
            >
              Balance Streaks
            </Button>
          </div>

          {streaksLoading ? <AnalyticsSkeleton /> : streaks?.leaders ? (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Climbing / Gaining */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    {streakType === "rank" ? "Longest Climb Streaks" : "Longest Gain Streaks"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {streaks.leaders
                    .filter(l => (l.streak || 0) > 0)
                    .slice(0, 10)
                    .map((l, i) => (
                    <Link key={l.address} href={`/${chain}/address/${l.address}`}>
                      <div className="flex items-center justify-between gap-3 p-3 rounded-md hover-elevate">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                          <div className="min-w-0">
                            {l.label && (
                              <Badge variant="outline" className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${getCategoryColor(l.category)}`}>
                                {l.label}
                              </Badge>
                            )}
                            <p className="font-mono text-xs text-muted-foreground truncate">{truncateAddress(l.address)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono text-emerald-400">{formatStreak(l.streak)}</p>
                          <p className="text-xs text-muted-foreground">#{l.rank}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {streaks.leaders.filter(l => (l.streak || 0) > 0).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No active climb streaks</p>
                  )}
                </CardContent>
              </Card>

              {/* Falling / Losing */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    {streakType === "rank" ? "Longest Fall Streaks" : "Longest Loss Streaks"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {streaks.leaders
                    .filter(l => (l.streak || 0) < 0)
                    .slice(0, 10)
                    .map((l, i) => (
                    <Link key={l.address} href={`/${chain}/address/${l.address}`}>
                      <div className="flex items-center justify-between gap-3 p-3 rounded-md hover-elevate">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                          <div className="min-w-0">
                            {l.label && (
                              <Badge variant="outline" className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${getCategoryColor(l.category)}`}>
                                {l.label}
                              </Badge>
                            )}
                            <p className="font-mono text-xs text-muted-foreground truncate">{truncateAddress(l.address)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono text-red-400">{formatStreak(l.streak)}</p>
                          <p className="text-xs text-muted-foreground">#{l.rank}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {streaks.leaders.filter(l => (l.streak || 0) < 0).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No active fall streaks</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* ─── NET FLOWS TAB ────────────────────────────────────────── */}
        <TabsContent value="flows" className="space-y-6">
          {flowsLoading ? <AnalyticsSkeleton /> : netFlows?.flows ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-emerald-400" />
                    Net Flow History (ELA In/Out of Top {topN})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={netFlows.flows} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value: number, name: string) => [formatBalance(value) + " ELA", name]}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
                      <Bar dataKey="totalInflow" name="Inflow" fill="#22c55e" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="totalOutflow" name="Outflow" fill="#ef4444" radius={[2, 2, 0, 0]} />
                      <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Net Flow (Cumulative Direction)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={netFlows.flows} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} formatter={(v: number) => [formatBalance(v) + " ELA", "Net Flow"]} />
                      <Area
                        type="monotone"
                        dataKey="netFlow"
                        name="Net Flow"
                        stroke="#3b82f6"
                        fill="#3b82f620"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <ArrowUpDown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-xs text-muted-foreground">No flow data yet. Data is generated after snapshots.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── DORMANCY TAB ─────────────────────────────────────────── */}
        <TabsContent value="dormant" className="space-y-6">
          {dormantLoading ? <AnalyticsSkeleton /> : dormant?.wallets ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Wallets with Gaps in Top {topN} Presence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead className="text-center">Appearances</TableHead>
                        <TableHead className="text-center">Missed</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Total Snapshots</TableHead>
                        <TableHead>First Seen</TableHead>
                        <TableHead>Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dormant.wallets.map((w) => (
                        <TableRow key={w.address} className="cursor-pointer hover-elevate">
                          <TableCell>
                            <Link href={`/${chain}/address/${w.address}`}>
                              <div className="min-w-0">
                                {w.label && (
                                  <Badge variant="outline" className={`text-[10px] mr-1 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(w.category)}`}>
                                    {w.label}
                                  </Badge>
                                )}
                                <span className="font-mono text-xs text-muted-foreground">{truncateAddress(w.address, 6)}</span>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">{w.appearances}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-amber-400">{w.missed_snapshots}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground hidden md:table-cell">{w.total_snapshots}</TableCell>
                          <TableCell className="font-mono text-xs">{w.first_seen}</TableCell>
                          <TableCell className="font-mono text-xs">{w.last_seen}</TableCell>
                        </TableRow>
                      ))}
                      {dormant.wallets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                            No dormant wallets detected yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-4"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
    </div>
  );
}
