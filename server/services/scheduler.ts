import cron from "node-cron";
import { fetchRichList } from "./fetcher";
import { analyzeSnapshot, type AddressHistoryMap } from "./analyzer";
import { buildConcentrationMetrics } from "./analytics";
import { storage } from "../storage";
import { log } from "../index";

function getCurrentTimeSlot(): string {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = Math.floor(now.getUTCMinutes() / 5) * 5;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export async function triggerManualSnapshot(): Promise<any> {
  return takeSnapshot("manual");
}

/**
 * Build address history map for computing advanced per-entry metrics.
 * Fetches the last N entries for each address in the current richlist.
 */
async function buildAddressHistoryMap(
  addresses: string[],
  windowSize: number = 30
): Promise<AddressHistoryMap> {
  const historyMap: AddressHistoryMap = {};

  // Batch fetch recent entries for all current addresses
  for (const address of addresses) {
    try {
      const entries = await storage.getRecentAddressEntries(address, windowSize);
      if (entries.length > 0) {
        historyMap[address] = entries;
      }
    } catch {
      // Skip if address has no history yet
    }
  }

  return historyMap;
}

async function takeSnapshot(trigger: string = "cron"): Promise<any> {
  const date = getTodayDate();
  const timeSlot = trigger === "manual" ? new Date().toISOString().split("T")[1].slice(0, 5) : getCurrentTimeSlot();

  log(`Starting ${trigger} snapshot for ${date} ${timeSlot}`, "scheduler");

  try {
    if (trigger !== "manual") {
      const existing = await storage.getSnapshotByDateAndSlot(date, timeSlot);
      if (existing) {
        log(`Snapshot already exists for ${date} ${timeSlot}, skipping`, "scheduler");
        return existing;
      }
    }

    const fetchResult = await fetchRichList();

    const prevSnapshot = await storage.getLatestSnapshot();
    const prevEntries = prevSnapshot
      ? await storage.getEntriesBySnapshotId(prevSnapshot.id)
      : [];

    const tempSnapshot = await storage.insertSnapshot({
      date,
      timeSlot,
      fetchedAt: new Date().toISOString(),
      totalBalances: fetchResult.totalBalances,
      totalRichlist: fetchResult.richlist.length,
    });

    // Build address history for advanced analytics (streaks, volatility, trends)
    const addresses = fetchResult.richlist.map(r => r.address);
    let addressHistory: AddressHistoryMap | undefined;
    try {
      addressHistory = await buildAddressHistoryMap(addresses);
    } catch (err: any) {
      log(`Warning: Could not build address history: ${err.message}`, "scheduler");
    }

    const analysis = analyzeSnapshot(fetchResult.richlist, prevEntries, tempSnapshot.id, addressHistory);

    await storage.insertSnapshotEntries(analysis.entries);
    const snapshot = { ...tempSnapshot, totalBalances: fetchResult.totalBalances };

    await storage.upsertDailySummary({
      date,
      newEntries: JSON.stringify(analysis.newEntries),
      dropouts: JSON.stringify(analysis.dropouts),
      biggestGainerAddress: analysis.biggestGainer?.address || null,
      biggestGainerChange: analysis.biggestGainer?.change || null,
      biggestLoserAddress: analysis.biggestLoser?.address || null,
      biggestLoserChange: analysis.biggestLoser?.change || null,
    });

    // ─── Compute & Store Concentration Metrics ─────────────────────────
    try {
      const storedEntries = await storage.getEntriesBySnapshotId(tempSnapshot.id);
      const metrics = buildConcentrationMetrics(
        tempSnapshot.id,
        date,
        timeSlot,
        storedEntries,
        analysis.newEntries.length,
        analysis.dropouts.length
      );
      await storage.insertConcentrationMetrics(metrics);
      log(`Concentration metrics computed: Gini=${metrics.giniCoefficient?.toFixed(4)}, WAI=${metrics.whaleActivityIndex}`, "scheduler");
    } catch (err: any) {
      log(`Warning: Could not compute concentration metrics: ${err.message}`, "scheduler");
    }

    log(`Snapshot ${snapshot.id} completed: ${analysis.entries.length} entries, ${analysis.newEntries.length} new, ${analysis.dropouts.length} dropouts`, "scheduler");

    return snapshot;
  } catch (error: any) {
    log(`Snapshot failed: ${error.message}`, "scheduler");
    throw error;
  }
}

/**
 * Compute weekly summary from concentration_metrics data.
 * Called every Sunday midnight UTC.
 */
async function computeWeeklySummary(): Promise<void> {
  try {
    const now = new Date();
    // Last Sunday (end of previous week)
    const dayOfWeek = now.getUTCDay();
    const lastSunday = new Date(now);
    lastSunday.setUTCDate(now.getUTCDate() - dayOfWeek);
    const weekEnd = lastSunday.toISOString().split("T")[0];

    // Monday of the same week
    const lastMonday = new Date(lastSunday);
    lastMonday.setUTCDate(lastSunday.getUTCDate() - 6);
    const weekStart = lastMonday.toISOString().split("T")[0];

    log(`Computing weekly summary for ${weekStart} to ${weekEnd}`, "scheduler");

    const metrics = await storage.getConcentrationByDateRange(weekStart, weekEnd);
    if (metrics.length === 0) {
      log("No concentration metrics found for the week, skipping", "scheduler");
      return;
    }

    const firstMetric = metrics[0];
    const lastMetric = metrics[metrics.length - 1];

    const avgWAI = metrics.reduce((s, m) => s + (m.whaleActivityIndex || 0), 0) / metrics.length;
    const totalNetFlow = metrics.reduce((s, m) => s + (m.netFlow || 0), 0);
    const totalNew = metrics.reduce((s, m) => s + (m.newEntryCount || 0), 0);
    const totalDropouts = metrics.reduce((s, m) => s + (m.dropoutCount || 0), 0);
    const avgVolatility = metrics.reduce((s, m) => s + (m.avgRankChange || 0), 0) / metrics.length;

    // Find top accumulator/distributor from movers endpoint logic
    const moverData = await storage.getMovers(weekStart, weekEnd);

    await storage.upsertWeeklySummary({
      weekStart,
      weekEnd,
      giniStart: firstMetric.giniCoefficient,
      giniEnd: lastMetric.giniCoefficient,
      giniChange: (lastMetric.giniCoefficient || 0) - (firstMetric.giniCoefficient || 0),
      totalBalanceStart: firstMetric.totalBalance,
      totalBalanceEnd: lastMetric.totalBalance,
      netFlowTotal: Math.round(totalNetFlow * 100) / 100,
      avgWhaleActivityIndex: Math.round(avgWAI * 100) / 100,
      totalNewEntries: totalNew,
      totalDropouts,
      topAccumulatorAddress: moverData.gainers[0]?.address || null,
      topAccumulatorChange: moverData.gainers[0]?.balanceChange || null,
      topDistributorAddress: moverData.losers[0]?.address || null,
      topDistributorChange: moverData.losers[0]?.balanceChange || null,
      avgRankVolatility: Math.round(avgVolatility * 100) / 100,
      snapshotCount: metrics.length,
    });

    log(`Weekly summary computed for ${weekStart}: ${metrics.length} snapshots, Gini ${firstMetric.giniCoefficient?.toFixed(4)} -> ${lastMetric.giniCoefficient?.toFixed(4)}`, "scheduler");
  } catch (error: any) {
    log(`Weekly summary failed: ${error.message}`, "scheduler");
  }
}

export function startScheduler(): void {
  // Snapshot every 5 minutes
  cron.schedule("*/5 * * * *", () => takeSnapshot("cron"), { timezone: "UTC" });

  // Weekly summary every Sunday at 23:59 UTC
  cron.schedule("59 23 * * 0", () => computeWeeklySummary(), { timezone: "UTC" });

  log("Scheduler started: snapshots every 5 minutes UTC, weekly summary Sundays 23:59 UTC", "scheduler");
}

export async function initializeIfEmpty(): Promise<void> {
  const count = await storage.getSnapshotCount();
  if (count === 0) {
    log("Database is empty, taking initial snapshot...", "scheduler");
    try {
      await takeSnapshot("init");
    } catch (error: any) {
      log(`Initial snapshot failed: ${error.message}`, "scheduler");
    }
  }
}
