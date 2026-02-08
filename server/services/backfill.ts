/**
 * Backfill Script
 * Computes analytics (concentration metrics, streaks, volatility, trends)
 * for all existing historical snapshots that don't have them yet.
 * 
 * Run via POST /api/admin/backfill or import and call directly.
 */

import { storage } from "../storage";
import { buildConcentrationMetrics } from "./analytics";
import { computeRankStreak, computeBalanceStreak, computeRankVolatility, computeBalanceTrend } from "./analytics";
import { db } from "../db";
import { snapshotEntries, snapshots } from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { log } from "../index";

/**
 * Backfill concentration_metrics for all snapshots that don't have them.
 */
export async function backfillConcentrationMetrics(): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  const allSnapshots = await db.select().from(snapshots).orderBy(asc(snapshots.id));
  log(`Backfill: Found ${allSnapshots.length} snapshots to process`, "backfill");

  for (let i = 0; i < allSnapshots.length; i++) {
    const snap = allSnapshots[i];

    // Check if metrics already exist for this snapshot (query by date to find match)
    try {
      const existing = await storage.getConcentrationByDateRange(snap.date, snap.date);
      if (existing.some(m => m.snapshotId === snap.id)) {
        skipped++;
        continue;
      }
    } catch {
      // Table might not exist yet, proceed
    }

    try {
      const entries = await storage.getEntriesBySnapshotId(snap.id);
      if (entries.length === 0) {
        skipped++;
        continue;
      }

      // Count new entries and dropouts vs previous snapshot
      let newEntryCount = 0;
      let dropoutCount = 0;
      if (i > 0) {
        const prevEntries = await storage.getEntriesBySnapshotId(allSnapshots[i - 1].id);
        const prevAddresses = new Set(prevEntries.map(e => e.address));
        const currentAddresses = new Set(entries.map(e => e.address));
        newEntryCount = entries.filter(e => !prevAddresses.has(e.address)).length;
        dropoutCount = prevEntries.filter(e => !currentAddresses.has(e.address)).length;
      }

      const metrics = buildConcentrationMetrics(
        snap.id,
        snap.date,
        snap.timeSlot,
        entries,
        newEntryCount,
        dropoutCount
      );

      await storage.insertConcentrationMetrics(metrics);
      processed++;

      if (processed % 50 === 0) {
        log(`Backfill progress: ${processed} processed, ${skipped} skipped`, "backfill");
      }
    } catch (err: any) {
      errors++;
      log(`Backfill error for snapshot ${snap.id}: ${err.message}`, "backfill");
    }
  }

  log(`Backfill complete: ${processed} processed, ${skipped} skipped, ${errors} errors`, "backfill");
  return { processed, skipped, errors };
}

/**
 * Backfill per-entry analytics (streaks, volatility, trends) for all snapshots.
 * This processes entries chronologically to build proper streaks.
 */
export async function backfillEntryAnalytics(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  const allSnapshots = await db.select().from(snapshots).orderBy(asc(snapshots.id));
  log(`Backfill entry analytics: Found ${allSnapshots.length} snapshots`, "backfill");

  // Track per-address history as we process chronologically
  const addressHistory: Map<string, Array<{ rank: number; balance: number; rankStreak: number; balanceStreak: number }>> = new Map();

  for (const snap of allSnapshots) {
    try {
      const entries = await storage.getEntriesBySnapshotId(snap.id);

      for (const entry of entries) {
        const history = addressHistory.get(entry.address) || [];
        const lastEntry = history.length > 0 ? history[history.length - 1] : null;

        // Compute streaks
        const rankStreak = computeRankStreak(entry.rankChange, lastEntry?.rankStreak ?? null);
        const balanceStreak = computeBalanceStreak(entry.balanceChange, lastEntry?.balanceStreak ?? null);

        // Compute volatility (from recent ranks)
        const recentRanks = history.map(h => h.rank).concat(entry.rank);
        const volatility = computeRankVolatility(recentRanks.slice(-30));

        // Compute balance trend
        const recentBalances = history.map(h => h.balance).concat(entry.balance);
        const trend = computeBalanceTrend(recentBalances.slice(-15));

        // Update in DB
        await db.update(snapshotEntries)
          .set({
            rankStreak,
            balanceStreak,
            rankVolatility: volatility,
            balanceTrend: trend,
          })
          .where(eq(snapshotEntries.id, entry.id));

        // Update history (keep last 30)
        history.push({ rank: entry.rank, balance: entry.balance, rankStreak, balanceStreak });
        if (history.length > 30) history.shift();
        addressHistory.set(entry.address, history);

        processed++;
      }

      if (processed % 500 === 0) {
        log(`Backfill entry progress: ${processed} entries processed`, "backfill");
      }
    } catch (err: any) {
      errors++;
      log(`Backfill entry error for snapshot ${snap.id}: ${err.message}`, "backfill");
    }
  }

  log(`Backfill entry analytics complete: ${processed} entries, ${errors} errors`, "backfill");
  return { processed, errors };
}
