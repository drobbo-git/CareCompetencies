// =============================================================================
// CareCompetencies — Audit Log seed
// -----------------------------------------------------------------------------
// Initial audit events shown on the Admin Audit Log page. New events appended
// via store.logAudit() prepend to this list at runtime.
// =============================================================================

import type { AuditEvent } from "./types";

export const seedAuditEvents: AuditEvent[] = [
  // Intentionally empty; the prototype seeds no historical audit events.
  // Add fixture rows here if you want a demo with non-empty initial state.
];