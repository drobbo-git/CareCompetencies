# Non-Functional Requirements — CareCompetencies

> **Purpose:** Specifies constraints on *how* the system must behave beyond its
> functional features. These requirements affect architecture decisions and must
> be confirmed with DHTS before backend development begins. Undiscovered
> non-functional requirements are the most common cause of mid-build refactoring.
>
> **Owner:** DHTS to review and confirm targets. Clinical / application team to
> confirm business expectations. Joint sign-off required before development starts.

---

## 1. Performance

### 1.1 Response Time

| Metric | Target | Notes |
|---|---|---|
| API read endpoints (p95) | < 500ms | Under typical load. Applies to: person lists, competency lists, achievement queries. |
| API write endpoints (p95) | < 1,000ms | Observations, achievements, change requests. |
| Frontend initial load | < 3 seconds | On standard DUHS hospital WiFi (estimated ~10 Mbps). |
| Frontend page navigation | < 500ms | After initial load; client-side routing. |

### 1.2 Throughput

| Metric | Target | Notes |
|---|---|---|
| Concurrent active users (per unit) | 50 | Peak: shift change, when multiple preceptors are recording simultaneously. |
| Concurrent active users (system-wide) | 200 | Across all units. |
| Database connections | Pooled; max 20 | Azure SQL serverless tier. Pool size tuned to stay within tier limits. |

### 1.3 Data Volume

These are planning estimates for capacity sizing. Actual volumes should be
confirmed with the nurse education team.

| Entity | Estimated Volume | Notes |
|---|---|---|
| Persons (active orientees) | ~1,000 system-wide at any time | Varies with hiring cycles. |
| Persons (total, including fully oriented staff) | ~12,000 | All DUHS employees in scope for the system. |
| Competencies | ~1,500 | Relatively stable catalog. |
| CompetencySteps | ~15,000 | ~10 steps per competency average. |
| StepObservations (per year) | ~500,000 system-wide | ~500 per orientee × 1,000 orientees. |
| CompetencyAchievements (per year) | ~30,000 system-wide | ~30 per orientee × 1,000 orientees. |

**Lesson learned:** Failing to specify concurrent user and data volume targets
before development led to N+1 query issues and missing pagination that required
refactoring mid-build. These targets must be agreed before API route design.

---

## 2. Availability

| Requirement | Target | Notes |
|---|---|---|
| Uptime during business hours | 99.5% | Mon–Fri, 0600–2200 local time. |
| Planned maintenance window | Saturday 0000–0400 | Communicate to users in advance. |
| Recovery Time Objective (RTO) | 4 hours | Time to restore service after an outage. |
| Recovery Point Objective (RPO) | 24 hours | Maximum acceptable data loss. Nightly backup assumed. |
| Azure SQL auto-resume | Handled in `db.ts` | Azure SQL serverless may auto-pause after inactivity. Extended connect timeout is configured when `DB_SERVER ≠ localhost`. |

---

## 3. Security

### 3.1 Authentication

| Requirement | Notes |
|---|---|
| Production auth method | Duke SSO via OIT OIDC (`oauth.oit.duke.edu/oidc`), backed by Shibboleth. Users authenticate with their Duke NetID. Current dev stub (shared password) must be replaced before go-live. See ADR-002. |
| OIDC client | React SPA handles the OIDC authorization code flow using `oidc-client-ts` or equivalent. API validates tokens against OIT's JWKS endpoint. |
| JWT expiry | 12-hour absolute expiry on the internal JWT issued by the API after OIDC token validation. |
| Session inactivity timeout | 15 minutes (configurable via `SESSION_TIMEOUT_MINUTES` API env var). |
| Token storage | JWT stored in `localStorage`. Acceptable for internal-only app on managed devices; evaluate for externally accessible deployments. |

### 3.2 Authorization

| Requirement | Notes |
|---|---|
| All API endpoints enforce JWT | No unauthenticated access except `/auth/login`, `/auth/logins` (dev only), `/health`, and `/config`. |
| Role enforcement is server-side | Client-side hiding is UX only. API must return HTTP 403 for unauthorized requests. |
| Unit scoping | Preceptor and UnitLeader endpoints must filter results to the caller's privilege scope. Unscoped queries are a data leakage risk. |
| Achievement scope check | Sign-off and observation endpoints verify the caller has achieved the target competency. Query runs against `competency_achievements` using the authenticated caller's ID from the JWT. |

