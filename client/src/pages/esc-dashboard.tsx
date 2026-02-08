import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { RankMedal } from "@/components/rank-badge";
import { Wallet, Clock, ExternalLink } from "lucide-react";
import { formatBalance, formatPercentage, timeAgo, getCategoryColor, truncateAddress } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EscEntry {
  rank: number;
  address: string;
  balance: number;
  percentage: number | null;
  balanceChange: number | null;
  label: string | null;
  category: string | null;
}

interface EscData {
  snapshot: { id: number; date: string; timeSlot: string; fetchedAt: string; totalBalances: number } | null;
  entries: EscEntry[];
  totalBalance: number;
}

export default function EscDashboard() {
  const { data, isLoading } = useQuery<EscData>({
    queryKey: ["/api/esc/dashboard"],
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  if (!data?.snapshot || !data.entries.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-center max-w-md">
          <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">ESC Dashboard</h2>
          <p className="text-sm text-muted-foreground">Waiting for the first ESC snapshot. Data appears within 5 minutes.</p>
        </div>
      </div>
    );
  }

  const totalBalance = data.totalBalance;
  const top10Balance = data.entries.slice(0, 10).reduce((s, e) => s + e.balance, 0);
  const top10Pct = totalBalance > 0 ? ((top10Balance / totalBalance) * 100).toFixed(1) : "0";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-purple-400/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-purple-400">ESC</span>
            </div>
            Elastos Smart Chain — Top 100
          </h2>
          <p className="text-xs text-muted-foreground mt-1">ELA is the native token on ESC (EVM sidechain). Balances in ELA.</p>
        </div>
        <a href="https://esc.elastos.io" target="_blank" rel="noopener noreferrer">
          <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
            <ExternalLink className="w-3 h-3 mr-1" /> ESC Explorer
          </Badge>
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="ESC Top 100 Balance" value={`${(totalBalance / 1e6).toFixed(2)}M`} subtitle="Total ELA in ESC top 100" icon={Wallet} iconColor="text-purple-400" />
        <StatCard title="Top 10 Share" value={`${top10Pct}%`} subtitle={`${formatBalance(top10Balance)} ELA`} icon={Wallet} iconColor="text-emerald-400" />
        <StatCard title="ESC Total Supply" value={`${((data.snapshot?.totalBalances || 0) / 1e6).toFixed(2)}M`} icon={Wallet} iconColor="text-blue-400" />
        <StatCard title="Last Updated" value={data.snapshot ? timeAgo(data.snapshot.fetchedAt) : "—"} subtitle={data.snapshot ? `${data.snapshot.date} ${data.snapshot.timeSlot}` : undefined} icon={Clock} iconColor="text-amber-400" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Top 100 ESC Wallets</CardTitle>
            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">{data.entries.length} wallets</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Balance (ELA)</TableHead>
                  <TableHead className="text-right hidden md:table-cell">% of Top 100</TableHead>
                  <TableHead className="w-10 hidden lg:table-cell"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <TableRow key={entry.address} className="hover-elevate">
                    <TableCell className="text-center font-mono"><RankMedal rank={entry.rank} /></TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        {entry.label && (
                          <Badge variant="outline" className={`text-xs mb-0.5 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(entry.category)}`}>
                            {entry.label}
                          </Badge>
                        )}
                        <p className="font-mono text-xs text-muted-foreground truncate">{truncateAddress(entry.address, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatBalance(entry.balance)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground hidden md:table-cell">
                      {entry.percentage ? formatPercentage(entry.percentage) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <a href={`https://esc.elastos.io/address/${entry.address}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </a>
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
