# Contributing

Thanks for your interest in the Project Controls Dashboard. This is a portfolio
project, but issues and pull requests that improve correctness, accessibility,
documentation or the controls domain model are welcome.

## Ground rules

- Be respectful and constructive — see the [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep the domain layer pure. Code under `src/domain/` must not depend on React,
  storage, network state or browser time; every calculation stays reproducible
  from its inputs. This is a hard architectural boundary, recorded in
  [`docs/architecture-decisions/ADR-0001-frontend-stack.md`](docs/architecture-decisions/ADR-0001-frontend-stack.md).
- Governance rules (baseline integrity, the change-control state machine,
  publication gating) are load-bearing. Changes that relax them need a clear
  rationale and matching tests.

## Development setup

Requirements: **Node.js 22.12+** and **pnpm 11** (the repo pins
`pnpm@11.9.0` via `packageManager`; run `corepack enable` if `pnpm` is not on
your PATH).

```bash
pnpm install
pnpm dev            # http://127.0.0.1:4173
```

## Before you open a pull request

Run the full quality gate and make sure it is green:

```bash
pnpm check          # lint + strict typecheck + Vitest + production build
```

For changes that touch import, native packaging, or browser journeys, run the
release gate as well (installs Playwright engines once):

```bash
pnpm exec playwright install chromium firefox webkit
pnpm check:release  # audit + check + native server tests + cross-browser E2E
```

Useful narrower commands:

| Command | Purpose |
|---|---|
| `pnpm test` | Vitest unit/component suite |
| `pnpm test:e2e:chromium` | Playwright journeys, Chromium only (fast loop) |
| `pnpm typecheck` | Strict TypeScript, no emit |
| `pnpm lint` | oxlint with warnings treated as errors |
| `pnpm coverage` | Vitest with coverage |

## Tests

New behaviour needs tests. Prefer:

- **Unit tests** for domain calculations and validation (they run against the
  pure library, not the UI).
- **Playwright journeys** for user-visible flows and accessibility states —
  these often carry more signal than markup assertions for this UI.

Do not commit `test.skip`/`test.only`, stub tests, or placeholder branches.

## Commit messages

Follow Conventional Commits:

```
<type>: <short description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Keep commits focused and the working tree reproducible — the CI status on a
commit should reflect the tree at that commit.

## Reporting issues

Open a GitHub issue describing what you expected, what happened, and the steps
to reproduce. For anything security-sensitive, please follow the private
reporting guidance in the Code of Conduct rather than filing a public issue.
