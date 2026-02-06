import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { AddressDisplay } from "@/components/address-display";
import { formatBalance, formatBalanceChange, getCategoryColor } from "@/lib/utils";
import { Award, TrendingUp, TrendingDown, Calendar, Hash, BarChart3, Activity } from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AddressData {
  address: string;
  label: string | null;
  category: string | null;
  currentRank: number | null;
  firstSeen: string;
  lastSeen: string;
  totalAppearances: number;
  bestRank: number;
  worstRank: number;
  history: Array<{
    date: string;
    timeSlot: string;
    rank: number;
    balance: number;
    balanceChange: number | null;
  }>;
}

export default function AddressDetail() {
  const params = useParams<{ address: string }>();
  const address = params.address;

  const { data, isLoading, error } = useQuery<AddressData>({
    queryKey: ["/api/address", address],
    enabled: !!address,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Address not found</h2>
          <p className="text-sm text-muted-foreground">This address has no recorded history yet.</p>
        </div>
      </div>
    );
  }

  const rankData = data.history.map((h) => ({
    date: `${h.date} ${h.timeSlot}`,
    rank: h.rank,
  }));

  const balanceData = data.history.map((h) => ({
    date: `${h.date} ${h.timeSlot}`,
    balance: h.balance,
  }));

  const currentBalance = data.history.length > 0 ? data.history[data.history.length - 1].balance : 0;
  const firstBalance = data.history.length > 0 ? data.history[0].balance : 0;
  const trendUp = currentBalance >= firstBalance;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          {data.label && (
            <Badge variant="outline" className={`no-default-hover-elevate no-default-active-elevate ${getCategoryColor(data.category)}`}>
              {data.label}
            </Badge>
          )}
          {data.currentRank ? (
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/20 bg-emerald-400/10 no-default-hover-elevate no-default-active-elevate">
              Currently #{data.currentRank}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground no-default-hover-elevate no-default-active-elevate">
              Not in Top 50
            </Badge>
          )}
        </div>
        <AddressDisplay address={data.address} truncate={false} showCopy={true} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Best Rank" value={`#${data.bestRank}`} icon={Award} iconColor="text-amber-400" />
        <StatCard title="Worst Rank" value={`#${data.worstRank}`} icon={BarChart3} iconColor="text-blue-400" />
        <StatCard title="First Seen" value={data.firstSeen} icon={Calendar} iconColor="text-emerald-400" />
        <StatCard title="Appearances" value={data.totalAppearances} icon={Hash} iconColor="text-purple-400" />
      </div>

      {rankData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rank History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={rankData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis reversed domain={[1, 50]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="rank" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {balanceData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Balance History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [formatBalance(value), "Balance"]}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={trendUp ? "#22c55e" : "#ef4444"}
                  fill={trendUp ? "#22c55e20" : "#ef444420"}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Appearance Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Rank</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.history].reverse().slice(0, 50).map((h, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{h.date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.timeSlot}</TableCell>
                    <TableCell className="text-center text-sm">#{h.rank}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatBalance(h.balance)}</TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {h.balanceChange !== null ? (
                        <span className={`text-xs font-mono ${h.balanceChange > 0 ? "text-emerald-400" : h.balanceChange < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {formatBalanceChange(h.balanceChange)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
