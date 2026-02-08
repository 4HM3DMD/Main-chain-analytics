import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useChain } from "@/lib/chain-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Ghost, Eye, AlertTriangle, Clock, Zap } from "lucide-react";
import { formatBalance, truncateAddress, getCategoryColor } from "@/lib/utils";

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

export default function GhostWallets() {
  const [maxAppearances, setMaxAppearances] = useState(3);
  const { chain, chainInfo } = useChain();
  const topN = chainInfo.topN;
  const chainSuffix = chain !== "mainchain" ? `chain=${chain}` : "";

  const { data, isLoading } = useQuery<GhostWalletsData>({
    queryKey: ["/api/analytics/ghost-wallets", `?maxAppearances=${maxAppearances}${chainSuffix ? `&${chainSuffix}` : ""}`],
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Ghost className="w-5 h-5 text-violet-400" />
            Shadow Entries
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Wallets that briefly entered the top {topN} then vanished — possible attempts to move large funds without sustained visibility.
          </p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 5].map((n) => (
            <Button
              key={n}
              variant={maxAppearances === n ? "default" : "secondary"}
              size="sm"
              onClick={() => setMaxAppearances(n)}
            >
              {n === 1 ? "1 snapshot" : `≤${n} snapshots`}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card><CardContent className="p-4"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ghost className="w-4 h-4 text-violet-400" />
                  <p className="text-xs text-muted-foreground">Total Detected</p>
                </div>
                <p className="text-2xl font-bold font-mono text-violet-400">{data.total}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  with ≤{maxAppearances} {maxAppearances === 1 ? "snapshot" : "snapshots"}
                </p>
              </CardContent>
            </Card>
            {Object.entries(data.byStintLength)
              .sort(([a], [b]) => Number(a) - Number(b))
              .slice(0, 3)
              .map(([length, count]) => (
              <Card key={length}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {Number(length) === 1 ? (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    ) : Number(length) === 2 ? (
                      <Zap className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {Number(length) === 1 ? "Single Flash" : `${length}-Snapshot Stint`}
                    </p>
                  </div>
                  <p className="text-2xl font-bold font-mono">{count}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {Number(length) === 1 ? "Appeared once, then gone" : `Lasted ${Number(length) * 5} minutes`}
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
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs ml-1">
                    {data.wallets.length} wallets
                  </Badge>
                </CardTitle>
                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs text-muted-foreground">
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
                      <TableHead className="hidden lg:table-cell">First Seen</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.wallets.map((g, i) => (
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
                        <TableCell className="font-mono text-xs hidden lg:table-cell">{g.first_seen}</TableCell>
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
                    {data.wallets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <Ghost className="w-10 h-10 mx-auto mb-3 opacity-20" />
                          <p className="text-sm font-medium mb-1">No shadow entries detected yet</p>
                          <p className="text-xs">Ghost wallets will appear here as more snapshots are collected and transient wallets are identified.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Explainer */}
          <Card className="border-violet-400/20 bg-violet-400/5">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                What Makes a Shadow Entry Suspicious?
              </h4>
              <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground mb-1">Single-Snapshot Flash</p>
                  <p>Wallet appears in one snapshot then vanishes completely. Could indicate a large fund transfer being routed through the address momentarily — in and out within 5 minutes.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">High Balance, Low Duration</p>
                  <p>Moving significant amounts through an address without maintaining presence. The larger the balance and shorter the stay, the more likely it's intentional brevity to avoid sustained tracking.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Ghost Score</p>
                  <p>Combines peak balance magnitude with brevity of stay. Higher score = more suspicious. Scores above 100 warrant close inspection. Scores above 30 are notable.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
