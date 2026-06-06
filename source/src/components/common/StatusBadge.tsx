import { cn } from "@/lib/utils";

export type CompetencyStatus = "Achieved" | "InProgress" | "NotStarted" | "NotRequired";

interface StatusBadgeProps {
  status: CompetencyStatus;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_CLASSES: Record<CompetencyStatus, string> = {
  Achieved:    "bg-green-100 text-green-800 border-green-200",
  InProgress:  "bg-blue-100 text-blue-800 border-blue-200",
  NotStarted:  "bg-zinc-100 text-zinc-700 border-zinc-200",
  NotRequired: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

const STATUS_LABEL: Record<CompetencyStatus, string> = {
  Achieved: "Achieved",
  InProgress: "In progress",
  NotStarted: "Not started",
  NotRequired: "Not required",
};

export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        STATUS_CLASSES[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}