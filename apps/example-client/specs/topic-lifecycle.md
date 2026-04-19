# Feature: Topic Lifecycle (unsubscribe / unpublish)

Subscribing and publishing both have cleanup paths. Unit tests verify the client clears its
local state and sends the right messenger frames, but only an end-to-end run against a real
server proves that cleanup actually takes effect server-side (the server stops delivering
updates, the publisher is released).

## User stories

- As a dashboard developer, after I call `unsubscribe`, I want the server to stop delivering
  updates for that topic so my callback is no longer invoked.
- As a dashboard developer, after I call `unpublish`, I want my client to no longer be the
  publisher, so subsequent `setValue` calls throw.
- As a dashboard developer, after I call `unsubscribeAll`, I want all subscribers on that topic
  to be removed in a single call.

## Acceptance criteria

| ID    | Description                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| LIF-1 | After `unsubscribe(subuid)`, the subscriber callback shall receive no further value updates for the topic.                          |
| LIF-2 | After `unsubscribeAll()`, every subscriber on the topic shall be removed and receive no further value updates.                      |
| LIF-3 | After `unpublish()`, the topic's `publisher` flag shall be `false`, `pubuid` shall be `undefined`, and `setValue` shall throw.      |
| LIF-4 | After `unpublish()`, a fresh `publish()` on the same topic shall succeed (new pubuid is allocated and the topic can be written to). |

## Tests

| Test                                                                                | Covers | Status      |
| ----------------------------------------------------------------------------------- | ------ | ----------- |
| `[LIF-1] unsubscribe stops further value updates`                                   | LIF-1  | Implemented |
| `[LIF-2] unsubscribeAll removes every subscriber and stops updates`                 | LIF-2  | Implemented |
| `[LIF-3] unpublish clears publisher state and causes setValue to throw`             | LIF-3  | Implemented |
| `[LIF-4] republish after unpublish allocates a new pubuid and accepts new setValue` | LIF-4  | Implemented |

## Coverage

All acceptance criteria (LIF-1…LIF-4) have at least one implemented test.
