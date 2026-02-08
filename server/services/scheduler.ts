import cron from "node-cron";
import { fetchRichList } from "./fetcher";
import { fetchEscRichList } from "./esc-fetcher";
import { analyzeSnapshot, type AddressHistoryMap } from "./analyzer";
import { buildConcentrationMetrics } from "./analytics";
import { storage } from "../storage";
import { log } from "../index";

// Backoff state: skip snapshot attempts after consecutive failures
let consecutiveFailures = 0;
let skipUntil: Date | null = null;

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
  // Backoff: skip if we're in a cooldown period (unless manual trigger)
  if (trigger !== "manual" && skipUntil && new Date() < skipUntil) {
    const mins = Math.ceil((skipUntil.getTime() - Date.now()) / 60000);
    log(`Skipping snapshot — API backoff active, resuming in ${mins}m (${consecutiveFailures} consecutive failures)`, "scheduler");
    return null;
  }

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

    let tempSnapshot;
    try {
      tempSnapshot = await storage.insertSnapshot({
        date,
        timeSlot,
        fetchedAt: new Date().toISOString(),
        totalBalances: fetchResult.totalBalances,
        totalRichlist: fetchResult.richlist.length,
      });
    } catch (insertErr: any) {
      // Handle race condition: another snapshot for this slot was inserted between check and insert
      if (insertErr.code === "23505") {
        log(`Snapshot for ${date} ${timeSlot} was already inserted (race condition), skipping`, "scheduler");
        const existing = await storage.getSnapshotByDateAndSlot(date, timeSlot);
        return existing;
      }
      throw insertErr;
    }

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

    // Reset backoff on success
    if (consecutiveFailures > 0) {
      log(`API recovered after ${consecutiveFailures} consecutive failures`, "scheduler");
    }
    consecutiveFailures = 0;
    skipUntil = null;

    return snapshot;
  } catch (error: any) {
    consecutiveFailures++;
    log(`Snapshot failed (failure #${consecutiveFailures}): ${error.message}`, "scheduler");

    // After 3 consecutive failures, back off for 15 minutes
    if (consecutiveFailures >= 3) {
      const backoffMinutes = Math.min(15 * Math.pow(2, Math.floor((consecutiveFailures - 3) / 3)), 120);
      skipUntil = new Date(Date.now() + backoffMinutes * 60000);
      log(`API appears down — backing off for ${backoffMinutes} minutes (until ${skipUntil.toISOString()})`, "scheduler");
    }

    if (trigger === "manual") throw error;
    return null;
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

// ─── ESC Snapshot (completely isolated from mainchain) ────────────────────

let escFailures = 0;
let escSkipUntil: Date | null = null;

async function takeEscSnapshot(): Promise<void> {
  if (escSkipUntil && new Date() < escSkipUntil) return;

  const date = getTodayDate();
  const timeSlot = getCurrentTimeSlot();

  try {
    const existing = await storage.getSnapshotByDateSlotChain(date, timeSlot, "esc");
    if (existing) return;

    const fetchResult = await fetchEscRichList();

    const prevSnapshot = await storage.getLatestSnapshotByChain("esc");
    const prevEntries = prevSnapshot ? await storage.getEntriesBySnapshotId(prevSnapshot.id) : [];

    let escSnapshot;
    try {
      escSnapshot = await storage.insertSnapshot({
        chain: "esc", date, timeSlot,
        fetchedAt: new Date().toISOString(),
        totalBalances: fetchResult.totalSupply,
        totalRichlist: fetchResult.richlist.length,
      });
    } catch (err: any) {
      if (err.code === "23505") return;
      throw err;
    }

    const analysis = analyzeSnapshot(fetchResult.richlist, prevEntries, escSnapshot.id);
    await storage.insertSnapshotEntries(analysis.entries);

    log(`ESC snapshot ${escSnapshot.id}: ${analysis.entries.length} entries`, "scheduler");
    escFailures = 0;
    escSkipUntil = null;
  } catch (error: any) {
    escFailures++;
    log(`ESC snapshot failed (#${escFailures}): ${error.message}`, "scheduler");
    if (escFailures >= 3) {
      const mins = Math.min(15 * Math.pow(2, Math.floor((escFailures - 3) / 3)), 120);
      escSkipUntil = new Date(Date.now() + mins * 60000);
    }
  }
}

export function startScheduler(): void {
  // Mainchain snapshot every 5 minutes
  cron.schedule("*/5 * * * *", () => takeSnapshot("cron"), { timezone: "UTC" });

  // ESC snapshot every 5 minutes (offset by 2 minutes to avoid overlap)
  cron.schedule("2-59/5 * * * *", () => takeEscSnapshot(), { timezone: "UTC" });

  // Weekly summary every Sunday at 23:59 UTC
  cron.schedule("59 23 * * 0", () => computeWeeklySummary(), { timezone: "UTC" });

  log("Scheduler started: mainchain + ESC every 5min, weekly summary Sundays", "scheduler");
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
