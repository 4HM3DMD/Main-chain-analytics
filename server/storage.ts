import {
  snapshots, snapshotEntries, addressLabels, dailySummary,
  type Snapshot, type InsertSnapshot,
  type SnapshotEntry, type InsertSnapshotEntry,
  type AddressLabel, type InsertAddressLabel,
  type DailySummary, type InsertDailySummary,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, inArray, asc } from "drizzle-orm";

export interface IStorage {
  insertSnapshot(data: InsertSnapshot): Promise<Snapshot>;
  updateSnapshotTotalBalances(id: number, totalBalances: number): Promise<void>;
  getLatestSnapshot(): Promise<Snapshot | undefined>;
  getSnapshotById(id: number): Promise<Snapshot | undefined>;
  getSnapshots(page: number, limit: number): Promise<{ snapshots: Snapshot[]; total: number }>;
  getSnapshotByDateAndSlot(date: string, timeSlot: string): Promise<Snapshot | undefined>;
  getLastSnapshotOfDate(date: string): Promise<Snapshot | undefined>;

  insertSnapshotEntries(entries: InsertSnapshotEntry[]): Promise<void>;
  getEntriesBySnapshotId(snapshotId: number): Promise<SnapshotEntry[]>;
  getEntriesWithLabels(snapshotId: number): Promise<Array<SnapshotEntry & { label: string | null; category: string | null }>>;
  getAddressHistory(address: string): Promise<Array<SnapshotEntry & { date: string; timeSlot: string }>>;
  getAllUniqueAddresses(): Promise<string[]>;
  getUniqueAddressCount(): Promise<number>;
  getSnapshotCount(): Promise<number>;

  getAddressLabel(address: string): Promise<AddressLabel | undefined>;
  getAllLabels(): Promise<AddressLabel[]>;
  upsertAddressLabel(data: InsertAddressLabel): Promise<void>;

  upsertDailySummary(data: InsertDailySummary): Promise<void>;
  getRecentSummaries(limit: number): Promise<DailySummary[]>;
  getDailySummaryByDate(date: string): Promise<DailySummary | undefined>;

