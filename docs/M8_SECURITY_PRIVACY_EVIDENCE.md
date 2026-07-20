# M8 local security and privacy evidence

**Evidence date:** 20 July 2026

**Milestone:** M8 — Quality and portfolio release

**Decision:** Local security baseline accepted; the product remains pre-release

## Outcome

The shipped browser build and native review bundle now have a repeatable,
fail-closed security baseline appropriate to the current local-first,
single-user scope. Script execution is restricted to same-origin files without
`unsafe-eval`; object, frame, media and external connection paths are denied;
the module import worker remains operational; and the native server binds only
to loopback while emitting defence-in-depth response headers.

The review found no remote API, analytics, telemetry, dynamic-code execution,
raw-HTML injection or user-controlled link-navigation sink in `src/`. That is a
negative finding for this checkout, not a promise about future increments.

This evidence does **not** claim penetration testing, remote CodeQL results,
application-managed encryption at rest or production suitability for client or
commercially sensitive information.

## Threat model and trust boundary

### In scope

- A malicious or malformed imported CSV or restored JSON backup.
- Stored user narrative later rendered by React.
- Accidental remote network requests introduced by a dependency or feature.
- Browser script injection made more damaging by a permissive document policy.
- Navigation away from the packaged local origin.
- Direct requests to the packaged Python server, including directory listing
  and resolved path traversal.
- Dependency vulnerabilities visible to the package-manager advisory service.
- Future JavaScript/TypeScript security defects detectable by CodeQL.

### Outside the current product boundary

- User accounts, roles, multi-user authorisation and cloud sync: no backend or
  identity service exists.
- Enterprise endpoint hardening, device theft and compromised macOS accounts.
- Confidential client deployment, internet hosting and hostile multi-tenant
  operation.
- A guarantee that a user-selected downloaded backup remains private after it
  leaves browser/WebKit storage.

## Implemented controls

### 1. Content Security Policy

`index.html` declares the production browser policy. The packaged loopback
server sends the matching policy as an HTTP header and adds
`frame-ancestors 'none'`, which is not supported by a meta-delivered policy.

The policy establishes these boundaries:

- `default-src 'self'` is the fallback.
- `script-src 'self'` permits packaged scripts and excludes inline scripts and
  `unsafe-eval`.
- `worker-src 'self'` permits the same-origin Vite module worker.
- `connect-src 'self'` blocks remote fetch/XHR/WebSocket connections.
- `object-src 'none'`, `frame-src 'none'` and `media-src 'none'` remove unused
  active-content surfaces.
- `base-uri 'none'` prevents base-element URL rewriting.
- `form-action 'self'` prevents form submission to an external origin.
- Images and fonts permit only same-origin plus the bounded data/blob sources
  required by the current interface.

`style-src 'unsafe-inline'` remains because React/Recharts render trusted
component styles through element style attributes. It is explicitly recorded
as a compatibility exception; it does not relax script execution.

Zod normally probes for dynamic-function support. Firefox reports that caught
probe as a CSP violation even when the application continues. The checked-in
`configureCspRuntime.ts` pre-populates Zod's documented global `jitless` option
before any schema module evaluates, in both the page and import-worker entry
graphs. The browser test then requires the visible “Validated in the isolated
module worker” result in Chromium, Firefox and WebKit, so CSP compatibility
cannot pass by silently using the main-thread fallback.

### 2. Browser runtime and network diagnostics

The automatic Playwright fixture records every error-level console message,
uncaught page exception and HTTP(S) request. Any request whose origin differs
from the test's loopback production-preview origin fails the journey. This
guard runs on all 25 browser runs, including empty launch, all eight routes,
controlled CSV import, calculations, milestone recovery, responsive checks and
accessibility scans.

`security.chromium-only.spec.ts` independently asserts the presence of the
restrictive policy and its required directives in the built entry point.

### 3. Native loopback server

`review_server.py` binds to `127.0.0.1`, not all interfaces. Its handler:

- resolves requested paths and rejects anything outside the packaged web root;
- rejects directory requests other than the application root, preventing
  directory indexes;
- retains the intentional SPA fallback for extensionless routes;
- sends CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, same-origin opener/resource policies and a
  restrictive `Permissions-Policy`;
- sends `Cache-Control: no-store`; and
- removes the default Python version disclosure from the `Server` header.

The Swift host permits top-level navigation only to the exact native loopback
origin and inert `about:` URLs. The previously unnecessary `data:` navigation
exception is removed.

