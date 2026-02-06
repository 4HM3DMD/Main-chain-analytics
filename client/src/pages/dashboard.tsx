import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Camera, Clock, Database, Users, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { RankBadge, RankMedal } from "@/components/rank-badge";
import { AddressDisplay } from "@/components/address-display";
import { formatBalance, formatBalanceChange, formatPercentage, timeAgo } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DashboardData {
  snapshot: {
    id: number;
    date: string;
    timeSlot: string;
    fetchedAt: string;
    totalBalances: number;
    totalRichlist: number;
  } | null;
  entries: Array<{
    id: number;
    rank: number;
    address: string;
    balance: number;
    percentage: number;
    prevRank: number | null;
    rankChange: number | null;
    balanceChange: number | null;
    label: string | null;
    category: string | null;
  }>;
  stats: {
    totalSnapshots: number;
    daysTracked: number;
    uniqueAddresses: number;
    firstSnapshotDate: string | null;
  };
  summaries: Array<{
    date: string;
    newEntries: string;
    dropouts: string;
    biggestGainerAddress: string | null;
    biggestGainerChange: number | null;
    biggestLoserAddress: string | null;
    biggestLoserChange: number | null;
  }>;
}

export default function Dashboard() {
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 300000,
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/snapshots/trigger");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Snapshot triggered", description: "A new snapshot has been taken successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (err: Error) => {
      toast({ title: "Snapshot failed", description: err.message, variant: "destructive" });
    },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Failed to load dashboard</h2>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={() => refetch()} data-testid="button-retry">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const dashboard = data!;
  const hasData = dashboard.snapshot !== null && dashboard.entries.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-center max-w-md">
          <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Welcome to ELA Whale Tracker</h2>
          <p className="text-sm text-muted-foreground mb-4">
            No snapshots yet. Click the button below to take your first snapshot and start tracking the top 50 ELA wallets.
          </p>
          <Button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            data-testid="button-first-snapshot"
          >
            {triggerMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 mr-2" />
            )}
            Take First Snapshot
          </Button>
        </div>
      </div>
    );
  }

  const newEntries = dashboard.summaries?.[0]?.newEntries ? JSON.parse(dashboard.summaries[0].newEntries) : [];
  const dropouts = dashboard.summaries?.[0]?.dropouts ? JSON.parse(dashboard.summaries[0].dropouts) : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Tracking Since"
          value={dashboard.stats.firstSnapshotDate || "—"}
          icon={Clock}
          iconColor="text-blue-400"
        />
        <StatCard
          title="Total Snapshots"
          value={dashboard.stats.totalSnapshots}
          icon={Camera}
          iconColor="text-emerald-400"
        />
        <StatCard
          title="Unique Addresses"
          value={dashboard.stats.uniqueAddresses}
          icon={Users}
          iconColor="text-purple-400"
        />
        <StatCard
          title="Last Updated"
          value={dashboard.snapshot ? timeAgo(dashboard.snapshot.fetchedAt) : "—"}
          subtitle={dashboard.snapshot ? `${dashboard.snapshot.date} ${dashboard.snapshot.timeSlot}` : undefined}
          icon={RefreshCw}
          iconColor="text-amber-400"
        />
      </div>

      {(newEntries.length > 0 || dropouts.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {newEntries.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/20 bg-emerald-400/10 no-default-hover-elevate no-default-active-elevate">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  {newEntries.length} new
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {newEntries.map((a: string) => a.slice(0, 8) + "...").join(", ")}
                </span>
              </div>
            )}
            {dropouts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-red-400 border-red-400/20 bg-red-400/10 no-default-hover-elevate no-default-active-elevate">
                  <ArrowDownRight className="w-3 h-3 mr-1" />
                  {dropouts.length} dropped
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dropouts.map((a: string) => a.slice(0, 8) + "...").join(", ")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Top 50 Wallets</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
              {dashboard.entries.length} wallets
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead className="w-16 text-center">Change</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Balance (ELA)</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Change</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">% Supply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.entries.map((entry) => (
                  <TableRow
                    key={entry.address}
                    className="cursor-pointer hover-elevate"
                    data-testid={`row-wallet-${entry.rank}`}
                  >
                    <TableCell className="text-center font-mono">
                      <Link href={`/address/${entry.address}`}>
                        <RankMedal rank={entry.rank} />
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/address/${entry.address}`}>
                        <RankBadge
                          rank={entry.rank}
                          rankChange={entry.rankChange}
                          isNew={entry.prevRank === null && entry.rankChange === null}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/address/${entry.address}`}>
                        <AddressDisplay
                          address={entry.address}
                          label={entry.label}
                          category={entry.category}
                          showCopy={false}
                        />
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <Link href={`/address/${entry.address}`}>
                        {formatBalance(entry.balance)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <Link href={`/address/${entry.address}`}>
                        {entry.balanceChange !== null ? (
                          <span className={`text-xs font-mono ${entry.balanceChange > 0 ? "text-emerald-400" : entry.balanceChange < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            {formatBalanceChange(entry.balanceChange)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      <Link href={`/address/${entry.address}`}>
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={Math.min((entry.percentage || 0) * 5, 100)} className="w-12 h-1.5" />
                          <span className="text-xs text-muted-foreground w-14 text-right">
                            {formatPercentage(entry.percentage || 0)}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {dashboard.summaries && dashboard.summaries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Recent Daily Summaries</h3>
          <ScrollArea className="w-full">
            <div className="flex gap-3 pb-2">
              {dashboard.summaries.map((s) => {
                const ne = s.newEntries ? JSON.parse(s.newEntries) : [];
                const dr = s.dropouts ? JSON.parse(s.dropouts) : [];
                return (
                  <Card key={s.date} className="min-w-[250px] shrink-0">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-medium">{s.date}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-emerald-400">{ne.length} new</span>
                        <span className="text-xs text-red-400">{dr.length} dropped</span>
                      </div>
                      {s.biggestGainerAddress && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Top gainer: </span>
                          <span className="text-emerald-400 font-mono">
                            {s.biggestGainerAddress.slice(0, 8)}... +{formatBalance(s.biggestGainerChange || 0)}
                          </span>
                        </div>
                      )}
                      {s.biggestLoserAddress && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Top loser: </span>
                          <span className="text-red-400 font-mono">
                            {s.biggestLoserAddress.slice(0, 8)}... {formatBalance(s.biggestLoserChange || 0)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="p-0">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
