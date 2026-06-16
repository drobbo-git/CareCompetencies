import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { api } from "@/lib/api";
import type { ImportJobDetail, ImportJobSummary } from "@/data/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  UploadCloud, FileText, CheckCircle2, XCircle, Loader2, Download, History,
} from "lucide-react";

const SAMPLE_CSV =
  "NetID,Name,Unit,Role,StartDate\n" +
  "ab12,Jordan Lee,DN 4100 General Medicine,RN,2026-06-01\n" +
  "cd34,Morgan Reyes,2B/2C Clinic,RN,2026-06-08\n";

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bulk-user-load-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Completed") {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Completed</Badge>;
  }
  if (status === "Failed") {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Failed</Badge>;
  }
  return (
    <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" /> Processing
    </Badge>
  );
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Job history
// ---------------------------------------------------------------------------
function JobHistory({ jobs, onSelect, selectedId }: {
  jobs: ImportJobSummary[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground px-1">No import jobs yet.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>By</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Rows</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((j) => (
          <TableRow
            key={j.id}
            className={`cursor-pointer ${selectedId === j.id ? "bg-muted/50" : ""}`}
            onClick={() => onSelect(j.id)}
          >
            <TableCell className="font-medium flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {j.filename ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">{fmtTime(j.submittedAt)}</TableCell>
            <TableCell className="text-muted-foreground">{j.submittedByName ?? j.submittedBy}</TableCell>
            <TableCell><StatusBadge status={j.status} /></TableCell>
            <TableCell className="text-right tabular-nums">
              {j.status === "Completed" || j.status === "Failed"
                ? `${j.successCount ?? 0}/${j.totalRows ?? 0}`
                : `…/${j.totalRows ?? "?"}`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Job detail / results
// ---------------------------------------------------------------------------
function JobDetailCard({ job }: { job: ImportJobDetail }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {job.filename ?? job.id}
          </span>
          <StatusBadge status={job.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Rows</p>
            <p className="text-lg font-semibold">{job.totalRows ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Succeeded</p>
            <p className="text-lg font-semibold text-emerald-600">{job.successCount ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Errors</p>
            <p className="text-lg font-semibold text-red-600">{job.errorCount ?? "—"}</p>
          </div>
        </div>

        {job.status === "Processing" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing rows in the background — this page will update automatically.
          </div>
        )}

        {job.rowResults && job.rowResults.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Row</TableHead>
                <TableHead>NetID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.rowResults.map((r) => (
                <TableRow key={r.row}>
                  <TableCell className="text-muted-foreground">{r.row}</TableCell>
                  <TableCell className="font-mono text-xs">{r.netid || "—"}</TableCell>
                  <TableCell>{r.name || "—"}</TableCell>
                  <TableCell>
                    {r.action === "error" ? (
                      <span className="flex items-center gap-1.5 text-xs text-red-700">
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                        {r.error}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {r.action === "created" ? "Created" : "Updated"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BulkUserLoadPage() {
  const { currentLogin } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJobDetail | null>(null);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);

  const loadJobs = useCallback(async () => {
    try {
      const list = await api.getImportJobs();
      setJobs(list);
    } catch {
      // history is a convenience panel; ignore transient failures
    }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  // Poll the active job until it's done.
  useEffect(() => {
    if (!activeJob || activeJob.status === "Completed" || activeJob.status === "Failed") return;
    const t = setInterval(async () => {
      const updated = await api.getImportJob(activeJob.id);
      setActiveJob(updated);
      if (updated.status === "Completed" || updated.status === "Failed") {
        clearInterval(t);
        void loadJobs();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [activeJob, loadJobs]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSubmitError(null);
    file.text().then(setFileContent);
  }

  async function handleSubmit() {
    if (!fileContent || !fileName) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const job = await api.createPersonImportJob(fileName, fileContent);
      setActiveJob(await api.getImportJob(job.id));
      setFileName(null);
      setFileContent(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void loadJobs();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectJob(id: string) {
    setActiveJob(await api.getImportJob(id));
  }

  if (currentLogin?.systemRole !== "Administrator") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UploadCloud className="h-6 w-6" />
          Bulk User Load
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV to create or update persons in bulk — modeled on the file-based
          batch loads Duke uses for HR data today. Triggered manually for now; a
          production version would run on a schedule against a dropped file instead of
          a manual upload.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Upload a file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Required columns: <code className="font-mono">NetID, Name, Unit, StartDate</code>.
            Optional: <code className="font-mono">Role, JobCode</code>. Matching on NetID
            updates an existing person; otherwise a new one is created.
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadSampleCsv}
              className="gap-1.5 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Sample CSV
            </Button>
          </div>
          {fileName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> {fileName} selected
            </p>
          )}
          {submitError && (
            <p className="text-xs text-red-600">{submitError}</p>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!fileContent || submitting}
            className="gap-1.5"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Start Import
          </Button>
        </CardContent>
      </Card>

      {activeJob && <JobDetailCard job={activeJob} />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Job History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JobHistory jobs={jobs} onSelect={handleSelectJob} selectedId={activeJob?.id ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
