import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Layers, 
  AlertCircle, 
  CheckCircle2,
  Info,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { formatBalance, formatCompact, getCategoryColor, truncateAddress } from "@/lib/utils";

interface Insight {
  severity: "critical" | "warning" | "info" | "positive";
  category: string;
  title: string;
  description: string;
  metric?: string;
}

interface EntityFlow {
  entity: string;
  category: string;
  chains: { mainchain?: number; esc?: number; ethereum?: number };
  total: number;
  netChange: number;
}

interface CrossChainData {
  insights: Insight[];
  entityFlows: EntityFlow[];
  supplyFlow: {
    mainchainTopN: number;
    escBridgeOnMain: number;
    escBridgeChange: number;
    escTopN: number;
    shadowBridgeOnEsc: number;
    shadowBridgeChange: number;
    ethTopN: number;
  };
  categoryBreakdown: Array<{
    category: string;
    mainchain: number;
    esc: number;
    ethereum: number;
    total: number;
    change24h: number;
  }>;
  topAccumulators: Array<{
    chain: string;
    address: string;
    label: string | null;
    balanceChange: number;
    category: string | null;
    balance: number;
    percentOfChain: number;
  }>;
  topDistributors: Array<{
    chain: string;
    address: string;
    label: string | null;
    balanceChange: number;
    category: string | null;
    balance: number;
    percentOfChain: number;
  }>;
  chainHealth: Array<{
    chain: string;
    gini: number | null;
    wai: number | null;
    activeWallets: number | null;
    netFlow24h: number | null;
    totalBalance: number;
    giniTrend7d: number | null;
    waiTrend7d: number | null;
  }>;
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical": return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "warning": return <AlertCircle className="w-4 h-4 text-amber-500" />;
    case "positive": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    default: return <Info className="w-4 h-4 text-blue-400" />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return "border-red-500/50 bg-red-500/5";
    case "warning": return "border-amber-500/50 bg-amber-500/5";
    case "positive": return "border-emerald-500/50 bg-emerald-500/5";
    default: return "border-blue-500/50 bg-blue-500/5";
  }
}

