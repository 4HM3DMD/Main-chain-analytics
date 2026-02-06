import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeftRight, ArrowUp, ArrowDown, TrendingUp, TrendingDown, UserPlus, UserMinus } from "lucide-react";
import { formatBalance, formatBalanceChange, truncateAddress, getCategoryColor } from "@/lib/utils";
import { StatCard } from "@/components/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RankMedal } from "@/components/rank-badge";

interface CompareResult {
  from: { date: string; timeSlot: string };
  to: { date: string; timeSlot: string };
  combined: Array<{
    address: string;
    label: string | null;
    category: string | null;
    fromRank: number | null;
    toRank: number | null;
    rankChange: number | null;
    fromBalance: number | null;
    toBalance: number | null;
    balanceDiff: number | null;
    status: "same" | "new" | "dropped" | "up" | "down";
  }>;
  stats: {
    totalBalanceChange: number;
    movedUp: number;
    movedDown: number;
    newEntries: number;
    dropouts: number;
  };
}

export default function Compare() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate, setToDate] = useState(today);

  const { data, isLoading, error } = useQuery<CompareResult>({
    queryKey: ["/api/compare", `?from=${fromDate}&to=${toDate}`],
    enabled: !!fromDate && !!toDate && fromDate !== toDate,
  });

  const swap = () => {
    setFromDate(toDate);
    setToDate(fromDate);
  };

  const setQuick = (days: number) => {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    setFromDate(from);
    setToDate(to);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <h2 className="text-lg font-semibold">Compare Snapshots</h2>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <label className="text-xs text-muted-foreground mb-1 block">From</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-testid="input-from-date"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={swap} className="mt-4 sm:mt-0" data-testid="button-swap-dates">
              <ArrowLeftRight className="w-4 h-4" />
            </Button>
            <div className="flex-1 w-full">
              <label className="text-xs text-muted-foreground mb-1 block">To</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                data-testid="input-to-date"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setQuick(1)} data-testid="button-quick-1d">Yesterday vs Today</Button>
            <Button variant="secondary" size="sm" onClick={() => setQuick(7)} data-testid="button-quick-7d">Last Week</Button>
            <Button variant="secondary" size="sm" onClick={() => setQuick(30)} data-testid="button-quick-30d">Last Month</Button>
          </div>
        </CardContent>
      </Card>

      {fromDate === toDate && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Select two different dates to compare snapshots.</p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card><CardContent className="p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full mb-2" />)}</CardContent></Card>
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No data available for the selected dates. Try different dates.</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              title="Balance Change"
              value={formatBalanceChange(data.stats.totalBalanceChange)}
              icon={TrendingUp}
              iconColor={data.stats.totalBalanceChange >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <StatCard title="Moved Up" value={data.stats.movedUp} icon={ArrowUp} iconColor="text-emerald-400" />
            <StatCard title="Moved Down" value={data.stats.movedDown} icon={ArrowDown} iconColor="text-red-400" />
            <StatCard title="New Entries" value={data.stats.newEntries} icon={UserPlus} iconColor="text-blue-400" />
            <StatCard title="Dropouts" value={data.stats.dropouts} icon={UserMinus} iconColor="text-amber-400" />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {data.from.date} vs {data.to.date}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">From #</TableHead>
                      <TableHead className="w-16">To #</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Balance From</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Balance To</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.combined.map((row) => (
                      <TableRow
                        key={row.address}
                        className={`${
                          row.status === "new" ? "bg-emerald-400/5" :
                          row.status === "dropped" ? "bg-red-400/5" :
                          row.status === "up" ? "bg-blue-400/5" :
                          row.status === "down" ? "bg-orange-400/5" : ""
                        }`}
                        data-testid={`row-compare-${row.address.slice(0, 8)}`}
                      >
                        <TableCell className="font-mono text-xs text-center">
                          {row.fromRank ? <RankMedal rank={row.fromRank} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          {row.toRank ? <RankMedal rank={row.toRank} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.label && (
                              <Badge variant="outline" className={`text-xs no-default-hover-elevate no-default-active-elevate ${getCategoryColor(row.category)}`}>
                                {row.label}
                              </Badge>
                            )}
                            <span className="font-mono text-xs">{truncateAddress(row.address)}</span>
                            {row.status === "new" && <Badge className="text-xs bg-emerald-500/20 text-emerald-400 no-default-hover-elevate no-default-active-elevate">NEW</Badge>}
                            {row.status === "dropped" && <Badge className="text-xs bg-red-500/20 text-red-400 no-default-hover-elevate no-default-active-elevate">OUT</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs hidden sm:table-cell">
                          {row.fromBalance ? formatBalance(row.fromBalance) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs hidden sm:table-cell">
                          {row.toBalance ? formatBalance(row.toBalance) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.balanceDiff !== null ? (
                            <span className={`text-xs font-mono ${row.balanceDiff > 0 ? "text-emerald-400" : row.balanceDiff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                              {formatBalanceChange(row.balanceDiff)}
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
        </>
      )}
    </div>
  );
}
