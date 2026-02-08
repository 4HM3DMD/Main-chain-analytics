/**
 * Advanced Analytics Engine
 * Pure computation functions for whale behavior analysis.
 */

import type { SnapshotEntry, InsertConcentrationMetrics } from "@shared/schema";

// ─── Wealth Distribution Metrics ────────────────────────────────────────────

/**
 * Compute Gini Coefficient from an array of balances.
 * 0 = perfect equality (everyone holds the same), 1 = maximum inequality (one wallet holds everything).
 */
export function computeGiniCoefficient(balances: number[]): number {
  if (balances.length === 0) return 0;
  const n = balances.length;
  const sorted = [...balances].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  let sumOfAbsDiffs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfAbsDiffs += Math.abs(sorted[i] - sorted[j]);
    }
  }

  return sumOfAbsDiffs / (2 * n * n * mean);
}

/**
 * Compute Herfindahl-Hirschman Index (HHI) from balances.
 * Measures market concentration. Range: 10000/N (equal) to 10000 (monopoly).
 * Values > 2500 = highly concentrated, 1500-2500 = moderate, < 1500 = competitive.
 */
export function computeHHI(balances: number[]): number {
  if (balances.length === 0) return 0;
  const total = balances.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  return balances.reduce((hhi, balance) => {
    const share = (balance / total) * 100; // Market share as percentage
    return hhi + share * share;
  }, 0);
}

// ─── Flow Analysis ──────────────────────────────────────────────────────────

export interface NetFlowResult {
  netFlow: number;
  totalInflow: number;
  totalOutflow: number;
  activeWallets: number;
}

/**
 * Compute net flow metrics from snapshot entries.
 * Inflow = sum of positive balance changes. Outflow = sum of negative balance changes (absolute).
 */
export function computeNetFlow(entries: SnapshotEntry[]): NetFlowResult {
  let totalInflow = 0;
  let totalOutflow = 0;
  let activeWallets = 0;

  for (const entry of entries) {
    if (entry.balanceChange !== null && entry.balanceChange !== 0) {
      activeWallets++;
      if (entry.balanceChange > 0) {
        totalInflow += entry.balanceChange;
      } else {
        totalOutflow += Math.abs(entry.balanceChange);
      }
    }
  }

  return {
    netFlow: totalInflow - totalOutflow,
    totalInflow,
    totalOutflow,
    activeWallets,
  };
}

// ─── Whale Activity Index ───────────────────────────────────────────────────

/**
 * Compute Whale Activity Index (WAI) — a composite score measuring how active whales are.
 * Higher = more activity. Combines: balance movement magnitude, rank shuffling, and entry/exit churn.
 * Normalized to roughly 0-100 scale.
 */
export function computeWhaleActivityIndex(
  entries: SnapshotEntry[],
  newEntryCount: number,
  dropoutCount: number
): number {
  if (entries.length === 0) return 0;

  const totalBalance = entries.reduce((s, e) => s + e.balance, 0);
  if (totalBalance === 0) return 0;

  // Component 1: Balance movement (sum of absolute balance changes / total balance * 100)
  const totalAbsBalanceChange = entries.reduce(
    (s, e) => s + Math.abs(e.balanceChange || 0), 0
  );
  const balanceMovementScore = (totalAbsBalanceChange / totalBalance) * 100;

  // Component 2: Rank shuffling (average absolute rank change, max 100)
  const totalAbsRankChange = entries.reduce(
    (s, e) => s + Math.abs(e.rankChange || 0), 0
  );
  const rankShuffleScore = Math.min(totalAbsRankChange / entries.length, 100);

  // Component 3: Churn (new entries + dropouts as % of total, scaled)
  const churnScore = ((newEntryCount + dropoutCount) / entries.length) * 100;

  // Weighted composite: balance movement (50%) + rank shuffle (30%) + churn (20%)
  const wai = balanceMovementScore * 0.5 + rankShuffleScore * 0.3 + churnScore * 0.2;

  return Math.round(wai * 100) / 100;
}

// ─── Streak Detection ───────────────────────────────────────────────────────

/**
 * Compute rank streak: consecutive snapshots where rank moves in the same direction.
 * Positive = climbing (rank # decreasing), Negative = falling (rank # increasing), 0 = no change.
 */
export function computeRankStreak(
  currentRankChange: number | null,
  previousRankStreak: number | null
): number {
  if (currentRankChange === null || currentRankChange === 0) return 0;

  const direction = currentRankChange > 0 ? 1 : -1; // positive rankChange = moved up
  const prevDirection = previousRankStreak !== null && previousRankStreak !== 0
    ? (previousRankStreak > 0 ? 1 : -1)
    : 0;

  if (direction === prevDirection) {
    return (previousRankStreak || 0) + direction;
  }
  return direction;
}

