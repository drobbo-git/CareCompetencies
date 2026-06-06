import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
}

/** A small shimmer placeholder. Use inside cards that are awaiting data. */
export function Shimmer({ className }: ShimmerProps) {
  return <div className={cn("rounded-md shimmer", className)} aria-hidden />;
}

/** Convenience: a stack of shimmer lines. */
export function ShimmerLines({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className={`h-3 ${i === count - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}