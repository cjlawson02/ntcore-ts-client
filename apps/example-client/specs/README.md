# example-client Specs

This folder contains **feature specs** for the `@ntcore-ts/client` library as exercised end-to-end against a real NetworkTables server (the `example-robot` app). Each spec defines a feature, its user stories, acceptance criteria (AC), and a table of tests that cover those acceptance criteria.

## Layout

| Spec                                                   | E2E file                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`topic-subscription.md`](./topic-subscription.md)     | [`../src/e2e/topic-subscription.spec.ts`](../src/e2e/topic-subscription.spec.ts)     |
| [`topic-publishing.md`](./topic-publishing.md)         | [`../src/e2e/topic-publishing.spec.ts`](../src/e2e/topic-publishing.spec.ts)         |
| [`prefix-topics.md`](./prefix-topics.md)               | [`../src/e2e/prefix-topics.spec.ts`](../src/e2e/prefix-topics.spec.ts)               |
| [`struct-topic-options.md`](./struct-topic-options.md) | [`../src/e2e/struct-topic-options.spec.ts`](../src/e2e/struct-topic-options.spec.ts) |
| [`retained-values.md`](./retained-values.md)           | [`../src/e2e/retained-values.spec.ts`](../src/e2e/retained-values.spec.ts)           |
| [`topic-lifecycle.md`](./topic-lifecycle.md)           | [`../src/e2e/topic-lifecycle.spec.ts`](../src/e2e/topic-lifecycle.spec.ts)           |
| [`custom-struct-schema.md`](./custom-struct-schema.md) | [`../src/e2e/custom-struct-schema.spec.ts`](../src/e2e/custom-struct-schema.spec.ts) |

## Spec template

Every spec file MUST follow this shape:

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

## Rules (MUST follow)

1. **AC IDs are stable.** Once an AC is published with an ID like `SUB-1`, its ID never changes. If the behaviour is removed, mark the ID as `Retired` rather than reusing it.
2. **Every test name starts with its AC IDs in square brackets.** Example: `[SUB-1] receives kDouble Gyro value from server`. Multiple ACs are comma-separated: `[PUB-1, PUB-2] ...`.
3. **Specs and tests stay in sync.** When you change one, you MUST change the other in the same PR:
   - Adding an AC → add (or update) at least one test that covers it (or mark it `Not yet implemented` in the Tests table).
   - Adding a test → reference the AC IDs it covers in its title AND add a row to the spec's **Tests** table.
   - Renaming a test → update the spec's **Tests** table row.
   - Removing a test → remove the row; if the AC is no longer covered, update **Coverage** accordingly.
4. **Every AC must appear in the Tests table.** Either covered by at least one `Implemented` test, or explicitly listed as `Not yet implemented` / `Retired`.
5. **Every test file maps 1:1 to a spec file.** One spec = one `*.spec.ts` under `src/e2e/`. If a new major feature is added, create a new spec + a new `*.spec.ts`.

## Running the tests

These tests require a live NT server on `localhost:5810`. Run them end-to-end (starts the robot, waits for it, then runs the e2e suite):

```bash
nx run example-client:e2e:local
```

Or, if you already have a robot running, just:

```bash
nx run example-client:e2e
```
