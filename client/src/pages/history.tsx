import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, Database } from "lucide-react";
import { formatBalance } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RankMedal, RankBadge } from "@/components/rank-badge";
import { AddressDisplay } from "@/components/address-display";
import { Link } from "wouter";

interface SnapshotListItem {
  id: number;
  date: string;
  timeSlot: string;
  fetchedAt: string;
  totalBalances: number | null;
  totalRichlist: number | null;
}

interface SnapshotDetail {
  snapshot: SnapshotListItem;
  entries: Array<{
    rank: number;
    address: string;
    balance: number;
    percentage: number | null;
    prevRank: number | null;
    rankChange: number | null;
    balanceChange: number | null;
    label: string | null;
    category: string | null;
  }>;
}

export default function History() {
  const [page, setPage] = useState(1);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { data: snapshotsData, isLoading } = useQuery<{ snapshots: SnapshotListItem[]; total: number }>({
    queryKey: ["/api/snapshots", `?page=${page}&limit=20`],
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<SnapshotDetail>({
    queryKey: ["/api/snapshots", selectedSnapshotId?.toString() ?? ""],
    enabled: selectedSnapshotId !== null,
  });

  const snapshotsByDate: Record<string, SnapshotListItem[]> = {};
  if (snapshotsData?.snapshots) {
    for (const s of snapshotsData.snapshots) {
      if (!snapshotsByDate[s.date]) snapshotsByDate[s.date] = [];
      snapshotsByDate[s.date].push(s);
    }
  }

  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleString("default", { month: "long", year: "numeric" });

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Snapshot History</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-sm">{monthName}</CardTitle>
          <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-xs text-muted-foreground py-1">{d}</div>
            ))}
            {[...Array(firstDayOfWeek)].map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const daySnapshots = snapshotsByDate[dateStr];
              const count = daySnapshots?.length || 0;

              return (
                <button
                  key={day}
                  onClick={() => {
                    if (daySnapshots?.length) setSelectedSnapshotId(daySnapshots[0].id);
                  }}
                  className={`aspect-square rounded-md flex items-center justify-center text-xs relative ${
                    count > 0
                      ? "hover-elevate cursor-pointer"
                      : "text-muted-foreground/50"
                  }`}
                  data-testid={`button-calendar-day-${day}`}
                >
                  {day}
                  {count > 0 && (
                    <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      count >= 3 ? "bg-primary" : count >= 2 ? "bg-primary/60" : "bg-primary/30"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">All Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32 ml-auto" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Total Balance</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshotsData?.snapshots.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedSnapshotId(s.id)}
                      data-testid={`row-snapshot-${s.id}`}
                    >
                      <TableCell className="font-mono text-xs">{s.date}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {s.timeSlot}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {s.totalBalances ? formatBalance(s.totalBalances) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground hidden sm:table-cell">
                        {s.totalRichlist || 50}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {snapshotsData && snapshotsData.total > page * 20 && (
                <div className="p-3 flex justify-center">
                  <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} data-testid="button-load-more">
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedSnapshotId !== null} onOpenChange={(open) => !open && setSelectedSnapshotId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Snapshot: {detailData?.snapshot.date} {detailData?.snapshot.timeSlot}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : detailData ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-14">Chg</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailData.entries.map((e) => (
                  <TableRow key={e.address}>
                    <TableCell><RankMedal rank={e.rank} /></TableCell>
                    <TableCell><RankBadge rank={e.rank} rankChange={e.rankChange} /></TableCell>
                    <TableCell>
                      <Link href={`/address/${e.address}`}>
                        <AddressDisplay address={e.address} label={e.label} category={e.category} showCopy={false} />
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatBalance(e.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
