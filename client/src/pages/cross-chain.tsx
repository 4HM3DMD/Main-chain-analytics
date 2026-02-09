import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, TrendingUp, TrendingDown, Activity, Layers } from "lucide-react";
import { formatBalance, formatCompact, getCategoryColor, truncateAddress, formatWAI, getWAIColor } from "@/lib/utils";

interface CrossChainData {
  supplyFlow: {
    mainchainTopN: number;
    escBridgeOnMain: number;
    escTopN: number;
    shadowBridgeOnEsc: number;
    ethTopN: number;
  };
  categoryBreakdown: Array<{
    category: string;
    mainchain: number;
    esc: number;
    ethereum: number;
    total: number;
  }>;
  topAccumulators: Array<{
    chain: string;
    address: string;
    label: string | null;
    balanceChange: number;
    category: string | null;
  }>;
  topDistributors: Array<{
    chain: string;
    address: string;
    label: string | null;
    balanceChange: number;
    category: string | null;
  }>;
  chainHealth: Array<{
    chain: string;
    gini: number | null;
    wai: number | null;
    activeWallets: number | null;
    netFlow24h: number | null;
    totalBalance: number;
  }>;
}

export default function CrossChain() {
  const { data, isLoading } = useQuery<CrossChainData>({
    queryKey: ["/api/cross-chain/summary"],
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-64" />
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  // Map chain health by chain key for easy lookup
  const healthMap = new Map(data.chainHealth.map(ch => [ch.chain, ch]));
  const mainchain = healthMap.get("mainchain");
  const esc = healthMap.get("esc");
  const ethereum = healthMap.get("ethereum");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Cross-Chain Intelligence
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Unified analysis across Main Chain, ESC, and Ethereum
        </p>
      </div>

      {/* Supply Flow Map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ELA Supply Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main → ESC */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-400/20 text-blue-400 no-default-hover-elevate">Main</Badge>
                <span className="text-sm font-medium">Top 100: {formatBalance(data.supplyFlow.mainchainTopN)}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono">{formatBalance(data.supplyFlow.escBridgeOnMain)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-400/20 text-purple-400 no-default-hover-elevate">ESC</Badge>
                <span className="text-sm font-medium">Top 50: {formatBalance(data.supplyFlow.escTopN)}</span>
              </div>
            </div>
          </div>

          {/* ESC → ETH */}
          <div className="flex items-center gap-3 pl-12">
            <div className="flex-1">
              <span className="text-xs text-muted-foreground">ShadowTokens Bridge</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono">{formatBalance(data.supplyFlow.shadowBridgeOnEsc)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-400/20 text-amber-400 no-default-hover-elevate">ETH</Badge>
                <span className="text-sm font-medium">Top 50: {formatBalance(data.supplyFlow.ethTopN)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Main Chain ELA bridges to ESC via <span className="font-mono">XVbCTM...Wf</span>, then to Ethereum via ShadowTokens.
          </p>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Category Distribution Across Chains</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Main Chain</TableHead>
                  <TableHead className="text-right">ESC</TableHead>
                  <TableHead className="text-right">Ethereum</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.categoryBreakdown.map((cat) => (
                  <TableRow key={cat.category}>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getCategoryColor(cat.category)}`}>
                        {cat.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCompact(cat.mainchain)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCompact(cat.esc)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCompact(cat.ethereum)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatCompact(cat.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Chain Health Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { data: mainchain, name: "Main Chain", color: "blue", topN: 100 },
          { data: esc, name: "ESC", color: "purple", topN: 50 },
          { data: ethereum, name: "Ethereum", color: "amber", topN: 50 },
        ].map((ch) => (
          <Card key={ch.name}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold text-${ch.color}-400`}>{ch.name}</span>
                <Badge variant="outline" className="text-[10px]">Top {ch.topN}</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Balance</span>
                  <span className="text-xs font-mono">{formatBalance(ch.data?.totalBalance || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Gini</span>
                  <span className="text-xs font-mono">{ch.data?.gini?.toFixed(3) || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">WAI</span>
                  <span className={`text-xs font-mono ${getWAIColor(ch.data?.wai)}`}>{ch.data?.wai?.toFixed(1) || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <span className="text-xs font-mono">{ch.data?.activeWallets ?? "—"}/{ch.topN}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Movers Across All Chains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Accumulators */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Top Accumulators (All Chains)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.topAccumulators.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No significant accumulation</p>
            ) : (
              data.topAccumulators.map((m, i) => (
                <div key={`${m.chain}-${m.address}`} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    <Badge variant="outline" className={`text-[10px] ${m.chain === "mainchain" ? "text-blue-400" : m.chain === "esc" ? "text-purple-400" : "text-amber-400"}`}>
                      {m.chain}
                    </Badge>
                    <span className="text-xs truncate">{m.label || truncateAddress(m.address, 6)}</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 shrink-0">
                    +{formatCompact(m.balanceChange)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Distributors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Top Distributors (All Chains)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.topDistributors.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No significant distribution</p>
            ) : (
              data.topDistributors.map((m, i) => (
                <div key={`${m.chain}-${m.address}`} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    <Badge variant="outline" className={`text-[10px] ${m.chain === "mainchain" ? "text-blue-400" : m.chain === "esc" ? "text-purple-400" : "text-amber-400"}`}>
                      {m.chain}
                    </Badge>
                    <span className="text-xs truncate">{m.label || truncateAddress(m.address, 6)}</span>
                  </div>
                  <span className="text-xs font-mono text-red-400 shrink-0">
                    {formatCompact(m.balanceChange)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
