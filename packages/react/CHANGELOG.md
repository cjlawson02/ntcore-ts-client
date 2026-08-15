# Changelog

## @ntcore-ts/react-v1.0.0

First stable release of `@ntcore-ts/react` — React bindings for `@ntcore-ts/client`. Hooks throw outside `NtcoreProvider`, struct/protobuf APIs match the client factories, and writer hooks unpublish on unmount by default.

### Hooks

- **`useTopic`** — subscribe to a NetworkTables topic and get the latest value as React state. Supports optional publishing with `publish: true` or `publish: { retained: true }`, with `isReadyToWrite` guard. For JSON, pass `NetworkTablesTypeInfos.kJson` with an object `T` (uses `getJsonTopic`).
- **`useProtobufTopic`** — subscribe to a protobuf-encoded topic with automatic decoding. Supports optional zod validation, `protoFilePath` (Node), `protoSource` / `messageType` (browser), and publishing.
- **`useStructTopic(name, Pose2d)`** or **`useStructTopic<T>(name, options?)`** — subscribe to a WPILib struct-encoded topic. Prefer a geometry descriptor from `@ntcore-ts/client`. Options: `typeName`, `schema`, `defaultValue`, `validator`, `subscribeOptions`, `publish`, `unpublishOnUnmount`.
- **`usePrefixTopic`** — subscribe to all topics under a prefix and get the latest single update `{ name, value, type } | null`.
- **`usePrefixTopicMap`** — subscribe to all topics under a prefix and get a map of topic name → `{ value, type }`. Updates are batched with `requestAnimationFrame`.
- **`useConnectionStatus`** — returns `{ connected, connecting, rtt }` with live robot connection state. `connecting` reflects auto-reconnect while disconnected; `rtt` is −1 when not connected.

### Components

- **`NtcoreProvider`** — context provider. Accepts `team` (number) or `uri` (string) with optional `port`. Validates port at render time. Changing `team` / `uri` / `port` switches the singleton; the previous instance is released and closed when no provider still retains it.
- **`useNtcore`** — returns the `NetworkTables` instance from the nearest `NtcoreProvider`. **Throws** when used outside a provider.

### Publishing

- Pass `publish: true` or `publish: { retained: true }` to become the publisher. Only call `setValue` when `isReadyToWrite` is true.
- Writer hooks call `topic.unpublish()` on unmount by default. Set `unpublishOnUnmount: false` to remain publisher after unmount.
- Unmount waits for an in-flight `publish()` and skips `unpublish()` when `pubuid` is null so remounts cannot steal the publisher.

### Re-exports

- Re-exports `NetworkTables`, `NetworkTablesTypeInfos`, `LogLevel`, and types `NetworkTablesTypeInfo`, `NetworkTablesTypes`, `SubscribeOptions`, `TopicProperties` from `@ntcore-ts/client`.
- Geometry types (`Pose2d`, `Pose2dSchema`, …) are imported from `@ntcore-ts/client`, not from this package.
