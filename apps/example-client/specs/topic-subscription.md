# Feature: Topic Subscription (robot → client)

The client can subscribe to topics published by a NetworkTables server and receive decoded values for scalar, protobuf, and struct-encoded messages.

## User stories

- As a dashboard developer, I want to subscribe to robot scalar values (e.g. gyro angle) and receive live updates.
- As a dashboard developer, I want to subscribe to protobuf-encoded messages (e.g. `Pose2d`) and receive decoded, typed objects.
- As a dashboard developer, I want to subscribe to struct-encoded messages and receive typed objects via a Zod validator.

## Acceptance criteria

| ID    | Description                                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| SUB-1 | The client shall receive scalar `kDouble` values via `createTopic` + `subscribe` from a server that is publishing the topic.      |
| SUB-2 | The client shall receive protobuf-encoded values via `createProtobufTopic` + `subscribe`, automatically decoded to typed objects. |
| SUB-3 | The client shall receive struct-encoded values via `createStructTopic` + `subscribe`, automatically decoded to typed objects.     |
| SUB-4 | Decoded protobuf and struct values shall pass a supplied Zod validator before being delivered to subscribers.                     |

## Tests

| Test                                                                          | Covers       | Status      |
| ----------------------------------------------------------------------------- | ------------ | ----------- |
| `[SUB-1] receives kDouble Gyro value from server`                             | SUB-1        | Implemented |
| `[SUB-2, SUB-4] receives Pose2d via createProtobufTopic and validates schema` | SUB-2, SUB-4 | Implemented |
| `[SUB-3, SUB-4] receives Pose2d via createStructTopic and validates schema`   | SUB-3, SUB-4 | Implemented |

## Coverage

All acceptance criteria (SUB-1…SUB-4) have at least one implemented test.
