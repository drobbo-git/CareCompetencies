# Requirements Package — CareCompetencies

> This folder contains the requirements artifacts that should accompany any
> prototype-to-backend handoff for a CareCompetencies feature or release.
> Together, these documents capture what the prototype demonstrates, the
> business rules behind it, and the technical constraints the backend must
> satisfy — none of which are reliably deducible from inspecting the prototype
> alone.

## Documents

| # | Document | Purpose |
|---|---|---|
| 01 | [Feature Inventory](01-feature-inventory.md) | Every screen, interaction, and business rule. The prototype shows *what*; this document captures *why*. |
| 02 | [Data Model Sketch](02-data-model.md) | Entities, relationships, and key constraints. Derived from prototype mock data; made explicit for backend implementation. |
| 03 | [Role & Permission Matrix](03-role-permission-matrix.md) | Who can see and do what. Must be enforced server-side; client-side hiding is UX only. |
| 04 | [Out-of-Scope & Known-Fake List](04-out-of-scope.md) | What is not real in the prototype and what is intentionally out of scope. Prevents developers from mistaking omissions for bugs. |
| 05 | [Non-Functional Requirements](05-nonfunctional-requirements.md) | Performance, availability, security, compliance, accessibility, and audit requirements. Affects architecture — must be agreed before development starts. |
| 06 | [Integration Requirements](06-integration-requirements.md) | External systems (Entra ID, PeopleSoft, email, mobile packaging) with data flows and open questions for DHTS. |

## Who Reviews What

| Audience | Primary Documents |
|---|---|
| DHTS (technical review / sign-off) | 03, 05, 06 |
| Development team | 01, 02, 03, 04 |
| Clinical stakeholders (SME validation) | 01, 04 |
| Application BA | All — owns and maintains this package |

## How This Package Is Used

1. BA and clinical stakeholders build the prototype and validate the workflow.
2. BA uses the agentic prototyping tool to generate initial drafts of these documents, then reviews and corrects them — especially the business rules in document 01, which require domain knowledge the tool cannot infer.
3. BA submits this package as a merge request in GitLab.
4. Development team and DHTS review and comment. DHTS has formal sign-off on documents 03, 05, and 06 before development begins.
5. Approved package becomes the baseline. Changes during development are tracked via GitLab merge requests against these documents.
