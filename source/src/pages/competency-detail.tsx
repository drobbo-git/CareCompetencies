import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/common/StageBadge";
import { STAGES, type Stage } from "@/data/types";
import {
  ArrowLeft, BookOpen, ExternalLink, FileText,
  FlaskConical, ShieldCheck, MailQuestion, ListChecks,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isURL(s: string): boolean {
  return /^https?:\/\//i.test(s.trim()) || /^:?\s*https?:\/\//i.test(s.trim());
}

function extractURL(s: string): string {
  const m = s.match(/https?:\/\/\S+/i);
  return m ? m[0] : s;
}

function ReferenceField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  const hasURL = isURL(value) || /https?:\/\//.test(value);
  const url = hasURL ? extractURL(value) : null;
  // Text before any URL (e.g. "Policy: DUHS Policy #1234 https://...")
  const prefix = url ? value.slice(0, value.indexOf("http")).trim().replace(/:$/, "").trim() : null;

  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        {url ? (
          <div>
            {prefix && <p className="text-sm mb-1">{prefix}</p>}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
            >
              {url} <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        ) : (
          <p className="text-sm">{value}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CompetencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentLogin } = useAuth();
  const { competencies, steps, assignments, units, personRoles } = useData();
  const navigate = useNavigate();

  const comp = competencies.find((c) => c.id === id);

  // Assignments at the user's home unit
  const homeUnit = useMemo(() => {
    if (!currentLogin?.unitIds?.length) return undefined;
    return units.find((u) => u.id === currentLogin.unitIds![0]);
  }, [currentLogin, units]);

  const homeUnitAssignments = useMemo(() => {
    if (!comp || !homeUnit) return [];
    return assignments
      .filter((a) => a.competencyId === comp.id && a.unitId === homeUnit.id)
      .sort((a, b) => STAGES.indexOf(a.stage as Stage) - STAGES.indexOf(b.stage as Stage));
  }, [comp, homeUnit, assignments]);

  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === id).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, id],
  );

  const hasReferences = !!(comp?.validationMethod || comp?.knowledgeSource || comp?.policySource || comp?.updateNote);

  if (!comp) {
    return (
      <div className="space-y-4">
        <Link to="/competencies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Search Competencies
        </Link>
        <p className="text-sm text-muted-foreground">Competency not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Back link ────────────────────────────────────────────────── */}
      <Link
        to="/competencies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Search Competencies
      </Link>

      {/* ── Title + description ──────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{comp.name}</h1>
        {comp.description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
            {comp.description}
          </p>
        )}
      </div>

      {/* ── Required at your unit ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {homeUnit ? `Required at ${homeUnit.name}` : "Unit Requirements"}
            </CardTitle>
            <button
              type="button"
              onClick={() => navigate("/requests", { state: { competencyId: comp.id } })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <MailQuestion className="h-3.5 w-3.5" />
              Request Change
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {!homeUnit ? (
            <p className="text-sm text-muted-foreground">Sign in with a unit-linked account to see unit-specific requirements.</p>
          ) : homeUnitAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This competency is not currently required at <span className="font-medium">{homeUnit.name}</span>.
            </p>
          ) : (
            <ul className="space-y-2">
              {homeUnitAssignments.map((a) => {
                const role = personRoles.find((r) => r.id === a.roleId);
                return (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <StageBadge stage={a.stage as Stage} size="sm" />
                    <span className="text-muted-foreground">·</span>
                    <span>{role?.name ?? a.roleId}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── References & Guidance ────────────────────────────────────── */}
      {hasReferences && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              References &amp; Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comp.validationMethod && (
              <ReferenceField icon={FlaskConical} label="Validation Method" value={comp.validationMethod} />
            )}
            {comp.knowledgeSource && (
              <ReferenceField icon={BookOpen} label="Knowledge Source" value={comp.knowledgeSource} />
            )}
            {comp.policySource && (
              <ReferenceField icon={FileText} label="Policy Source" value={comp.policySource} />
            )}
            {comp.updateNote && (
              <ReferenceField icon={ShieldCheck} label="Update Note" value={comp.updateNote} />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Steps ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Steps
            <span className="font-normal text-muted-foreground">({compSteps.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {compSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps defined for this competency.</p>
          ) : (
            <ol className="space-y-2">
              {compSteps.map((s, i) => (
                <li key={s.id} className="flex items-start gap-3 text-sm">
                  <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{s.name}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
