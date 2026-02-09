import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down";
  trendLabel?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor = "text-primary", trend, trendLabel }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xl font-bold truncate">{value}</p>
              {trend && trendLabel && (
                <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                  {trend === "up" ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {trendLabel}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-md bg-muted/50 ${iconColor} shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