export default function CrossChain() {
  const { data, isLoading } = useQuery<CrossChainData>({
    queryKey: ["/api/cross-chain/summary"],
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        <Skeleton className="h-8 w-64" />
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const healthMap = new Map(data.chainHealth.map(ch => [ch.chain, ch]));
  const mainchain = healthMap.get("mainchain");
  const esc = healthMap.get("esc");
  const ethereum = healthMap.get("ethereum");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Cross-Chain Intelligence
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Actionable insights, entity behavior, and flow analysis across Main Chain, ESC, and Ethereum
        </p>
      </div>

      {/* 🧠 INTELLIGENT INSIGHTS - Priority #1 */}
      {data.insights.length > 0 && (
        <Card className="border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Live Intelligence Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.insights.map((insight, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${getSeverityColor(insight.severity)} flex items-start gap-3`}
              >
                <div className="mt-0.5">{getSeverityIcon(insight.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{insight.title}</span>
                    <Badge variant="outline" className="text-[10px]">{insight.category}</Badge>
                    {insight.metric && (
                      <span className="text-xs font-mono ml-auto text-muted-foreground">{insight.metric}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Supply Flow with Bridge Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ELA Supply Flow & Bridge Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main → ESC */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-400/20 text-blue-400 no-default-hover-elevate">Main</Badge>
                <span className="text-sm font-medium">{formatBalance(data.supplyFlow.mainchainTopN)}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 min-w-[120px]">
              <div className="flex items-center gap-1">
                {data.supplyFlow.escBridgeChange > 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : data.supplyFlow.escBridgeChange < 0 ? (
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatBalance(data.supplyFlow.escBridgeOnMain)}
                </span>
              </div>
              {data.supplyFlow.escBridgeChange !== 0 && (
                <span className={`text-[9px] font-mono ${data.supplyFlow.escBridgeChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {data.supplyFlow.escBridgeChange > 0 ? "+" : ""}{formatCompact(data.supplyFlow.escBridgeChange)}
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-400/20 text-purple-400 no-default-hover-elevate">ESC</Badge>
                <span className="text-sm font-medium">{formatBalance(data.supplyFlow.escTopN)}</span>
              </div>
            </div>
          </div>

          {/* ESC → ETH */}
          <div className="flex items-center gap-3 pl-12">
            <div className="flex-1">
              <span className="text-xs text-muted-foreground">ShadowTokens</span>
            </div>
            <div className="flex flex-col items-center gap-1 min-w-[120px]">
              <div className="flex items-center gap-1">
                {data.supplyFlow.shadowBridgeChange > 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : data.supplyFlow.shadowBridgeChange < 0 ? (
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatBalance(data.supplyFlow.shadowBridgeOnEsc)}
                </span>
              </div>
              {data.supplyFlow.shadowBridgeChange !== 0 && (
                <span className={`text-[9px] font-mono ${data.supplyFlow.shadowBridgeChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {data.supplyFlow.shadowBridgeChange > 0 ? "+" : ""}{formatCompact(data.supplyFlow.shadowBridgeChange)}
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-400/20 text-amber-400 no-default-hover-elevate">ETH</Badge>
                <span className="text-sm font-medium">{formatBalance(data.supplyFlow.ethTopN)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity Flow Intelligence */}
      {data.entityFlows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Entity Behavior Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Main Chain</TableHead>
                    <TableHead className="text-right">ESC</TableHead>
                    <TableHead className="text-right">Ethereum</TableHead>
                    <TableHead className="text-right">Total Holdings</TableHead>
                    <TableHead className="text-right">Net Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entityFlows.map((entity, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs max-w-[180px] truncate">{entity.entity}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getCategoryColor(entity.category)}`}>
                          {entity.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {entity.chains.mainchain ? formatCompact(entity.chains.mainchain) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {entity.chains.esc ? formatCompact(entity.chains.esc) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {entity.chains.ethereum ? formatCompact(entity.chains.ethereum) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCompact(entity.total)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-xs ${entity.netChange > 0 ? "text-emerald-400" : entity.netChange < 0 ? "text-red-400" : ""}`}>
                        {entity.netChange > 0 ? "+" : ""}{formatCompact(entity.netChange)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Movers with Enhanced Context */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Top Accumulators
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.topAccumulators.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No significant accumulation</p>
            ) : (
              data.topAccumulators.map((m, i) => (
                <div key={`acc-${i}`} className="p-2 rounded-md hover-elevate space-y-1">
                  <div className="flex items-center justify-between">
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
                  <div className="flex items-center gap-2 ml-8 text-[10px] text-muted-foreground">
                    <span>Holdings: {formatCompact(m.balance)}</span>
                    <span>•</span>
                    <span>{m.percentOfChain.toFixed(2)}% of chain</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Top Distributors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.topDistributors.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No significant distribution</p>
            ) : (
              data.topDistributors.map((m, i) => (
                <div key={`dist-${i}`} className="p-2 rounded-md hover-elevate space-y-1">
                  <div className="flex items-center justify-between">
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
                  <div className="flex items-center gap-2 ml-8 text-[10px] text-muted-foreground">
                    <span>Holdings: {formatCompact(m.balance)}</span>
                    <span>•</span>
                    <span>{m.percentOfChain.toFixed(2)}% of chain</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chain Health with 7-Day Trends */}
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
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono">{ch.data?.gini?.toFixed(3) || "—"}</span>
                    {ch.data?.giniTrend7d && Math.abs(ch.data.giniTrend7d) > 0.001 && (
                      <span className={`text-[9px] ${ch.data.giniTrend7d > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {ch.data.giniTrend7d > 0 ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">WAI</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono">{ch.data?.wai?.toFixed(1) || "—"}</span>
                    {ch.data?.waiTrend7d && Math.abs(ch.data.waiTrend7d) > 5 && (
                      <span className={`text-[9px] ${ch.data.waiTrend7d > 0 ? "text-amber-400" : "text-blue-400"}`}>
                        {ch.data.waiTrend7d > 0 ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
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

      {/* Category Breakdown with 24h Changes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Category Distribution & Changes</CardTitle>
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
                  <TableHead className="text-right">24h Change</TableHead>
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
                    <TableCell className={`text-right font-mono text-xs ${cat.change24h > 0 ? "text-emerald-400" : cat.change24h < 0 ? "text-red-400" : ""}`}>
                      {cat.change24h !== 0 ? `${cat.change24h > 0 ? "+" : ""}${formatCompact(cat.change24h)}` : "—"}
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
