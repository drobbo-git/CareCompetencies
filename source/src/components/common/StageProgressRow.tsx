import type { Stage } from "@/data/types";
import { cn } from "@/lib/utils";
import { STAGE_HEX } from "./StageBadge";

interface StageProgressRowProps {
  stage: Stage;
  achieved: number;
  total: number;
  isCurrent?: boolean;
  className?: string;
}

/**
 * Single horizontal row showing one stage's progress: stage label, count,
 * and a thin progress bar tinted with the stage color.
 */
export function StageProgressRow({ stage, achieved, total, isCurrent, className }: StageProgressRowProps) {
  const pct = total === 0 ? 0 : Math.round((achieved / total) * 100);
  const color = STAGE_HEX[stage];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="w-28 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className={cn("text-sm", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {stage}
        </span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="w-20 text-right text-xs text-muted-foreground tabular-nums">
        {achieved} / {total}
      </div>
    </div>
  );
}