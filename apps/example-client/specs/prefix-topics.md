# Feature: Prefix Topics

The client can subscribe to a name prefix and receive values from every topic whose name starts with that prefix, along with per-topic metadata (name, type, id). This enables "wildcard" dashboards without having to pre-declare each topic.

## User stories

- As a dashboard developer, I want to subscribe to `/MyTable/Accelerometer/` once and receive values for `X` and `Y` sub-topics as they appear.
- As a dashboard developer, I want to know which topic a value came from inside the prefix callback so I can route it correctly.
- As a dashboard developer, I want to keep publishing scalars (e.g. `AutoMode`) while a prefix subscription is active.

## Acceptance criteria

| ID    | Description                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PFX-1 | `getPrefixTopic(prefix)` + `subscribe(cb)` shall deliver values for every topic whose name starts with `prefix`.                                                              |
| PFX-2 | The prefix subscription callback shall receive the matched topic name in its `params.name` argument so callers can distinguish sub-topics.                                    |
| PFX-3 | A scalar topic (e.g. `/MyTable/AutoMode`) published by the client shall be readable via a fresh `getStringTopic(...).subscribe(...)` while the prefix subscription is active. |

## Tests

| Test                                                                                    | Covers       | Status      |
| --------------------------------------------------------------------------------------- | ------------ | ----------- |
| `[PFX-1, PFX-2] receives /MyTable/Accelerometer/{X,Y} via a single prefix subscription` | PFX-1, PFX-2 | Implemented |
| `[PFX-3] publishes /MyTable/AutoMode and reads it back via a separate subscription`     | PFX-3        | Implemented |

## Coverage

All acceptance criteria (PFX-1…PFX-3) have at least one implemented test.
