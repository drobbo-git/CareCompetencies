# ADR-002: Authentication via Duke Shibboleth SSO

**Status:** Accepted (planned — not yet implemented)
**Date:** 2026-06
**Deciders:** Lead developer; DHTS alignment

## Context

CareCompetencies is an internal DUHS application. All users have Duke NetIDs. The
application currently uses a stub auth mechanism: any username in the `persons` table
plus a shared `DEV_PASSWORD` environment variable grants access, and a 12-hour JWT is
issued. This is intentionally minimal — enough to build and demo the app, but not
suitable for production.

DUHS/DHTS requires internal applications to use Duke SSO (Shibboleth) rather than
managing separate credentials. Duke OIT provides two integration paths:

**Path A — Shibboleth Proxy (SAML):** An Apache proxy sidecar (`apache-shib` Helm chart)
sits in front of the application in OpenShift/DKS. It handles the SAML exchange with
Duke's IdP and forwards authenticated requests to the app with identity headers (`uid`
for NetID, `cn` for display name, `ismemberof` for Grouper group membership, etc.).
The app reads headers; it never sees credentials. Requires DKS/OpenShift deployment.
Documented at: `dev/docs/DKS/shib-proxy.md` in the DHTS developer guide.

**Path B — OIT OIDC:** OIT provides a standard OpenID Connect authorization server at
`oauth.oit.duke.edu/oidc` backed by Shibboleth. Applications register via
`authentication.oit.duke.edu/manager/oauth` and receive a client ID/secret. Supports
authorization code and client credential grant types. Works with any hosting platform,
not just DKS. Documented at: `dev/docs/how-to/openid-connect.md`.

## Decision

Target **Path B (OIT OIDC)** for the production integration. This is the better fit for
a React SPA + separate Express API architecture: the SPA handles the OIDC authorization
code flow, obtains a token from OIT, and passes it to the API as a Bearer token. The
API validates the token against OIT's OIDC discovery endpoint.

For **authorization** (who can act as Preceptor, UnitLeader, Administrator), use
Duke Grouper groups passed as OIDC claims or managed in the app's own `person_privileges`
table. The simplest approach: Shibboleth/OIDC provides identity (NetID), and the app
database remains the source of truth for privileges (`person_privileges`). Groups in
Grouper are an optional enhancement if DHTS prefers delegated group management.

The current dev stub (shared password + JWT) stays in place until OIT OIDC is wired.
The `DEV_PASSWORD` environment variable and `/auth/logins` public endpoint must be
removed or gated before any production deployment.

## Alternatives Considered

- **Shibboleth proxy (Path A)** — simpler to deploy (sidecar, no app code changes), and
  the standard pattern for traditional server-rendered apps in DKS. Not chosen because
  it sits in front of the whole app as a reverse proxy, which is awkward for a React SPA
  that makes direct API calls. Also locks the deployment to DKS/OpenShift, while OIDC
  works anywhere.
- **Custom JWT (current stub)** — not suitable for production; no identity verification
  against Duke IdM.
- **Entra ID / MSAL** — considered given the Azure SQL and Microsoft-stack context.
  Not the Duke standard; OIT Shibboleth/OIDC is the mandated SSO path for internal apps.

## Consequences

- **Positive:**
  - Users sign in with their Duke NetID — no separate account management.
  - Identity is authoritative (from Duke IdM); NetID maps directly to `persons.username`
    and `persons.duke_netid` in the database.
  - Standard OIDC flow works well for SPAs and is hosting-agnostic.
- **Trade-offs:**
  - Requires OIT app registration before implementation can begin.
  - The React SPA needs an OIDC client library (e.g. `oidc-client-ts` or `@auth0/auth0-react`
    reconfigured for OIT's OIDC endpoint).
  - `api/src/middleware/auth.ts` needs to change: instead of verifying a self-signed JWT
    with `JWT_SECRET`, verify tokens against OIT's JWKS endpoint.
  - The login dropdown (`/auth/logins`) and shared password (`DEV_PASSWORD`) are dev-only
    and must be fully removed in production.
  - The `persons.username` field must match the Duke NetID (`uid` header / OIDC `sub`
    claim) for the lookup to work at login time.
- **Follow-up actions:**
  - Register the application at `authentication.oit.duke.edu/manager/oauth`.
  - Replace `api/src/middleware/auth.ts` JWT verification with OIT OIDC token validation.
  - Replace `source/src/data/auth.tsx` stub with an OIDC client library flow.
  - Decide on Grouper group management vs. app-managed `person_privileges` for
    Preceptor/UnitLeader/Administrator roles. If Grouper: create groups and map
    `ismemberof` claims to privileges at login time.
  - See `dev/docs/how-to/openid-connect.md` in the DHTS developer guide for registration
    steps and implementation details.

## Notes

- See ADR-001 (database choice) and ADR-003 [TODO] (hosting / deployment platform).
- The `shib-proxy` approach remains available as a fallback if the app moves to DKS and
  the OIDC approach proves impractical. See `dev/docs/DKS/shib-proxy.md`.
- Duke Grouper documentation: `dev/docs/how-to/grouper.md`.
