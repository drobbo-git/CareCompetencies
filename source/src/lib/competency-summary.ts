// =============================================================================
// Competency Summary (printable, regulator-facing)
// -----------------------------------------------------------------------------
// Opens a new browser window with a self-contained, print-formatted summary of
// a single nurse's competency status. Designed to be pulled up if a regulator
// (e.g., Joint Commission) drops in and asks for proof of competency.
//
// Sections rendered (in order):
//   1. Header block + identity grid
//   2. Stage status panel + prior-stage pass/fail pill
//   3. Per-stage summary stats (Core / Orientation / Education)
//   4. Required competency detail by category (the nurse's unit + role assignments)
//   5. "Other Competencies" — achievements OUTSIDE the required set, with
//      provenance like "Earned at DN 4100 · Core". Only shown if non-empty.
//
// We deliberately exclude the dashboard's "Up next" and "Recent activity"
// blocks. They are useful for day-to-day workflow but not part of the
// official competency-of-record evidence.
//
// The output is a fully self-contained HTML document.
// =============================================================================

import type {
  Person, Unit, PersonRole, Competency, CompetencyStep,
  CompetencyCategory, CompetencyGroup, CompetencyAssignment, StepObservation,
  CompetencyAchievement, Stage, StageOrFully,
} from "@/data/types";
import { STAGES } from "@/data/types";

export interface CompetencySummaryInput {
  person: Person;
  unit?: Unit;
  role?: PersonRole;
  primaryPreceptorName?: string;
  persons: Person[];
  competencies: Competency[];
  steps: CompetencyStep[];
  categories: CompetencyCategory[];
  groups: CompetencyGroup[];
  assignments: CompetencyAssignment[];
  observations: StepObservation[];
  achievements: CompetencyAchievement[];
  units: Unit[];
  currentStage: StageOrFully;
  daysSinceStart: number;
}

const STAGE_ORDER: Stage[] = ["Core", "Orientation", "Education"];

const STAGE_COLOR: Record<Stage, string> = {
  Core: "#b91c1c",
  Orientation: "#b45309",
  Education: "#1d4ed8",
};

function stageIndex(stage: StageOrFully): number {
  if (stage === "FullyOriented") return STAGE_ORDER.length;
  if (stage === "Nonclinical") return -1;
  return STAGE_ORDER.indexOf(stage);
}

function esc(s: string | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso?: string): string {
  if (!iso) return "\u2014";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "\u2014";
  }
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Produce a compact label for a unit, used in parenthetical signer notes
// when a sign-off comes from a preceptor on a unit other than the nurse's home unit.
// Strips trailing descriptor words like "Clinic", "General Medicine", etc., and
// shrinks "2B/2C Clinic" -> "2B-2C", "DRH - Cardiac Cath Services" -> "DRH Cath", etc.
function unitShortLabel(unit: Unit | undefined): string {
  if (!unit) return "";
  const name = unit.name;
  // 2B/2C Clinic -> 2B-2C
  if (/^2B\/2C/i.test(name)) return "2B-2C";
  // DN 4100 General Medicine -> DN 4100
  const dn = name.match(/^DN\s*\d+/i);
  if (dn) return dn[0].replace(/\s+/g, " ");
  // DRH - Cardiac Cath Services -> DRH Cath
  if (/^DRH/i.test(name)) {
    if (/cath/i.test(name)) return "DRH Cath";
    if (/rad/i.test(name)) return "DRH RadOnc";
    return name.replace(/\s*-\s*/, " ");
  }
  // Surgical Care Unit (ASC PACU) -> ASC PACU
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  return name;
}

interface DetailRow {
  competencyId: string;
  competencyName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  stage: Stage;
  achievement?: CompetencyAchievement;
  signerName?: string;
  signerUnitLabel?: string;
  hasUnsatisfactory: boolean;
  hasAnyObservation: boolean;
}

