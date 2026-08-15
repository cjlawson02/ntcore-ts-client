# Feature: Struct Topic Options

`getStructTopic` provides consistent caching and option-merging semantics so that multiple parts of an application can request the "same" topic without fighting over configuration.

## User stories

- As a library user, I want multiple calls to `getStructTopic(name, ...)` with the same name to return the same topic instance so subscribers and publishers agree on a single underlying topic.
- As a library user, I want later calls to merge new options (`schema`, `defaultValue`, etc.) into the cached topic so I can refine configuration without having to restructure my code.

## Acceptance criteria

| ID    | Description                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| STR-1 | Calling `getStructTopic(name, opts)` twice with the same `name` shall return the same topic instance.                        |
| STR-2 | A subsequent call with additional options (e.g. `schema`, `defaultValue`) shall merge those options into the cached topic.   |
| STR-3 | When `defaultValue` is supplied and no other value has been produced, `getValue()` shall return the supplied `defaultValue`. |

## Tests

| Test                                                                                 | Covers              | Status      |
| ------------------------------------------------------------------------------------ | ------------------- | ----------- |
| `[STR-1, STR-2, STR-3] getStructTopic reuse applies options (schema + defaultValue)` | STR-1, STR-2, STR-3 | Implemented |

## Coverage

All acceptance criteria (STR-1…STR-3) have at least one implemented test.
