import { ArrowUp, ArrowDown, Minus, Sparkles } from "lucide-react";

interface RankBadgeProps {
  rank: number;
  rankChange: number | null;
  isNew?: boolean;
}

export function RankBadge({ rank, rankChange, isNew }: RankBadgeProps) {
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
        <Sparkles className="w-3 h-3" />
        NEW
      </span>
    );
  }

  if (rankChange === null || rankChange === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
      </span>
    );
  }

  if (rankChange > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
        <ArrowUp className="w-3 h-3" />
        {rankChange}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-400">
      <ArrowDown className="w-3 h-3" />
      {Math.abs(rankChange)}
    </span>
  );
}

export function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-400 font-bold">1</span>;
  if (rank === 2) return <span className="text-slate-300 font-bold">2</span>;
  if (rank === 3) return <span className="text-amber-600 font-bold">3</span>;
  return <span className="text-muted-foreground">{rank}</span>;
}