/**
 * Compute balance streak: consecutive snapshots of gains or losses.
 * Positive = gaining, Negative = losing, 0 = no change.
 */
export function computeBalanceStreak(
  currentBalanceChange: number | null,
  previousBalanceStreak: number | null
): number {
  if (currentBalanceChange === null || currentBalanceChange === 0) return 0;

  const direction = currentBalanceChange > 0 ? 1 : -1;
  const prevDirection = previousBalanceStreak !== null && previousBalanceStreak !== 0
    ? (previousBalanceStreak > 0 ? 1 : -1)
    : 0;

  if (direction === prevDirection) {
    return (previousBalanceStreak || 0) + direction;
  }
  return direction;
}

// ─── Rank Volatility ────────────────────────────────────────────────────────

/**
 * Compute standard deviation of rank positions over a window of historical entries.
 * Lower = stable, Higher = volatile.
 */
export function computeRankVolatility(ranks: number[]): number {
  if (ranks.length < 2) return 0;
  const mean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
  const variance = ranks.reduce((s, r) => s + (r - mean) ** 2, 0) / ranks.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

// ─── Balance Trend Classification ───────────────────────────────────────────

export type BalanceTrend = "accumulating" | "distributing" | "holding" | "erratic";

/**
 * Classify balance trend using linear regression on balance history.
 * Uses the slope direction and R² fit quality to determine pattern.
 */
export function computeBalanceTrend(balanceHistory: number[]): BalanceTrend {
  if (balanceHistory.length < 3) return "holding";

  const n = balanceHistory.length;
  const xMean = (n - 1) / 2;
  const yMean = balanceHistory.reduce((s, v) => s + v, 0) / n;

  if (yMean === 0) return "holding";

  // Linear regression slope
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const xDev = i - xMean;
    sumXY += xDev * (balanceHistory[i] - yMean);
    sumXX += xDev * xDev;
  }

  const slope = sumXX === 0 ? 0 : sumXY / sumXX;

  // R² (coefficient of determination)
  const ssRes = balanceHistory.reduce((s, y, i) => {
    const predicted = yMean + slope * (i - xMean);
    return s + (y - predicted) ** 2;
  }, 0);
  const ssTot = balanceHistory.reduce((s, y) => s + (y - yMean) ** 2, 0);

  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  // Threshold: slope as percentage of mean balance per step
  const slopePct = (slope / yMean) * 100;

  // If R² < 0.3, the trend is erratic (noisy/unpredictable)
  if (rSquared < 0.3 && Math.abs(slopePct) > 0.1) return "erratic";

  // Classify based on slope magnitude
  if (slopePct > 0.05) return "accumulating";
  if (slopePct < -0.05) return "distributing";
  return "holding";
}

// ─── Dormancy Detection ─────────────────────────────────────────────────────

export interface DormancyInfo {
  isDormant: boolean;
  lastSeenDate: string | null;
  reEntryDate: string | null;
  gapSnapshots: number;
  gapDays: number;
}

/**
 * Detect if a wallet has been dormant (absent from top 100) and re-entered.
 * Analyzes gaps in appearance history.
 */
export function detectDormancy(
  appearances: Array<{ date: string; snapshotId: number }>,
  allSnapshotIds: number[]
): DormancyInfo | null {
  if (appearances.length < 2) return null;

  // Find the largest gap in snapshot IDs
  const appearanceSet = new Set(appearances.map(a => a.snapshotId));
  let maxGap = 0;
  let gapStart = -1;
  let gapEnd = -1;

  const sortedIds = [...allSnapshotIds].sort((a, b) => a - b);

  let currentGap = 0;
  let currentGapStart = -1;

  for (const sid of sortedIds) {
    if (!appearanceSet.has(sid)) {
      if (currentGap === 0) currentGapStart = sid;
      currentGap++;
    } else {
      if (currentGap > maxGap) {
        maxGap = currentGap;
        gapStart = currentGapStart;
        gapEnd = sid;
      }
      currentGap = 0;
    }
  }

  // Only count as dormancy if gap is >= 144 snapshots (~12 hours at 5-min intervals)
  if (maxGap < 144) return null;

  const beforeGap = appearances.filter(a => a.snapshotId < gapStart);
  const afterGap = appearances.filter(a => a.snapshotId >= gapEnd);

  if (beforeGap.length === 0 || afterGap.length === 0) return null;

  const lastSeenDate = beforeGap[beforeGap.length - 1].date;
  const reEntryDate = afterGap[0].date;
  const gapDays = Math.ceil(
    (new Date(reEntryDate).getTime() - new Date(lastSeenDate).getTime()) / 86400000
  );

  return {
    isDormant: false, // they re-entered, so not currently dormant
    lastSeenDate,
    reEntryDate,
    gapSnapshots: maxGap,
    gapDays,
  };
}

