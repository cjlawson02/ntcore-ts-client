# @ntcore-ts/react

React bindings for [@ntcore-ts/client](https://github.com/robototes/ntcore-ts) (NetworkTables for FRC). Provides a context provider and hooks so components can subscribe to topics and connection status without managing lifecycle by hand.

Requires **React 18+** and **@ntcore-ts/client**.

## Installation

```bash
npm install @ntcore-ts/react @ntcore-ts/client react react-dom
```

## Usage

Wrap your app with `NtcoreProvider` (by team number or URI), then use hooks in descendants.

```tsx
import { NtcoreProvider, useTopic, useConnectionStatus, NetworkTablesTypeInfos } from '@ntcore-ts/react';

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
  const { value: gyro } = useTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);

  return (
    <div>
      <p>Robot: {connected ? 'Connected' : 'Disconnected'}</p>
      {connected && rtt >= 0 && <p>RTT: {rtt} ms</p>}
      <p>Gyro: {gyro ?? '—'}</p>
    </div>
  );
}
```

### Reading vs writing

- **Reading a topic** — Omit `publish` in options. You get `{ value, setValue: undefined, isReadyToWrite: false }`. Use `value` to display robot data.
- **Writing a topic** — Pass `publish: true` or `publish: { retained: true }` (etc.) in options to **make this client the publisher**. You get `{ value, setValue, isReadyToWrite }`. Only call `setValue` when `isReadyToWrite` is true (after the server has acknowledged); otherwise the client can throw.

### Publishing to a topic

To **make this client the publisher** so you can write to a topic:

- **`publish: true`** — Become the publisher with default properties (not retained). Use when you just want to send values.
- **`publish: { retained: true }`** — Become the publisher with `retained` (topic is not deleted when the last publisher stops).

Always wait for `isReadyToWrite` before calling `setValue`.

```tsx
const { value, setValue, isReadyToWrite } = useTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, {
  defaultValue: 'Default',
  publish: true, // make me the publisher (default properties)
});

// Only call setValue once the server has acknowledged
const handleChange = (newValue: string) => {
  if (isReadyToWrite && setValue) setValue(newValue);
};
```

With retained topic:

```tsx
const { value, setValue, isReadyToWrite } = useTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, {
  defaultValue: 'Default',
  publish: { retained: true },
});
```

### Prefix and Protobuf topics

Subscribe to **all topics under a path** (prefix) with one of two hooks:

- **`usePrefixTopic(prefix, subscribeOptions?)`** – Returns only the **latest** single update `{ name, value } | null`. Use when you need to react to “something under this prefix changed” (e.g. trigger a refetch, show “last activity”) without keeping a full list. Rapid updates overwrite; you only see the most recent.
- **`usePrefixTopicMap(prefix, subscribeOptions?)`** – Returns a **map** of every topic name → value under the prefix, batched so rapid announcements all appear. Use when you need to list or iterate over all topics (e.g. an “all topics” table). Prefer this when in doubt.

Prefix topics are subscribe-only (no publish).

- **`useProtobufTopic<T>(name, options?)`** – Subscribes to a protobuf topic. Options: `defaultValue`, `validator` (Zod schema), `protoFilePath`, `subscribeOptions`, `publish`. Returns `{ value, setValue, isReadyToWrite }` like `useTopic`; when using `publish`, only call `setValue` when `isReadyToWrite` is true.

### Recommended connection UX

For dashboards used at the field, a good pattern is:

- **Connection overlay** — When disconnected, show a full-screen “Connect to the robot” overlay instead of a broken or empty UI.
- **Manual connect** — Let the user enter server address and port (e.g. from `nt.getURI()` and `nt.getPort()`), then call `nt.changeURI(uri, port)` on submit so they can switch robot or fix the address without restarting.
- **Escape to dismiss** — Call `nt.stopAutoConnect()` when the user presses Escape so the overlay closes and the client stops auto-reconnecting (e.g. to use the app offline). Use `useConnectionStatus()` so the overlay only re-opens when connected again unless the user explicitly dismissed it.
- **Help** — Provide a “Need help?” link or button that opens a short connection guide (e.g. connect to robot network, set server address, default port 5810).

See the **example-react** app in this repo for a full `ConnectionBackdrop` + `HelpDialog` implementation wired with `useConnectionStatus()` and `useNtcore()`.

### Advanced: raw client access

For manual connection, log level, or other client APIs, use `useNtcore()`. Returns the `NetworkTables` instance or `null` when used outside a provider.

```tsx
const nt = useNtcore();
if (nt) {
  // Manual connect form: pre-fill from nt.getURI(), nt.getPort(); on submit call nt.changeURI(uri, port)
  nt.changeURI('roborio-973-frc.local', 5810);

  // Dismiss connection overlay and stop auto-reconnect (e.g. on Escape)
  nt.stopAutoConnect();
  // Resume auto-reconnect later if needed
  nt.startAutoConnect();

  NetworkTables.setLogLevel(LogLevel.debug);
}
```

## API

- **`NtcoreProvider`** – Props: `team?: number` | `uri: string`, and optional `port` (default `5810`). Provides a single NetworkTables instance to the tree.
- **`useNtcore()`** – Returns the `NetworkTables` instance from context, or `null` when used outside a provider.
- **`useTopic<T>(name, typeInfo, options?)`** – Subscribes to a topic. Returns `{ value, setValue, isReadyToWrite }`. Unsubscribes on unmount. Options: `defaultValue`, `subscribeOptions`, `publish` (`true` or `TopicProperties`). When you pass `publish`, only call `setValue` when `isReadyToWrite` is true.
- **`usePrefixTopic(prefix, subscribeOptions?)`** – Subscribes to all topics under a prefix. Returns only the **latest** update `PrefixTopicUpdate | null` (subscribe-only). For a map of all topics, use `usePrefixTopicMap`.
- **`usePrefixTopicMap(prefix, subscribeOptions?)`** – Subscribes to all topics under a prefix. Returns a map of topic name → value, or `null` when outside provider (subscribe-only). Use for listing or iterating over all topics under a prefix.
- **`useProtobufTopic<T>(name, options?)`** – Subscribes to a protobuf topic. Returns `{ value, setValue, isReadyToWrite }`; when using `publish`, only call `setValue` when `isReadyToWrite` is true.
- **`useConnectionStatus()`** – Returns `{ connected: boolean, rtt: number }`. `rtt` is round-trip time in ms (-1 when not connected or not yet measured). The client auto-reconnects after disconnect.

When using `useNtcore()`, the client exposes `getURI()`, `getPort()`, `changeURI(uri, port)`, `stopAutoConnect()`, and `startAutoConnect()` for connection-overlay UX (see Recommended connection UX above).

Re-exports from @ntcore-ts/client: `NetworkTablesTypeInfos`, and types `NetworkTablesTypeInfo`, `NetworkTablesTypes`, `SubscribeOptions`, `TopicProperties`.

## Running unit tests

Run `nx test react` to execute the unit tests via [Vitest](https://vitest.dev/).
