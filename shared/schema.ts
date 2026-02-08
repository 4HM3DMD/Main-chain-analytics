import { pgTable, text, integer, real, serial, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Core Tables ────────────────────────────────────────────────────────────

export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  timeSlot: text("time_slot").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  totalBalances: real("total_balances"),
  totalRichlist: integer("total_richlist"),
}, (table) => [
  unique("snapshots_date_time_slot").on(table.date, table.timeSlot),
]);

export const snapshotEntries = pgTable("snapshot_entries", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => snapshots.id),
  rank: integer("rank").notNull(),
  address: text("address").notNull(),
  balance: real("balance").notNull(),
  percentage: real("percentage"),
  prevRank: integer("prev_rank"),
  rankChange: integer("rank_change"),
  balanceChange: real("balance_change"),
  // Advanced analytics columns
  rankVolatility: real("rank_volatility"),          // Std dev of rank over last 30 snapshots
  balanceTrend: text("balance_trend"),              // accumulating | distributing | holding | erratic
  rankStreak: integer("rank_streak"),               // Consecutive same-direction rank moves (+up, -down)
  balanceStreak: integer("balance_streak"),          // Consecutive balance gains (+) or losses (-)
}, (table) => [
  index("snapshot_entries_snapshot_id_idx").on(table.snapshotId),
  index("snapshot_entries_address_idx").on(table.address),
  index("snapshot_entries_address_snapshot_idx").on(table.address, table.snapshotId),
]);

export const addressLabels = pgTable("address_labels", {
  address: text("address").primaryKey(),
  label: text("label").notNull(),
  category: text("category"),
  notes: text("notes"),                               // Optional intel/context about this address
});

export const dailySummary = pgTable("daily_summary", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  newEntries: text("new_entries"),
  dropouts: text("dropouts"),
  biggestGainerAddress: text("biggest_gainer_address"),
  biggestGainerChange: real("biggest_gainer_change"),
  biggestLoserAddress: text("biggest_loser_address"),
  biggestLoserChange: real("biggest_loser_change"),
});

// ─── Analytics Tables ───────────────────────────────────────────────────────

/** Per-snapshot concentration & activity metrics (computed during snapshot ingestion) */
export const concentrationMetrics = pgTable("concentration_metrics", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => snapshots.id).unique(),
  date: text("date").notNull(),
  timeSlot: text("time_slot").notNull(),
  // Concentration metrics
  giniCoefficient: real("gini_coefficient"),         // 0 = perfect equality, 1 = max inequality
  hhi: real("hhi"),                                  // Herfindahl-Hirschman Index (0-10000)
  top10Pct: real("top10_pct"),                       // Top 10 share of top 100 total (%)
  top20Pct: real("top20_pct"),                       // Top 20 share of top 100 total (%)
  top50Pct: real("top50_pct"),                       // Top 50 share of top 100 total (%)
  // Flow metrics
  netFlow: real("net_flow"),                         // Net ELA change in top 100 vs previous snapshot
  totalInflow: real("total_inflow"),                 // Sum of positive balance changes
  totalOutflow: real("total_outflow"),               // Sum of negative balance changes (absolute)
  // Activity metrics
  whaleActivityIndex: real("whale_activity_index"),  // Composite activity score
  activeWallets: integer("active_wallets"),           // Wallets with balance change != 0
  avgRankChange: real("avg_rank_change"),             // Average absolute rank change
  avgBalanceChangePct: real("avg_balance_change_pct"),// Average balance change as %
  // Counts
  newEntryCount: integer("new_entry_count"),
  dropoutCount: integer("dropout_count"),
  totalBalance: real("total_balance"),
}, (table) => [
  index("concentration_metrics_date_idx").on(table.date),
  index("concentration_metrics_snapshot_id_idx").on(table.snapshotId),
]);

/** Weekly roll-up summary with richer analytics */
export const weeklySummary = pgTable("weekly_summary", {
  id: serial("id").primaryKey(),
  weekStart: text("week_start").notNull().unique(),  // ISO date of Monday
  weekEnd: text("week_end").notNull(),               // ISO date of Sunday
  // Concentration change
  giniStart: real("gini_start"),
  giniEnd: real("gini_end"),
  giniChange: real("gini_change"),
  // Balance metrics
  totalBalanceStart: real("total_balance_start"),
  totalBalanceEnd: real("total_balance_end"),
  netFlowTotal: real("net_flow_total"),              // Total net flow for the week
  avgWhaleActivityIndex: real("avg_whale_activity_index"),
  // Movement metrics
  totalNewEntries: integer("total_new_entries"),
  totalDropouts: integer("total_dropouts"),
  // Top movers of the week
  topAccumulatorAddress: text("top_accumulator_address"),
  topAccumulatorChange: real("top_accumulator_change"),
  topDistributorAddress: text("top_distributor_address"),
  topDistributorChange: real("top_distributor_change"),
  // Rank volatility
  avgRankVolatility: real("avg_rank_volatility"),
  snapshotCount: integer("snapshot_count"),
});

/** Pairwise wallet balance correlation scores (computed periodically) */
export const walletCorrelations = pgTable("wallet_correlations", {
  id: serial("id").primaryKey(),
  addressA: text("address_a").notNull(),
  addressB: text("address_b").notNull(),
  correlation: real("correlation").notNull(),        // Pearson correlation coefficient (-1 to 1)
  dataPoints: integer("data_points").notNull(),      // Number of overlapping snapshots
  computedAt: text("computed_at").notNull(),          // ISO timestamp
  period: text("period").notNull(),                  // e.g. "30d", "90d"
}, (table) => [
  index("wallet_correlations_address_a_idx").on(table.addressA),
  index("wallet_correlations_address_b_idx").on(table.addressB),
  unique("wallet_correlations_pair").on(table.addressA, table.addressB, table.period),
]);

// ─── Zod Schemas & Types ────────────────────────────────────────────────────

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({ id: true });
export const insertSnapshotEntrySchema = createInsertSchema(snapshotEntries).omit({ id: true });
export const insertAddressLabelSchema = createInsertSchema(addressLabels);
export const insertDailySummarySchema = createInsertSchema(dailySummary).omit({ id: true });
export const insertConcentrationMetricsSchema = createInsertSchema(concentrationMetrics).omit({ id: true });
export const insertWeeklySummarySchema = createInsertSchema(weeklySummary).omit({ id: true });
export const insertWalletCorrelationSchema = createInsertSchema(walletCorrelations).omit({ id: true });

export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type SnapshotEntry = typeof snapshotEntries.$inferSelect;
export type InsertSnapshotEntry = z.infer<typeof insertSnapshotEntrySchema>;
export type AddressLabel = typeof addressLabels.$inferSelect;
export type InsertAddressLabel = z.infer<typeof insertAddressLabelSchema>;
export type DailySummary = typeof dailySummary.$inferSelect;
export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;
export type ConcentrationMetrics = typeof concentrationMetrics.$inferSelect;
export type InsertConcentrationMetrics = z.infer<typeof insertConcentrationMetricsSchema>;
export type WeeklySummary = typeof weeklySummary.$inferSelect;
export type InsertWeeklySummary = z.infer<typeof insertWeeklySummarySchema>;
export type WalletCorrelation = typeof walletCorrelations.$inferSelect;
export type InsertWalletCorrelation = z.infer<typeof insertWalletCorrelationSchema>;