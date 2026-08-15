# Feature: Topic Subscription (robot → client)

The client can subscribe to topics published by a NetworkTables server and receive decoded
values for every supported wire type: scalar primitives (`kBoolean`, `kDouble`, `kInteger`,
`kFloat`), arrays (`kBooleanArray`, `kDoubleArray`, `kIntegerArray`, `kFloatArray`,
`kStringArray`), and structured payloads (protobuf, struct).

Unit tests cover the zod schemas and `NetworkTablesTypeInfos.validateData` for each type locally,
but only end-to-end delivery through a real WPILib ntcore server proves that the client's
msgpack encode/decode path round-trips correctly for every concrete wire type.

## User stories

- As a dashboard developer, I want to subscribe to robot scalar values (e.g. gyro angle,
  boolean flags, integer counters) and receive live updates of the correct JS type.
- As a dashboard developer, I want to subscribe to array-valued topics and receive a JS array
  of correctly-typed elements.
- As a dashboard developer, I want to subscribe to protobuf-encoded messages (e.g. `Pose2d`)
  and receive decoded, typed objects.
- As a dashboard developer, I want to subscribe to struct-encoded messages and receive typed
  objects via a Zod validator.

## Acceptance criteria

| ID     | Description                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| SUB-1  | The client shall receive scalar `kDouble` values via `getDoubleTopic` + `subscribe` from a server that is publishing the topic. |
| SUB-2  | The client shall receive protobuf-encoded values via `getProtobufTopic` + `subscribe`, automatically decoded to typed objects.  |
| SUB-3  | The client shall receive struct-encoded values via `getStructTopic` + `subscribe`, automatically decoded to typed objects.      |
| SUB-4  | Decoded protobuf and struct values shall pass a supplied Zod validator before being delivered to subscribers.                   |
| SUB-5  | The client shall receive scalar `kBoolean` values via `getBooleanTopic` + `subscribe`, delivered as JS `boolean`.               |
| SUB-6  | The client shall receive scalar `kInteger` values via `getIntegerTopic` + `subscribe`, delivered as a JS integer `number`.      |
| SUB-7  | The client shall receive scalar `kFloat` values via `getFloatTopic` + `subscribe`, delivered as a finite JS `number`.           |
| SUB-8  | The client shall receive `kBooleanArray` values via `getBooleanArrayTopic` + `subscribe`, delivered as `boolean[]`.             |
| SUB-9  | The client shall receive `kDoubleArray` values via `getDoubleArrayTopic` + `subscribe`, delivered as `number[]`.                |
| SUB-10 | The client shall receive `kIntegerArray` values via `getIntegerArrayTopic` + `subscribe`, delivered as an integer `number[]`.   |
| SUB-11 | The client shall receive `kFloatArray` values via `getFloatArrayTopic` + `subscribe`, delivered as a finite `number[]`.         |
| SUB-12 | The client shall receive `kStringArray` values via `getStringArrayTopic` + `subscribe`, delivered as `string[]`.                |

## Tests

| Test                                                                       | Covers       | Status      |
| -------------------------------------------------------------------------- | ------------ | ----------- |
| `[SUB-1] receives kDouble Gyro value from server`                          | SUB-1        | Implemented |
| `[SUB-2, SUB-4] receives Pose2d via getProtobufTopic and validates schema` | SUB-2, SUB-4 | Implemented |
| `[SUB-3, SUB-4] receives Pose2d via getStructTopic and validates schema`   | SUB-3, SUB-4 | Implemented |
| `[SUB-5] receives kBoolean value from server`                              | SUB-5        | Implemented |
| `[SUB-6] receives kInteger value from server`                              | SUB-6        | Implemented |
| `[SUB-7] receives kFloat value from server`                                | SUB-7        | Implemented |
| `[SUB-8] receives kBooleanArray value from server`                         | SUB-8        | Implemented |
| `[SUB-9] receives kDoubleArray value from server`                          | SUB-9        | Implemented |
| `[SUB-10] receives kIntegerArray value from server`                        | SUB-10       | Implemented |
| `[SUB-11] receives kFloatArray value from server`                          | SUB-11       | Implemented |
| `[SUB-12] receives kStringArray value from server`                         | SUB-12       | Implemented |

## Coverage

All acceptance criteria (SUB-1…SUB-12) have at least one implemented test. Scalar `kString`
subscription is intentionally covered end-to-end by `prefix-topics.md` (PFX-3) rather than a
dedicated SUB-\* test, since the robot exposes string topics only via prefix-subscribed tables.
