import cron from "node-cron";
import { fetchRichList } from "./fetcher";
import { analyzeSnapshot } from "./analyzer";
import { storage } from "../storage";
import { log } from "../index";

function getCurrentTimeSlot(): string {
  const hour = new Date().getUTCHours();
  const slotHour = Math.floor(hour / 2) * 2;
  return `${slotHour.toString().padStart(2, "0")}:00`;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export async function triggerManualSnapshot(): Promise<any> {
  return takeSnapshot("manual");
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

    const analysis = analyzeSnapshot(fetchResult.richlist, prevEntries, tempSnapshot.id);

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

    log(`Snapshot ${snapshot.id} completed: ${analysis.entries.length} entries, ${analysis.newEntries.length} new, ${analysis.dropouts.length} dropouts`, "scheduler");

    return snapshot;
  } catch (error: any) {
    log(`Snapshot failed: ${error.message}`, "scheduler");
    throw error;
  }
}

export function startScheduler(): void {
  cron.schedule("0 */2 * * *", () => takeSnapshot("cron"), { timezone: "UTC" });

  log("Scheduler started: snapshots every 2 hours UTC (00, 02, 04, ..., 22)", "scheduler");
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
