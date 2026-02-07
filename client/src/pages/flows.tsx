import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, PieChart as PieChartIcon, TrendingUp, TrendingDown, AlertTriangle, Layers } from "lucide-react";
import { formatBalance, formatBalanceChange, truncateAddress, getCategoryColor } from "@/lib/utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface FlowsData {
  snapshotDate: string;
  snapshotTime: string;
  concentration: {
    top10: { balance: number; percentage: number };
    top20: { balance: number; percentage: number };
    top100: { balance: number; percentage: number };
  };
  categoryBreakdown: Array<{
    category: string;
    balance: number;
    count: number;
    percentage: number;
  }>;
  flowTrend: Array<{
    date: string;
    timeSlot: string;
    totalBalance: number;
    top10Balance: number;
    top20Balance: number;
  }>;
  significantMovements: Array<{
    address: string;
    label: string | null;
    category: string | null;
    rank: number;
    balance: number;
    balanceChange: number;
    rankChange: number | null;
  }>;
  totalBalance: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  sidechain: "#3b82f6",
  pool: "#22c55e",
  dao: "#a855f7",
  exchange: "#f97316",
  burn: "#eab308",
  unknown: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  sidechain: "Sidechains",
  pool: "Staking Pools",
  dao: "DAO / Treasury",
  exchange: "Exchanges",
  burn: "Burn Addresses",
  unknown: "Unknown Wallets",
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
};

export default function Flows() {
  const { data, isLoading } = useQuery<FlowsData>({
    queryKey: ["/api/flows"],
    refetchInterval: 300000,
  });

  if (isLoading) return <FlowsSkeleton />;
  if (!data) return null;

  const pieData = data.categoryBreakdown.map((c) => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    value: c.balance,
    count: c.count,
    percentage: c.percentage,
    color: CATEGORY_COLORS[c.category] || "#6b7280",
  }));

  const concentrationData = [
    { name: "Top 10", percentage: data.concentration.top10.percentage, balance: data.concentration.top10.balance },
    { name: "Top 11-20", percentage: data.concentration.top20.percentage - data.concentration.top10.percentage, balance: data.concentration.top20.balance - data.concentration.top10.balance },
    { name: "Top 21-100", percentage: 100 - data.concentration.top20.percentage, balance: data.concentration.top100.balance - data.concentration.top20.balance },
  ];

  const concentrationPieData = concentrationData.map((d, i) => ({
    name: d.name,
    value: d.balance,
    percentage: d.percentage,
    color: ["#3b82f6", "#8b5cf6", "#6b7280"][i],
  }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-flows-title">Where Is ELA Going?</h2>
          <p className="text-xs text-muted-foreground">Flow analysis of {data.snapshotDate} {data.snapshotTime} UTC</p>
        </div>
        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
          <Activity className="w-3 h-3 mr-1" />
          Total: {formatBalance(data.totalBalance)} ELA
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="card-concentration-top10">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Top 10 Wallets</p>
            <p className="text-2xl font-bold font-mono">{data.concentration.top10.percentage.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBalance(data.concentration.top10.balance)} ELA</p>
          </CardContent>
        </Card>
        <Card data-testid="card-concentration-top20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Top 20 Wallets</p>
            <p className="text-2xl font-bold font-mono">{data.concentration.top20.percentage.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBalance(data.concentration.top20.balance)} ELA</p>
          </CardContent>
        </Card>
        <Card data-testid="card-concentration-top100">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Top 100 Wallets</p>
            <p className="text-2xl font-bold font-mono">{formatBalance(data.totalBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total ELA in top 100</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-category-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-blue-400" />
              Where ELA Sits (by Category)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatBalance(value) + " ELA", "Balance"]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {data.categoryBreakdown.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-xs" data-testid={`row-category-${c.category}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.category] || "#6b7280" }} />
                    <span>{CATEGORY_LABELS[c.category] || c.category}</span>
                    <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{c.count}</Badge>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-muted-foreground">{c.percentage.toFixed(1)}%</span>
                    <span>{formatBalance(c.balance)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-concentration-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              Concentration Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={concentrationPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {concentrationPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatBalance(value) + " ELA", "Balance"]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {concentrationData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ["#3b82f6", "#8b5cf6", "#6b7280"][i] }} />
                    <span>{d.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-muted-foreground">{d.percentage.toFixed(1)}%</span>
                    <span>{formatBalance(d.balance)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.flowTrend.length > 1 && (
        <Card data-testid="card-balance-trends">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Balance Trends (Last 50 Snapshots)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.flowTrend} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [formatBalance(value) + " ELA", name]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="totalBalance"
                  name="Top 100"
                  stroke="#6b7280"
                  fill="#6b7280"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="top20Balance"
                  name="Top 20"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="top10Balance"
                  name="Top 10"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {data.significantMovements.length > 0 && (
        <Card data-testid="card-significant-movements">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Significant Movements ({">"}1,000 ELA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.significantMovements.map((m) => (
              <Link key={m.address} href={`/address/${m.address}`}>
                <div
                  className="flex items-center justify-between gap-3 p-3 rounded-md hover-elevate"
                  data-testid={`row-movement-${m.rank}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{m.rank}</span>
                    <div className="min-w-0">
                      {m.label ? (
                        <Badge variant="outline" className={`text-xs mb-0.5 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(m.category)}`}>
                          {m.label}
                        </Badge>
                      ) : null}
                      <p className="font-mono text-xs text-muted-foreground truncate">{truncateAddress(m.address)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      {m.balanceChange > 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      <span className={`text-sm font-mono ${m.balanceChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatBalanceChange(m.balanceChange)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{formatBalance(m.balance)} ELA</p>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FlowsSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
