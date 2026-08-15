# Feature: Topic Publishing (client → robot)

The client can publish values to topics that a NetworkTables server (or other subscribers) will consume, including struct values and arrays of structs. Published values round-trip correctly through a server echo.

## User stories

- As a dashboard developer, I want to publish a `Pose2d` struct from the client to the robot.
- As a dashboard developer, I want to publish arrays of structs (e.g. `Translation2d[]` waypoints) and read them back locally.
- As a dashboard developer, I want the server to observe my published values so that it can echo or react to them.

## Acceptance criteria

| ID    | Description                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| PUB-1 | The client shall publish struct-encoded values via `getStructTopic(...).publish({ retained: true })` + `setValue(value)`.                |
| PUB-2 | Values published by the client shall be consumed by the server and visible to other subscribers (verified via an echo topic).            |
| PUB-3 | The client shall publish arrays of struct values (e.g. `Translation2d[]`) via `getStructTopic` with an array `typeName`.                 |
| PUB-4 | Published values shall be retrievable locally via `getValue()` immediately after `setValue(...)`, without requiring a server round-trip. |
| PUB-5 | Struct array topics shall have a `typeInfo[1]` NT type string of `struct:<TypeName>[]`.                                                  |

## Tests

| Test                                                                                                              | Covers              | Status      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------- | ----------- |
| `[PUB-1, PUB-2] publishes Pose2d struct and server echoes it back to PoseStructEcho`                              | PUB-1, PUB-2        | Implemented |
| `[PUB-3, PUB-4, PUB-5] publishes Translation2d[] struct array with correct typeInfo and round-trips via getValue` | PUB-3, PUB-4, PUB-5 | Implemented |

## Coverage

All acceptance criteria (PUB-1…PUB-5) have at least one implemented test.
