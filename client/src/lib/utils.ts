import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatBalance(balance: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);
}

export function formatBalanceChange(change: number): string {
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${formatBalance(change)}`;
}

export function formatPercentage(pct: number): string {
  return `${pct.toFixed(4)}%`;
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function getCategoryColor(category: string | null): string {
  switch (category) {
    case "burn": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "sidechain": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "pool": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "dao": return "text-purple-400 bg-purple-400/10 border-purple-400/20";
    case "exchange": return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    case "ef": return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    case "whale": return "text-pink-400 bg-pink-400/10 border-pink-400/20";
    default: return "text-muted-foreground bg-muted/50 border-muted";
  }
}

// ─── Analytics Formatting Helpers ─────────────────────────────────────────

/** Format Gini coefficient (0-1) as readable string */
export function formatGini(gini: number | null | undefined): string {
  if (gini === null || gini === undefined) return "—";
  return gini.toFixed(4);
}

/** Get Gini interpretation label */
export function getGiniLabel(gini: number | null | undefined): string {
  if (gini === null || gini === undefined) return "Unknown";
  if (gini < 0.3) return "Low Inequality";
  if (gini < 0.5) return "Moderate";
  if (gini < 0.7) return "High";
  return "Very High Inequality";
}

/** Get Gini color class */
export function getGiniColor(gini: number | null | undefined): string {
  if (gini === null || gini === undefined) return "text-muted-foreground";
  if (gini < 0.3) return "text-emerald-400";
  if (gini < 0.5) return "text-blue-400";
  if (gini < 0.7) return "text-amber-400";
  return "text-red-400";
}

/** Format HHI (0-10000) as readable string */
export function formatHHI(hhi: number | null | undefined): string {
  if (hhi === null || hhi === undefined) return "—";
  return hhi.toFixed(0);
}

/** Get HHI interpretation label */
export function getHHILabel(hhi: number | null | undefined): string {
  if (hhi === null || hhi === undefined) return "Unknown";
  if (hhi < 1500) return "Competitive";
  if (hhi < 2500) return "Moderate";
  return "Highly Concentrated";
}

/** Format WAI (Whale Activity Index) */
export function formatWAI(wai: number | null | undefined): string {
  if (wai === null || wai === undefined) return "—";
  return wai.toFixed(2);
}

/** Get WAI level label */
export function getWAILevel(wai: number | null | undefined): string {
  if (wai === null || wai === undefined) return "Unknown";
  if (wai < 1) return "Very Low";
  if (wai < 3) return "Low";
  if (wai < 7) return "Moderate";
  if (wai < 15) return "High";
  return "Very High";
}

/** Get WAI color class */
export function getWAIColor(wai: number | null | undefined): string {
  if (wai === null || wai === undefined) return "text-muted-foreground";
  if (wai < 1) return "text-muted-foreground";
  if (wai < 3) return "text-blue-400";
  if (wai < 7) return "text-emerald-400";
  if (wai < 15) return "text-amber-400";
  return "text-red-400";
}

/** Format balance trend as readable label */
export function formatTrend(trend: string | null | undefined): string {
  switch (trend) {
    case "accumulating": return "Accumulating";
    case "distributing": return "Distributing";
    case "holding": return "Holding";
    case "erratic": return "Erratic";
    default: return "Unknown";
  }
}

/** Get trend color class */
export function getTrendColor(trend: string | null | undefined): string {
  switch (trend) {
    case "accumulating": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "distributing": return "text-red-400 bg-red-400/10 border-red-400/20";
    case "holding": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "erratic": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    default: return "text-muted-foreground bg-muted/50 border-muted";
  }
}

/** Format streak number with direction indicator */
export function formatStreak(streak: number | null | undefined): string {
  if (streak === null || streak === undefined || streak === 0) return "—";
  const direction = streak > 0 ? "▲" : "▼";
  return `${direction} ${Math.abs(streak)}`;
}

/** Get streak color class */
export function getStreakColor(streak: number | null | undefined): string {
  if (streak === null || streak === undefined || streak === 0) return "text-muted-foreground";
  return streak > 0 ? "text-emerald-400" : "text-red-400";
}

/** Format volatility score */
export function formatVolatility(vol: number | null | undefined): string {
  if (vol === null || vol === undefined) return "—";
  return vol.toFixed(2);
}

/** Get volatility level */
export function getVolatilityLevel(vol: number | null | undefined): string {
  if (vol === null || vol === undefined) return "Unknown";
  if (vol < 2) return "Very Stable";
  if (vol < 5) return "Stable";
  if (vol < 10) return "Moderate";
  if (vol < 20) return "Volatile";
  return "Very Volatile";
}

/** Format compact number (e.g. 1.2M, 350K). Near-zero values (< 1) shown as neutral. */
export function formatCompact(num: number): string {
  if (num === 0 || Math.abs(num) < 1) return "0";
  const prefix = num > 0 ? "+" : "";
  if (Math.abs(num) >= 1000000) return `${prefix}${(num / 1000000).toFixed(2)}M`;
  if (Math.abs(num) >= 1000) return `${prefix}${(num / 1000).toFixed(1)}K`;
  return formatBalanceChange(num);
}

// ─── Total Supply Context ─────────────────────────────────────────────────

/** Known approximate total ELA supply */
export const ELA_TOTAL_SUPPLY = 28_220_000;

/** Format a balance as percentage of total ELA supply */
export function formatSupplyPct(balance: number): string {
  const pct = (balance / ELA_TOTAL_SUPPLY) * 100;
  return `${pct.toFixed(2)}%`;
}

/** Get a plain-English wealth spread description from Gini */
export function getWealthSpreadDescription(gini: number | null | undefined): string {
  if (gini === null || gini === undefined) return "No data yet";
  if (gini < 0.4) return "Wealth is relatively well-distributed among the top 100";
  if (gini < 0.6) return "Moderate concentration — a few wallets hold significantly more";
  if (gini < 0.8) return "High concentration — top wallets dominate the balance";
  return "Very high concentration — a small number of wallets hold the vast majority";
}

/** Get wealth spread level as a simple word */
export function getWealthSpreadLevel(gini: number | null | undefined): string {
  if (gini === null || gini === undefined) return "Unknown";
  if (gini < 0.4) return "Spread Out";
  if (gini < 0.6) return "Moderate";
  if (gini < 0.8) return "Concentrated";
  return "Highly Concentrated";
}

/** Get a visual percentage for a gauge bar (0-100) from Gini */
export function getWealthSpreadPct(gini: number | null | undefined): number {
  if (gini === null || gini === undefined) return 0;
  return Math.round(gini * 100);
}

/** Format change with sign and color indicator */
export function formatSignedChange(value: number | null | undefined): { text: string; positive: boolean; neutral: boolean } {
  if (value === null || value === undefined) return { text: "—", positive: true, neutral: true };
  if (value === 0) return { text: "0.0000", positive: true, neutral: true };
  const prefix = value > 0 ? "+" : "";
  return {
    text: `${prefix}${value.toFixed(4)}`,
    positive: value > 0,
    neutral: false,
  };
}

/** Get color class for a numeric change value (green/red/neutral). Near-zero (<1 ELA) treated as neutral. */
export function getChangeColor(value: number | null | undefined): string {
  if (value === null || value === undefined || Math.abs(value) < 1) return "text-muted-foreground";
  return value > 0 ? "text-emerald-400" : "text-red-400";
}
