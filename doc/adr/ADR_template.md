# ADR-[NNN]: [Short title describing the decision]

**Status:** Proposed | Accepted | Superseded by ADR-[XXX] | Deprecated
**Date:** YYYY-MM-DD
**Deciders:** [roles — e.g. "lead developer", "BA / nurse education", not necessarily names]

## Context

[What problem or situation led to needing a decision? What constraints — technical,
organizational, regulatory — were in play? Write enough that someone unfamiliar with the
situation understands why this was even a question.]

## Decision

[State the decision in one or two sentences. Be concrete and unambiguous.]

## Alternatives Considered

- **[Option A]** — [why it was considered, why it wasn't chosen]
- **[Option B]** — [why it was considered, why it wasn't chosen]

## Consequences

- **Positive:** [what this decision makes easier or enables]
- **Trade-offs / costs:** [what this decision makes harder, or what risk it accepts]
- **Follow-up actions:** [anything that needs to happen as a result — migrations,
  documentation updates, things to revisit later]

## Notes

[Links to related ADRs, discussions, or external references. If this ADR is later
superseded, add a note here pointing to the new one — don't delete old ADRs.]

---

### Tips for writing useful ADRs

- Write one ADR per *decision*, not per feature. A single feature might generate
  several ADRs (e.g. "choice of database," "approach to authentication").
- Retroactive ADRs are valuable too — if a past decision isn't documented, write it
  down now while the reasoning is still known. An ADR written six months late is far
  better than no ADR.
- The "Alternatives Considered" section is often the most useful part for a future
  reader — it preempts "why didn't they just do X?"
- Keep status current. A "Superseded" decision that's still marked "Accepted" is
  actively misleading to a cold-start reader.
