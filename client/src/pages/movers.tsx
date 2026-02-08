import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatBalance, formatBalanceChange, truncateAddress, getCategoryColor } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Mover {
  address: string;
  label: string | null;
  category: string | null;
  balanceChange: number;
  balanceChangePct: number;
  currentBalance: number;
  currentRank: number | null;
  rankChange: number | null;
}

interface MoversData {
  gainers: Mover[];
  losers: Mover[];
}

export default function Movers() {
  const [period, setPeriod] = useState("7d");

  const { data, isLoading } = useQuery<MoversData>({
    queryKey: ["/api/movers", `?period=${period}`],
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Biggest Movers</h2>
        <div className="flex gap-1">
          {(["24h", "7d", "30d"] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "secondary"}
              size="sm"
              onClick={() => setPeriod(p)}
              data-testid={`button-period-${p}`}
            >
              {p === "24h" ? "24 Hours" : p === "7d" ? "7 Days" : "30 Days"}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                {[...Array(5)].map((_, j) => <Skeleton key={j} className="h-12 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Biggest Gainers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.gainers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data for this period</p>
                ) : (
                  data.gainers.map((m, i) => (
                    <Link key={m.address} href={`/address/${m.address}`}>
                      <div
                        className="flex items-center justify-between gap-3 p-3 rounded-md hover-elevate"
                        data-testid={`card-gainer-${i}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                          <div className="min-w-0">
                            {m.label && (
                              <Badge variant="outline" className={`text-xs mb-0.5 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(m.category)}`}>
                                {m.label}
                              </Badge>
                            )}
                            <p className="font-mono text-xs text-muted-foreground truncate">{truncateAddress(m.address)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono text-emerald-400">{formatBalanceChange(m.balanceChange)}</p>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] font-mono text-emerald-400/70">+{m.balanceChangePct}%</span>
                            {m.currentRank && <span className="text-[10px] text-muted-foreground">#{m.currentRank}</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">{formatBalance(m.currentBalance)} ELA</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Biggest Losers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.losers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data for this period</p>
                ) : (
                  data.losers.map((m, i) => (
                    <Link key={m.address} href={`/address/${m.address}`}>
                      <div
                        className="flex items-center justify-between gap-3 p-3 rounded-md hover-elevate"
                        data-testid={`card-loser-${i}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                          <div className="min-w-0">
                            {m.label && (
                              <Badge variant="outline" className={`text-xs mb-0.5 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(m.category)}`}>
                                {m.label}
                              </Badge>
                            )}
                            <p className="font-mono text-xs text-muted-foreground truncate">{truncateAddress(m.address)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono text-red-400">{formatBalanceChange(m.balanceChange)}</p>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] font-mono text-red-400/70">{m.balanceChangePct}%</span>
                            {m.currentRank && <span className="text-[10px] text-muted-foreground">#{m.currentRank}</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">{formatBalance(m.currentBalance)} ELA</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {(data.gainers.length > 0 || data.losers.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Balance Changes Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      ...data.gainers.slice(0, 5).map((m) => ({
                        name: m.label || truncateAddress(m.address, 4),
                        change: m.balanceChange,
                        type: "gain",
                      })),
                      ...data.losers.slice(0, 5).map((m) => ({
                        name: m.label || truncateAddress(m.address, 4),
                        change: m.balanceChange,
                        type: "loss",
                      })),
                    ]}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--muted-foreground))" width={80} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [formatBalance(value), "Change"]}
                    />
                    <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                      {[
                        ...data.gainers.slice(0, 5).map(() => "gain"),
                        ...data.losers.slice(0, 5).map(() => "loss"),
                      ].map((type, i) => (
                        <Cell key={i} fill={type === "gain" ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