`test_review_server.py` starts the real threaded server on an ephemeral
loopback port and verifies the SPA route, every configured security header,
asset delivery, directory rejection and path-traversal rejection for both GET
and HEAD request handling.

### 4. Supply-chain and static-analysis automation

- `pnpm audit --audit-level high` is part of `check:release` and GitHub Actions.
- Dependabot is configured for weekly npm and GitHub Actions updates with a
  bounded pull-request limit.
- CodeQL advanced setup is configured for JavaScript/TypeScript on pull
  requests, pushes to `main` and a weekly schedule with the
  `security-extended` query suite.

The YAML files were parsed locally. The workflows are configuration evidence;
they are not described as passing until GitHub executes them and a maintainer
reviews the results.

## Verification evidence

The final clean-tree release command was:

```bash
pnpm check:release
```

Final release evidence for this increment:

- package audit: no known vulnerability at the high-severity gate;
- lint: zero warnings;
- strict TypeScript application and E2E check: passed;
- Vitest: 305/305 tests passed across 45 files;
- Vite production build: passed;
- native loopback server: 4/4 tests passed;
- Playwright: 25/25 runs passed across Chromium, Firefox, WebKit and mobile-390;
- imported CSV journeys in all three desktop engines visibly confirmed the
  isolated module worker;
- every browser run reported zero unexpected external HTTP(S) requests, page
  exceptions or error-level console messages; and
- `git diff --check`: passed.

The final Playwright matrix completed in 30.7 seconds. The ordinary Node colour
environment notices in its captured output were runner warnings, not browser
console errors; the browser diagnostic fixture stayed clean.

The YAML parser also accepted `.github/workflows/e2e.yml`,
`.github/workflows/codeql.yml` and `.github/dependabot.yml`.

## Findings encountered during the increment

1. The first native-test package script used `python -m unittest` with a path
   below the hyphenated `macos-review` directory. Python interpreted it as an
   invalid dotted module name. The script now executes the checked-in test file
   directly; the tests still use `unittest` and a real server.
2. The first strict CSP run passed functionally in Chromium/WebKit but Firefox
   exposed Zod's caught dynamic-function capability probe as an error-level CSP
   report. Adding `unsafe-eval` was rejected. Early supported `jitless`
   configuration eliminated the probe while preserving all validation results.
3. The first full release run exposed an existing Testing Library race: an
   assertion captured the dashboard source region while it still said
   “Checking local data…”. The underlying active generation was present. The
   test now waits for the final accessible data-source state before asserting,
   matching the browser gate's web-first synchronization approach.
4. The first matrix run after raising the evidenced delivery position correctly
   rejected the stale 88% E2E expectation in all three desktop engines. The
   assertion now verifies the reconciled 90% value shown by the application.

## Privacy statement supported by the code

- Repository fixtures are synthetic and do not contain the user's CV,
  university details, employer/client information or confidential project
  data.
- Project imports, register entries, variance analysis and report publications
  are stored locally in browser/WebKit storage.
- The current application has no telemetry, analytics, remote API or cloud
  synchronisation path.
- A downloaded backup crosses the application boundary only through an
  explicit user action and intentionally omits several local record classes as
  documented in the README.
- Reset clears both generation storage and the local management-register store.

Local-first does not mean secret: the application does not add a separate
encryption key over browser/WebKit storage, and a person with access to the
device account or downloaded backup may be able to read the data.

## Remaining limitations and release actions

- Review the first remote CodeQL and Dependabot results; local configuration is
  not a substitute for a completed remote run.
- Run manual native WKWebView and VoiceOver tasks; automation cannot establish
  assistive-technology conformance.
- Revisit CSP if charts stop requiring style attributes, with the goal of
  removing `style-src 'unsafe-inline'`.
- Repeat this threat model before adding any hosted origin, authentication,
  external link, telemetry, API, file-system entitlement or auto-update path.
- Do not use real employer/client/commercially sensitive data for the portfolio
  build without an organisation-approved security and privacy assessment.

## Standards and current official guidance checked

- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [MDN `worker-src` reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src)
- [GitHub CodeQL code scanning concepts](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning)
- [GitHub Dependabot version-update configuration](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates)

The implementation intentionally uses a meta policy for ordinary static-preview
hosting and an HTTP header policy for the packaged native server. Server-only
directives are not falsely claimed for the meta path.
