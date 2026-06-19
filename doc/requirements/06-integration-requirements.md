# Integration Requirements — CareCompetencies

> **Purpose:** Defines all external systems that CareCompetencies must connect to,
> the data flows involved, and the open questions that require DHTS coordination.
> Each integration has a status: **Implemented**, **Planned**, or **Future**.

---

## Integration Overview

| Integration | Direction | Status | Priority |
|---|---|---|---|
| Duke OIT OIDC / Shibboleth (authentication) | Inbound (identity) | Planned — Phase 2 | High |
| SAP / LDAP (HR data sync) | Inbound (person data) | Planned — Phase 2 | High |
| DUHS Email / Exchange (notifications) | Outbound (email) | Future — Phase 3 | Medium |
| MDM / App Store (mobile packaging) | Packaging only | Future — Phase 3 | Low |

---

## 1. Duke OIT OIDC / Shibboleth — Authentication

### Overview

The current dev stub (shared password + username field) must be replaced with
Duke SSO before go-live. Duke OIT provides an OIDC interface (`oauth.oit.duke.edu/oidc`)
backed by Shibboleth (Duke's identity provider). Users authenticate with their
Duke NetID — no separate CareCompetencies credentials. See ADR-002 for the full
decision record.

### Data Flow

```
User browser → OIDC authorization code flow → OIT OIDC server (oauth.oit.duke.edu/oidc)
→ Shibboleth login (Duke NetID + password) → OIT issues OIDC token
→ CareCompetencies API validates token against OIT JWKS endpoint → Issues internal JWT
→ Frontend stores internal JWT for subsequent API calls
```

### Requirements

| Requirement | Detail |
|---|---|
| Identity provider | Duke OIT OIDC, backed by Shibboleth. Register the app at `authentication.oit.duke.edu/manager/oauth`. |
| Protocol | OpenID Connect authorization code flow. OIDC client library: `oidc-client-ts` or equivalent in the React SPA. |
| Claims required | `uid` (NetID — used as the person lookup key), `cn` (display name). Group memberships via `ismemberof` are optional — see privilege note below. |
| Token validation | API validates OIT OIDC tokens against OIT's JWKS endpoint (from the OIDC discovery document). Replaces current `JWT_SECRET`-based self-signing. |
| Token exchange | OIT token is validated by the API; the API issues its own 12-hour internal JWT for subsequent calls. Decouples session lifetime from OIT token refresh. |
| Redirect URIs | Register URIs for dev, staging, and production environments. |
| Logout | Clear the internal JWT and initiate OIDC logout to end the Shibboleth session. |
| Dev stub removal | `/auth/logins` public endpoint and `DEV_PASSWORD` env var must be removed or gated before any production deployment. |

### Open Questions for DHTS / OIT

- Has the application been registered at `authentication.oit.duke.edu/manager/oauth`? Who initiates this?
- Which redirect URIs are needed for each environment (dev, staging, prod)?
- Should Grouper group membership (`ismemberof` claim) be used to drive Preceptor/UnitLeader/Administrator privilege assignment, or remain app-managed via `person_privileges`?

### What Does NOT Change

Privilege rows (`PersonPrivilege` table) are app-managed. OIT OIDC/Shibboleth
provides identity only (NetID). Who is a Preceptor, UnitLeader, or Administrator
is determined by rows in the CareCompetencies database, not by Duke directory groups
(unless the Grouper enhancement is adopted — see open questions above).

---

## 2. SAP / LDAP — HR Data Sync

### Overview

Person data (names, NetIDs, unit assignments, job codes) currently comes from
a manually maintained seed file. Production requires a nightly sync from the
authoritative HR system.

### Data Flow

```
SAP / LDAP → Nightly ETL job → CareCompetencies persons table
```

The sync is **one-way**. SAP is the system of record for person data.
CareCompetencies does not write back to SAP.

### Fields to Sync

| Field | Source | Notes |
|---|---|---|
| `netId` | SAP / LDAP | Unique employee identifier. Match key. |
| `name` | SAP / LDAP | Display name (e.g., "Sara Hayes, RN"). |
| `unitId` | SAP (department/unit mapping) | Requires a mapping table from SAP department code to CareCompetencies unit ID. DHTS to provide. |
| `roleId` | SAP job code → role mapping | Job codes map to clinical roles (RN, NCA, HUC). Mapping table needed. |
| `jobCode` | SAP | Stored for reference. |
| `active` | SAP employment status | **Not yet implemented.** Persons table needs an `active` boolean column. Inactive employees should be hidden from active views but records retained. |
| `startDate` | SAP hire/unit start date | Orientation start date. Authoritative from HR. |

### Requirements

| Requirement | Detail |
|---|---|
| Sync frequency | Nightly. Exact time TBD with DHTS. |
| New employees | Inserted into `persons` table automatically. Default to no privilege rows. |
| Transferred employees | `unitId` updated. Start date does **not** reset on transfer (TBD — confirm with SME). Stage reflects original start date unless overridden. |
| Terminated employees | `active` flag set to false. Record retained. Achievements and observations preserved. |
| Privilege rows | **Not touched by sync.** Preceptor/UnitLeader/Administrator privileges are app-managed. |
| Conflict resolution | SAP data wins for synced fields (name, unit, role, job code). App-managed fields (startDate override, stageOverride, primaryPreceptorId, privilege rows) are preserved. |

### Open Questions for DHTS

- Is SAP or LDAP the preferred data source? (SAP has richer job data; LDAP is easier to query.)
- What API or data export format does SAP support for nightly extracts?
- Who maintains the department-code → unit-ID mapping table?
- Who maintains the job-code → clinical-role mapping table?
- What is the ETL infrastructure? (Scripts live in `etl/`; they need a scheduler and a host.)

### What Does NOT Change

The `startDate` field in CareCompetencies may differ from an employee's
SAP hire date if the person transferred units. Confirm with SME whether
to reset `startDate` on unit transfer or preserve the original.

---

## 3. DUHS Email / Exchange — Notifications

**Status: Future (Phase 3)**

### Overview

Several user actions should trigger email notifications once the notification
system is built. No notifications exist in the prototype.

### Planned Notification Events

| Trigger | Recipient(s) | Content |
|---|---|---|
| Change request approved | Request submitter | "Your change request for [competency] was approved." |
| Change request rejected | Request submitter | "Your change request for [competency] was rejected. Note: [adminNote]." |
| Preceptor assigned | New preceptor | "You have been assigned as preceptor for [orientee name]." |
| Preceptor assigned | Orientee | "Your preceptor is now [preceptor name]." |

### Integration Options (for DHTS evaluation)

| Option | Notes |
|---|---|
| Microsoft Graph API | Preferred if app registration is already in place for Entra ID. Sends email via Office 365. |
| DUHS SMTP relay | Simpler integration; requires DHTS to provide SMTP relay host and credentials. |
| SendGrid or similar | Third-party; unlikely to be approved for DUHS internal tools. |

### Open Questions for DHTS

- Is Microsoft Graph API available for CareCompetencies after the Entra ID integration?
- Is there a DUHS SMTP relay available for application-generated email?
- Are there DHTS-approved notification templates or branding requirements?

---

## 4. Mobile Device / App Packaging

**Status: Future (Phase 3)**

### Overview

Mobile views (observe, sign-off) are currently responsive web pages. The
packaging strategy — PWA vs. native app wrapper — is not yet decided.

### Options

| Option | Pros | Cons |
|---|---|---|
| Progressive Web App (PWA) | No app store distribution; installs from browser; camera API available | Limited to what browser APIs support; no MDM control of the "app" |
| Capacitor (React → native wrapper) | App store distribution; full native API access; MDM-manageable | Requires build pipeline for iOS and Android; App Store / Play Store accounts needed |

### Open Questions for DHTS

- Does DUHS MDM (Intune or similar) require apps to be distributed through a managed app store, or is PWA installation acceptable?
- Does DUHS have an Apple Developer account and Google Play account for internal app distribution?
- Is there a preference for Capacitor, React Native, or another wrapper?
- What iOS/Android OS versions are in scope based on MDM-enrolled device fleet?

### Camera Permission (QR Code Scanning)

QR-based orientee lookup on mobile sign-off requires camera access. Both PWA
and native wrappers support this via browser/native camera APIs, but the
permission prompt UX differs. Native wrappers provide a better user experience
on first use.

---

## Integration Dependencies Map

```
Phase 1 (Current):
  CareCompetencies API ←→ Azure SQL Server (operational)
  CareCompetencies API ←→ ETL (read-only; separate pipeline)

Phase 2 (Planned):
  CareCompetencies API ←→ Entra ID / MSAL       [Authentication]
  ETL job              ←  SAP / LDAP      [Nightly person sync]

Phase 3 (Future):
  CareCompetencies API → Exchange / Graph API    [Email notifications]
  Mobile packaging     → MDM / App Store         [Device distribution]
```

---

## DHTS Coordination Checklist

Before Phase 2 development begins, the following must be resolved with DHTS:

- [ ] Entra ID tenant ID and app registration process confirmed
- [ ] Redirect URIs for dev / staging / production environments agreed
- [ ] SAP vs. LDAP as HR data source confirmed
- [ ] Department-code → unit-ID mapping table owner identified
- [ ] Job-code → clinical-role mapping table owner identified
- [ ] ETL scheduler and host infrastructure confirmed
- [ ] Notification integration method (Graph API vs. SMTP relay) confirmed
- [ ] Mobile packaging strategy (PWA vs. Capacitor) confirmed
- [ ] MDM policy for mobile app distribution confirmed