// ─── Concentration Metrics Builder ──────────────────────────────────────────

/**
 * Build complete concentration metrics for a snapshot.
 * Called during snapshot ingestion to pre-compute all analytics.
 */
export function buildConcentrationMetrics(
  snapshotId: number,
  date: string,
  timeSlot: string,
  entries: SnapshotEntry[],
  newEntryCount: number,
  dropoutCount: number
): InsertConcentrationMetrics {
  const balances = entries.map(e => e.balance);
  const totalBalance = balances.reduce((s, v) => s + v, 0);

  // Concentration percentages
  const top10Balance = balances.slice(0, 10).reduce((s, v) => s + v, 0);
  const top20Balance = balances.slice(0, 20).reduce((s, v) => s + v, 0);
  const top50Balance = balances.slice(0, 50).reduce((s, v) => s + v, 0);

  const top10Pct = totalBalance > 0 ? (top10Balance / totalBalance) * 100 : 0;
  const top20Pct = totalBalance > 0 ? (top20Balance / totalBalance) * 100 : 0;
  const top50Pct = totalBalance > 0 ? (top50Balance / totalBalance) * 100 : 0;

  // Net flow
  const flowResult = computeNetFlow(entries);

  // Rank change averages
  const rankChanges = entries
    .filter(e => e.rankChange !== null)
    .map(e => Math.abs(e.rankChange!));
  const avgRankChange = rankChanges.length > 0
    ? rankChanges.reduce((s, v) => s + v, 0) / rankChanges.length
    : 0;

  // Balance change percentages (relative to previous balance, not current)
  const balanceChangePcts = entries
    .filter(e => e.balanceChange !== null && e.balance > 0)
    .map(e => {
      const prevBalance = e.balance - (e.balanceChange || 0);
      return prevBalance > 0 ? (e.balanceChange! / prevBalance) * 100 : 0;
    })
    .filter(p => isFinite(p));
  const avgBalanceChangePct = balanceChangePcts.length > 0
    ? balanceChangePcts.reduce((s, v) => s + v, 0) / balanceChangePcts.length
    : 0;

  return {
    snapshotId,
    date,
    timeSlot,
    giniCoefficient: computeGiniCoefficient(balances),
    hhi: computeHHI(balances),
    top10Pct: Math.round(top10Pct * 100) / 100,
    top20Pct: Math.round(top20Pct * 100) / 100,
    top50Pct: Math.round(top50Pct * 100) / 100,
    netFlow: Math.round(flowResult.netFlow * 100) / 100,
    totalInflow: Math.round(flowResult.totalInflow * 100) / 100,
    totalOutflow: Math.round(flowResult.totalOutflow * 100) / 100,
    whaleActivityIndex: computeWhaleActivityIndex(entries, newEntryCount, dropoutCount),
    activeWallets: flowResult.activeWallets,
    avgRankChange: Math.round(avgRankChange * 100) / 100,
    avgBalanceChangePct: Math.round(avgBalanceChangePct * 100) / 100,
    newEntryCount,
    dropoutCount,
    totalBalance: Math.round(totalBalance * 100) / 100,
  };
}

// ─── Pearson Correlation ────────────────────────────────────────────────────

/**
 * Compute Pearson correlation coefficient between two balance change time series.
 * Returns value between -1 (inversely correlated) and 1 (perfectly correlated).
 * Returns null if insufficient data points.
 */
export function computePearsonCorrelation(
  seriesA: number[],
  seriesB: number[]
): number | null {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 5) return null; // Need at least 5 data points for meaningful correlation

  const a = seriesA.slice(0, n);
  const b = seriesB.slice(0, n);

  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let sumAB = 0;
  let sumAA = 0;
  let sumBB = 0;

  for (let i = 0; i < n; i++) {
    const devA = a[i] - meanA;
    const devB = b[i] - meanB;
    sumAB += devA * devB;
    sumAA += devA * devA;
    sumBB += devB * devB;
  }

  const denominator = Math.sqrt(sumAA * sumBB);
  if (denominator === 0) return null;

  return Math.round((sumAB / denominator) * 10000) / 10000;
}
