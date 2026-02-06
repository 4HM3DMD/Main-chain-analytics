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
    default: return "text-muted-foreground bg-muted/50 border-muted";
  }
}
