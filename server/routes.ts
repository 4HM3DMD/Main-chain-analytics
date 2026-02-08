import type { Express } from "express";
import { createServer, type Server } from "http";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { triggerManualSnapshot, startScheduler, initializeIfEmpty } from "./services/scheduler";
import { backfillConcentrationMetrics, backfillEntryAnalytics } from "./services/backfill";
import { seedAddressLabels } from "./services/seed-labels";
import { log } from "./index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await seedAddressLabels();
  startScheduler();
  initializeIfEmpty();

  app.get("/api/health", async (_req, res) => {
    try {
      const count = await storage.getSnapshotCount();
      const latest = await storage.getLatestSnapshot();
      res.json({
        status: "ok",
        uptime: process.uptime(),
        totalSnapshots: count,
        lastSnapshot: latest?.fetchedAt || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dashboard", async (_req, res) => {
    try {
      const snapshot = await storage.getLatestSnapshot();
      let entries: any[] = [];

      if (snapshot) {
        entries = await storage.getEntriesWithLabels(snapshot.id);
      }

      const totalSnapshots = await storage.getSnapshotCount();
      const uniqueAddresses = await storage.getUniqueAddressCount();

      const allSnapshots = await storage.getSnapshots(1, 1);
      const oldestSnapshot = allSnapshots.total > 0
        ? (await storage.getSnapshots(allSnapshots.total, 1)).snapshots[0]
        : null;

      const summaries = await storage.getRecentSummaries(5);

      // Fetch latest analytics metrics
      let analytics = null;
      try {
        const latestMetrics = await storage.getLatestConcentrationMetrics();
        if (latestMetrics) {
          analytics = {
            giniCoefficient: latestMetrics.giniCoefficient,
            hhi: latestMetrics.hhi,
            whaleActivityIndex: latestMetrics.whaleActivityIndex,
            netFlow: latestMetrics.netFlow,
            activeWallets: latestMetrics.activeWallets,
            top10Pct: latestMetrics.top10Pct,
            top20Pct: latestMetrics.top20Pct,
          };
        }
      } catch {
        // Analytics tables may not exist yet
      }

      res.json({
        snapshot,
        entries,
        stats: {
          totalSnapshots,
          daysTracked: oldestSnapshot
            ? Math.ceil((Date.now() - new Date(oldestSnapshot.date).getTime()) / 86400000) + 1
            : 0,
          uniqueAddresses,
          firstSnapshotDate: oldestSnapshot?.date || null,
        },
        analytics,
        summaries,
      });
    } catch (err: any) {
      log(`Dashboard error: ${err.message}`, "api");
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/snapshots", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await storage.getSnapshots(page, limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/snapshots/latest", async (_req, res) => {
    try {
      const snapshot = await storage.getLatestSnapshot();
      if (!snapshot) return res.status(404).json({ message: "No snapshots found" });

      const entries = await storage.getEntriesWithLabels(snapshot.id);
      res.json({ snapshot, entries });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/snapshots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid snapshot ID" });

      const snapshot = await storage.getSnapshotById(id);
      if (!snapshot) return res.status(404).json({ message: "Snapshot not found" });

      const entries = await storage.getEntriesWithLabels(snapshot.id);
      res.json({ snapshot, entries });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/compare", async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;

      if (!from || !to) return res.status(400).json({ message: "from and to dates required" });

      const result = await storage.getCompareData(from, to);
      if (!result) return res.status(404).json({ message: "No data for the specified dates" });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const history = await storage.getAddressHistory(address);

      if (history.length === 0) {
        return res.status(404).json({ message: "Address not found in any snapshot" });
      }

      const label = await storage.getAddressLabel(address);
      const ranks = history.map((h) => h.rank);
      const latestSnapshot = await storage.getLatestSnapshot();
      const latestEntries = latestSnapshot
        ? await storage.getEntriesBySnapshotId(latestSnapshot.id)
        : [];
      const currentEntry = latestEntries.find((e) => e.address === address);

      // Detect gaps (dormancy) — only count missed snapshots BETWEEN first and last appearance
      const totalSnapshots = await storage.getSnapshotCount();
      const firstSnapshotId = history[0].snapshotId;
      const lastSnapshotId = history[history.length - 1].snapshotId;
      const spanSnapshots = lastSnapshotId - firstSnapshotId + 1;
      const missedSnapshots = Math.max(0, spanSnapshots - history.length);
      const hasDormancy = missedSnapshots >= 144;

      res.json({
        address,
        label: label?.label || null,
        category: label?.category || null,
        notes: label?.notes || null,
        currentRank: currentEntry?.rank || null,
        firstSeen: history[0].date,
        lastSeen: history[history.length - 1].date,
        totalAppearances: history.length,
        bestRank: Math.min(...ranks),
        worstRank: Math.max(...ranks),
        // Advanced analytics
        analytics: {
          rankVolatility: currentEntry?.rankVolatility ?? null,
          balanceTrend: currentEntry?.balanceTrend ?? null,
          rankStreak: currentEntry?.rankStreak ?? null,
          balanceStreak: currentEntry?.balanceStreak ?? null,
          hasDormancy,
          missedSnapshots,
          totalSnapshots,
        },
        history: history.map((h) => ({
          date: h.date,
          timeSlot: h.timeSlot,
          rank: h.rank,
          balance: h.balance,
          balanceChange: h.balanceChange,
          rankStreak: h.rankStreak,
          balanceStreak: h.balanceStreak,
          balanceTrend: h.balanceTrend,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/movers", async (req, res) => {
    try {
      const period = (req.query.period as string) || "7d";
      let daysBack: number;
      switch (period) {
        case "24h": daysBack = 1; break;
        case "30d": daysBack = 30; break;
        default: daysBack = 7;
      }

      const toDate = new Date().toISOString().split("T")[0];
      const fromDate = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

      let result = await storage.getMovers(fromDate, toDate);

      // If no results (e.g. all snapshots on same day), fallback to first vs latest snapshot
      if (result.gainers.length === 0 && result.losers.length === 0) {
        const allSnaps = await storage.getSnapshots(1, 1000);
        if (allSnaps.snapshots.length >= 2) {
          const latest = allSnaps.snapshots[0];
          const oldest = allSnaps.snapshots[allSnaps.snapshots.length - 1];
          if (latest.id !== oldest.id) {
            result = await storage.getMoversById(oldest.id, latest.id);
          }
        }
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      if (q.length < 3) return res.json({ results: [] });
      const results = await storage.searchAddresses(q);
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/hall-of-fame", async (_req, res) => {
    try {
      const entries = await storage.getHallOfFame();
      const latestSnapshot = await storage.getLatestSnapshot();
      const latestEntries = latestSnapshot
        ? await storage.getEntriesBySnapshotId(latestSnapshot.id)
        : [];

      res.json({
        entries,
        stats: {
          totalUnique: entries.length,
          currentlyActive: latestEntries.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/flows", async (req, res) => {
    try {
      const latestSnapshot = await storage.getLatestSnapshot();
      if (!latestSnapshot) return res.status(404).json({ message: "No snapshots available" });

      const entries = await storage.getEntriesWithLabels(latestSnapshot.id);

      const totalBalance = entries.reduce((sum, e) => sum + e.balance, 0);
      const top10Balance = entries.slice(0, 10).reduce((sum, e) => sum + e.balance, 0);
      const top20Balance = entries.slice(0, 20).reduce((sum, e) => sum + e.balance, 0);
      const top100Balance = totalBalance;

      const concentration = {
        top10: { balance: top10Balance, percentage: totalBalance > 0 ? (top10Balance / totalBalance) * 100 : 0 },
        top20: { balance: top20Balance, percentage: totalBalance > 0 ? (top20Balance / totalBalance) * 100 : 0 },
        top100: { balance: top100Balance, percentage: 100 },
      };

      const categoryMap = new Map<string, { balance: number; count: number; addresses: string[] }>();
      for (const e of entries) {
        const cat = e.category || "unknown";
        if (!categoryMap.has(cat)) categoryMap.set(cat, { balance: 0, count: 0, addresses: [] });
        const c = categoryMap.get(cat)!;
        c.balance += e.balance;
        c.count += 1;
        c.addresses.push(e.address);
      }

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, data]) => ({
        category: cat,
        balance: data.balance,
        count: data.count,
        percentage: totalBalance > 0 ? (data.balance / totalBalance) * 100 : 0,
      })).sort((a, b) => b.balance - a.balance);

      // Use pre-computed concentration_metrics for flow trend (fixes N+1 query issue)
      let flowTrend: Array<{ date: string; timeSlot: string; totalBalance: number; top10Balance: number; top20Balance: number; gini?: number; wai?: number }> = [];
      try {
        const metricsHistory = (await storage.getConcentrationHistory(50)).reverse();
        if (metricsHistory.length > 0) {
          flowTrend = metricsHistory.map(m => ({
            date: m.date,
            timeSlot: m.timeSlot,
            totalBalance: m.totalBalance ?? 0,
            top10Balance: (m.top10Pct ?? 0) / 100 * (m.totalBalance ?? 0),
            top20Balance: (m.top20Pct ?? 0) / 100 * (m.totalBalance ?? 0),
            gini: m.giniCoefficient ?? undefined,
            wai: m.whaleActivityIndex ?? undefined,
          }));
        }
      } catch {
        // Fallback to legacy N+1 approach if concentration_metrics table doesn't exist yet
        const allSnapshots = await storage.getSnapshots(1, 100);
        const snapshotsToProcess = allSnapshots.snapshots.slice(0, 50).reverse();
        for (const snap of snapshotsToProcess) {
          const snapEntries = await storage.getEntriesBySnapshotId(snap.id);
          const total = snapEntries.reduce((s, e) => s + e.balance, 0);
          const t10 = snapEntries.slice(0, 10).reduce((s, e) => s + e.balance, 0);
          const t20 = snapEntries.slice(0, 20).reduce((s, e) => s + e.balance, 0);
          flowTrend.push({ date: snap.date, timeSlot: snap.timeSlot, totalBalance: total, top10Balance: t10, top20Balance: t20 });
        }
      }

      const significantMovements = entries
        .filter(e => e.balanceChange !== null && Math.abs(e.balanceChange) > 1000)
        .map(e => ({
          address: e.address,
          label: e.label,
          category: e.category,
          rank: e.rank,
          balance: e.balance,
          balanceChange: e.balanceChange,
          rankChange: e.rankChange,
        }))
        .sort((a, b) => Math.abs(b.balanceChange!) - Math.abs(a.balanceChange!));

      res.json({
        snapshotDate: latestSnapshot.date,
        snapshotTime: latestSnapshot.timeSlot,
        concentration,
        categoryBreakdown,
        flowTrend,
        significantMovements,
        totalBalance,
      });
    } catch (err: any) {
      log(`Flows error: ${err.message}`, "api");
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/entities — Aggregate labeled addresses by entity (label name).
   * Groups all addresses with the same label into one entity view.
   */
  /**
   * GET /api/dashboard/changes?period=5m|1h|24h|7d|30d
   * Returns balance changes for all current top-100 entries compared to a snapshot
   * from the requested period ago. Returns a map of address -> { balanceChange, balanceChangePct, compareDate }.
   */
  app.get("/api/dashboard/changes", async (req, res) => {
    try {
      const period = (req.query.period as string) || "5m";

      // Calculate target time
      let msAgo: number;
      switch (period) {
        case "1h": msAgo = 3600000; break;
        case "24h": msAgo = 86400000; break;
        case "7d": msAgo = 7 * 86400000; break;
        case "30d": msAgo = 30 * 86400000; break;
        default: msAgo = 0; // "5m" or "latest" = use pre-computed
      }

      const latestSnapshot = await storage.getLatestSnapshot();
      if (!latestSnapshot) return res.json({ period, changes: {}, compareSnapshot: null });

      // For "latest/5m", just return the pre-computed balanceChange from the current snapshot
      if (msAgo === 0) {
        const entries = await storage.getEntriesBySnapshotId(latestSnapshot.id);
        const changes: Record<string, { balanceChange: number; balanceChangePct: number }> = {};
        for (const e of entries) {
          const bc = e.balanceChange || 0;
          const prevBalance = e.balance - bc;
          changes[e.address] = {
            balanceChange: bc,
            balanceChangePct: prevBalance > 0 ? Math.round((bc / prevBalance) * 10000) / 100 : 0,
          };
        }
        return res.json({ period, changes, compareSnapshot: { date: latestSnapshot.date, timeSlot: latestSnapshot.timeSlot, label: "previous snapshot" } });
      }

      // Find the snapshot closest to the target time
      const targetTime = new Date(Date.now() - msAgo);
      const compareSnapshot = await storage.getSnapshotClosestTo(targetTime);
      if (!compareSnapshot || compareSnapshot.id === latestSnapshot.id) {
        return res.json({ period, changes: {}, compareSnapshot: null, message: "No comparison snapshot available for this period" });
      }

      const currentEntries = await storage.getEntriesBySnapshotId(latestSnapshot.id);
      const compareEntries = await storage.getEntriesBySnapshotId(compareSnapshot.id);
      const compareMap = new Map(compareEntries.map(e => [e.address, e]));

      const changes: Record<string, { balanceChange: number; balanceChangePct: number }> = {};
      for (const e of currentEntries) {
        const prev = compareMap.get(e.address);
        if (prev) {
          const bc = e.balance - prev.balance;
          changes[e.address] = {
            balanceChange: bc,
            balanceChangePct: prev.balance > 0 ? Math.round((bc / prev.balance) * 10000) / 100 : 0,
          };
        } else {
          // New entry since comparison point
          changes[e.address] = { balanceChange: e.balance, balanceChangePct: 100 };
        }
      }

      res.json({
        period,
        changes,
        compareSnapshot: {
          date: compareSnapshot.date,
          timeSlot: compareSnapshot.timeSlot,
          label: period === "24h" ? "yesterday" : period === "7d" ? "7 days ago" : period === "30d" ? "30 days ago" : `${period} ago`,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/cross-chain/overview
   * Cross-chain ELA supply breakdown and history.
   */
  app.get("/api/cross-chain/overview", async (_req, res) => {
    try {
      const latest = await storage.getLatestCrossChainSupply();
      const history = (await storage.getCrossChainHistory(200)).reverse();

      const totalSupply = 28220000; // Known ELA total supply

      res.json({
        current: latest ? {
          ...latest,
          totalSupply,
          mainchainOther: totalSupply - (latest.escBridgeBalance || 0) - (latest.mainchainTop100 || 0),
          escNotInTop100: (latest.escTotalSupply || 0) - (latest.escTop100 || 0),
        } : null,
        history,
        totalSupply,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/esc/dashboard
   * ESC chain dashboard — latest snapshot with entries.
   */
  app.get("/api/esc/dashboard", async (_req, res) => {
    try {
      const snapshot = await storage.getLatestSnapshotByChain("esc");
      if (!snapshot) return res.json({ snapshot: null, entries: [], stats: { totalSnapshots: 0 } });

      const entries = await storage.getEntriesWithLabels(snapshot.id);

      // Count ESC snapshots
      const allSnaps = await db.execute(sql`SELECT COUNT(*)::int AS count FROM snapshots WHERE chain = 'esc'`);
      const totalSnapshots = (allSnaps.rows[0] as any)?.count || 0;

      res.json({
        snapshot,
        entries,
        stats: { totalSnapshots },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/entities", async (_req, res) => {
    try {
      const latestSnapshot = await storage.getLatestSnapshot();
      if (!latestSnapshot) return res.json({ entities: [] });

      const entries = await storage.getEntriesWithLabels(latestSnapshot.id);
      const allLabels = await storage.getAllLabels();

      // Group by label (entity name)
      const entityMap = new Map<string, {
        label: string;
        category: string | null;
        notes: string | null;
        addresses: Array<{ address: string; rank: number; balance: number; balanceChange: number | null }>;
        totalBalance: number;
        totalChange: number;
        addressCount: number;
        bestRank: number;
      }>();

      for (const entry of entries) {
        if (!entry.label) continue;

        if (!entityMap.has(entry.label)) {
          entityMap.set(entry.label, {
            label: entry.label,
            category: entry.category,
            notes: entry.notes,
            addresses: [],
            totalBalance: 0,
            totalChange: 0,
            addressCount: 0,
            bestRank: 999,
          });
        }

        const entity = entityMap.get(entry.label)!;
        entity.addresses.push({
          address: entry.address,
          rank: entry.rank,
          balance: entry.balance,
          balanceChange: entry.balanceChange,
        });
        entity.totalBalance += entry.balance;
        entity.totalChange += entry.balanceChange || 0;
        entity.addressCount++;
        entity.bestRank = Math.min(entity.bestRank, entry.rank);
      }

      // Also include labeled addresses NOT currently in top 100
      for (const lbl of allLabels) {
        if (!entityMap.has(lbl.label)) {
          entityMap.set(lbl.label, {
            label: lbl.label,
            category: lbl.category,
            notes: lbl.notes,
            addresses: [{ address: lbl.address, rank: -1, balance: 0, balanceChange: null }],
            totalBalance: 0,
            totalChange: 0,
            addressCount: 1,
            bestRank: -1,
          });
        } else {
          const entity = entityMap.get(lbl.label)!;
          const alreadyTracked = entity.addresses.some(a => a.address === lbl.address);
          if (!alreadyTracked) {
            entity.addresses.push({ address: lbl.address, rank: -1, balance: 0, balanceChange: null });
            entity.addressCount++;
          }
        }
      }

      const entities = Array.from(entityMap.values())
        .sort((a, b) => b.totalBalance - a.totalBalance);

      const totalTop100 = entries.reduce((s, e) => s + e.balance, 0);

      res.json({ entities, totalTop100 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/address/:address/transactions?page=1&pageSize=20
   * Proxies the Elastos blockchain API to fetch recent transactions for an address.
   * No data stored — fetched on demand.
   */
  app.get("/api/address/:address/transactions", async (req, res) => {
    try {
      const { address } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://blockchain.elastos.io/api/v1/address/${address}?page=${page}&pageSize=${pageSize}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({ message: `Blockchain API error: ${response.statusText}` });
      }

      const data = await response.json();

      // Transform the raw API data into a cleaner format
      const transactions = (data.addresses || []).map((tx: any) => ({
        txid: tx.txid,
        time: tx.time ? new Date(parseInt(tx.time) * 1000).toISOString() : null,
        value: parseFloat(tx.value) || 0,
        type: tx.vtype === 1 ? "receive" : tx.vtype === 2 ? "send" : "unknown",
        blockhash: tx.blockhash,
      }));

      res.json({
        address: data.address,
        balance: parseFloat(data.balance) || 0,
        totalReceived: parseFloat(data.totalreceive) || 0,
        totalSent: parseFloat(data.totalsent) || 0,
        txCount: data.txcount || 0,
        transactions,
        page,
        pageSize,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        return res.status(504).json({ message: "Blockchain API timeout" });
      }
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * POST /api/labels — Create or update an address label from the UI.
   * Body: { address, label, category?, notes? }
   */
  app.post("/api/labels", async (req, res) => {
    try {
      const { address, label, category, notes } = req.body;
      if (!address || !label) {
        return res.status(400).json({ message: "address and label are required" });
      }
      await storage.upsertAddressLabel({ address, label, category: category || null, notes: notes || null });
      log(`Label updated: ${address} → ${label} (${category || "none"})`, "api");
      res.json({ success: true, address, label, category, notes });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/snapshots/trigger", async (_req, res) => {
    try {
      const snapshot = await triggerManualSnapshot();
      res.json(snapshot);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Analytics Endpoints ────────────────────────────────────────────────

  /**
   * GET /api/analytics/overview
   * Returns current Gini, HHI, WAI, net flow, concentration, and trend data.
   */
  app.get("/api/analytics/overview", async (_req, res) => {
    try {
      const latest = await storage.getLatestConcentrationMetrics();
      const history = await storage.getConcentrationHistory(100);
      const weeklySummaries = await storage.getRecentWeeklySummaries(12);

      // Compute trends (compare latest vs 24h ago, 7d ago, 30d ago)
      const now = history[0];
      const h24 = history.find(h => {
        if (!now) return false;
        const diff = new Date(now.date).getTime() - new Date(h.date).getTime();
        return diff >= 82800000; // ~23 hours
      });
      const h7d = history.find(h => {
        if (!now) return false;
        const diff = new Date(now.date).getTime() - new Date(h.date).getTime();
        return diff >= 6 * 86400000; // ~6 days
      });

      res.json({
        current: latest || null,
        trends: {
          gini24h: h24 ? (now!.giniCoefficient || 0) - (h24.giniCoefficient || 0) : null,
          gini7d: h7d ? (now!.giniCoefficient || 0) - (h7d.giniCoefficient || 0) : null,
          wai24h: h24 ? (now!.whaleActivityIndex || 0) - (h24.whaleActivityIndex || 0) : null,
          netFlow24h: h24 ? history.filter(h => {
            const diff = new Date(now!.date).getTime() - new Date(h.date).getTime();
            return diff < 86400000;
          }).reduce((s, h) => s + (h.netFlow || 0), 0) : null,
        },
        history: history.reverse(), // chronological order
        weeklySummaries,
      });
    } catch (err: any) {
      log(`Analytics overview error: ${err.message}`, "api");
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/streaks?type=rank|balance&limit=20
   * Top streak holders.
   */
  app.get("/api/analytics/streaks", async (req, res) => {
    try {
      const type = (req.query.type as string) === "balance" ? "balance" : "rank";
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const leaders = await storage.getStreakLeaders(type, limit);
      res.json({ type, leaders });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/dormant
   * Wallets that left and re-entered top 100.
   */
  app.get("/api/analytics/dormant", async (_req, res) => {
    try {
      const dormant = await storage.getDormantWallets();
      res.json({ wallets: dormant });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/ghost-wallets?maxAppearances=3
   * Wallets that briefly appeared in top 100 then vanished — "shadow entries."
   */
  app.get("/api/analytics/ghost-wallets", async (req, res) => {
    try {
      const maxAppearances = Math.min(Math.max(parseInt(req.query.maxAppearances as string) || 3, 1), 10);
      const ghosts = await storage.getGhostWallets(maxAppearances);

      // Group by stint length for summary stats
      const byStintLength: Record<number, number> = {};
      for (const g of ghosts) {
        const len = g.total_appearances;
        byStintLength[len] = (byStintLength[len] || 0) + 1;
      }

      res.json({
        maxAppearances,
        total: ghosts.length,
        byStintLength,
        wallets: ghosts,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/accumulation
   * All wallets with their trend classification.
   */
  app.get("/api/analytics/accumulation", async (_req, res) => {
    try {
      const breakdown = await storage.getAccumulationBreakdown();

      const summary = {
        accumulating: breakdown.filter(b => b.balanceTrend === "accumulating").length,
        distributing: breakdown.filter(b => b.balanceTrend === "distributing").length,
        holding: breakdown.filter(b => b.balanceTrend === "holding").length,
        erratic: breakdown.filter(b => b.balanceTrend === "erratic").length,
        unknown: breakdown.filter(b => !b.balanceTrend).length,
      };

      res.json({ summary, wallets: breakdown });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/concentration-history?from=DATE&to=DATE
   * Time series of Gini/HHI/concentration for charts.
   */
  app.get("/api/analytics/concentration-history", async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;

      let data;
      if (from && to) {
        data = await storage.getConcentrationByDateRange(from, to);
      } else {
        data = (await storage.getConcentrationHistory(200)).reverse();
      }

      res.json({ data });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/net-flows?limit=50
   * Net flow per snapshot for charting.
   */
  app.get("/api/analytics/net-flows", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const flows = await storage.getNetFlowHistory(limit);
      res.json({ flows: flows.reverse() }); // chronological
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/correlations?period=30d&limit=20
   * Top correlated wallet pairs.
   */
  app.get("/api/analytics/correlations", async (req, res) => {
    try {
      const period = (req.query.period as string) || "30d";
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const correlations = await storage.getTopCorrelations(limit, period);
      res.json({ period, correlations });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * POST /api/admin/backfill
   * Backfill analytics for all existing historical data.
   */
  app.post("/api/admin/backfill", async (_req, res) => {
    try {
      log("Starting backfill...", "api");
      const metricsResult = await backfillConcentrationMetrics();
      const entriesResult = await backfillEntryAnalytics();
      res.json({
        message: "Backfill complete",
        concentrationMetrics: metricsResult,
        entryAnalytics: entriesResult,
      });
    } catch (err: any) {
      log(`Backfill error: ${err.message}`, "api");
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/export/:type?format=csv|json
   * Export data as CSV or JSON.
   */
  app.get("/api/export/:type", async (req, res) => {
    try {
      const type = req.params.type;
      const format = (req.query.format as string) || "json";

      let data: any[];
      let filename: string;

      switch (type) {
        case "snapshots": {
          const result = await storage.getSnapshots(1, 1000);
          data = result.snapshots;
          filename = "snapshots";
          break;
        }
        case "latest": {
          const snapshot = await storage.getLatestSnapshot();
          if (!snapshot) return res.status(404).json({ message: "No snapshots" });
          data = await storage.getEntriesWithLabels(snapshot.id);
          filename = `snapshot-${snapshot.date}`;
          break;
        }
        case "analytics": {
          data = (await storage.getConcentrationHistory(1000)).reverse();
          filename = "analytics";
          break;
        }
        case "hall-of-fame": {
          data = await storage.getHallOfFame();
          filename = "hall-of-fame";
          break;
        }
        default:
          return res.status(400).json({ message: "Invalid export type. Use: snapshots, latest, analytics, hall-of-fame" });
      }

      if (format === "csv") {
        if (data.length === 0) return res.status(404).json({ message: "No data" });
        const headers = Object.keys(data[0]);
        const escapeCsvField = (val: any): string => {
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        const csv = [
          headers.join(","),
          ...data.map(row => headers.map(h => escapeCsvField(row[h])).join(","))
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
        return res.send(csv);
      }

      res.json({ data, count: data.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