interface OtherRow {
  achievement: CompetencyAchievement;
  competencyName: string;
  categoryName: string;
  categoryColor: string;
  earnedAtUnitName?: string;
  earnedAtStage?: Stage;
  signerName?: string;
  signerUnitLabel?: string;
}

type OverallStatus = "Achieved" | "InProgress" | "NotStarted";

function overallStatusFor(row: DetailRow): OverallStatus {
  if (row.achievement) return "Achieved";
  if (row.hasAnyObservation) return "InProgress";
  return "NotStarted";
}

function statusLabel(s: OverallStatus): string {
  if (s === "Achieved") return "Achieved";
  if (s === "InProgress") return "In Progress";
  return "Not Started";
}

function statusColor(s: OverallStatus): string {
  if (s === "Achieved") return "#15803d";
  if (s === "InProgress") return "#1d4ed8";
  return "#52525b";
}

export function buildCompetencySummaryHtml(input: CompetencySummaryInput): string {
  const {
    person, unit, role, primaryPreceptorName, persons,
    competencies, steps, categories, groups, assignments,
    observations, achievements, units, currentStage, daysSinceStart,
  } = input;

  const personRoleId = person.roleId ?? "r-rn";
  const personHomeUnitId = person.unitId;
  const myAssignments = assignments.filter(
    (a) => a.unitId === personHomeUnitId && a.roleId === personRoleId
  );

  const obsForPerson = observations.filter((o) => o.personId === person.id);
  const obsByCompStepLatest = new Map<string, StepObservation>();
  for (const o of obsForPerson) {
    const k = `${o.competencyId}|${o.stepId}`;
    const cur = obsByCompStepLatest.get(k);
    if (!cur || cur.observedAt < o.observedAt) obsByCompStepLatest.set(k, o);
  }

  const requiredCompIds = new Set(myAssignments.map((a) => a.competencyId));

  function signerCrossUnitLabel(observerId: string | undefined): string | undefined {
    if (!observerId) return undefined;
    const signerUnitId = persons.find((nn) => nn.id === observerId)?.unitId;
    if (!signerUnitId) return undefined;
    if (signerUnitId === personHomeUnitId) return undefined;
    const u = units.find((uu) => uu.id === signerUnitId);
    return unitShortLabel(u);
  }

  const rows: DetailRow[] = myAssignments.map((a) => {
    const c = competencies.find((cc) => cc.id === a.competencyId);
    const cat = categories.find((cc) => cc.id === c?.categoryId);
    const ach = achievements.find((x) => x.personId === person.id && x.competencyId === a.competencyId);
    const signer = ach ? persons.find((nn) => nn.id === ach.observerId) : undefined;
    const compSteps = steps.filter((s) => s.competencyId === a.competencyId);
    let hasUnsat = false;
    let hasAny = false;
    for (const s of compSteps) {
      const o = obsByCompStepLatest.get(`${a.competencyId}|${s.id}`);
      if (o) {
        hasAny = true;
        if (o.rating === "Unsatisfactory") hasUnsat = true;
      }
    }
    if (!hasAny) {
      hasAny = obsForPerson.some((o) => o.competencyId === a.competencyId);
    }
    return {
      competencyId: a.competencyId,
      competencyName: c?.name ?? "\u2014",
      categoryId: cat?.id ?? "",
      categoryName: cat?.name ?? "Uncategorized",
      categoryColor: cat?.color ?? "#94a3b8",
      stage: a.stage,
      achievement: ach,
      signerName: signer?.name,
      signerUnitLabel: signerCrossUnitLabel(ach?.observerId),
      hasUnsatisfactory: hasUnsat,
      hasAnyObservation: hasAny,
    };
  });

  const otherRows: OtherRow[] = [];
  for (const ach of achievements) {
    if (ach.personId !== person.id) continue;
    if (requiredCompIds.has(ach.competencyId)) continue;
    const c = competencies.find((cc) => cc.id === ach.competencyId);
    if (!c) continue;
    const cat = categories.find((cc) => cc.id === c.categoryId);
    const earnedAtUnit = ach.earnedAtUnitId ? units.find((u) => u.id === ach.earnedAtUnitId) : undefined;
    let earnedAtStage: Stage | undefined;
    if (ach.earnedAtUnitId) {
      const m = assignments.find(
        (x) => x.unitId === ach.earnedAtUnitId && x.roleId === personRoleId && x.competencyId === ach.competencyId,
      );
      earnedAtStage = m?.stage;
    }
    otherRows.push({
      achievement: ach,
      competencyName: c.name,
      categoryName: cat?.name ?? "Uncategorized",
      categoryColor: cat?.color ?? "#94a3b8",
      earnedAtUnitName: earnedAtUnit?.name,
      earnedAtStage,
      signerName: persons.find((nn) => nn.id === ach.observerId)?.name,
      signerUnitLabel: signerCrossUnitLabel(ach.observerId),
    });
  }
  otherRows.sort((a, b) => {
    const au = a.earnedAtUnitName ?? "";
    const bu = b.earnedAtUnitName ?? "";
    if (au !== bu) return au.localeCompare(bu);
    return a.competencyName.localeCompare(b.competencyName);
  });

  const stageTotals: Record<Stage, { total: number; achieved: number }> = {
    Core: { total: 0, achieved: 0 },
    Orientation: { total: 0, achieved: 0 },
    Education: { total: 0, achieved: 0 },
  };
  for (const r of rows) {
    stageTotals[r.stage].total++;
    if (r.achievement) stageTotals[r.stage].achieved++;
  }

  const overallTotal = stageTotals.Core.total + stageTotals.Orientation.total + stageTotals.Education.total;
  const overallAchieved = stageTotals.Core.achieved + stageTotals.Orientation.achieved + stageTotals.Education.achieved;
  const overallPct = overallTotal === 0 ? 0 : Math.round((overallAchieved / overallTotal) * 100);

  const curIdx = stageIndex(currentStage);
  const priorStages = STAGE_ORDER.filter((_, i) => i < curIdx);
  const incompletePrior = priorStages.filter(
    (s) => stageTotals[s].total > 0 && stageTotals[s].achieved < stageTotals[s].total
  );
  const allPriorComplete = incompletePrior.length === 0;

  const categoryNames = Array.from(new Set(rows.map((r) => r.categoryName))).sort((a, b) =>
    a.localeCompare(b)
  );
  const stageRank: Record<Stage, number> = { Core: 0, Orientation: 1, Education: 2 };
  const rowsByCategory = new Map<string, DetailRow[]>();
  for (const r of rows) {
    const list = rowsByCategory.get(r.categoryName) ?? [];
    list.push(r);
    rowsByCategory.set(r.categoryName, list);
  }
  for (const list of rowsByCategory.values()) {
    list.sort((a, b) => {
      if (a.stage !== b.stage) return stageRank[a.stage] - stageRank[b.stage];
      return a.competencyName.localeCompare(b.competencyName);
    });
  }

  const generatedAt = new Date().toISOString();
  const personDisplayName = person.name.replace(/,\s*RN$/i, "").trim();
  const stageBadge = renderStageBadge(currentStage);

  void groups; void STAGES;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Competency Summary \u2014 ${esc(personDisplayName)}</title>
<meta name="description" content="Printable competency summary for ${esc(personDisplayName)}" />
<style>
  :root {
    --ink: #18181b; --ink-soft: #3f3f46; --muted: #71717a;
    --line: #e4e4e7; --line-soft: #f4f4f5; --paper: #ffffff;
    --brand: #1d4ed8; --good: #15803d; --warn: #b45309; --bad: #b91c1c;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f4f4f5; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.45; }
  .page { max-width: 8.5in; margin: 0 auto; padding: 0.6in 0.6in 0.4in; background: var(--paper); }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; padding: 0.5in; margin: 0; }
    .toolbar { display: none !important; }
    h2 { page-break-after: avoid; }
    .cat-block { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #ffffffee; backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
  .toolbar .meta { margin-right: auto; color: var(--muted); font-size: 11px; }
  .toolbar button { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--line); background: #fff; cursor: pointer; color: var(--ink); }
  .toolbar button.primary { background: var(--brand); color: #fff; border-color: var(--brand); }
  .toolbar button:hover { filter: brightness(0.97); }

  header.title { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 2px solid var(--ink); padding-bottom: 12px; margin-bottom: 16px; }
  header.title h1 { font-size: 18px; margin: 0 0 2px; letter-spacing: 0.02em; }
  header.title .sub { color: var(--muted); font-size: 11px; }
  header.title .brand { font-weight: 700; color: var(--brand); letter-spacing: 0.06em; text-transform: uppercase; font-size: 11px; }

  .identity { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 18px; margin-bottom: 14px; }
  .identity .field .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .identity .field .value { font-size: 12px; font-weight: 600; color: var(--ink); margin-top: 1px; }

  .stage-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .stage-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .stage-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .stage-badge.core { background: #fee2e2; color: #b91c1c; }
  .stage-badge.orientation { background: #fef3c7; color: #b45309; }
  .stage-badge.education { background: #dbeafe; color: #1d4ed8; }
  .stage-badge.fully { background: #dcfce7; color: #15803d; }
  .stage-badge.nonclinical { background: #e4e4e7; color: #3f3f46; }

  .prior-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; border: 1px solid; }
  .prior-pill.ok { color: var(--good); background: #f0fdf4; border-color: #bbf7d0; }
  .prior-pill.warn { color: var(--bad); background: #fef2f2; border-color: #fecaca; }

  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 22px 0 8px; }

  .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .stat { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: #fff; }
  .stat .name { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .stat .value { font-size: 18px; font-weight: 700; color: var(--ink); margin-top: 2px; line-height: 1.1; }
  .stat .extra { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .stat.current { border-color: #bfdbfe; background: #eff6ff; }
  .stat.complete .value { color: var(--good); }
  .stat.incomplete .value { color: var(--ink); }
  .bar { height: 5px; background: var(--line-soft); border-radius: 999px; margin-top: 6px; overflow: hidden; }
  .bar > span { display: block; height: 100%; border-radius: 999px; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); border-bottom: 1px solid var(--line); padding: 6px 8px; font-weight: 600; }
  tbody td { border-bottom: 1px solid var(--line-soft); padding: 7px 8px; vertical-align: top; }
  tbody tr:last-child td { border-bottom: 1px solid var(--line); }
  .col-stage { width: 96px; }
  .col-status { width: 110px; }
  .col-signer { width: 220px; }
  .col-date { width: 100px; }
  .col-earned { width: 220px; }

  .cat-block { margin-top: 14px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .cat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: #fafafa; border-bottom: 1px solid var(--line); }
  .cat-head .name { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 12px; }
  .cat-head .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .cat-head .count { font-size: 11px; color: var(--muted); }
  .cat-block table { border-top: 0; }

  .other-block { margin-top: 14px; border: 1px dashed #a1a1aa; border-radius: 8px; overflow: hidden; background: #fafafa; }
  .other-head { padding: 8px 12px; border-bottom: 1px solid var(--line); background: #f4f4f5; }
  .other-head .title { font-weight: 700; font-size: 12px; }
  .other-head .sub { font-size: 10px; color: var(--muted); margin-top: 2px; }

  .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .status-pill.achieved { background: #f0fdf4; color: var(--good); }
  .status-pill.in-progress { background: #eff6ff; color: var(--brand); }
  .status-pill.not-started { background: #f4f4f5; color: #52525b; }
  .flag-unsat { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; }

  .signer-unit { color: var(--muted); font-weight: 500; font-size: 10px; margin-left: 4px; }

  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; color: var(--muted); font-size: 10px; }

  .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 10px; color: var(--muted); margin-top: 8px; }
  .legend .item { display: inline-flex; align-items: center; gap: 6px; }
  .legend .swatch { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="meta">Generated ${esc(fmtDateTime(generatedAt))}</span>
    <button onclick="window.print()" class="primary" type="button">Print / Save as PDF</button>
    <button onclick="window.close()" type="button">Close</button>
  </div>
  <div class="page">
    <header class="title">
      <div>
        <div class="brand">CareCompetencies \u00B7 Duke University Health System</div>
        <h1>Competency Summary \u2014 ${esc(personDisplayName)}</h1>
        <div class="sub">Official competency-of-record evidence for regulatory inspection. Includes all competencies the person is assigned by unit and clinical role, plus any earned outside that scope.</div>
      </div>
      <div style="text-align: right;">
        ${stageBadge}
        <div class="sub" style="margin-top: 4px;">Day ${daysSinceStart} since start</div>
      </div>
    </header>

    <div class="identity">
      ${identityField("Name", personDisplayName)}
      ${identityField("Duke ID", person.dukeId ?? "\u2014")}
      ${identityField("Job Code", person.jobCode ?? "\u2014")}
      ${identityField("Clinical Role", role?.name ?? "\u2014")}
      ${identityField("Home Unit", unit?.name ?? "\u2014")}
      ${identityField("Cost Center", unit?.costCenter ?? "\u2014")}
      ${identityField("Primary Preceptor", primaryPreceptorName ?? "\u2014")}
      ${identityField("Start Date", fmtDate(person.startDate))}
    </div>

    <div class="stage-row">
      <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);">Stage status</span>
      ${stageBadge}
      ${renderPriorPill(allPriorComplete, incompletePrior, priorStages, currentStage)}
    </div>
    ${incompletePrior.length > 0 ? renderIncompleteDetail(incompletePrior, stageTotals) : ""}

    <h2>Summary</h2>
    <div class="summary-grid">
      ${renderOverallStat(overallAchieved, overallTotal, overallPct)}
      ${STAGE_ORDER.map((s) => renderStageStat(s, stageTotals[s], currentStage === s)).join("")}
    </div>
    <div class="legend">
      <span class="item"><span class="swatch" style="background:#15803d"></span> Achieved</span>
      <span class="item"><span class="swatch" style="background:#1d4ed8"></span> In Progress (one or more step observations recorded)</span>
      <span class="item"><span class="swatch" style="background:#a1a1aa"></span> Not Started</span>
      <span class="item"><span class="swatch" style="background:#fde68a"></span> Has Unsatisfactory observation</span>
    </div>

    <h2>Competency detail by category</h2>
    ${categoryNames.length === 0 ? `<p style="color: var(--muted);">No competencies are assigned to this person's unit / clinical role.</p>` : ""}
    ${categoryNames.map((cat) => renderCategoryBlock(cat, rowsByCategory.get(cat) ?? [])).join("")}

    ${otherRows.length > 0 ? renderOtherBlock(otherRows) : ""}

    <div class="footer">
      <span>CareCompetencies \u00B7 DUHS \u00B7 Generated ${esc(fmtDateTime(generatedAt))}</span>
      <span>${esc(personDisplayName)} \u00B7 ${esc(unit?.name ?? "\u2014")} \u00B7 ${esc(role?.name ?? "\u2014")}</span>
    </div>
  </div>
  <script>
    if (new URLSearchParams(window.location.search).get("print") === "1") {
      window.addEventListener("load", function () { setTimeout(function(){ window.print(); }, 200); });
    }
  </script>
</body>
</html>`;
  return html;
}

function identityField(label: string, value: string): string {
  return `<div class="field"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`;
}

function renderStageBadge(stage: StageOrFully): string {
  if (stage === "FullyOriented") {
    return `<span class="stage-badge fully"><span class="dot"></span>Fully Oriented \u00B7 Year 1 Complete</span>`;
  }
  if (stage === "Nonclinical") {
    return `<span class="stage-badge nonclinical"><span class="dot"></span>Nonclinical</span>`;
  }
  const cls = stage.toLowerCase();
  return `<span class="stage-badge ${cls}"><span class="dot"></span>${esc(stage)}</span>`;
}

function renderPriorPill(
  allComplete: boolean,
  incomplete: Stage[],
  prior: Stage[],
  currentStage: StageOrFully,
): string {
  if (prior.length === 0) {
    return `<span class="prior-pill ok" title="No prior stages">No prior stages to complete</span>`;
  }
  if (allComplete) {
    const label = currentStage === "FullyOriented"
      ? "All stage requirements satisfied"
      : `All prior stage requirements satisfied (${prior.join(", ")})`;
    return `<span class="prior-pill ok">\u2713 ${esc(label)}</span>`;
  }
  return `<span class="prior-pill warn">! Outstanding prior-stage competencies: ${esc(incomplete.join(", "))}</span>`;
}

function renderIncompleteDetail(
  incomplete: Stage[],
  totals: Record<Stage, { total: number; achieved: number }>
): string {
  const parts = incomplete.map((s) => {
    const t = totals[s];
    const remaining = t.total - t.achieved;
    return `${esc(s)}: ${t.achieved} of ${t.total} achieved (${remaining} remaining)`;
  });
  return `<div style="font-size: 11px; color: var(--bad); margin-top: 4px;">${parts.join(" \u00B7 ")}</div>`;
}

function renderOverallStat(achieved: number, total: number, pct: number): string {
  return `
    <div class="stat ${achieved === total && total > 0 ? "complete" : "incomplete"}">
      <div class="name">Overall</div>
      <div class="value">${achieved} / ${total}</div>
      <div class="extra">${pct}% achieved</div>
      <div class="bar"><span style="width:${pct}%; background:#15803d;"></span></div>
    </div>`;
}

function renderStageStat(
  stage: Stage,
  data: { total: number; achieved: number },
  isCurrent: boolean,
): string {
  const pct = data.total === 0 ? 0 : Math.round((data.achieved / data.total) * 100);
  const isComplete = data.total > 0 && data.achieved === data.total;
  const color = STAGE_COLOR[stage];
  const classes = ["stat", isCurrent ? "current" : "", isComplete ? "complete" : "incomplete"].join(" ");
  return `
    <div class="${classes}">
      <div class="name">${esc(stage)}${isCurrent ? " \u00B7 Current" : ""}</div>
      <div class="value">${data.achieved} / ${data.total}</div>
      <div class="extra">${data.total === 0 ? "No requirements" : `${pct}% achieved`}${isComplete ? " \u00B7 \u2713 complete" : ""}</div>
      <div class="bar"><span style="width:${pct}%; background:${color};"></span></div>
    </div>`;
}

function renderCategoryBlock(categoryName: string, rows: DetailRow[]): string {
  if (rows.length === 0) return "";
  const color = rows[0]?.categoryColor ?? "#94a3b8";
  const achievedCount = rows.filter((r) => r.achievement).length;
  return `
    <section class="cat-block">
      <div class="cat-head">
        <span class="name"><span class="dot" style="background:${esc(color)}"></span>${esc(categoryName)}</span>
        <span class="count">${achievedCount} of ${rows.length} achieved</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Competency</th>
            <th class="col-stage">Stage</th>
            <th class="col-status">Status</th>
            <th class="col-signer">Signed off by</th>
            <th class="col-date">Date signed off</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderDetailRow).join("")}
        </tbody>
      </table>
    </section>`;
}

function renderOtherBlock(rows: OtherRow[]): string {
  return `
    <h2>Other Competencies</h2>
    <section class="other-block">
      <div class="other-head">
        <div class="title">Earned outside current unit + clinical role requirements</div>
        <div class="sub">Cross-train and prior-unit credentials. Not counted toward current stage progress; included here for completeness of the record.</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Competency</th>
            <th class="col-earned">Earned at</th>
            <th class="col-signer">Signed off by</th>
            <th class="col-date">Date signed off</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderOtherRow).join("")}
        </tbody>
      </table>
    </section>`;
}

function renderOtherRow(r: OtherRow): string {
  const provenance = r.earnedAtUnitName
    ? `${r.earnedAtUnitName}${r.earnedAtStage ? ` \u00B7 ${r.earnedAtStage}` : ""}`
    : "Cross-credential";
  const signerCell = r.signerName
    ? (r.signerUnitLabel
        ? `${esc(r.signerName)} <span class="signer-unit">(${esc(r.signerUnitLabel)})</span>`
        : esc(r.signerName))
    : "\u2014";
  return `
    <tr>
      <td>
        <div style="font-weight: 600; color: var(--ink);">${esc(r.competencyName)}</div>
        <div style="font-size: 9px; color: var(--muted); margin-top: 1px;">
          <span style="display:inline-block; width:7px; height:7px; background:${esc(r.categoryColor)}; border-radius:50%; margin-right:4px;"></span>${esc(r.categoryName)}
        </div>
      </td>
      <td style="color: var(--ink-soft);">${esc(provenance)}</td>
      <td style="color: var(--ink-soft);">${signerCell}</td>
      <td style="color: var(--ink-soft); white-space: nowrap;">${esc(fmtDate(r.achievement.achievedAt))}</td>
    </tr>`;
}

function renderDetailRow(r: DetailRow): string {
  const status = overallStatusFor(r);
  const statusCls = status === "Achieved" ? "achieved" : status === "InProgress" ? "in-progress" : "not-started";
  const stageColor = STAGE_COLOR[r.stage];
  const dateLabel = r.achievement ? fmtDate(r.achievement.achievedAt) : "\u2014";
  const signerCell = r.achievement
    ? (r.signerName
        ? (r.signerUnitLabel
            ? `${esc(r.signerName)} <span class="signer-unit">(${esc(r.signerUnitLabel)})</span>`
            : esc(r.signerName))
        : "\u2014")
    : "\u2014";
  return `
    <tr>
      <td>
        <div style="font-weight: 600; color: var(--ink);">${esc(r.competencyName)}</div>
      </td>
      <td>
        <span style="display:inline-flex; align-items:center; gap:6px; font-size:10px; color:${stageColor}; font-weight:600;"><span style="width:6px; height:6px; background:${stageColor}; border-radius:50%; display:inline-block;"></span>${esc(r.stage)}</span>
      </td>
      <td>
        <span class="status-pill ${statusCls}"><span class="dot" style="background:${statusColor(status)};"></span>${esc(statusLabel(status))}</span>
        ${r.hasUnsatisfactory ? `<span class="flag-unsat">UNSAT</span>` : ""}
      </td>
      <td style="color: var(--ink-soft);">${signerCell}</td>
      <td style="color: var(--ink-soft); white-space: nowrap;">${esc(dateLabel)}</td>
    </tr>`;
}

export function openCompetencySummaryWindow(input: CompetencySummaryInput): Window | null {
  const html = buildCompetencySummaryHtml(input);
  const features = "noopener=no,noreferrer=no,width=1024,height=900,resizable=yes,scrollbars=yes";
  const w = window.open("", "_blank", features);
  if (!w) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const fallback = window.open(url, "_blank");
    return fallback;
  }
  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  } catch {
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      w.location.href = url;
    } catch {
      // best effort
    }
  }
  return w;
}