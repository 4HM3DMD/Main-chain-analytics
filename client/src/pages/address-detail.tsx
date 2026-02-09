import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useChain, CHAINS } from "@/lib/chain-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { AddressDisplay } from "@/components/address-display";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  formatBalance, formatBalanceChange, getCategoryColor,
  formatStreak, getStreakColor, formatVolatility, getVolatilityLevel,
  formatTrend, getTrendColor,
} from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Award, TrendingUp, TrendingDown, Calendar, Hash, BarChart3, Activity, Gauge, Zap, Target, Pencil, ExternalLink, ArrowDownUp } from "lucide-react";
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
  notes: string | null;
  currentRank: number | null;
  firstSeen: string;
  lastSeen: string;
  totalAppearances: number;
  bestRank: number;
  worstRank: number;
  analytics: {
    rankVolatility: number | null;
    balanceTrend: string | null;
    rankStreak: number | null;
    balanceStreak: number | null;
    hasDormancy: boolean;
    missedSnapshots: number;
    totalSnapshots: number;
  };
  history: Array<{
    date: string;
    timeSlot: string;
    rank: number;
    balance: number;
    balanceChange: number | null;
    rankStreak: number | null;
    balanceStreak: number | null;
    balanceTrend: string | null;
  }>;
}

const CATEGORIES = [
  { value: "exchange", label: "Exchange" },
  { value: "whale", label: "Known Whale" },
  { value: "ef", label: "Elastos Foundation" },
  { value: "dao", label: "DAO / Treasury" },
  { value: "pool", label: "Staking Pool" },
  { value: "sidechain", label: "Sidechain" },
  { value: "burn", label: "Burn Address" },
  { value: "other", label: "Other" },
];

