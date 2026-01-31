# @ntcore/react

React bindings for [@ntcore/client](https://github.com/robototes/ntcore-ts) (NetworkTables for FRC). Provides a context provider and hooks so components can subscribe to topics and connection status without managing lifecycle by hand.

Requires **React 18+** and **@ntcore/client**.

## Installation

```bash
npm install @ntcore/react @ntcore/client react react-dom
```

## Usage

Wrap your app with `NtcoreProvider` (by team number or URI), then use hooks in descendants.

```tsx
import { NtcoreProvider, useTopic, useConnectionStatus, NetworkTablesTypeInfos } from '@ntcore/react';

// By team number (e.g. 973 → roborio-973-frc.local)
function App() {
  return (
    <NtcoreProvider team={973} port={5810}>
      <Dashboard />
    </NtcoreProvider>
  );
}

// Or by URI (e.g. localhost for simulation)
function AppLocal() {
  return (
    <NtcoreProvider uri="localhost" port={5810}>
      <Dashboard />
    </NtcoreProvider>
  );
}

function Dashboard() {
  const { connected, rtt } = useConnectionStatus();
  const [gyro] = useTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);

  return (
    <div>
      <p>Robot: {connected ? 'Connected' : 'Disconnected'}</p>
      {connected && rtt >= 0 && <p>RTT: {rtt} ms</p>}
      <p>Gyro: {gyro ?? '—'}</p>
    </div>
  );
}
```

### Publishing to a topic

To publish (write) a topic, pass `publishOptions` (e.g. `{ retained: true }`). The hook returns `[value, setValue, canPublish]`. **Only call `setValue` when `canPublish` is true** (after the server has acknowledged the publish); otherwise the client will throw.

```tsx
const [value, setValue, canPublish] = useTopic<string>(
  '/MyTable/AutoMode',
  NetworkTablesTypeInfos.kString,
  'Default',
  undefined,
  { retained: true }
);

// Guard writes until we can publish
const handleChange = (newValue: string) => {
  if (canPublish && setValue) setValue(newValue);
};
```

### Prefix and Protobuf topics

- **`usePrefixTopic(prefix, subscribeOptions?)`** – Subscribes to all topics under a prefix. Returns the latest `PrefixTopicUpdate | null` (subscribe-only).
- **`useProtobufTopic<T>(name, options?)`** – Subscribes to a protobuf topic. Options: `defaultValue`, `validator` (Zod schema), `protoFilePath`, `subscribeOptions`, `publishOptions`. Returns `[value, setValue, canPublish]` like `useTopic`; only call `setValue` when `canPublish` is true.

### Advanced: raw client access

For `changeURI`, log level, or other client APIs, use `useNtcore()`. Returns the `NetworkTables` instance or `null` outside a provider.

```tsx
const nt = useNtcore();
if (nt) {
  nt.changeURI('roborio-973-frc.local');
  NetworkTables.setLogLevel(LogLevel.debug);
}
```

## API

- **`NtcoreProvider`** – Props: `team?: number` | `uri: string`, and optional `port` (default `5810`). Provides a single NetworkTables instance to the tree.
- **`useNtcore()`** – Returns the `NetworkTables` instance from context, or `null` when used outside a provider.
- **`useTopic<T>(name, typeInfo, defaultValue?, subscribeOptions?, publishOptions?)`** – Subscribes to a topic. Returns `[value, setValue, canPublish]`. Unsubscribes on unmount. Only call `setValue` when `canPublish` is true (pass `publishOptions` to publish from this client).
- **`usePrefixTopic(prefix, subscribeOptions?)`** – Subscribes to all topics under a prefix. Returns `PrefixTopicUpdate | null` (subscribe-only).
- **`useProtobufTopic<T>(name, options?)`** – Subscribes to a protobuf topic. Returns `[value, setValue, canPublish]`; only call `setValue` when `canPublish` is true if using `publishOptions`.
- **`useConnectionStatus()`** – Returns `{ connected: boolean, rtt: number }`. `rtt` is round-trip time in ms (-1 when not connected or not yet measured). The client auto-reconnects after disconnect.

Re-exports from @ntcore/client: `NetworkTablesTypeInfos`, and types `NetworkTablesTypeInfo`, `NetworkTablesTypes`, `SubscribeOptions`, `TopicProperties`.

## Running unit tests

Run `nx test @ntcore/react` to execute the unit tests via [Vitest](https://vitest.dev/).