  getMovers(fromDate: string, toDate: string): Promise<{ gainers: any[]; losers: any[] }>;
  searchAddresses(query: string): Promise<any[]>;
  getHallOfFame(): Promise<any[]>;
  getCompareData(fromDate: string, toDate: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async insertSnapshot(data: InsertSnapshot): Promise<Snapshot> {
    const [result] = await db.insert(snapshots).values(data).returning();
    return result;
  }

  async updateSnapshotTotalBalances(id: number, totalBalances: number): Promise<void> {
    await db.update(snapshots).set({ totalBalances }).where(eq(snapshots.id, id));
  }

  async getLatestSnapshot(): Promise<Snapshot | undefined> {
    const [result] = await db.select().from(snapshots).orderBy(desc(snapshots.id)).limit(1);
    return result;
  }

  async getSnapshotById(id: number): Promise<Snapshot | undefined> {
    const [result] = await db.select().from(snapshots).where(eq(snapshots.id, id));
    return result;
  }

  async getSnapshots(page: number, limit: number): Promise<{ snapshots: Snapshot[]; total: number }> {
    const offset = (page - 1) * limit;
    const results = await db.select().from(snapshots).orderBy(desc(snapshots.id)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(snapshots);
    return { snapshots: results, total: count };
  }

  async getSnapshotByDateAndSlot(date: string, timeSlot: string): Promise<Snapshot | undefined> {
    const [result] = await db.select().from(snapshots)
      .where(and(eq(snapshots.date, date), eq(snapshots.timeSlot, timeSlot)));
    return result;
  }

  async getLastSnapshotOfDate(date: string): Promise<Snapshot | undefined> {
    const [result] = await db.select().from(snapshots)
      .where(eq(snapshots.date, date))
      .orderBy(desc(snapshots.id))
      .limit(1);
    return result;
  }

  async insertSnapshotEntries(entries: InsertSnapshotEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await db.insert(snapshotEntries).values(entries);
  }

  async getEntriesBySnapshotId(snapshotId: number): Promise<SnapshotEntry[]> {
    return db.select().from(snapshotEntries)
      .where(eq(snapshotEntries.snapshotId, snapshotId))
      .orderBy(asc(snapshotEntries.rank));
  }

  async getEntriesWithLabels(snapshotId: number): Promise<Array<SnapshotEntry & { label: string | null; category: string | null }>> {
    const entries = await this.getEntriesBySnapshotId(snapshotId);
    const labels = await this.getAllLabels();
    const labelMap = new Map(labels.map(l => [l.address, l]));

    return entries.map(e => ({
      ...e,
      label: labelMap.get(e.address)?.label || null,
      category: labelMap.get(e.address)?.category || null,
    }));
  }

  async getAddressHistory(address: string): Promise<Array<SnapshotEntry & { date: string; timeSlot: string }>> {
    const results = await db
      .select({
        id: snapshotEntries.id,
        snapshotId: snapshotEntries.snapshotId,
        rank: snapshotEntries.rank,
        address: snapshotEntries.address,
        balance: snapshotEntries.balance,
        percentage: snapshotEntries.percentage,
        prevRank: snapshotEntries.prevRank,
        rankChange: snapshotEntries.rankChange,
        balanceChange: snapshotEntries.balanceChange,
        date: snapshots.date,
        timeSlot: snapshots.timeSlot,
      })
      .from(snapshotEntries)
      .innerJoin(snapshots, eq(snapshotEntries.snapshotId, snapshots.id))
      .where(eq(snapshotEntries.address, address))
      .orderBy(asc(snapshots.id));

    return results;
  }

  async getAllUniqueAddresses(): Promise<string[]> {
    const results = await db.selectDistinct({ address: snapshotEntries.address }).from(snapshotEntries);
    return results.map(r => r.address);
  }

  async getUniqueAddressCount(): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(distinct ${snapshotEntries.address})::int` }).from(snapshotEntries);
    return count;
  }

  async getSnapshotCount(): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(snapshots);
    return count;
  }

  async getAddressLabel(address: string): Promise<AddressLabel | undefined> {
    const [result] = await db.select().from(addressLabels).where(eq(addressLabels.address, address));
    return result;
  }

  async getAllLabels(): Promise<AddressLabel[]> {
    return db.select().from(addressLabels);
  }

  async upsertAddressLabel(data: InsertAddressLabel): Promise<void> {
    await db.insert(addressLabels).values(data)
      .onConflictDoUpdate({
        target: addressLabels.address,
        set: { label: data.label, category: data.category },
      });
  }

  async upsertDailySummary(data: InsertDailySummary): Promise<void> {
    await db.insert(dailySummary).values(data)
      .onConflictDoUpdate({
        target: dailySummary.date,
        set: {
          newEntries: data.newEntries,
          dropouts: data.dropouts,
          biggestGainerAddress: data.biggestGainerAddress,
          biggestGainerChange: data.biggestGainerChange,
          biggestLoserAddress: data.biggestLoserAddress,
          biggestLoserChange: data.biggestLoserChange,
        },
      });
  }

  async getRecentSummaries(limit: number): Promise<DailySummary[]> {
    return db.select().from(dailySummary).orderBy(desc(dailySummary.date)).limit(limit);
  }

  async getDailySummaryByDate(date: string): Promise<DailySummary | undefined> {
    const [result] = await db.select().from(dailySummary).where(eq(dailySummary.date, date));
    return result;
  }

  async getMovers(fromDate: string, toDate: string): Promise<{ gainers: any[]; losers: any[] }> {
    const latestSnapshot = await this.getLatestSnapshot();
    if (!latestSnapshot) return { gainers: [], losers: [] };

    const fromSnapshot = await this.getLastSnapshotOfDate(fromDate);
    const toSnapshot = await this.getLastSnapshotOfDate(toDate);
    if (!fromSnapshot || !toSnapshot) return { gainers: [], losers: [] };

    const fromEntries = await this.getEntriesBySnapshotId(fromSnapshot.id);
    const toEntries = await this.getEntriesBySnapshotId(toSnapshot.id);
    const labels = await this.getAllLabels();
    const labelMap = new Map(labels.map(l => [l.address, l]));

    const fromMap = new Map(fromEntries.map(e => [e.address, e]));
    const toMap = new Map(toEntries.map(e => [e.address, e]));

    const allAddresses = new Set([...Array.from(fromMap.keys()), ...Array.from(toMap.keys())]);
    const changes: any[] = [];

    allAddresses.forEach((addr) => {
      const from = fromMap.get(addr);
      const to = toMap.get(addr);
      if (from && to) {
        const label = labelMap.get(addr);
        changes.push({
          address: addr,
          label: label?.label || null,
          category: label?.category || null,
          balanceChange: to.balance - from.balance,
          currentRank: to.rank,
          rankChange: from.rank - to.rank,
        });
      }
    });

    changes.sort((a, b) => b.balanceChange - a.balanceChange);
    const gainers = changes.filter(c => c.balanceChange > 0).slice(0, 10);
    const losers = changes.filter(c => c.balanceChange < 0).sort((a, b) => a.balanceChange - b.balanceChange).slice(0, 10);

    return { gainers, losers };
  }

  async searchAddresses(query: string): Promise<any[]> {
    const allAddresses = await this.getAllUniqueAddresses();
    const q = query.toLowerCase();
    const matched = allAddresses.filter(a => a.toLowerCase().includes(q));

    const labels = await this.getAllLabels();
    const labelMap = new Map(labels.map(l => [l.address, l]));
    const labelMatches = labels.filter(l =>
      l.label?.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    ).map(l => l.address);

    const combined = new Set([...matched, ...labelMatches]);
    const results: any[] = [];

    combined.forEach((addr) => {
      const label = labelMap.get(addr);
      results.push({
        address: addr,
        label: label?.label || null,
        category: label?.category || null,
      });
    });

    return results.slice(0, 20);
  }

  async getHallOfFame(): Promise<any[]> {
    const latestSnapshot = await this.getLatestSnapshot();
    const latestEntries = latestSnapshot
      ? await this.getEntriesBySnapshotId(latestSnapshot.id)
      : [];
    const activeMap = new Map(latestEntries.map(e => [e.address, e]));

    const allAddresses = await this.getAllUniqueAddresses();
    const labels = await this.getAllLabels();
    const labelMap = new Map(labels.map(l => [l.address, l]));

    const results: any[] = [];
    for (const addr of allAddresses) {
      const history = await this.getAddressHistory(addr);
      if (history.length === 0) continue;

      const label = labelMap.get(addr);
      const ranks = history.map(h => h.rank);
      const dates = history.map(h => h.date);
      const lastEntry = history[history.length - 1];
      const activeEntry = activeMap.get(addr);

      results.push({
        address: addr,
        label: label?.label || null,
        category: label?.category || null,
        totalAppearances: history.length,
        firstSeen: dates[0],
        lastSeen: dates[dates.length - 1],
        bestRank: Math.min(...ranks),
        lastRank: lastEntry.rank,
        lastBalance: lastEntry.balance,
        currentRank: activeEntry?.rank || null,
        currentBalance: activeEntry?.balance || null,
        currentStatus: activeMap.has(addr) ? "active" : "inactive",
      });
    }

    return results;
  }

  async getCompareData(fromDate: string, toDate: string): Promise<any> {
    const fromSnapshot = await this.getLastSnapshotOfDate(fromDate);
    const toSnapshot = await this.getLastSnapshotOfDate(toDate);

    if (!fromSnapshot || !toSnapshot) return null;

    const fromEntries = await this.getEntriesWithLabels(fromSnapshot.id);
    const toEntries = await this.getEntriesWithLabels(toSnapshot.id);

    const fromMap = new Map(fromEntries.map(e => [e.address, e]));
    const toMap = new Map(toEntries.map(e => [e.address, e]));

    const allAddresses = new Set([...Array.from(fromMap.keys()), ...Array.from(toMap.keys())]);
    const combined: any[] = [];

    let totalBalanceChange = 0;
    let movedUp = 0;
    let movedDown = 0;
    let newEntriesCount = 0;
    let dropoutsCount = 0;

    allAddresses.forEach((addr) => {
      const from = fromMap.get(addr);
      const to = toMap.get(addr);

      let status: string;
      let rankChange: number | null = null;
      let balanceDiff: number | null = null;

      if (from && to) {
        rankChange = from.rank - to.rank;
        balanceDiff = to.balance - from.balance;
        totalBalanceChange += balanceDiff;
        if (rankChange > 0) { status = "up"; movedUp++; }
        else if (rankChange < 0) { status = "down"; movedDown++; }
        else { status = "same"; }
      } else if (!from && to) {
        status = "new";
        newEntriesCount++;
      } else {
        status = "dropped";
        dropoutsCount++;
      }

      combined.push({
        address: addr,
        label: (to || from)?.label || null,
        category: (to || from)?.category || null,
        fromRank: from?.rank || null,
        toRank: to?.rank || null,
        rankChange,
        fromBalance: from?.balance || null,
        toBalance: to?.balance || null,
        balanceDiff,
        status,
      });
    });

    combined.sort((a, b) => {
      if (a.status === "new" && b.status !== "new") return -1;
      if (b.status === "new" && a.status !== "new") return 1;
      if (a.status === "dropped" && b.status !== "dropped") return 1;
      if (b.status === "dropped" && a.status !== "dropped") return -1;
      return (a.toRank || 99) - (b.toRank || 99);
    });

    return {
      from: { date: fromSnapshot.date, timeSlot: fromSnapshot.timeSlot },
      to: { date: toSnapshot.date, timeSlot: toSnapshot.timeSlot },
      combined,
      stats: { totalBalanceChange, movedUp, movedDown, newEntries: newEntriesCount, dropouts: dropoutsCount },
    };
  }
}

export const storage = new DatabaseStorage();
