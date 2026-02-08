import type { SnapshotEntry, InsertSnapshotEntry } from "@shared/schema";
import type { RichListItem } from "./fetcher";
import {
  computeRankStreak,
  computeBalanceStreak,
  computeRankVolatility,
  computeBalanceTrend,
} from "./analytics";

export interface AnalysisResult {
  entries: InsertSnapshotEntry[];
  newEntries: string[];
  dropouts: string[];
  biggestGainer: { address: string; change: number } | null;
  biggestLoser: { address: string; change: number } | null;
  totalBalance: number;
}

/**
 * Historical entries for an address used to compute advanced metrics.
 * Provided by the caller (storage layer) to avoid DB dependency in this module.
 */
export interface AddressHistoryMap {
  /** Map of address -> array of recent entries (ordered by snapshotId ascending) */
  [address: string]: Array<{ rank: number; balance: number; rankStreak: number | null; balanceStreak: number | null }>;
}

export function analyzeSnapshot(
  currentData: RichListItem[],
  previousEntries: SnapshotEntry[],
  snapshotId: number,
  addressHistory?: AddressHistoryMap
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

    // ─── Advanced Metrics ─────────────────────────────────────────────
    let rankStreakVal: number | null = null;
    let balanceStreakVal: number | null = null;
    let rankVolatilityVal: number | null = null;
    let balanceTrendVal: string | null = null;

    if (addressHistory && addressHistory[item.address]) {
      const history = addressHistory[item.address];
      const lastEntry = history.length > 0 ? history[history.length - 1] : null;

      // Streaks
      rankStreakVal = computeRankStreak(rankChange, lastEntry?.rankStreak ?? null);
      balanceStreakVal = computeBalanceStreak(balanceChange, lastEntry?.balanceStreak ?? null);

      // Rank volatility (std dev of recent ranks including current)
      const recentRanks = history.map(h => h.rank).concat(rank);
      rankVolatilityVal = computeRankVolatility(recentRanks);

      // Balance trend (linear regression on recent balances including current)
      const recentBalances = history.map(h => h.balance).concat(balance);
      balanceTrendVal = computeBalanceTrend(recentBalances);
    } else if (prev) {
      // No deep history, but we have a previous entry — compute basic streak
      rankStreakVal = computeRankStreak(rankChange, prev.rankStreak ?? null);
      balanceStreakVal = computeBalanceStreak(balanceChange, prev.balanceStreak ?? null);
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
      rankVolatility: rankVolatilityVal,
      balanceTrend: balanceTrendVal,
      rankStreak: rankStreakVal,
      balanceStreak: balanceStreakVal,
    };
  });

  prevAddresses.forEach((addr) => {
    if (!currentAddresses.has(addr)) {
      dropouts.push(addr);
    }
  });

  if (biggestGainer && (biggestGainer as { address: string; change: number }).change <= 0) biggestGainer = null;
  if (biggestLoser && (biggestLoser as { address: string; change: number }).change >= 0) biggestLoser = null;

  return { entries, newEntries, dropouts, biggestGainer, biggestLoser, totalBalance };
}
