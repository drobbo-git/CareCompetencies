import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/data/store";
import { useAuth } from "@/data/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";

export default function PeoplePage() {
  const { currentLogin } = useAuth();
  const { nurses, preceptors, administrators, units } = useData();
  const [query, setQuery] = useState("");

  const unitName = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  if (currentLogin?.systemRole !== "Administrator") {
    return <p className="text-sm text-muted-foreground">Administrator access required.</p>;
  }

  const q = query.trim().toLowerCase();
  const matchN = nurses.filter((n) => !q || n.name.toLowerCase().includes(q) || (unitName.get(n.unitId) ?? "").toLowerCase().includes(q));
  const matchP = preceptors.filter((p) => !q || p.name.toLowerCase().includes(q) || (unitName.get(p.unitId) ?? "").toLowerCase().includes(q));
  const matchA = administrators.filter((a) => !q || a.name.toLowerCase().includes(q));

  return (
    <>
      <PageHeader
        title="People"
        description="All nurses, preceptors, and administrators in the system."
      />

      <div className="mb-4 max-w-md">
        <Input
          type="search"
          placeholder="Search by name or unit…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Tabs defaultValue="nurses">
        <TabsList>
          <TabsTrigger value="nurses">Nurses ({matchN.length})</TabsTrigger>
          <TabsTrigger value="preceptors">Preceptors ({matchP.length})</TabsTrigger>
          <TabsTrigger value="admins">Administrators ({matchA.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="nurses">
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {matchN.map((n) => (
                  <li key={n.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <Link to={`/nurses/${n.id}`} className="text-sm font-medium hover:underline">
                      {n.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{unitName.get(n.unitId) ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preceptors">
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {matchP.map((p) => (
                  <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{unitName.get(p.unitId) ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins">
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {matchA.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.title ?? "Administrator"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}