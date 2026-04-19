<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

- E2E tests (against example-robot) are run with `nx run example-client:e2e:local` (starts the robot, then runs the e2e suite)
- Unit tests: run `nx test <project>` (e.g. `nx test client`, `nx test react`). To run a single test file, use `nx test <project> --testFile=<name>` where `<name>` is a substring of the filename (e.g. `nx test client --testFile=struct-parser`). Do **not** invoke `vitest` directly — the Nx executor provides the required globals (describe, it, expect) and project-level config.
- To run multiple project tests in one command: `nx run-many -t test --projects=client,react`

## Spec-driven E2E tests

E2E tests are **spec-driven**: every major feature has a markdown spec under `apps/example-client/specs/` that defines the feature, its acceptance criteria (AC), and the tests that cover those ACs. Tests live in `apps/example-client/src/e2e/` with one `*.spec.ts` file per spec.

**Specs and tests MUST stay in sync.** When you change one, change the other in the same PR.

### Spec template

Every spec file in `apps/example-client/specs/` MUST follow this shape:

```markdown
# Feature: <name>

<One-paragraph description.>

## User stories

- <bullet list of who-wants-what-so-that>

## Acceptance criteria

| ID   | Description          |
| ---- | -------------------- |
| XX-1 | <testable behaviour> |

## Tests

| Test                  | Covers | Status      |
| --------------------- | ------ | ----------- |
| `[XX-1] <test title>` | XX-1   | Implemented |

## Coverage

<Summary of which ACs are covered and which (if any) are not.>
```

### Rules (MUST follow)

1. **AC ID format**: 2–3 letter feature prefix + integer (no leading zeros), e.g. `SUB-1`, `PUB-12`. Prefixes are chosen per feature (`SUB`, `PUB`, `PFX`, `STR`, `RET`, …).
2. **AC IDs are stable.** Once published, an AC's ID never changes or gets reused. Retired ACs stay in the spec marked `Retired`.
3. **Every test name starts with its AC IDs in square brackets.** Example: `[SUB-1] receives kDouble Gyro value from server`. Multiple ACs are comma-separated: `[PUB-1, PUB-2] ...`.
4. **Every test file maps 1:1 to a spec file.** One spec = one `*.spec.ts` under `apps/example-client/src/e2e/`. When adding a new major feature, create both a new `specs/<feature>.md` and a new `src/e2e/<feature>.spec.ts`.
5. **Every AC has a row in its spec's Tests table.** Either covered by at least one `Implemented` test, or explicitly listed as `Not yet implemented` / `Retired`.
6. **When changing tests or ACs**, update:
   - The spec's **Acceptance criteria** table (if ACs changed).
   - The spec's **Tests** table row (if a test title, coverage, or status changed).
   - The spec's **Coverage** summary (if any AC became covered/uncovered).
   - The test title's bracketed AC IDs (if coverage changed).
7. Shared helpers/schemas for e2e tests live in `apps/example-client/src/e2e/_support.ts` (underscore prefix keeps it out of the `*.spec.ts` include glob).
8. The e2e vitest config runs spec files **sequentially** (`fileParallelism: false`) because they share a live NT server. Don't introduce parallelism-dependent tests.

See `apps/example-client/specs/README.md` for the canonical rulebook.
