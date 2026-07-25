# Security Policy

## Supported versions

This is a portfolio project released as a single tested slice. Security fixes are
applied to the latest release only.

| Version | Supported |
|---------|-----------|
| 0.1.0 (latest) | ✅ |
| < 0.1.0 | ❌ |

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
anything security-sensitive.

- **Preferred:** use GitHub's private vulnerability reporting on this repository
  (**Security → Report a vulnerability**, or
  [open a draft advisory](https://github.com/alexwang-engineering/project-controls-dashboard/security/advisories/new)).
- **Alternatively:** contact the maintainer through their
  [GitHub profile](https://github.com/alexwang-engineering).

Please include the affected version or commit, a description of the issue,
reproduction steps, and the impact you observed. You can expect an
acknowledgement within a few days and an assessment of next steps.

## Security model

The application is **local-first** and is designed to minimise its own attack
surface:

- **No backend, no telemetry, no remote API path.** Imported and user-entered
  data stay in browser/WebKit local storage on the device. Automated browser
  journeys fail on any unexpected external HTTP(S) request.
- **Restrictive production CSP** without `unsafe-eval`; the import worker is
  constrained to same-origin assets.
- **Hardened native loopback server** (packaged macOS app) that binds to
  `127.0.0.1` only, adds CSP/frame/MIME/referrer/permissions headers, disables
  directory listings, and rejects paths resolving outside the packaged web root.
- A high-severity dependency audit runs in the release command and CI, with
  Dependabot and CodeQL providing ongoing dependency and static-analysis
  coverage.

The full threat model, controls, negative findings and explicit limitations are
documented in
[`docs/M8_SECURITY_PRIVACY_EVIDENCE.md`](docs/M8_SECURITY_PRIVACY_EVIDENCE.md).

## Scope notes

Because data is stored locally and unencrypted at the application layer, device
access, macOS account security and backup handling remain the user's
responsibility — this is a deliberate, documented boundary rather than a
vulnerability. A cloud backend and authentication are outside the
portfolio-release scope.