export default function AddressDetail() {
  const params = useParams<{ chain?: string; address: string }>();
  const address = params.address;
  const { toast } = useToast();
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelForm, setLabelForm] = useState({ label: "", category: "", notes: "" });
  const { chain, chainInfo } = useChain();
  const topN = chainInfo.topN;
  const chainSuffix = chain !== "mainchain" ? `chain=${chain}` : "";

  const { data, isLoading, error } = useQuery<AddressData>({
    queryKey: ["/api/address", address, ...(chainSuffix ? [`?${chainSuffix}`] : [])],
    enabled: !!address,
  });

  const labelMutation = useMutation({
    mutationFn: async (body: { address: string; label: string; category: string; notes: string }) => {
      const res = await apiRequest("POST", "/api/labels", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Label saved", description: "Address label has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/address", address] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setLabelDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const openLabelDialog = () => {
    setLabelForm({
      label: data?.label || "",
      category: data?.category || "",
      notes: data?.notes || "",
    });
    setLabelDialogOpen(true);
  };

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
              Not in Top {topN}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AddressDisplay address={data.address} truncate={false} showCopy={true} showExplorer={true} />
          <Button variant="outline" size="sm" onClick={openLabelDialog} className="shrink-0">
            <Pencil className="w-3 h-3 mr-1.5" />
            {data.label ? "Edit Label" : "Add Label"}
          </Button>
        </div>
      </div>

      {/* Intel Notes */}
      {data.notes && (
        <Card className="border-cyan-400/20 bg-cyan-400/5">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-400/10 flex items-center justify-center shrink-0 mt-0.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-cyan-400 mb-1">Intel Note</p>
              <p className="text-sm text-muted-foreground">{data.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Best Rank" value={`#${data.bestRank}`} icon={Award} iconColor="text-amber-400" />
        <StatCard title="Worst Rank" value={`#${data.worstRank}`} icon={BarChart3} iconColor="text-blue-400" />
        <StatCard title="First Seen" value={data.firstSeen} icon={Calendar} iconColor="text-emerald-400" />
        <StatCard title="Appearances" value={data.totalAppearances} icon={Hash} iconColor="text-purple-400" />
      </div>

      {/* Advanced Analytics */}
      {data.analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-xs text-muted-foreground">Balance Trend</p>
              </div>
              <Badge variant="outline" className={`no-default-hover-elevate no-default-active-elevate ${getTrendColor(data.analytics.balanceTrend)}`}>
                {formatTrend(data.analytics.balanceTrend)}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-xs text-muted-foreground">Rank Volatility</p>
              </div>
              <p className="text-lg font-bold font-mono">{formatVolatility(data.analytics.rankVolatility)}</p>
              <p className="text-[10px] text-muted-foreground">{getVolatilityLevel(data.analytics.rankVolatility)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs text-muted-foreground">Rank Streak</p>
              </div>
              <p className={`text-lg font-bold font-mono ${getStreakColor(data.analytics.rankStreak)}`}>
                {formatStreak(data.analytics.rankStreak)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <p className="text-xs text-muted-foreground">Balance Streak</p>
              </div>
              <p className={`text-lg font-bold font-mono ${getStreakColor(data.analytics.balanceStreak)}`}>
                {formatStreak(data.analytics.balanceStreak)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dormancy Alert */}
      {data.analytics?.hasDormancy && (
        <Card className="border-amber-400/30 bg-amber-400/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">Dormancy Detected</p>
              <p className="text-xs text-muted-foreground">
                This wallet has been absent from the top {topN} for {data.analytics.missedSnapshots} snapshots
                out of {data.analytics.totalSnapshots} total.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {rankData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rank History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={rankData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--muted-foreground))" />
                <YAxis reversed domain={[1, topN]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
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
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
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

      {/* Recent On-Chain Transactions */}
      <RecentTransactions address={data.address} />

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

      {/* Label Edit Dialog */}
      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{data.label ? "Edit Label" : "Add Label"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Label *</label>
              <Input
                placeholder="e.g. KuCoin Exchange, Paxen Whale..."
                value={labelForm.label}
                onChange={(e) => setLabelForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select value={labelForm.category} onValueChange={(v) => setLabelForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input
                placeholder="Any additional context or intel..."
                value={labelForm.notes}
                onChange={(e) => setLabelForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={!labelForm.label || labelMutation.isPending}
              onClick={() => labelMutation.mutate({ address: data.address, ...labelForm })}
            >
              {labelMutation.isPending ? "Saving..." : "Save Label"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Recent Transactions Component ────────────────────────────────────────

interface TxData {
  address: string;
  balance: number;
  totalReceived: number;
  totalSent: number;
  txCount: number;
  transactions: Array<{
    txid: string;
    time: string | null;
    value: number;
    type: "receive" | "send" | "unknown";
    blockhash: string;
  }>;
}

function RecentTransactions({ address }: { address: string }) {
  const { chain } = useChain();
  const chainSuffix = chain !== "mainchain" ? `chain=${chain}` : "";

  const { data, isLoading, error } = useQuery<TxData>({
    queryKey: ["/api/address", address, `transactions${chainSuffix ? `?${chainSuffix}` : ""}`],
  });

  if (error) return null; // Silently fail — blockchain API might be down
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent On-Chain Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (!data || data.transactions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowDownUp className="w-4 h-4 text-blue-400" />
            Recent On-Chain Transactions
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{data.txCount} total txns</span>
            <a
              href={`${CHAINS[chain].explorerUrl}/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:underline"
            >
              Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="text-right">Amount (ELA)</TableHead>
                <TableHead className="hidden md:table-cell">Time</TableHead>
                <TableHead className="hidden lg:table-cell">TX ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions.slice(0, 15).map((tx, i) => (
                <TableRow key={`${tx.txid}-${i}`}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${
                        tx.type === "receive"
                          ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                          : tx.type === "send"
                          ? "text-red-400 border-red-400/20 bg-red-400/10"
                          : "text-muted-foreground"
                      }`}
                    >
                      {tx.type === "receive" ? "IN" : tx.type === "send" ? "OUT" : "?"}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs ${
                    tx.type === "receive" ? "text-emerald-400" : tx.type === "send" ? "text-red-400" : ""
                  }`}>
                    {tx.type === "receive" ? "+" : tx.type === "send" ? "-" : ""}{formatBalance(tx.value)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                    {tx.time ? new Date(tx.time).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <a
                      href={`${CHAINS[chain].explorerUrl.replace("/address", "/tx")}/${tx.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-blue-400 hover:underline"
                    >
                      {tx.txid.slice(0, 12)}...{tx.txid.slice(-8)}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Summary row */}
        <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Total received: <span className="font-mono text-emerald-400">{formatBalance(data.totalReceived)} ELA</span></span>
          <span>Total sent: <span className="font-mono text-red-400">{formatBalance(data.totalSent)} ELA</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
