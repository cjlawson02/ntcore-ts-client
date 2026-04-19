# Changelog

## 1.0.0

Initial release of `@ntcore-ts/react` — React bindings for `@ntcore-ts/client`.

### Hooks

- **`useTopic`** — subscribe to a NetworkTables topic and get the latest value as React state. Supports optional publishing with `publish: true` or `publish: { retained: true }`, with `isReadyToWrite` guard.
- **`useProtobufTopic`** — subscribe to a protobuf-encoded topic with automatic decoding. Supports optional zod validation, `.proto` file path for schema registration, and publishing.
- **`useStructTopic`** — subscribe to a WPILib struct-encoded topic (`Pose2d`, `Rotation2d`, etc.) with automatic decoding. Supports optional zod validation, schema string, and publishing.
- **`usePrefixTopic`** — subscribe to all topics under a prefix and get the latest single update. Useful for "react to any change under prefix" patterns.
- **`usePrefixTopicMap`** — subscribe to all topics under a prefix and get a `Record<string, value>` map of every topic. Updates are batched with `requestAnimationFrame` to handle rapid announcements efficiently.
- **`useConnectionStatus`** — returns `{ connected, rtt }` with live robot connection state and round-trip time polling.

### Components

- **`NtcoreProvider`** — context provider that creates a `NetworkTables` instance for the component tree. Accepts `team` (number) or `uri` (string) with optional `port`. Validates port at render time.
- **`useNtcore`** — returns the `NetworkTables` instance from the nearest `NtcoreProvider`, or `null` if outside a provider.

### Re-exports

- Re-exports `NetworkTablesTypeInfos`, `NetworkTablesTypeInfo`, `NetworkTablesTypes`, `SubscribeOptions`, and `TopicProperties` from `@ntcore-ts/client` for convenience.
