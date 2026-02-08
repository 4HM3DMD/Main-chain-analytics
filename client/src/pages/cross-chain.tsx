import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers, ArrowRight, ExternalLink, ArrowDownUp } from "lucide-react";
import { formatBalance, formatSupplyPct, ELA_TOTAL_SUPPLY } from "@/lib/utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface CrossChainData {
  current: {
    mainchainTop100: number | null;
    escBridgeBalance: number | null;
    escTotalSupply: number | null;
    escTop100: number | null;
    ethBridgedSupply: number | null;
    mainchainOther: number | null;
    escNotInTop100: number | null;
    date: string;
    timeSlot: string;
  } | null;
  history: Array<{
    date: string;
    timeSlot: string;
    mainchainTop100: number | null;
    escBridgeBalance: number | null;
    escTotalSupply: number | null;
    escTop100: number | null;
    ethBridgedSupply: number | null;
  }>;
  totalSupply: number;
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

const CHAIN_COLORS = {
  mainchain: "#3b82f6",
  esc: "#8b5cf6",
  ethereum: "#f59e0b",
  other: "#6b7280",
};

export default function CrossChain() {
  const { data, isLoading } = useQuery<CrossChainData>({
    queryKey: ["/api/cross-chain/overview"],
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const c = data?.current;
  const totalSupply = data?.totalSupply || ELA_TOTAL_SUPPLY;

  // Compute supply distribution
  const escBridge = c?.escBridgeBalance || 0;
  const ethBridged = c?.ethBridgedSupply || 0;
  const escOnly = Math.max(0, escBridge - ethBridged); // ELA on ESC that hasn't been bridged to ETH
  const mainchainCirculating = totalSupply - escBridge; // Remaining on mainchain

  const pieData = [
    { name: "Main Chain", value: mainchainCirculating, color: CHAIN_COLORS.mainchain },
    { name: "ESC (not bridged to ETH)", value: escOnly, color: CHAIN_COLORS.esc },
    { name: "Ethereum (bridged)", value: ethBridged, color: CHAIN_COLORS.ethereum },
  ].filter(d => d.value > 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Cross-Chain ELA Overview
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          How ELA is distributed across Main Chain, Elastos Smart Chain (ESC), and Ethereum.
        </p>
      </div>

      {/* Flow Diagram */}
      <Card className="border-blue-400/20 bg-blue-400/5">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3">ELA Bridge Flow</p>
          <div className="flex items-center justify-center gap-2 flex-wrap text-center">
            <div className="p-3 rounded-lg bg-blue-400/10 border border-blue-400/20 min-w-[140px]">
              <p className="text-[10px] text-muted-foreground">Main Chain</p>
              <p className="text-sm font-bold font-mono">{formatBalance(mainchainCirculating)}</p>
              <p className="text-[10px] text-muted-foreground">{((mainchainCirculating / totalSupply) * 100).toFixed(1)}%</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="p-3 rounded-lg bg-purple-400/10 border border-purple-400/20 min-w-[140px]">
              <p className="text-[10px] text-muted-foreground">ESC Sidechain</p>
              <p className="text-sm font-bold font-mono">{formatBalance(escBridge)}</p>
              <p className="text-[10px] text-muted-foreground">{((escBridge / totalSupply) * 100).toFixed(1)}%</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 min-w-[140px]">
              <p className="text-[10px] text-muted-foreground">Ethereum</p>
              <p className="text-sm font-bold font-mono">{formatBalance(ethBridged)}</p>
              <p className="text-[10px] text-muted-foreground">{((ethBridged / totalSupply) * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span>via ESC Bridge</span>
            <span>via ShadowTokens</span>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Supply</p>
            <p className="text-xl font-bold font-mono">{(totalSupply / 1e6).toFixed(2)}M</p>
            <p className="text-[10px] text-muted-foreground">ELA across all chains</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">On Main Chain</p>
            <p className="text-xl font-bold font-mono text-blue-400">{((mainchainCirculating / totalSupply) * 100).toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">{formatBalance(mainchainCirculating)} ELA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">On ESC</p>
            <p className="text-xl font-bold font-mono text-purple-400">{((escBridge / totalSupply) * 100).toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">{formatBalance(escBridge)} ELA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">On Ethereum</p>
            <p className="text-xl font-bold font-mono text-amber-400">{((ethBridged / totalSupply) * 100).toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">{formatBalance(ethBridged)} ELA</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supply Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Supply Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatBalance(v) + " ELA", ""]} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Collecting data...</p>
            )}
          </CardContent>
        </Card>

        {/* ESC Bridge Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bridge Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ESC Top 100 hold</span>
                <span className="font-mono">{formatBalance(c?.escTop100 || 0)} ELA</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ESC outside top 100</span>
                <span className="font-mono">{formatBalance(c?.escNotInTop100 || 0)} ELA</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Bridged to Ethereum</span>
                <span className="font-mono text-amber-400">{formatBalance(ethBridged)} ELA</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Still on ESC only</span>
                <span className="font-mono text-purple-400">{formatBalance(escOnly)} ELA</span>
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <a href="https://esc.elastos.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-400 hover:underline">
                <ExternalLink className="w-3 h-3" /> ESC Explorer
              </a>
              <a href="https://etherscan.io/token/0xe6fd75ff38Adca4B97FBCD938c86b98772431867" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-amber-400 hover:underline">
                <ExternalLink className="w-3 h-3" /> ELA on Etherscan
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supply Over Time */}
      {data?.history && data.history.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ELA Distribution Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.history} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={tickStyle} stroke={axisStroke} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} formatter={(v: number) => [formatBalance(v) + " ELA", ""]} />
                <Area type="monotone" dataKey="escBridgeBalance" name="On ESC" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} />
                <Area type="monotone" dataKey="ethBridgedSupply" name="On Ethereum" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--foreground))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ethereum Recent Transfers */}
      <EthTransfers />
    </div>
  );
}

// ─── Ethereum Transfers Component ─────────────────────────────────────────

interface EthTransferData {
  transfers: Array<{
    from: string;
    to: string;
    value: number;
    timestamp: string;
    txHash: string;
  }>;
  contractAddress: string;
}

function EthTransfers() {
  const { data, isLoading } = useQuery<EthTransferData>({
    queryKey: ["/api/ethereum/transfers"],
    refetchInterval: 300000,
  });

  if (isLoading) return <Card><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>;
  if (!data?.transfers.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowDownUp className="w-4 h-4 text-amber-400" />
            Recent ELA Transfers on Ethereum
          </CardTitle>
          <a href={`https://etherscan.io/token/${data.contractAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:underline flex items-center gap-1">
            Etherscan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Amount (ELA)</TableHead>
                <TableHead className="hidden md:table-cell">Time</TableHead>
                <TableHead className="hidden lg:table-cell">TX</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transfers.map((t, i) => (
                <TableRow key={`${t.txHash}-${i}`}>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {t.from.slice(0, 8)}...{t.from.slice(-4)}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {t.to.slice(0, 8)}...{t.to.slice(-4)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatBalance(t.value)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                    {t.timestamp ? new Date(t.timestamp).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <a href={`https://etherscan.io/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-400 hover:underline font-mono">
                      {t.txHash.slice(0, 10)}...
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