### 3.3 Data Protection

| Requirement | Notes |
|---|---|
| Data in transit | TLS 1.2 minimum. Enforced by Azure infrastructure; verify at the load balancer / ingress level. |
| Data at rest | Azure SQL Transparent Data Encryption (TDE) enabled. Confirm with DHTS. |
| PII in logs | Employee names and NetIDs must not appear in application logs. Log entity IDs only. |
| Secrets management | All secrets (JWT_SECRET, DB_PASSWORD, etc.) must be stored in Kubernetes secrets or Azure Key Vault. Never in source code or Docker images. |

---

## 4. Compliance

### 4.1 HIPAA

> **Note for DHTS legal / compliance review:** CareCompetencies tracks employee
> training records, not patient data. Competency records (who achieved what, when)
> are employee records, not Protected Health Information (PHI). However, confirm
> this classification with the DUHS Privacy Office before go-live, as some
> competency names may reference patient-care contexts.

| Requirement | Notes |
|---|---|
| PHI classification | Competency records are employee records, not PHI. Confirm with DUHS Privacy Office. |
| Audit log retention | All write actions must be logged. Logs must be retained for a minimum of **7 years** per DUHS records retention policy. |
| Access logging | Authentication events (login, logout, session expiry) must be logged. |
| Data minimization | Collect only what is needed. No patient identifiers in any system record. |

### 4.2 Records Retention

| Record Type | Retention Period | Notes |
|---|---|---|
| `competency_achievements` | 7 years minimum | Clinical training record. Append-only. |
| `step_observations` | 7 years minimum | Clinical training record. Append-only. |
| `audit_events` | 7 years minimum | Compliance log. |
| `change_requests` | 7 years minimum | Administrative record. |
| `persons` | Duration of employment + 7 years | Soft-delete preferred over hard delete. |

---

## 5. Accessibility

| Requirement | Target | Notes |
|---|---|---|
| WCAG compliance level | WCAG 2.1 AA | Required for DUHS digital tools serving clinical staff. |
| Keyboard navigation | Full | All interactive elements reachable and operable by keyboard. |
| Screen reader support | NVDA + Chrome, VoiceOver + Safari | Clinical staff may include users with accessibility needs. |
| Color contrast | WCAG AA ratios | Especially relevant for the stage-shading feature (green/amber). Do not use color alone to convey status. |
| Touch targets | Minimum 44×44px | Mobile views used at bedside; gloves may affect precision. |

---

## 6. Browser & Device Support

### 6.1 Desktop Browsers

| Browser | Support Level |
|---|---|
| Chrome (current and current-1) | Full |
| Microsoft Edge (current and current-1) | Full |
| Safari (current and current-1) | Full |
| Firefox (current) | Best effort |
| Internet Explorer 11 | Not supported |

### 6.2 Mobile

| Platform | Support Level | Notes |
|---|---|---|
| iOS Safari (current and current-1) | Full | Preceptor mobile views (observe, sign-off). |
| Chrome for Android (current) | Full | |
| DUHS-issued mobile devices | Full | Coordinate with DHTS on device OS versions in MDM. |

---

## 7. Audit Logging

Every significant write operation must emit an audit event. The caller provides
the human-readable summary; the route does not generate it automatically.

| Event Category | Examples |
|---|---|
| Authentication | Login, logout, session timeout, failed login |
| Competency catalog | Create, edit, delete competency; add/remove steps; manage groups |
| Assignments | Create or delete competency assignment |
| Observations | Record step observation |
| Achievements | Record competency achievement (sign-off) |
| Self-assessments | Submit self-assessment |
| Change requests | Submit, approve, reject |
| Person management | Create person, edit unit/role/preceptor, set stage override |

---

## 8. Operability

| Requirement | Notes |
|---|---|
| Health check endpoint | `GET /health` returns `{ status: "ok" }`. Used by load balancer / Kubernetes liveness probe. |
| Structured logging | API logs should be JSON-structured for ingestion into DHTS log aggregation. |
| Environment config | All environment-specific values (DB credentials, JWT secret, timeout settings) via env vars. No hardcoded config. |
| Container | API is containerized via `Dockerfile.api`. Image must be deployable to AKS without modification. |
| Graceful shutdown | API should handle SIGTERM gracefully (drain in-flight requests before exiting). |
| Database schema | `api/src/schema.sql` is idempotent — safe to re-run. DHTS can apply it as part of deployment pipeline. |
