import { useMemo, useState } from "react";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AuditLogPage() {
  const { auditEvents } = useData();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? auditEvents.filter((e) =>
          [e.type, e.summary, e.targetLabel, e.actor, e.actorRole, e.detail]
            .filter(Boolean)
            .some((s) => (s as string).toLowerCase().includes(q)),
        )
      : auditEvents;
    return filtered.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [auditEvents, query]);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Catalog edits, sign-offs, and governance decisions. Newest first."
      />

      <div className="mb-4 max-w-md">
        <Input
          type="search"
          placeholder="Filter by type, target, actor…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No audit events {query ? "match the filter." : "yet."}
            </div>
          )}
          <ul className="divide-y">
            {rows.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{e.summary}</div>
                  {e.detail && (
                    <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    <span className="font-mono">{e.type}</span>
                    {" · "}
                    <span>{e.actor}</span>
                    {" · "}
                    <Badge variant="outline" className="ml-0.5 text-[9px] px-1.5 py-0">{e.actorRole}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.timestamp).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}