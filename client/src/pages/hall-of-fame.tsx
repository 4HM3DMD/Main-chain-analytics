import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useChain } from "@/lib/chain-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { Users, Activity, Search, UserMinus, ArrowDown, Trophy } from "lucide-react";
import { formatBalance, getCategoryColor } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

interface HallEntry {
  address: string;
  label: string | null;
  category: string | null;
  totalAppearances: number;
  firstSeen: string;
  lastSeen: string;
  bestRank: number;
  lastRank: number;
  lastBalance: number;
  currentRank: number | null;
  currentBalance: number | null;
  currentStatus: "active" | "inactive";
}

interface HallData {
  entries: HallEntry[];
  stats: {
    totalUnique: number;
    currentlyActive: number;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  burn: "#f59e0b",
  sidechain: "#3b82f6",
  pool: "#22c55e",
  dao: "#a855f7",
  exchange: "#f97316",
  ef: "#22d3ee",
  whale: "#f472b6",
  unknown: "#64748b",
};

export default function HallOfFame() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "dropped">("all");
  const [sortBy, setSortBy] = useState<"appearances" | "bestRank" | "lastBalance" | "firstSeen">("appearances");
  const { chain } = useChain();
  const chainSuffix = chain !== "mainchain" ? `chain=${chain}` : "";

  const { data, isLoading } = useQuery<HallData>({
    queryKey: ["/api/hall-of-fame", ...(chainSuffix ? [`?${chainSuffix}`] : [])],
  });

  const droppedCount = data?.entries.filter(e => e.currentStatus === "inactive").length || 0;

  const filtered = data?.entries
    .filter((e) => {
      if (filter === "active") return e.currentStatus === "active";
      if (filter === "dropped") return e.currentStatus === "inactive";
      return true;
    })
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return e.address.toLowerCase().includes(q) || (e.label && e.label.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "appearances") return b.totalAppearances - a.totalAppearances;
      if (sortBy === "bestRank") return a.bestRank - b.bestRank;
      if (sortBy === "lastBalance") return b.lastBalance - a.lastBalance;
      return a.firstSeen.localeCompare(b.firstSeen);
    }) || [];

  const categoryBreakdown = data?.entries.reduce((acc, e) => {
    const cat = e.category || "unknown";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const pieData = Object.entries(categoryBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: CATEGORY_COLORS[name] || CATEGORY_COLORS.unknown,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <h2 className="text-lg font-semibold" data-testid="text-hall-title">Hall of Fame</h2>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
          </div>
          <Card><CardContent className="p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />)}</CardContent></Card>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard title="Total Unique Addresses" value={data.stats.totalUnique} icon={Users} iconColor="text-purple-400" />
            <StatCard title="Currently Active" value={data.stats.currentlyActive} icon={Activity} iconColor="text-emerald-400" />
            <StatCard title="Dropped Out" value={droppedCount} icon={UserMinus} iconColor="text-red-400" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3">
                    <CardTitle className="text-sm">All Tracked Addresses</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search by full or partial address..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-8 text-sm"
                          data-testid="input-search-hall"
                        />
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {([
                          { key: "all", label: "All" },
                          { key: "active", label: "Active" },
                          { key: "dropped", label: "Dropped" },
                        ] as const).map((f) => (
                          <Button
                            key={f.key}
                            variant={filter === f.key ? "default" : "secondary"}
                            size="sm"
                            onClick={() => setFilter(f.key as any)}
                            data-testid={`button-filter-${f.key}`}
                          >
                            {f.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-xs text-muted-foreground mr-1 self-center">Sort:</span>
                      {([
                        { key: "appearances", label: "Appearances" },
                        { key: "bestRank", label: "Best Rank" },
                        { key: "lastBalance", label: "Last Balance" },
                        { key: "firstSeen", label: "First Seen" },
                      ] as const).map((s) => (
                        <Button
                          key={s.key}
                          variant={sortBy === s.key ? "outline" : "ghost"}
                          size="sm"
                          onClick={() => setSortBy(s.key as any)}
                          data-testid={`button-sort-${s.key}`}
                        >
                          {s.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center hidden sm:table-cell">Best #</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Last Balance</TableHead>
                          <TableHead className="text-center hidden lg:table-cell">Apps</TableHead>
                          <TableHead className="text-center hidden lg:table-cell">First Seen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((e) => (
                          <TableRow key={e.address} className="hover-elevate cursor-pointer" data-testid={`row-hall-${e.address.slice(0, 8)}`}>
                            <TableCell className="max-w-[300px]">
                              <Link href={`/${chain}/address/${e.address}`}>
                                <div className="space-y-0.5">
                                  {e.label && (
                                    <Badge variant="outline" className={`text-xs no-default-hover-elevate no-default-active-elevate ${getCategoryColor(e.category)}`}>
                                      {e.label}
                                    </Badge>
                                  )}
                                  <p className="font-mono text-xs text-muted-foreground break-all">{e.address}</p>
                                  {e.currentStatus === "inactive" && (
                                    <p className="text-xs text-muted-foreground">Last rank: #{e.lastRank}</p>
                                  )}
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell className="text-center">
                              {e.currentStatus === "active" ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs no-default-hover-elevate no-default-active-elevate text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                                >
                                  #{e.currentRank}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs no-default-hover-elevate no-default-active-elevate text-red-400 border-red-400/20 bg-red-400/10"
                                >
                                  <ArrowDown className="w-3 h-3 mr-0.5" />
                                  Dropped
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-sm hidden sm:table-cell">#{e.bestRank}</TableCell>
                            <TableCell className="text-right font-mono text-xs hidden md:table-cell">{formatBalance(e.lastBalance)} ELA</TableCell>
                            <TableCell className="text-center text-sm hidden lg:table-cell">{e.totalAppearances}</TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground hidden lg:table-cell">{e.firstSeen}</TableCell>
                          </TableRow>
                        ))}
                        {filtered.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                              No addresses found matching your search
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              fontSize: "12px",
                              color: "hsl(var(--foreground))",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {pieData.map((entry) => (
                          <div key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                              <span>{entry.name}</span>
                            </div>
                            <span className="text-muted-foreground">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
