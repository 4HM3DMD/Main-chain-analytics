import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { triggerManualSnapshot, startScheduler, initializeIfEmpty } from "./services/scheduler";
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

      res.json({
        address,
        label: label?.label || null,
        category: label?.category || null,
        currentRank: currentEntry?.rank || null,
        firstSeen: history[0].date,
        lastSeen: history[history.length - 1].date,
        totalAppearances: history.length,
        bestRank: Math.min(...ranks),
        worstRank: Math.max(...ranks),
        history: history.map((h) => ({
          date: h.date,
          timeSlot: h.timeSlot,
          rank: h.rank,
          balance: h.balance,
          balanceChange: h.balanceChange,
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

      const result = await storage.getMovers(fromDate, toDate);
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

      const allSnapshots = await storage.getSnapshots(1, 100);
      const flowTrend: Array<{ date: string; timeSlot: string; totalBalance: number; top10Balance: number; top20Balance: number }> = [];

      const snapshotsToProcess = allSnapshots.snapshots.slice(0, 50).reverse();
      for (const snap of snapshotsToProcess) {
        const snapEntries = await storage.getEntriesBySnapshotId(snap.id);
        const total = snapEntries.reduce((s, e) => s + e.balance, 0);
        const t10 = snapEntries.slice(0, 10).reduce((s, e) => s + e.balance, 0);
        const t20 = snapEntries.slice(0, 20).reduce((s, e) => s + e.balance, 0);
        flowTrend.push({
          date: snap.date,
          timeSlot: snap.timeSlot,
          totalBalance: total,
          top10Balance: t10,
          top20Balance: t20,
        });
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

  app.post("/api/snapshots/trigger", async (_req, res) => {
    try {
      const snapshot = await triggerManualSnapshot();
      res.json(snapshot);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
