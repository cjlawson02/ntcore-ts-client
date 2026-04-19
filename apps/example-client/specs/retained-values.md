# Feature: Retained Values & Connection Lifecycle

Values published with `retained: true` persist on the server and are re-delivered to clients that reconnect. The connection lifecycle API (`addRobotConnectionListener`, `changeURI`) supports reconnecting cleanly.

## User stories

- As a dashboard developer, I want my retained `AutoMode` selection to survive a brief network blip so operators don't lose state.
- As a dashboard developer, I want `changeURI` to cleanly disconnect from the old server and reconnect to the new one.
- As a dashboard developer, I want to be notified when the connection is (re)established so I can update UI.

## Acceptance criteria

| ID    | Description                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RET-1 | `publish({ retained: true })` followed by `setValue(v)` shall cause the server to retain `v` for future subscribers.                                          |
| RET-2 | After `nt.changeURI(uri, port)` and reconnection, retained values shall be re-delivered to a freshly created subscriber.                                      |
| RET-3 | `nt.addRobotConnectionListener(cb, true)` shall fire with `connected=true` once the initial or reestablished connection is up, within the connection timeout. |

## Tests

| Test                                                                   | Covers              | Status      |
| ---------------------------------------------------------------------- | ------------------- | ----------- |
| `[RET-1, RET-2, RET-3] retained AutoMode survives changeURI reconnect` | RET-1, RET-2, RET-3 | Implemented |

## Coverage

All acceptance criteria (RET-1…RET-3) have at least one implemented test.
