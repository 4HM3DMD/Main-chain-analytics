import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, ExternalLink } from "lucide-react";
import { formatBalance, formatBalanceChange, truncateAddress, getCategoryColor, formatSupplyPct, getChangeColor } from "@/lib/utils";

interface Entity {
  label: string;
  category: string | null;
  notes: string | null;
  addresses: Array<{
    address: string;
    rank: number;
    balance: number;
    balanceChange: number | null;
  }>;
  totalBalance: number;
  totalChange: number;
  addressCount: number;
  bestRank: number;
}

interface EntitiesData {
  entities: Entity[];
  totalTop100: number;
}

export default function Entities() {
  const { data, isLoading } = useQuery<EntitiesData>({
    queryKey: ["/api/entities"],
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const activeEntities = data.entities.filter(e => e.totalBalance > 0);
  const inactiveEntities = data.entities.filter(e => e.totalBalance === 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Known Entities
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Addresses grouped by entity. {activeEntities.length} entities active in top 100,
          holding {formatBalance(activeEntities.reduce((s, e) => s + e.totalBalance, 0))} ELA
          ({formatSupplyPct(activeEntities.reduce((s, e) => s + e.totalBalance, 0))} of total supply).
        </p>
      </div>

      {/* Entity Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeEntities.map((entity) => (
          <Card key={entity.label} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className={`no-default-hover-elevate no-default-active-elevate ${getCategoryColor(entity.category)}`}>
                    {entity.label}
                  </Badge>
                </CardTitle>
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-[10px]">
                  {entity.addressCount} {entity.addressCount === 1 ? "address" : "addresses"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Totals */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Combined Balance</p>
                  <p className="text-lg font-bold font-mono">{formatBalance(entity.totalBalance)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSupplyPct(entity.totalBalance)} of supply
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Best Rank</p>
                  <p className="text-lg font-bold font-mono">#{entity.bestRank}</p>
                </div>
              </div>

              {/* Individual addresses */}
              <div className="border-t pt-2 space-y-1.5">
                {entity.addresses
                  .filter(a => a.rank > 0)
                  .sort((a, b) => a.rank - b.rank)
                  .map((addr) => (
                  <Link key={addr.address} href={`/address/${addr.address}`}>
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground w-6">#{addr.rank}</span>
                        <span className="font-mono text-[10px] text-muted-foreground truncate">{truncateAddress(addr.address, 6)}</span>
                      </div>
                      <span className="font-mono text-[10px] shrink-0">{formatBalance(addr.balance)}</span>
                    </div>
                  </Link>
                ))}
                {entity.addresses.filter(a => a.rank <= 0).length > 0 && (
                  <p className="text-[10px] text-muted-foreground italic">
                    +{entity.addresses.filter(a => a.rank <= 0).length} not in top 100
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inactive entities */}
      {inactiveEntities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Labeled but Not in Top 100 ({inactiveEntities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Addresses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveEntities.map((e) => (
                    <TableRow key={e.label}>
                      <TableCell className="text-xs font-medium">{e.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${getCategoryColor(e.category)}`}>
                          {e.category || "other"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs">{e.addressCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
