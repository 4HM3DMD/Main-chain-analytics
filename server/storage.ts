import {
  snapshots, snapshotEntries, addressLabels, dailySummary,
  concentrationMetrics, weeklySummary, walletCorrelations, crossChainSupply,
  type Snapshot, type InsertSnapshot,
  type SnapshotEntry, type InsertSnapshotEntry,
  type AddressLabel, type InsertAddressLabel,
  type DailySummary, type InsertDailySummary,
  type ConcentrationMetrics, type InsertConcentrationMetrics,
  type WeeklySummary, type InsertWeeklySummary,
  type WalletCorrelation, type InsertWalletCorrelation,
  type CrossChainSupply, type InsertCrossChainSupply,
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
  getEntriesWithLabels(snapshotId: number): Promise<Array<SnapshotEntry & { label: string | null; category: string | null; notes: string | null }>>;
  getAddressHistory(address: string): Promise<Array<SnapshotEntry & { date: string; timeSlot: string }>>;
  getRecentAddressEntries(address: string, limit: number): Promise<Array<{ rank: number; balance: number; rankStreak: number | null; balanceStreak: number | null }>>;
  getAllUniqueAddresses(): Promise<string[]>;
  getUniqueAddressCount(): Promise<number>;
  getSnapshotCount(): Promise<number>;
  getAllSnapshotIds(): Promise<number[]>;

  getAddressLabel(address: string): Promise<AddressLabel | undefined>;
  getAllLabels(): Promise<AddressLabel[]>;
  upsertAddressLabel(data: InsertAddressLabel): Promise<void>;

  upsertDailySummary(data: InsertDailySummary): Promise<void>;
  getRecentSummaries(limit: number): Promise<DailySummary[]>;
  getDailySummaryByDate(date: string): Promise<DailySummary | undefined>;

  // Analytics: Concentration Metrics
  insertConcentrationMetrics(data: InsertConcentrationMetrics): Promise<ConcentrationMetrics>;
  getConcentrationHistory(limit: number): Promise<ConcentrationMetrics[]>;
  getLatestConcentrationMetrics(): Promise<ConcentrationMetrics | undefined>;
  getConcentrationByDateRange(from: string, to: string): Promise<ConcentrationMetrics[]>;

  // Analytics: Weekly Summary
  upsertWeeklySummary(data: InsertWeeklySummary): Promise<void>;
  getRecentWeeklySummaries(limit: number): Promise<WeeklySummary[]>;

  // Analytics: Wallet Correlations
  upsertWalletCorrelations(data: InsertWalletCorrelation[]): Promise<void>;
  getTopCorrelations(limit: number, period: string): Promise<WalletCorrelation[]>;
  getCorrelationsForAddress(address: string, period: string): Promise<WalletCorrelation[]>;

  // Analytics: Advanced queries
  getStreakLeaders(type: "rank" | "balance", limit: number): Promise<any[]>;
  getAccumulationBreakdown(): Promise<any[]>;
  getDormantWallets(): Promise<any[]>;
  getGhostWallets(maxAppearances?: number): Promise<any[]>;
  getNetFlowHistory(limit: number): Promise<any[]>;

  getMovers(fromDate: string, toDate: string): Promise<{ gainers: any[]; losers: any[] }>;
  getMoversById(fromSnapshotId: number, toSnapshotId: number): Promise<{ gainers: any[]; losers: any[] }>;
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

  async getEntriesWithLabels(snapshotId: number): Promise<Array<SnapshotEntry & { label: string | null; category: string | null; notes: string | null }>> {
    const entries = await this.getEntriesBySnapshotId(snapshotId);
    const labels = await this.getAllLabels();
    const labelMap = new Map(labels.map(l => [l.address, l]));

    return entries.map(e => ({
      ...e,
      label: labelMap.get(e.address)?.label || null,
      category: labelMap.get(e.address)?.category || null,
      notes: labelMap.get(e.address)?.notes || null,
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
        rankVolatility: snapshotEntries.rankVolatility,
        balanceTrend: snapshotEntries.balanceTrend,
        rankStreak: snapshotEntries.rankStreak,
        balanceStreak: snapshotEntries.balanceStreak,
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
        set: { label: data.label, category: data.category, notes: data.notes },
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
        const balanceChange = to.balance - from.balance;
        const balanceChangePct = from.balance > 0 ? (balanceChange / from.balance) * 100 : 0;
        changes.push({
          address: addr,
          label: label?.label || null,
          category: label?.category || null,
          balanceChange,
          balanceChangePct: Math.round(balanceChangePct * 100) / 100,
          currentBalance: to.balance,
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

  async getMoversById(fromSnapshotId: number, toSnapshotId: number): Promise<{ gainers: any[]; losers: any[] }> {
    const fromEntries = await this.getEntriesBySnapshotId(fromSnapshotId);
    const toEntries = await this.getEntriesBySnapshotId(toSnapshotId);
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
        const balanceChange = to.balance - from.balance;
        const balanceChangePct = from.balance > 0 ? (balanceChange / from.balance) * 100 : 0;
        changes.push({
          address: addr,
          label: label?.label || null,
          category: label?.category || null,
          balanceChange,
          balanceChangePct: Math.round(balanceChangePct * 100) / 100,
          currentBalance: to.balance,
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
    // Optimized: single aggregated query instead of N+1 per-address lookups
    const latestSnapshot = await this.getLatestSnapshot();
    const latestSnapshotId = latestSnapshot?.id ?? -1;

    const results = await db.execute(sql`
      WITH address_stats AS (
        SELECT
          se.address,
          COUNT(*)::int AS total_appearances,
          MIN(s.date) AS first_seen,
          MAX(s.date) AS last_seen,
          MIN(se.rank) AS best_rank
        FROM snapshot_entries se
        INNER JOIN snapshots s ON se.snapshot_id = s.id
        GROUP BY se.address
      ),
      latest_entries AS (
        SELECT address, rank, balance
        FROM snapshot_entries
        WHERE snapshot_id = ${latestSnapshotId}
      ),
      last_entry AS (
        SELECT DISTINCT ON (se.address) se.address, se.rank AS last_rank, se.balance AS last_balance
        FROM snapshot_entries se
        INNER JOIN snapshots s ON se.snapshot_id = s.id
        ORDER BY se.address, s.id DESC
      )
      SELECT
        a.address,
        al.label,
        al.category,
        a.total_appearances,
        a.first_seen,
        a.last_seen,
        a.best_rank,
        le.last_rank,
        le.last_balance,
        COALESCE(la.rank, NULL) AS current_rank,
        COALESCE(la.balance, NULL) AS current_balance,
        CASE WHEN la.address IS NOT NULL THEN 'active' ELSE 'inactive' END AS current_status
      FROM address_stats a
      LEFT JOIN address_labels al ON a.address = al.address
      LEFT JOIN latest_entries la ON a.address = la.address
      LEFT JOIN last_entry le ON a.address = le.address
      ORDER BY a.total_appearances DESC
    `);

    // Map snake_case SQL columns to camelCase for frontend compatibility
    return (results.rows as any[]).map(row => ({
      address: row.address,
      label: row.label || null,
      category: row.category || null,
      totalAppearances: row.total_appearances,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      bestRank: row.best_rank,
      lastRank: row.last_rank,
      lastBalance: row.last_balance,
      currentRank: row.current_rank,
      currentBalance: row.current_balance,
      currentStatus: row.current_status,
    }));
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

  // ─── Analytics: Recent Address Entries ──────────────────────────────────

  async getSnapshotClosestTo(targetTime: Date): Promise<Snapshot | undefined> {
    // Find the snapshot with fetchedAt closest to targetTime
    const targetIso = targetTime.toISOString();
    const results = await db.execute(sql`
      SELECT * FROM snapshots
      ORDER BY ABS(EXTRACT(EPOCH FROM (fetched_at::timestamp - ${targetIso}::timestamp)))
      LIMIT 1
    `);
    const row = results.rows[0] as any;
    if (!row) return undefined;
    return {
      id: row.id,
      chain: row.chain || "mainchain",
      date: row.date,
      timeSlot: row.time_slot,
      fetchedAt: row.fetched_at,
      totalBalances: row.total_balances,
      totalRichlist: row.total_richlist,
    };
  }

  async getRecentAddressEntries(
    address: string,
    limit: number
  ): Promise<Array<{ rank: number; balance: number; rankStreak: number | null; balanceStreak: number | null }>> {
    const results = await db
      .select({
        rank: snapshotEntries.rank,
        balance: snapshotEntries.balance,
        rankStreak: snapshotEntries.rankStreak,
        balanceStreak: snapshotEntries.balanceStreak,
      })
      .from(snapshotEntries)
      .innerJoin(snapshots, eq(snapshotEntries.snapshotId, snapshots.id))
      .where(eq(snapshotEntries.address, address))
      .orderBy(desc(snapshots.id))
      .limit(limit);

    return results.reverse(); // Return in chronological order
  }

  async getAllSnapshotIds(): Promise<number[]> {
    const results = await db.select({ id: snapshots.id }).from(snapshots).orderBy(asc(snapshots.id));
    return results.map(r => r.id);
  }

  // ─── Analytics: Concentration Metrics ───────────────────────────────────

  async insertConcentrationMetrics(data: InsertConcentrationMetrics): Promise<ConcentrationMetrics> {
    const [result] = await db.insert(concentrationMetrics).values(data).returning();
    return result;
  }

  async getConcentrationHistory(limit: number): Promise<ConcentrationMetrics[]> {
    return db.select().from(concentrationMetrics)
      .orderBy(desc(concentrationMetrics.id))
      .limit(limit);
  }

  async getLatestConcentrationMetrics(): Promise<ConcentrationMetrics | undefined> {
    const [result] = await db.select().from(concentrationMetrics)
      .orderBy(desc(concentrationMetrics.id))
      .limit(1);
    return result;
  }

  async getConcentrationByDateRange(from: string, to: string): Promise<ConcentrationMetrics[]> {
    return db.select().from(concentrationMetrics)
      .where(and(gte(concentrationMetrics.date, from), lte(concentrationMetrics.date, to)))
      .orderBy(asc(concentrationMetrics.id));
  }

  // ─── Analytics: Weekly Summary ──────────────────────────────────────────

  async upsertWeeklySummary(data: InsertWeeklySummary): Promise<void> {
    await db.insert(weeklySummary).values(data)
      .onConflictDoUpdate({
        target: weeklySummary.weekStart,
        set: {
          weekEnd: data.weekEnd,
          giniStart: data.giniStart,
          giniEnd: data.giniEnd,
          giniChange: data.giniChange,
          totalBalanceStart: data.totalBalanceStart,
          totalBalanceEnd: data.totalBalanceEnd,
          netFlowTotal: data.netFlowTotal,
          avgWhaleActivityIndex: data.avgWhaleActivityIndex,
          totalNewEntries: data.totalNewEntries,
          totalDropouts: data.totalDropouts,
          topAccumulatorAddress: data.topAccumulatorAddress,
          topAccumulatorChange: data.topAccumulatorChange,
          topDistributorAddress: data.topDistributorAddress,
          topDistributorChange: data.topDistributorChange,
          avgRankVolatility: data.avgRankVolatility,
          snapshotCount: data.snapshotCount,
        },
      });
  }

  async getRecentWeeklySummaries(limit: number): Promise<WeeklySummary[]> {
    return db.select().from(weeklySummary)
      .orderBy(desc(weeklySummary.weekStart))
      .limit(limit);
  }

  // ─── Analytics: Wallet Correlations ─────────────────────────────────────

  async upsertWalletCorrelations(data: InsertWalletCorrelation[]): Promise<void> {
    if (data.length === 0) return;
    for (const item of data) {
      await db.insert(walletCorrelations).values(item)
        .onConflictDoUpdate({
          target: [walletCorrelations.addressA, walletCorrelations.addressB, walletCorrelations.period],
          set: {
            correlation: item.correlation,
            dataPoints: item.dataPoints,
            computedAt: item.computedAt,
          },
        });
    }
  }

  async getTopCorrelations(limit: number, period: string): Promise<WalletCorrelation[]> {
    return db.select().from(walletCorrelations)
      .where(eq(walletCorrelations.period, period))
      .orderBy(desc(walletCorrelations.correlation))
      .limit(limit);
  }

  async getCorrelationsForAddress(address: string, period: string): Promise<WalletCorrelation[]> {
    const results = await db.execute(sql`
      SELECT * FROM wallet_correlations
      WHERE (address_a = ${address} OR address_b = ${address})
        AND period = ${period}
      ORDER BY correlation DESC
      LIMIT 10
    `);
    return results.rows as WalletCorrelation[];
  }

  // ─── Analytics: Advanced Queries ────────────────────────────────────────

  async getStreakLeaders(type: "rank" | "balance", limit: number): Promise<any[]> {
    const latestSnapshot = await this.getLatestSnapshot();
    if (!latestSnapshot) return [];

    const column = type === "rank" ? snapshotEntries.rankStreak : snapshotEntries.balanceStreak;

    const results = await db
      .select({
        address: snapshotEntries.address,
        rank: snapshotEntries.rank,
        balance: snapshotEntries.balance,
        streak: column,
        rankVolatility: snapshotEntries.rankVolatility,
        balanceTrend: snapshotEntries.balanceTrend,
        label: addressLabels.label,
        category: addressLabels.category,
      })
      .from(snapshotEntries)
      .leftJoin(addressLabels, eq(snapshotEntries.address, addressLabels.address))
      .where(eq(snapshotEntries.snapshotId, latestSnapshot.id))
      .orderBy(desc(sql`ABS(${column})`))
      .limit(limit);

    return results;
  }

  async getAccumulationBreakdown(): Promise<any[]> {
    const latestSnapshot = await this.getLatestSnapshot();
    if (!latestSnapshot) return [];

    const results = await db
      .select({
        address: snapshotEntries.address,
        rank: snapshotEntries.rank,
        balance: snapshotEntries.balance,
        balanceTrend: snapshotEntries.balanceTrend,
        balanceStreak: snapshotEntries.balanceStreak,
        rankStreak: snapshotEntries.rankStreak,
        rankVolatility: snapshotEntries.rankVolatility,
        balanceChange: snapshotEntries.balanceChange,
        label: addressLabels.label,
        category: addressLabels.category,
      })
      .from(snapshotEntries)
      .leftJoin(addressLabels, eq(snapshotEntries.address, addressLabels.address))
      .where(eq(snapshotEntries.snapshotId, latestSnapshot.id))
      .orderBy(asc(snapshotEntries.rank));

    return results;
  }

  async getDormantWallets(): Promise<any[]> {
    // Find addresses with gaps between their first and last appearance in the top 100
    const results = await db.execute(sql`
      WITH address_snapshots AS (
        SELECT
          se.address,
          MIN(se.snapshot_id) AS first_snapshot_id,
          MAX(se.snapshot_id) AS last_snapshot_id,
          MIN(s.date) AS first_seen,
          MAX(s.date) AS last_seen,
          COUNT(*)::int AS appearances
        FROM snapshot_entries se
        INNER JOIN snapshots s ON se.snapshot_id = s.id
        GROUP BY se.address
      ),
      gap_analysis AS (
        SELECT
          a.address,
          a.first_seen,
          a.last_seen,
          a.appearances,
          (a.last_snapshot_id - a.first_snapshot_id + 1) AS span_snapshots,
          (a.last_snapshot_id - a.first_snapshot_id + 1) - a.appearances AS missed_snapshots
        FROM address_snapshots a
        WHERE (a.last_snapshot_id - a.first_snapshot_id + 1) - a.appearances >= 144
      )
      SELECT
        g.address,
        al.label,
        al.category,
        g.first_seen,
        g.last_seen,
        g.appearances,
        g.span_snapshots AS total_snapshots,
        g.missed_snapshots
      FROM gap_analysis g
      LEFT JOIN address_labels al ON g.address = al.address
      ORDER BY g.missed_snapshots DESC
      LIMIT 50
    `);

    return results.rows as any[];
  }

  async getGhostWallets(maxAppearances: number = 3): Promise<any[]> {
    // Ghost wallets: addresses that appeared in the top 100 for a very short stint
    // then disappeared. They must NOT be currently in the latest snapshot (they left).
    const latestSnapshot = await this.getLatestSnapshot();
    if (!latestSnapshot) return [];

    const results = await db.execute(sql`
      WITH address_stints AS (
        SELECT
          se.address,
          COUNT(*)::int AS total_appearances,
          MIN(s.date) AS first_seen,
          MAX(s.date) AS last_seen,
          MIN(se.snapshot_id) AS first_snapshot_id,
          MAX(se.snapshot_id) AS last_snapshot_id,
          AVG(se.balance)::real AS avg_balance,
          MAX(se.balance)::real AS peak_balance,
          MIN(se.rank)::int AS best_rank,
          MAX(se.rank)::int AS worst_rank
        FROM snapshot_entries se
        INNER JOIN snapshots s ON se.snapshot_id = s.id
        GROUP BY se.address
        HAVING COUNT(*) <= ${maxAppearances}
      ),
      currently_active AS (
        SELECT address FROM snapshot_entries
        WHERE snapshot_id = ${latestSnapshot.id}
      )
      SELECT
        a.address,
        al.label,
        al.category,
        a.total_appearances,
        a.first_seen,
        a.last_seen,
        a.first_snapshot_id,
        a.last_snapshot_id,
        a.avg_balance,
        a.peak_balance,
        a.best_rank,
        a.worst_rank,
        -- Ghost score: higher = more suspicious (fewer appearances + higher balance = more ghost-like)
        ROUND((a.peak_balance / 10000.0 * (${maxAppearances + 1} - a.total_appearances))::numeric, 2)::real AS ghost_score
      FROM address_stints a
      LEFT JOIN address_labels al ON a.address = al.address
      WHERE a.address NOT IN (SELECT address FROM currently_active)
        AND a.last_snapshot_id < ${latestSnapshot.id}
      ORDER BY ghost_score DESC
      LIMIT 50
    `);

    return results.rows as any[];
  }

  // ─── Multi-Chain Methods ─────────────────────────────────────────────

  async getSnapshotByDateSlotChain(date: string, timeSlot: string, chain: string): Promise<Snapshot | undefined> {
    const [result] = await db.select().from(snapshots)
      .where(and(eq(snapshots.date, date), eq(snapshots.timeSlot, timeSlot), eq(snapshots.chain, chain)));
    return result;
  }

  async getLatestSnapshotByChain(chain: string): Promise<Snapshot | undefined> {
    const [result] = await db.select().from(snapshots)
      .where(eq(snapshots.chain, chain))
      .orderBy(desc(snapshots.id))
      .limit(1);
    return result;
  }

  async insertCrossChainSupply(data: InsertCrossChainSupply): Promise<void> {
    await db.insert(crossChainSupply).values(data)
      .onConflictDoUpdate({
        target: [crossChainSupply.date, crossChainSupply.timeSlot],
        set: {
          fetchedAt: data.fetchedAt,
          mainchainTop100: data.mainchainTop100,
          escBridgeBalance: data.escBridgeBalance,
          escTotalSupply: data.escTotalSupply,
          escTop100: data.escTop100,
          ethBridgedSupply: data.ethBridgedSupply,
        },
      });
  }

  async getCrossChainHistory(limit: number): Promise<CrossChainSupply[]> {
    return db.select().from(crossChainSupply)
      .orderBy(desc(crossChainSupply.id))
      .limit(limit);
  }

  async getLatestCrossChainSupply(): Promise<CrossChainSupply | undefined> {
    const [result] = await db.select().from(crossChainSupply)
      .orderBy(desc(crossChainSupply.id))
      .limit(1);
    return result;
  }

  async getNetFlowHistory(limit: number): Promise<any[]> {
    return db
      .select({
        date: concentrationMetrics.date,
        timeSlot: concentrationMetrics.timeSlot,
        netFlow: concentrationMetrics.netFlow,
        totalInflow: concentrationMetrics.totalInflow,
        totalOutflow: concentrationMetrics.totalOutflow,
        totalBalance: concentrationMetrics.totalBalance,
        whaleActivityIndex: concentrationMetrics.whaleActivityIndex,
      })
      .from(concentrationMetrics)
      .orderBy(desc(concentrationMetrics.id))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
