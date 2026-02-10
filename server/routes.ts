import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { triggerManualSnapshot, startScheduler, initializeIfEmpty } from "./services/scheduler";
import { backfillConcentrationMetrics, backfillEntryAnalytics } from "./services/backfill";
import { fetchEthElaSupply, fetchEthRecentTransfers } from "./services/eth-fetcher";
import { seedAddressLabels } from "./services/seed-labels";
import { log } from "./index";

/** Extract chain from query parameter, default to mainchain */
function getChain(req: any): string {
  return (req.query.chain as string) || "mainchain";
}

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

  // Manual label reseed endpoint
  app.post("/api/admin/reseed-labels", async (_req, res) => {
    try {
      await seedAddressLabels();
      res.json({ success: true, message: "Address labels reseeded successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const chain = getChain(req);
      const snapshot = await storage.getLatestSnapshot(chain);
      let entries: any[] = [];

      if (snapshot) {
        entries = await storage.getEntriesWithLabels(snapshot.id);
      }

      const totalSnapshots = await storage.getSnapshotCount(chain);
      const uniqueAddresses = await storage.getUniqueAddressCount(chain);

      const allSnapshots = await storage.getSnapshots(1, 1, chain);
      const oldestSnapshot = allSnapshots.total > 0
        ? (await storage.getSnapshots(allSnapshots.total, 1, chain)).snapshots[0]
        : null;

      const summaries = await storage.getRecentSummaries(5);

      // Fetch latest analytics metrics with 24h trends
      let analytics = null;
      try {
        const latestMetrics = await storage.getLatestConcentrationMetrics(chain);
        if (latestMetrics) {
          // Fetch last 30 metrics for 24h comparison (288 snapshots/day, need ~30 for safety)
          const history = await storage.getConcentrationHistory(30, chain);
          
          // Find metric from ~24h ago
          const h24 = history.find(h => {
            const diff = new Date(latestMetrics.date).getTime() - new Date(h.date).getTime();
            return diff >= 82800000; // ~23 hours (allows for some variance)
          });

          // Sum last 24h net flow (all metrics where date diff < 24h)
          const netFlow24h = history
            .filter(h => {
              const diff = new Date(latestMetrics.date).getTime() - new Date(h.date).getTime();
              return diff >= 0 && diff < 86400000;
            })
            .reduce((s, h) => s + (h.netFlow || 0), 0);

          analytics = {
            giniCoefficient: latestMetrics.giniCoefficient,
            hhi: latestMetrics.hhi,
            whaleActivityIndex: latestMetrics.whaleActivityIndex,
            netFlow: latestMetrics.netFlow,
            activeWallets: latestMetrics.activeWallets,
            top10Pct: latestMetrics.top10Pct,
            top20Pct: latestMetrics.top20Pct,
            // 24h trends
            gini24hChange: h24 ? (latestMetrics.giniCoefficient || 0) - (h24.giniCoefficient || 0) : null,
            wai24hChange: h24 ? (latestMetrics.whaleActivityIndex || 0) - (h24.whaleActivityIndex || 0) : null,
            netFlow24h: netFlow24h !== 0 ? netFlow24h : null,
            top10Pct24hChange: h24 ? (latestMetrics.top10Pct || 0) - (h24.top10Pct || 0) : null,
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
      const chain = getChain(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await storage.getSnapshots(page, limit, chain);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/snapshots/latest", async (req, res) => {
    try {
      const chain = getChain(req);
      const snapshot = await storage.getLatestSnapshot(chain);
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
      const chain = getChain(req);
      const from = req.query.from as string;
      const to = req.query.to as string;

      if (!from || !to) return res.status(400).json({ message: "from and to dates required" });

      const result = await storage.getCompareData(from, to, chain);
      if (!result) return res.status(404).json({ message: "No data for the specified dates" });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const chain = getChain(req);
      const history = await storage.getAddressHistory(address, chain);

      if (history.length === 0) {
        return res.status(404).json({ message: "Address not found in any snapshot" });
      }

      const label = await storage.getAddressLabel(address);
      const ranks = history.map((h) => h.rank);
      const latestSnapshot = await storage.getLatestSnapshot(chain);
      const latestEntries = latestSnapshot
        ? await storage.getEntriesBySnapshotId(latestSnapshot.id)
        : [];
      const currentEntry = latestEntries.find((e) => e.address === address);

      // Detect gaps (dormancy) — count actual same-chain snapshots in range
      const totalSnapshots = await storage.getSnapshotCount(chain);
      const allChainSnapshotIds = await storage.getAllSnapshotIds(chain);
      const firstSnapshotId = history[0].snapshotId;
      const lastSnapshotId = history[history.length - 1].snapshotId;
      const spanSnapshots = allChainSnapshotIds.filter(id => id >= firstSnapshotId && id <= lastSnapshotId).length;
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
      const chain = getChain(req);
      const period = (req.query.period as string) || "7d";
      let daysBack: number;
      switch (period) {
        case "24h": daysBack = 1; break;
        case "30d": daysBack = 30; break;
        default: daysBack = 7;
      }

      const toDate = new Date().toISOString().split("T")[0];
      const fromDate = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

      let result = await storage.getMovers(fromDate, toDate, chain);

      // If no results (e.g. all snapshots on same day), fallback to first vs latest snapshot
      if (result.gainers.length === 0 && result.losers.length === 0) {
        const allSnaps = await storage.getSnapshots(1, 1000, chain);
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

  app.get("/api/hall-of-fame", async (req, res) => {
    try {
      const chain = getChain(req);
      const entries = await storage.getHallOfFame(chain);
      const latestSnapshot = await storage.getLatestSnapshot(chain);
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
      const chain = getChain(req);
      const latestSnapshot = await storage.getLatestSnapshot(chain);
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
        const metricsHistory = (await storage.getConcentrationHistory(50, chain)).reverse();
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
        const allSnapshots = await storage.getSnapshots(1, 100, chain);
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
      const chain = getChain(req);
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

      const latestSnapshot = await storage.getLatestSnapshot(chain);
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
      const compareSnapshot = await storage.getSnapshotClosestTo(targetTime, chain);
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

  app.get("/api/entities", async (req, res) => {
    try {
      const chain = getChain(req);
      const latestSnapshot = await storage.getLatestSnapshot(chain);
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

      // Only include entities that have at least one address in the current chain's snapshot
      const entities = Array.from(entityMap.values())
        .filter(e => e.addresses.some(a => a.rank > 0))
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
  app.get("/api/analytics/overview", async (req, res) => {
    try {
      const chain = getChain(req);
      const latest = await storage.getLatestConcentrationMetrics(chain);
      const history = await storage.getConcentrationHistory(100, chain);
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
      const chain = getChain(req);
      const type = (req.query.type as string) === "balance" ? "balance" : "rank";
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const leaders = await storage.getStreakLeaders(type, limit, chain);
      res.json({ type, leaders });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /api/analytics/dormant
   * Wallets that left and re-entered top 100.
   */
  app.get("/api/analytics/dormant", async (req, res) => {
    try {
      const chain = getChain(req);
      const dormant = await storage.getDormantWallets(chain);
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
      const chain = getChain(req);
      const maxAppearances = Math.min(Math.max(parseInt(req.query.maxAppearances as string) || 3, 1), 10);
      const ghosts = await storage.getGhostWallets(maxAppearances, chain);

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
  app.get("/api/analytics/accumulation", async (req, res) => {
    try {
      const chain = getChain(req);
      const breakdown = await storage.getAccumulationBreakdown(chain);

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
      const chain = getChain(req);
      const from = req.query.from as string;
      const to = req.query.to as string;

      let data;
      if (from && to) {
        data = await storage.getConcentrationByDateRange(from, to, chain);
      } else {
        data = (await storage.getConcentrationHistory(200, chain)).reverse();
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
      const chain = getChain(req);
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const flows = await storage.getNetFlowHistory(limit, chain);
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
      const chain = getChain(req);
      const type = req.params.type;
      const format = (req.query.format as string) || "json";

      let data: any[];
      let filename: string;

      switch (type) {
        case "snapshots": {
          const result = await storage.getSnapshots(1, 1000, chain);
          data = result.snapshots;
          filename = `snapshots-${chain}`;
          break;
        }
        case "latest": {
          const snapshot = await storage.getLatestSnapshot(chain);
          if (!snapshot) return res.status(404).json({ message: "No snapshots" });
          data = await storage.getEntriesWithLabels(snapshot.id);
          filename = `snapshot-${chain}-${snapshot.date}`;
          break;
        }
        case "analytics": {
          data = (await storage.getConcentrationHistory(1000, chain)).reverse();
          filename = `analytics-${chain}`;
          break;
        }
        case "hall-of-fame": {
          data = await storage.getHallOfFame(chain);
          filename = `hall-of-fame-${chain}`;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Chain Intelligence Summary
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/cross-chain/summary
   * 🧠 Intelligent Cross-Chain Analytics (Arkham-style)
   * Provides actionable insights, entity behavior, flow intelligence, and risk signals
   */
  app.get("/api/cross-chain/summary", async (_req, res) => {
    try {
      const chains = ["mainchain", "esc", "ethereum"] as const;
      
      // Fetch latest snapshot + metrics + 7-day history from each chain
      const chainData = await Promise.all(
        chains.map(async (chain) => {
          const snapshot = await storage.getLatestSnapshot(chain);
          if (!snapshot) return { chain, snapshot: null, entries: [], metrics: null, history: [] };

          const entries = await storage.getEntriesWithLabels(snapshot.id);
          const metrics = await storage.getLatestConcentrationMetrics(chain);
          
          // Fetch 7-day metrics history for trend analysis
          const history = await storage.getConcentrationHistory(168, chain); // 7 days of 5-min snapshots

          return { chain, snapshot, entries, metrics, history };
        })
      );

      // ═══════════════════════════════════════════════════════════════════════════
      // 🧠 INTELLIGENT INSIGHTS ENGINE
      // ═══════════════════════════════════════════════════════════════════════════

      const insights: Array<{
        severity: "critical" | "warning" | "info" | "positive";
        category: string;
        title: string;
        description: string;
        metric?: string;
      }> = [];

      // ─── Entity Behavior Analysis ────────────────────────────────────────────
      
      // Track exchange behavior across all chains
      const exchangeMovements = chainData.flatMap(cd =>
        cd.entries
          .filter(e => e.category === "exchange" && e.balanceChange !== null && Math.abs(e.balanceChange) > 1000)
          .map(e => ({ chain: cd.chain, label: e.label, change: e.balanceChange!, balance: e.balance }))
      );

      const exchangeAccumulating = exchangeMovements.filter(e => e.change > 0).reduce((s, e) => s + e.change, 0);
      const exchangeDistributing = Math.abs(exchangeMovements.filter(e => e.change < 0).reduce((s, e) => s + e.change, 0));

      if (exchangeAccumulating > exchangeDistributing * 1.5 && exchangeAccumulating > 5000) {
        insights.push({
          severity: "warning",
          category: "Exchange Behavior",
          title: "Heavy Exchange Accumulation",
          description: `Exchanges are net accumulating ${(exchangeAccumulating - exchangeDistributing).toFixed(0)} ELA across all chains. May indicate reduced retail selling pressure or institutional buying.`,
          metric: `+${exchangeAccumulating.toFixed(0)} ELA`,
        });
      } else if (exchangeDistributing > exchangeAccumulating * 1.5 && exchangeDistributing > 5000) {
        insights.push({
          severity: "critical",
          category: "Exchange Behavior",
          title: "Heavy Exchange Distribution",
          description: `Exchanges are net distributing ${(exchangeDistributing - exchangeAccumulating).toFixed(0)} ELA. May signal incoming sell pressure or withdrawals to cold storage.`,
          metric: `-${exchangeDistributing.toFixed(0)} ELA`,
        });
      }

      // ─── Bridge Health Monitoring ──────────────────────────────────────────────
      
      const escBridgeEntry = chainData[0].entries.find(e => e.address === "XVbCTM7vqM1qHKsABSFH4xKN1qbp7ijpWf");
      const escBridgeBalance = escBridgeEntry?.balance || 0;
      const escBridgeChange = escBridgeEntry?.balanceChange || 0;
      
      // Note: ESC/ETH addresses normalized to lowercase
      const shadowBridgeEntry = chainData[1].entries.find(e => e.address === "0xe235cbc85e26824e4d855d4d0ac80f3a85a520e4");
      const shadowBridgeBalance = shadowBridgeEntry?.balance || 0;
      const shadowBridgeChange = shadowBridgeEntry?.balanceChange || 0;

      // Detect abnormal bridge flows
      if (Math.abs(escBridgeChange) > 10000) {
        insights.push({
          severity: escBridgeChange > 0 ? "info" : "warning",
          category: "Bridge Activity",
          title: escBridgeChange > 0 ? "Main→ESC Bridge Inflow" : "Main→ESC Bridge Outflow",
          description: `${Math.abs(escBridgeChange).toFixed(0)} ELA ${escBridgeChange > 0 ? "bridged TO" : "bridged FROM"} ESC. Current bridge balance: ${escBridgeBalance.toFixed(0)} ELA.`,
          metric: `${escBridgeChange > 0 ? "+" : ""}${escBridgeChange.toFixed(0)} ELA`,
        });
      }

      if (Math.abs(shadowBridgeChange) > 5000) {
        insights.push({
          severity: shadowBridgeChange > 0 ? "info" : "warning",
          category: "Bridge Activity",
          title: shadowBridgeChange > 0 ? "ESC→ETH Bridge Inflow" : "ESC→ETH Bridge Outflow",
          description: `${Math.abs(shadowBridgeChange).toFixed(0)} ELA ${shadowBridgeChange > 0 ? "bridged TO" : "bridged FROM"} Ethereum via ShadowTokens. Current: ${shadowBridgeBalance.toFixed(0)} ELA.`,
          metric: `${shadowBridgeChange > 0 ? "+" : ""}${shadowBridgeChange.toFixed(0)} ELA`,
        });
      }

      // ─── Concentration Risk Analysis ──────────────────────────────────────────
      
      for (const cd of chainData) {
        if (!cd.metrics) continue;
        
        const gini = cd.metrics.giniCoefficient;
        const wai = cd.metrics.whaleActivityIndex;
        
        // Critical concentration threshold
        if (gini && gini > 0.85) {
          insights.push({
            severity: "critical",
            category: "Concentration Risk",
            title: `Extreme Concentration on ${cd.chain === "mainchain" ? "Main Chain" : cd.chain.toUpperCase()}`,
            description: `Gini coefficient of ${gini.toFixed(3)} indicates top wallets control vast majority of supply. Centralization risk.`,
            metric: `Gini ${gini.toFixed(3)}`,
          });
        }

        // Whale activity spike
        if (wai && wai > 75) {
          insights.push({
            severity: "warning",
            category: "Whale Activity",
            title: `High Whale Activity on ${cd.chain === "mainchain" ? "Main Chain" : cd.chain.toUpperCase()}`,
            description: `WAI of ${wai.toFixed(1)} indicates significant top-10 movement. Monitor for potential volatility.`,
            metric: `WAI ${wai.toFixed(1)}`,
          });
        }
      }

      // ─── 7-Day Trend Analysis ────────────────────────────────────────────────
      
      for (const cd of chainData) {
        if (cd.history.length < 50) continue; // Need at least 50 snapshots for trend
        
        const recent = cd.history.slice(-20);
        const week = cd.history.slice(0, 20);
        
        const avgGiniRecent = recent.reduce((s, m) => s + (m.giniCoefficient || 0), 0) / recent.length;
        const avgGiniWeek = week.reduce((s, m) => s + (m.giniCoefficient || 0), 0) / week.length;
        const giniChange = ((avgGiniRecent - avgGiniWeek) / avgGiniWeek) * 100;

        if (Math.abs(giniChange) > 2) { // >2% change in Gini
          insights.push({
            severity: giniChange > 0 ? "warning" : "positive",
            category: "Trend Analysis",
            title: `${cd.chain.toUpperCase()}: ${giniChange > 0 ? "Increasing" : "Decreasing"} Concentration`,
            description: `Gini ${giniChange > 0 ? "up" : "down"} ${Math.abs(giniChange).toFixed(1)}% over 7 days. ${giniChange > 0 ? "Supply becoming more centralized." : "Supply distributing to more wallets."}`,
            metric: `${giniChange > 0 ? "+" : ""}${giniChange.toFixed(1)}%`,
          });
        }
      }

      // ─── Smart Entity Flow Tracking ───────────────────────────────────────────
      
      type EntityFlow = {
        entity: string;
        category: string;
        chains: { mainchain?: number; esc?: number; ethereum?: number };
        total: number;
        netChange: number;
      };

      const entityFlowsMap: Record<string, EntityFlow> = {};

      for (const cd of chainData) {
        for (const entry of cd.entries) {
          if (!entry.label || entry.balanceChange === null || Math.abs(entry.balanceChange) < 500) continue;
          
          const key = entry.label;
          if (!entityFlowsMap[key]) {
            entityFlowsMap[key] = {
              entity: entry.label,
              category: entry.category || "unknown",
              chains: {},
              total: 0,
              netChange: 0,
            };
          }
          
          const chainKey = cd.chain as "mainchain" | "esc" | "ethereum";
          entityFlowsMap[key].chains[chainKey] = (entityFlowsMap[key].chains[chainKey] || 0) + entry.balance;
          entityFlowsMap[key].total += entry.balance;
          entityFlowsMap[key].netChange += entry.balanceChange;
        }
      }

      const topEntityFlows = Object.values(entityFlowsMap)
        .sort((a, b) => Math.abs(b.netChange) - Math.abs(a.netChange))
        .slice(0, 10);

      // ─── Risk Signals ──────────────────────────────────────────────────────────
      
      // Detect if any single entity controls >5% across all chains
      const totalSupply = chainData.reduce((s, cd) => s + cd.entries.reduce((t, e) => t + e.balance, 0), 0);
      const dangerousEntities = Object.values(entityFlowsMap).filter(e => (e.total / totalSupply) > 0.05);

      if (dangerousEntities.length > 0) {
        dangerousEntities.forEach(ent => {
          insights.push({
            severity: "warning",
            category: "Risk Signal",
            title: `High Single-Entity Exposure: ${ent.entity}`,
            description: `${ent.entity} controls ${((ent.total / totalSupply) * 100).toFixed(1)}% of tracked supply across all chains. Concentration risk.`,
            metric: `${((ent.total / totalSupply) * 100).toFixed(1)}%`,
          });
        });
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // 📊 TRADITIONAL METRICS (Enhanced)
      // ═══════════════════════════════════════════════════════════════════════════

      const categoryBreakdown: Record<string, { mainchain: number; esc: number; ethereum: number; total: number; change24h: number }> = {};
      
      for (const cd of chainData) {
        for (const entry of cd.entries) {
          const cat = entry.category || "unknown";
          if (!categoryBreakdown[cat]) {
            categoryBreakdown[cat] = { mainchain: 0, esc: 0, ethereum: 0, total: 0, change24h: 0 };
          }
          categoryBreakdown[cat][cd.chain] += entry.balance;
          categoryBreakdown[cat].total += entry.balance;
          if (entry.balanceChange) {
            categoryBreakdown[cat].change24h += entry.balanceChange;
          }
        }
      }

      const mainBalance = chainData[0].entries.reduce((s, e) => s + e.balance, 0);
      const escBalance = chainData[1].entries.reduce((s, e) => s + e.balance, 0);
      const ethBalance = chainData[2].entries.reduce((s, e) => s + e.balance, 0);

      // Top movers with enhanced context
      const allMovers = chainData.flatMap(cd =>
        cd.entries
          .filter(e => e.balanceChange !== null && e.balanceChange !== 0)
          .map(e => ({
            chain: cd.chain,
            address: e.address,
            label: e.label,
            balanceChange: e.balanceChange!,
            category: e.category,
            balance: e.balance,
            percentOfChain: (e.balance / cd.entries.reduce((s, x) => s + x.balance, 0)) * 100,
          }))
      );

      allMovers.sort((a, b) => Math.abs(b.balanceChange) - Math.abs(a.balanceChange));
      const topAccumulators = allMovers.filter(m => m.balanceChange > 0).slice(0, 8);
      const topDistributors = allMovers.filter(m => m.balanceChange < 0).slice(0, 8);

      const chainHealth = chainData.map(cd => ({
        chain: cd.chain,
        gini: cd.metrics?.giniCoefficient ?? null,
        wai: cd.metrics?.whaleActivityIndex ?? null,
        activeWallets: cd.metrics?.activeWallets ?? null,
        netFlow24h: cd.metrics?.netFlow ?? null,
        totalBalance: cd.entries.reduce((s, e) => s + e.balance, 0),
        // 7-day trend indicators
        giniTrend7d: cd.history.length > 20 ? ((cd.history[cd.history.length - 1].giniCoefficient || 0) - (cd.history[0].giniCoefficient || 0)) : null,
        waiTrend7d: cd.history.length > 20 ? ((cd.history[cd.history.length - 1].whaleActivityIndex || 0) - (cd.history[0].whaleActivityIndex || 0)) : null,
      }));

      // Sort insights: critical → warning → positive → info
      const severityOrder = { critical: 0, warning: 1, positive: 2, info: 3 };
      insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      res.json({
        // 🧠 Intelligence Layer
        insights: insights.slice(0, 12), // Top 12 most important insights
        entityFlows: topEntityFlows,
        
        // 📊 Enhanced Metrics
        supplyFlow: {
          mainchainTopN: mainBalance,
          escBridgeOnMain: escBridgeBalance,
          escBridgeChange: escBridgeChange,
          escTopN: escBalance,
          shadowBridgeOnEsc: shadowBridgeBalance,
          shadowBridgeChange: shadowBridgeChange,
          ethTopN: ethBalance,
        },
        categoryBreakdown: Object.entries(categoryBreakdown)
          .map(([category, balances]) => ({ category, ...balances }))
          .sort((a, b) => b.total - a.total),
        topAccumulators,
        topDistributors,
        chainHealth,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ESC (Elastos Smart Chain) — Separate view, completely isolated
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/esc/dashboard", async (_req, res) => {
    try {
      const snapshot = await storage.getLatestSnapshotByChain("esc");
      if (!snapshot) return res.json({ snapshot: null, entries: [], stats: { totalSnapshots: 0 } });

      const entries = await storage.getEntriesWithLabels(snapshot.id);
      const totalBalance = entries.reduce((s, e) => s + e.balance, 0);

      res.json({ snapshot, entries, totalBalance });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ethereum — Separate view, supply + transfers
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/eth/overview", async (_req, res) => {
    try {
      let supply = { totalSupply: 0, contractAddress: "0xe6fd75ff38Adca4B97FBCD938c86b98772431867" };
      try { supply = await fetchEthElaSupply(); } catch { /* non-critical */ }

      let transfers: any[] = [];
      try { transfers = await fetchEthRecentTransfers(20); } catch { /* non-critical */ }

      res.json({
        totalSupply: supply.totalSupply,
        contractAddress: supply.contractAddress,
        transfers,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
