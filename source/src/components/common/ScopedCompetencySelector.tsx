import { useMemo, useState } from "react";
import { useData } from "@/data/store";
import type { Competency } from "@/data/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ScopedCompetencySelectorProps {
  unitId?: string;
  roleId?: string;
  value?: string;
  onChange: (competencyId: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Dropdown-style picker that filters competencies to a unit+role scope.
 * Used in the Observe and Sign Off pages so a preceptor can quickly pick
 * a competency assigned to the nurse's unit and role.
 */
export function ScopedCompetencySelector({
  unitId, roleId, value, onChange, placeholder = "Search competencies…", className,
}: ScopedCompetencySelectorProps) {
  const { competencies, assignments } = useData();
  const [query, setQuery] = useState("");

  const inScope = useMemo<Competency[]>(() => {
    const ids = new Set(
      assignments
        .filter((a) => (!unitId || a.unitId === unitId) && (!roleId || a.roleId === roleId))
        .map((a) => a.competencyId),
    );
    return competencies
      .filter((c) => ids.has(c.id))
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [competencies, assignments, unitId, roleId, query]);

  return (
    <div className={cn("space-y-2", className)}>
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="text-sm"
      />
      <div className="max-h-64 overflow-auto rounded-md border bg-card">
        {inScope.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">No matching competencies in scope.</div>
        )}
        {inScope.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              "w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted",
              value === c.id && "bg-accent/10 font-medium",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}