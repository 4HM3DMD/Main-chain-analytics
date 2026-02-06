import type { SnapshotEntry, InsertSnapshotEntry } from "@shared/schema";
import type { RichListItem } from "./fetcher";

interface AnalysisResult {
  entries: InsertSnapshotEntry[];
  newEntries: string[];
  dropouts: string[];
  biggestGainer: { address: string; change: number } | null;
  biggestLoser: { address: string; change: number } | null;
  totalBalance: number;
}

export function analyzeSnapshot(
  currentData: RichListItem[],
  previousEntries: SnapshotEntry[],
  snapshotId: number
): AnalysisResult {
  const prevMap = new Map(previousEntries.map((e) => [e.address, e]));
  const currentAddresses = new Set(currentData.map((d) => d.address));
  const prevAddresses = new Set(previousEntries.map((e) => e.address));

  const newEntries: string[] = [];
  const dropouts: string[] = [];
  let biggestGainer: { address: string; change: number } | null = null;
  let biggestLoser: { address: string; change: number } | null = null;
  let totalBalance = 0;

  const entries: InsertSnapshotEntry[] = currentData.map((item, index) => {
    const rank = index + 1;
    const balance = parseFloat(item.balance);
    const percentage = parseFloat(item.percentage);
    totalBalance += balance;

    const prev = prevMap.get(item.address);
    let prevRank: number | null = null;
    let rankChange: number | null = null;
    let balanceChange: number | null = null;

    if (prev) {
      prevRank = prev.rank;
      rankChange = prev.rank - rank;
      balanceChange = balance - prev.balance;

      if (!biggestGainer || balanceChange > (biggestGainer.change || 0)) {
        biggestGainer = { address: item.address, change: balanceChange };
      }
      if (!biggestLoser || balanceChange < (biggestLoser?.change || 0)) {
        biggestLoser = { address: item.address, change: balanceChange };
      }
    } else if (previousEntries.length > 0) {
      newEntries.push(item.address);
    }

    return {
      snapshotId,
      rank,
      address: item.address,
      balance,
      percentage,
      prevRank,
      rankChange,
      balanceChange,
    };
  });

  for (const addr of prevAddresses) {
    if (!currentAddresses.has(addr)) {
      dropouts.push(addr);
    }
  }

  if (biggestGainer && biggestGainer.change <= 0) biggestGainer = null;
  if (biggestLoser && biggestLoser.change >= 0) biggestLoser = null;

  return { entries, newEntries, dropouts, biggestGainer, biggestLoser, totalBalance };
}
