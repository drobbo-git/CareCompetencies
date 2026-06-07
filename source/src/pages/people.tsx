import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/data/store";
import { useAuth } from "@/data/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function PeoplePage() {
  const { currentLogin } = useAuth();
  const { persons, privileges, units } = useData();
  const [query, setQuery] = useState("");

  const unitName = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  // Build a map of personId → privilege labels for display
  const personPrivilegeLabels = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of privileges) {
      const labels = m.get(p.personId) ?? [];
      const unitLabel = p.unitId ? ` (${unitName.get(p.unitId) ?? p.unitId})` : "";
      labels.push(`${p.privilege}${unitLabel}`);
      m.set(p.personId, labels);
    }
    return m;
  }, [privileges, unitName]);

  if (currentLogin?.systemRole !== "Administrator") {
    return <p className="text-sm text-muted-foreground">Administrator access required.</p>;
  }

  const q = query.trim().toLowerCase();
  const matched = persons.filter(
    (n) => !q || n.name.toLowerCase().includes(q) || (unitName.get(n.unitId) ?? "").toLowerCase().includes(q)
  );

  return (
    <>
      <PageHeader
        title="People"
        description="All persons in the system, with their clinical roles and privileges."
      />

      <div className="mb-4 max-w-md">
        <Input
          type="search"
          placeholder="Search by name or unit…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {matched.map((n) => {
              const privLabels = personPrivilegeLabels.get(n.id) ?? [];
              return (
                <li key={n.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <Link to={`/people/${n.id}`} className="text-sm font-medium hover:underline truncate min-w-0">
                    {n.name}
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{unitName.get(n.unitId) ?? "—"}</span>
                    {privLabels.map((label) => (
                      <Badge key={label} variant="secondary" className="text-[10px]">{label}</Badge>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
