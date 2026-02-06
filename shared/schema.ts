import { pgTable, text, integer, real, serial, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
}, (table) => [
  index("snapshot_entries_snapshot_id_idx").on(table.snapshotId),
  index("snapshot_entries_address_idx").on(table.address),
]);

export const addressLabels = pgTable("address_labels", {
  address: text("address").primaryKey(),
  label: text("label").notNull(),
  category: text("category"),
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

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({ id: true });
export const insertSnapshotEntrySchema = createInsertSchema(snapshotEntries).omit({ id: true });
export const insertAddressLabelSchema = createInsertSchema(addressLabels);
export const insertDailySummarySchema = createInsertSchema(dailySummary).omit({ id: true });

export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type SnapshotEntry = typeof snapshotEntries.$inferSelect;
export type InsertSnapshotEntry = z.infer<typeof insertSnapshotEntrySchema>;
export type AddressLabel = typeof addressLabels.$inferSelect;
export type InsertAddressLabel = z.infer<typeof insertAddressLabelSchema>;
export type DailySummary = typeof dailySummary.$inferSelect;
export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;
