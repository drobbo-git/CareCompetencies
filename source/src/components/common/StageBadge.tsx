import type { Stage, StageOrFully } from "@/data/types";
import { cn } from "@/lib/utils";

interface StageBadgeProps {
  stage: StageOrFully;
  size?: "sm" | "md";
  className?: string;
}

const STAGE_CLASSES: Record<StageOrFully, string> = {
  Core:          "bg-red-100 text-red-800 border-red-200",
  Orientation:   "bg-amber-100 text-amber-900 border-amber-200",
  Education:     "bg-blue-100 text-blue-800 border-blue-200",
  FullyOriented: "bg-green-100 text-green-800 border-green-200",
  Nonclinical:   "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const STAGE_LABEL: Record<StageOrFully, string> = {
  Core: "Core",
  Orientation: "Orientation",
  Education: "Education",
  FullyOriented: "Fully Oriented",
  Nonclinical: "Nonclinical",
};

export function StageBadge({ stage, size = "md", className }: StageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        STAGE_CLASSES[stage],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** Same color palette mapped to a flat hex, useful for inline SVG/D3 colors. */
export const STAGE_HEX: Record<Stage, string> = {
  Core: "#b91c1c",
  Orientation: "#b45309",
  Education: "#1d4ed8",
};