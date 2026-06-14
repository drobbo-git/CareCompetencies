import { useState, useCallback, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Play, Copy, Check, Clock, Terminal, AlertCircle } from "lucide-react";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
interface ApiResult {
  loading: boolean;
  durationMs?: number;
  status?: number;
  data?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function MethodBadge({ method }: { method: string }) {
  const colours: Record<string, string> = {
    GET:  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    PUT:  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    POST: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${colours[method] ?? "bg-muted text-muted-foreground"}`}>
      {method}
    </span>
  );
}

function UrlBar({ method, url }: { method: string; url: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/60 border font-mono text-sm mb-4 overflow-x-auto whitespace-nowrap">
      <MethodBadge method={method} />
      <span className="text-muted-foreground">{BASE}</span>
      <span>{url}</span>
    </div>
  );
}

function JsonPanel({ result }: { result: ApiResult }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [result.data]);

  if (result.loading) {
    return (
      <div className="h-48 flex items-center justify-center rounded-md bg-muted/40 border text-sm text-muted-foreground">
        Running…
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        {result.error}
      </div>
    );
  }

  if (result.data === undefined) {
    return (
      <div className="h-48 flex items-center justify-center rounded-md bg-muted/40 border text-sm text-muted-foreground">
        Response will appear here
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {result.durationMs}ms
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy} title="Copy JSON">
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="text-xs rounded-md bg-slate-950 text-slate-100 dark:bg-black p-4 overflow-auto max-h-80 leading-relaxed">
        {JSON.stringify(result.data, null, 2)}
      </pre>
    </div>
  );
}

function CurlSnippet({ curl }: { curl: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(curl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [curl]);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">curl</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy} title="Copy curl">
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="text-xs rounded-md bg-muted/60 border p-3 overflow-x-auto whitespace-pre-wrap break-all text-foreground/80 leading-relaxed">
        {curl}
      </pre>
    </div>
  );
}

function ScenarioLayout({
  method, urlTemplate, description, form, result, curl,
}: {
  method: string; urlTemplate: string; description: string;
  form: ReactNode; result: ApiResult; curl: string;
}) {
  return (
    <div className="space-y-4">
      <UrlBar method={method} url={urlTemplate} />
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Request</CardTitle>
          </CardHeader>
          <CardContent>{form}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Response</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonPanel result={result} />
          </CardContent>
        </Card>
      </div>
      <CurlSnippet curl={curl} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario 1: Person → Competencies
// ---------------------------------------------------------------------------
function PersonCompetenciesScenario() {
  const [netid, setNetid] = useState("sh27");
  const [includeInProgress, setIncludeInProgress] = useState(false);
  const [result, setResult] = useState<ApiResult>({ loading: false });

  const run = useCallback(async () => {
    if (!netid.trim()) return;
    setResult({ loading: true });
    const t0 = Date.now();
    try {
      const data = await api.integrationGetPersonCompetencies(netid.trim(), includeInProgress);
      setResult({ loading: false, data, durationMs: Date.now() - t0 });
    } catch (e) {
      setResult({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  }, [netid, includeInProgress]);

  const qs = includeInProgress ? "?include_in_progress=true" : "";
  const urlTemplate = `/integration/persons/{netid}/competencies${qs}`;
  const curl =
    `curl -X GET '${BASE}/integration/persons/${encodeURIComponent(netid.trim() || "{netid}")}` +
    `/competencies${qs}' \\\n  -H 'Authorization: Bearer <token>'`;

  return (
    <ScenarioLayout
      method="GET"
      urlTemplate={urlTemplate}
      description="Returns all competencies signed off for a person, identified by their Duke NetID (username). Optionally includes competencies that are assigned but not yet achieved."
      result={result}
      curl={curl}
      form={
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Duke NetID</Label>
            <Input
              className="mt-1 font-mono"
              value={netid}
              onChange={(e) => setNetid(e.target.value)}
              placeholder="e.g. sh27"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ip"
              checked={includeInProgress}
              onCheckedChange={(v) => setIncludeInProgress(v === true)}
            />
            <Label htmlFor="ip" className="text-sm cursor-pointer">
              Include in-progress (assigned but not yet signed off)
            </Label>
          </div>
          <Button onClick={run} disabled={result.loading} className="w-full">
            <Play className="h-3.5 w-3.5 mr-2" />
            Run
          </Button>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Scenario 2: Competency → People
// ---------------------------------------------------------------------------
type UnitFilter = "none" | "include" | "exclude";

function CompetencyPeopleScenario() {
  const { competencies, units } = useData();
  const [compQuery, setCompQuery] = useState("");
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<UnitFilter>("none");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ApiResult>({ loading: false });

  const sortedUnits = [...units].sort((a, b) => a.name.localeCompare(b.name));
  const sortedComps = [...competencies]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => !compQuery.trim() || c.name.toLowerCase().includes(compQuery.toLowerCase()));

  const toggleComp = (id: string) =>
    setSelectedCompIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleUnit = (id: string) =>
    setSelectedUnitIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const unitIds    = filterMode === "include" ? [...selectedUnitIds] : [];
  const excludeIds = filterMode === "exclude" ? [...selectedUnitIds] : [];

  const run = useCallback(async () => {
    if (selectedCompIds.size === 0) return;
    setResult({ loading: true });
    const t0 = Date.now();
    try {
      const ids = [...selectedCompIds];
      const responses = await Promise.all(
        ids.map((id) => api.integrationGetCompetencyPersons(id, unitIds, excludeIds)),
      );

      if (ids.length === 1) {
        setResult({ loading: false, data: responses[0], durationMs: Date.now() - t0 });
        return;
      }

      // Intersection: persons present in every response
      const personSets = responses.map(
        (r) => new Set(((r as any).persons as any[]).map((p: any) => p.person_id as string)),
      );
      const intersected = personSets.reduce((acc, s) => new Set([...acc].filter((id) => s.has(id))));

      // Merge person info + per-competency achievement list
      const personMap = new Map<string, any>();
      for (const r of responses) {
        for (const p of (r as any).persons as any[]) {
          if (!personMap.has(p.person_id)) personMap.set(p.person_id, { ...p, achieved_competencies: [] });
          personMap.get(p.person_id).achieved_competencies.push({
            competency_id: (r as any).competency_id,
            competency_name: (r as any).competency_name,
            achieved_at: p.achieved_at,
          });
        }
      }

      setResult({
        loading: false,
        durationMs: Date.now() - t0,
        data: {
          queried_competencies: responses.map((r: any) => ({ id: r.competency_id, name: r.competency_name })),
          mode: "intersection",
          count: intersected.size,
          persons: [...intersected].map((id) => personMap.get(id)),
        },
      });
    } catch (e) {
      setResult({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...selectedCompIds].join(","), unitIds.join(","), excludeIds.join(",")]);

  const qs = unitIds.length
    ? `?unit_ids=${unitIds.join(",")}`
    : excludeIds.length ? `?exclude_unit_ids=${excludeIds.join(",")}` : "";
  const firstId = [...selectedCompIds][0] ?? "{id}";
  const curl = selectedCompIds.size <= 1
    ? `curl -X GET '${BASE}/integration/competencies/${encodeURIComponent(firstId)}/persons${qs}' \\\n  -H 'Authorization: Bearer <token>'`
    : [...selectedCompIds].map((id, i) => {
        const name = competencies.find((c) => c.id === id)?.name ?? id;
        return `# ${i + 1}. ${name}\ncurl -X GET '${BASE}/integration/competencies/${encodeURIComponent(id)}/persons${qs}' \\\n  -H 'Authorization: Bearer <token>'`;
      }).join("\n\n") + "\n\n# Results intersected — persons who achieved all of the above";

  return (
    <ScenarioLayout
      method="GET"
      urlTemplate={`/integration/competencies/{id}/persons${qs}`}
      description="Returns everyone who has achieved one or more competencies. Select multiple competencies to get the intersection — persons who have signed off all of them. Optionally filter by home unit."
      result={result}
      curl={curl}
      form={
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Competencies</Label>
              {selectedCompIds.size > 0 && (
                <Badge variant="secondary">{selectedCompIds.size} selected</Badge>
              )}
            </div>
            <Input
              className="mb-1 h-7 text-xs"
              placeholder="Filter list…"
              value={compQuery}
              onChange={(e) => setCompQuery(e.target.value)}
            />
            <div className="border rounded-md p-2 max-h-44 overflow-y-auto space-y-1">
              {sortedComps.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`c-${c.id}`}
                    checked={selectedCompIds.has(c.id)}
                    onCheckedChange={() => toggleComp(c.id)}
                  />
                  <Label htmlFor={`c-${c.id}`} className="text-xs cursor-pointer font-normal leading-snug">{c.name}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Unit Filter</Label>
            <Select value={filterMode} onValueChange={(v) => { setFilterMode(v as UnitFilter); setSelectedUnitIds(new Set()); }}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No filter — all units</SelectItem>
                <SelectItem value="include">Include only selected units</SelectItem>
                <SelectItem value="exclude">Exclude selected units</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterMode !== "none" && (
            <div>
              <Label className="text-xs mb-1 block">
                {filterMode === "include" ? "Include" : "Exclude"} these units
                {selectedUnitIds.size > 0 && <Badge variant="secondary" className="ml-2">{selectedUnitIds.size}</Badge>}
              </Label>
              <div className="border rounded-md p-2 max-h-36 overflow-y-auto space-y-1">
                {sortedUnits.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Checkbox id={`u-${u.id}`} checked={selectedUnitIds.has(u.id)} onCheckedChange={() => toggleUnit(u.id)} />
                    <Label htmlFor={`u-${u.id}`} className="text-xs cursor-pointer font-normal">{u.name}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={run} disabled={result.loading || selectedCompIds.size === 0} className="w-full">
            <Play className="h-3.5 w-3.5 mr-2" />
            Run{selectedCompIds.size > 1 ? ` (intersection of ${selectedCompIds.size})` : ""}
          </Button>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Scenario 3: Upsert Person (HR sync)
// ---------------------------------------------------------------------------
const STAGE_OPTIONS = ["Core", "Orientation", "Education", "FullyOriented", "Nonclinical"];
const STAGE_NONE = "__none__";

function UpsertPersonScenario() {
  const { units, personRoles } = useData();
  const [netid, setNetid] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [jobCode, setJobCode] = useState("");
  const [stageOverride, setStageOverride] = useState(STAGE_NONE);
  const [result, setResult] = useState<ApiResult>({ loading: false });

  const sortedUnits = [...units].sort((a, b) => a.name.localeCompare(b.name));
  const sortedRoles = [...personRoles].sort((a, b) => a.name.localeCompare(b.name));

  const run = useCallback(async () => {
    if (!netid.trim() || !name.trim() || !unitId || !startDate) return;
    setResult({ loading: true });
    const t0 = Date.now();
    try {
      const body: Parameters<typeof api.integrationUpsertPerson>[1] = {
        name: name.trim(),
        unitId,
        startDate,
        ...(roleId ? { roleId } : {}),
        ...(jobCode.trim() ? { jobCode: jobCode.trim() } : {}),
        ...(stageOverride && stageOverride !== STAGE_NONE ? { stageOverride } : {}),
      };
      const data = await api.integrationUpsertPerson(netid.trim(), body);
      setResult({ loading: false, data, durationMs: Date.now() - t0 });
    } catch (e) {
      setResult({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  }, [netid, name, unitId, roleId, startDate, jobCode, stageOverride]);

  const bodyObj = {
    name: name.trim() || "Display Name",
    unitId: unitId || "{unitId}",
    ...(roleId ? { roleId } : {}),
    startDate: startDate || "YYYY-MM-DD",
    ...(jobCode.trim() ? { jobCode: jobCode.trim() } : {}),
    ...(stageOverride && stageOverride !== STAGE_NONE ? { stageOverride } : {}),
  };

  const curl =
    `curl -X PUT '${BASE}/integration/persons/${encodeURIComponent(netid.trim() || "{netid}")}' \\\n` +
    `  -H 'Authorization: Bearer <token>' \\\n` +
    `  -H 'Content-Type: application/json' \\\n` +
    `  -d '${JSON.stringify(bodyObj)}'`;

  const canRun = netid.trim() && name.trim() && unitId && startDate;

  return (
    <ScenarioLayout
      method="PUT"
      urlTemplate="/integration/persons/{netid}"
      description="Creates or updates a person record keyed on NetID. Designed for nightly HR sync from PeopleSoft/LDAP. Returns the saved record and whether it was created or updated."
      result={result}
      curl={curl}
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Duke NetID *</Label>
              <Input className="mt-1 font-mono" value={netid} onChange={(e) => setNetid(e.target.value)} placeholder="sh27" />
            </div>
            <div>
              <Label className="text-xs">Display Name *</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Harris" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Home Unit *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {sortedUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Clinical Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— none —</SelectItem>
                  {sortedRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start Date *</Label>
              <Input className="mt-1" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Job Code</Label>
              <Input className="mt-1 font-mono" value={jobCode} onChange={(e) => setJobCode(e.target.value)} placeholder="RN003" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Stage Override</Label>
            <Select value={stageOverride} onValueChange={setStageOverride}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STAGE_NONE}>— compute from start date —</SelectItem>
                {STAGE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={run} disabled={result.loading || !canRun} className="w-full">
            <Play className="h-3.5 w-3.5 mr-2" />
            Run
          </Button>
          {!canRun && (
            <p className="text-xs text-muted-foreground text-center">NetID, name, unit, and start date are required</p>
          )}
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ApiExplorerPage() {
  const { currentLogin } = useAuth();

  if (currentLogin?.systemRole !== "Administrator") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Terminal className="h-6 w-6" />
          API Explorer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive integration API — designed for HR sync and external system queries.
          Calls hit the live API with your current session token.
        </p>
      </div>

      <Tabs defaultValue="person-competencies">
        <TabsList className="mb-4">
          <TabsTrigger value="person-competencies">Person → Competencies</TabsTrigger>
          <TabsTrigger value="competency-people">Competencies → People</TabsTrigger>
          <TabsTrigger value="upsert-person">Upsert Person</TabsTrigger>
        </TabsList>

        <TabsContent value="person-competencies" className="mt-0">
          <PersonCompetenciesScenario />
        </TabsContent>

        <TabsContent value="competency-people" className="mt-0">
          <CompetencyPeopleScenario />
        </TabsContent>

        <TabsContent value="upsert-person" className="mt-0">
          <UpsertPersonScenario />
        </TabsContent>
      </Tabs>
    </div>
  );
}
