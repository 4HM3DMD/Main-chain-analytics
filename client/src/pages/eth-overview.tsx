import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, ExternalLink, ArrowDownUp } from "lucide-react";
import { formatBalance, formatSupplyPct, ELA_TOTAL_SUPPLY } from "@/lib/utils";

interface EthData {
  totalSupply: number;
  contractAddress: string;
  transfers: Array<{
    from: string;
    to: string;
    value: number;
    timestamp: string;
    txHash: string;
  }>;
}

export default function EthOverview() {
  const { data, isLoading } = useQuery<EthData>({
    queryKey: ["/api/eth/overview"],
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const supply = data?.totalSupply || 0;
  const pctOfTotal = ((supply / ELA_TOTAL_SUPPLY) * 100).toFixed(2);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-400/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-amber-400">ETH</span>
            </div>
            ELA on Ethereum
          </h2>
          <p className="text-xs text-muted-foreground mt-1">ELA bridged to Ethereum as an ERC-20 token via ShadowTokens from ESC.</p>
        </div>
        <a href={`https://etherscan.io/token/${data?.contractAddress || "0xe6fd75ff38Adca4B97FBCD938c86b98772431867"}`} target="_blank" rel="noopener noreferrer">
          <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
            <ExternalLink className="w-3 h-3 mr-1" /> Etherscan
          </Badge>
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="ELA on Ethereum" value={`${(supply / 1e6).toFixed(2)}M`} subtitle={`${pctOfTotal}% of total ELA supply`} icon={Wallet} iconColor="text-amber-400" />
        <StatCard title="Total ELA Supply" value={`${(ELA_TOTAL_SUPPLY / 1e6).toFixed(2)}M`} subtitle="Across all chains" icon={Wallet} iconColor="text-blue-400" />
        <StatCard title="Bridge" value="ShadowTokens" subtitle="ESC → Ethereum" icon={ArrowDownUp} iconColor="text-purple-400" />
      </div>

      {/* ELA Bridge Flow */}
      <Card className="border-amber-400/20 bg-amber-400/5">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">How ELA gets to Ethereum</p>
          <p className="text-sm text-muted-foreground">
            ELA is minted on the <strong>Elastos Main Chain</strong>.
            It is bridged to the <strong>Elastos Smart Chain (ESC)</strong> via the ESC sidechain bridge.
            From ESC, it can be bridged to <strong>Ethereum</strong> as an ERC-20 token via <strong>ShadowTokens</strong>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Contract: <a href={`https://etherscan.io/token/${data?.contractAddress}`} target="_blank" rel="noopener noreferrer" className="font-mono text-amber-400 hover:underline">{data?.contractAddress}</a>
          </p>
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      {data?.transfers && data.transfers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowDownUp className="w-4 h-4 text-amber-400" />
              Recent ELA Transfers on Ethereum
            </CardTitle>
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
                      <TableCell className="text-right font-mono text-xs">{formatBalance(t.value)}</TableCell>
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
      )}

      {!data?.transfers?.length && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No transfer data available. Set ALCHEMY_API_KEY to enable Ethereum transfer tracking.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
