# ntcore-ts

A TypeScript library for communication over [WPILib's NetworkTables 4.1 protocol](https://github.com/wpilibsuite/allwpilib/blob/main/ntcore/doc/networktables4.adoc).

## Features

- NodeJS and DOM support
- Togglable auto-reconnect
- Callbacks for new data on subscriptions
- Callbacks for connection listeners
- Wildcard prefix listeners for multiple topics
- Protobuf support with optional type generation and Zod validation
- Struct support for WPILib types (`getStructTopic(name, Pose2d)`, `useStructTopic(name, Pose2d)`)
- Retrying for messages queued during a connection loss
- On-the-fly server switching with resubscribing and republishing
- Generic types for Topics
- Client-side data validation using [Zod](https://github.com/colinhacks/zod)
- Server-matching timestamping using RTT calculation
- Granular logging with configurable log levels per module

## Documentation

TypeDocs are available at [https://ntcore.chrislawson.dev](https://ntcore.chrislawson.dev)

## Quick Start

This section will help get you started with sending and receiving data over NetworkTables

### Installation

`npm install --save @ntcore-ts/client`

[Zod](https://github.com/colinhacks/zod) v4 is a dependency of the client. Install it in your app only if you write custom validators (`npm install zod@^4`).

### Connecting to the NetworkTables Server

The NetworkTables class is instance-based, but allows for connections to multiple teams/URIs.

### Importing `NetworkTables`

Use this at the top of your file:

```typescript
import { NetworkTables } from '@ntcore-ts/client';
```

### With Team Number

Use this function:

```typescript
NetworkTables.getInstanceByTeam(team: number, port = 5810)
```

> This creates the instance using the team number. Connects to `roborio-<team>-frc.local`

### With URI

Use this function:

```typescript
NetworkTables.getInstanceByURI(uri: string, port?)
```

> This creates the instance using a custom URI, i.e. 127.0.0.1, localhost, google.com, etc.

### Closing the client

Call `ntcore.close()` to disconnect, unsubscribe/unpublish, and drop the singleton so it does not leak. In the browser the client also registers a `beforeunload` listener (it does not overwrite `window.onbeforeunload`).

### Publishing and Subscribing to a Topic

Prefer the typed factories (`getDoubleTopic`, `getStringTopic`, …). `createTopic(name, typeInfo, defaultValue?)` remains for cases where the type is not known until runtime.

```typescript
getDoubleTopic(name: string, defaultValue?: number)
getStringTopic(name: string, defaultValue?: string)
getBooleanTopic(name: string, defaultValue?: boolean)
getIntegerTopic(name: string, defaultValue?: number)
getFloatTopic(name: string, defaultValue?: number)
getBooleanArrayTopic(name: string, defaultValue?: boolean[])
getDoubleArrayTopic(name: string, defaultValue?: number[])
getIntegerArrayTopic(name: string, defaultValue?: number[])
getFloatArrayTopic(name: string, defaultValue?: number[])
getStringArrayTopic(name: string, defaultValue?: string[])
getRawTopic(name: string, defaultValue?: Uint8Array)
getJsonTopic<T extends object>(name: string, defaultValue?: T, options?: { validator?: ZodSchema<T> })
```

Once a topic has been created, subscribe with:

```typescript
subscribe(
  callback: (value: T | null, params: AnnounceMessageParams) => void,
  options?: SubscribeOptions
)
```

and/or publish with:

```typescript
await publish(properties: TopicProperties = {})
```

For example, here's a subscription for a Gyro:

```typescript
import { NetworkTables } from '@ntcore-ts/client';

const ntcore = NetworkTables.getInstanceByTeam(973);

const gyroTopic = ntcore.getDoubleTopic('/MyTable/Gyro');

gyroTopic.subscribe((value) => {
  console.log(`Got Gyro Value: ${value}`);
});

gyroTopic.subscribe((value, params) => {
  console.log(`Got Gyro Value: ${value} at from topic id ${params.id}`);
});
```

Or a publisher for an auto mode:

```typescript
import { NetworkTables } from '@ntcore-ts/client';

const ntcore = NetworkTables.getInstanceByTeam(973);

const autoModeTopic = ntcore.getStringTopic('/MyTable/AutoMode', 'No Auto');

await autoModeTopic.publish();

autoModeTopic.setValue('25 Ball Auto and Climb');
```

### Subscribing to Multiple Topics

You can also subscribe to multiple topics by using a "wildcard" through creating a prefix topic.

For example, here's a subscription for an Accelerometer with topics `/MyTable/Accelerometer/X`, `/MyTable/Accelerometer/Y`, and `/MyTable/Accelerometer/Z`:

```typescript
import { NetworkTables } from '@ntcore-ts/client';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByTeam(973);

// Create the accelerometer prefix topic
const accelerometerTopic = ntcore.getPrefixTopic('/MyTable/Accelerometer/');

let x, y, z;

// Subscribe to all topics under the prefix /MyTable/Accelerometer/
accelerometerTopic.subscribe((value, params) => {
  console.log(`Got Accelerometer Value: ${value} from topic ${params.name}`); // i.e. Got Accelerometer Value: 9.81 from topic /MyTable/Accelerometer/Y

  // You can also use the topic name to determine which value to set
  if (params.name.endsWith('X')) {
    x = value;
  } else if (params.name.endsWith('Y')) {
    y = value;
  } else if (params.name.endsWith('Z')) {
    z = value;
  }

  // Since there can be many types in subtopics,
  // you can use the type information for other checks...
  if (params.type === 'int') {
    console.warn('Hmm... the accelerometer seems low precision');
  } else if (params.type === 'double') {
    console.log('The accelerometer is high precision');
  }
});

// x, y, and z will be updated as new values come in
```

### Protobuf Topics

For custom message types using [Protocol Buffers](https://protobuf.dev/), use `getProtobufTopic`. The library fetches the schema from NetworkTables and can decode values in subscriber callbacks. For type-safe decoding, pass a [Zod](https://github.com/colinhacks/zod) schema as a runtime validator.

**Subscribing to a protobuf topic** (e.g. a topic announced by the robot with a known shape):

```typescript
import { NetworkTables, Pose2d, Pose2dSchema } from '@ntcore-ts/client';

const ntcore = NetworkTables.getInstanceByTeam(973);

const poseTopic = ntcore.getProtobufTopic<Pose2d>('/MyTable/Pose', {
  validator: Pose2dSchema,
});
poseTopic.subscribe((value) => {
  console.log(`Pose: x=${value?.translation.x}, y=${value?.translation.y}`);
});
```

**Publishing to a protobuf topic** (so the client can encode and register the schema):

- `protoFilePath` — path to a `.proto` file. **Node.js only** (uses the filesystem).
- `protoSource` — contents of a `.proto` file, parsed in memory. **Safe in the browser.**
- `messageType` — a prebuilt protobufjs `Type`. **Safe in the browser.**

```typescript
import * as path from 'path';
import { NetworkTables } from '@ntcore-ts/client';

const ntcore = NetworkTables.getInstanceByURI('localhost');

const sensorTopic = ntcore.getProtobufTopic<{ timestamp: number; value: number }>('/MyTable/Sensor', {
  protoFilePath: path.join(__dirname, 'sensor.proto'),
  // Browser: protoSource: protoText, or messageType: myType,
});

await sensorTopic.publish();
sensorTopic.setValue({ timestamp: Date.now(), value: 42.5 });
```

### Struct Topics

For WPILib struct types over NetworkTables, use `getStructTopic(name, Pose2d)`. Structs use fixed-size binary serialization and interoperate with WPILib Java and C++ clients. Geometry types (`Pose2d`, `Translation2d`, …) and matching Zod schemas are exported from `@ntcore-ts/client`.

**Built-in struct types:** Translation2d, Rotation2d, Pose2d, Transform2d, Twist2d, Translation3d, Quaternion, Rotation3d, Pose3d, Transform3d, Twist3d.

**Subscribing to a struct topic** (e.g., a topic announced by the robot):

```typescript
import { NetworkTables, Pose2d } from '@ntcore-ts/client';

const ntcore = NetworkTables.getInstanceByTeam(973);

const poseTopic = ntcore.getStructTopic('/MyTable/PoseStruct', Pose2d);
poseTopic.subscribe((value) => {
  console.log(`Pose: x=${value?.translation.x}, y=${value?.translation.y}`);
});
```

**Publishing to a struct topic** (with custom schema for types not built-in):

```typescript
const customTopic = ntcore.getStructTopic<{ x: number; y: number }>('/MyTable/Custom2d', {
  typeName: 'Custom2d',
  schema: 'double x;double y',
});

await customTopic.publish();
customTopic.setValue({ x: 1.5, y: -2.0 });
```

**Array of structs:** Use `typeName: 'Translation2d[]'` (or `Pose2d[]`, etc.) for topics that publish arrays of structs.

**React:** Use `useStructTopic` from `@ntcore-ts/react` for subscribing and optionally publishing struct topics in React components.

> **Note:** Struct fields using `int64` or `uint64` are returned as JavaScript `number`, which has a precision limit of ±2^53. Values beyond `Number.MAX_SAFE_INTEGER` will lose precision. No built-in WPILib struct types are affected (they all use `double`).

### Subscribing to All Topics

You can also subscribe to all topics by doing the above, but with a prefix of `/`.

For example, here's a subscription for all topics:

```typescript
import { NetworkTables } from '@ntcore-ts/client';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByTeam(973);

// Create a prefix for all topics
const allTopics = ntcore.getPrefixTopic('/');

// Subscribe to all topics
allTopics.subscribe((value, params) => {
  console.log(`Got Value: ${value} from topic ${params.name}`);
});
```

### More Info

The API for Topics is much more exhaustive than this quick example. Feel free to view the docs at [https://ntcore.chrislawson.dev](https://ntcore.chrislawson.dev).

## Logging Configuration

The library uses [tslog](https://github.com/fullstack-build/tslog) for structured logging with granular control over log levels. Logging is configured per module (socket, messenger, pubsub) and can be adjusted at runtime.

### Available Log Levels

- `LogLevel.TRACE` - Very detailed debugging information
- `LogLevel.DEBUG` - Detailed debugging information
- `LogLevel.INFO` - General informational messages (default)
- `LogLevel.WARN` - Warning messages
- `LogLevel.ERROR` - Error messages
- `LogLevel.FATAL` - Fatal error messages
- `LogLevel.SILENT` - Disable all logging

### Setting Global Log Level

Set the log level for all modules:

```typescript
import { NetworkTables, LogLevel } from '@ntcore-ts/client';

// Set global log level to DEBUG
NetworkTables.setLogLevel(LogLevel.DEBUG);

// Disable all logging
NetworkTables.setLogLevel(LogLevel.SILENT);
```

### Module-Specific Log Levels

Configure log levels for specific modules to focus debugging on particular areas:

```typescript
import { NetworkTables, LogLevel } from '@ntcore-ts/client';

// Enable detailed debugging for socket connections only
NetworkTables.setModuleLogLevel('socket', LogLevel.DEBUG);

// Set messenger to only show warnings and errors
NetworkTables.setModuleLogLevel('messenger', LogLevel.WARN);

// Disable pubsub logging completely
NetworkTables.setModuleLogLevel('pubsub', LogLevel.SILENT);
```

Available modules:

- `'socket'` - WebSocket connection management
- `'messenger'` - Message publishing and subscription handling
- `'pubsub'` - Topic management and value updates
- `'default'` - General library logging

### Getting Current Log Level

Check the current log level for a module:

```typescript
import { NetworkTables, LogLevel } from '@ntcore-ts/client';

const currentLevel = NetworkTables.getModuleLogLevel('socket');
console.log(`Socket log level: ${LogLevel[currentLevel]}`);
```

### Logging Examples

By default, the library logs:

- **INFO**: Connection status, protocol version
- **WARN**: Connection issues, unhandled message types
- **ERROR**: WebSocket errors, connection failures
- **DEBUG**: Reconnection attempts, unknown topics (development only)

Example output:

```
2024.01.15 14:30:25:123	[INFO]	SOCKET	Connected on NT 4.1
2024.01.15 14:30:25:124	[INFO]	SOCKET	Robot Connected!
2024.01.15 14:30:30:456	[DEBUG]	PUBSUB	Received update for unknown topic { topicId: 42 }
```

### Advanced Usage

You can also import and use the logger utilities directly:

```typescript
import { LogLevel, setLogLevel, setModuleLogLevel, LoggerModule } from '@ntcore-ts/client';

// Set log levels programmatically
setLogLevel(LogLevel.INFO);
setModuleLogLevel('socket' as LoggerModule, LogLevel.DEBUG);
```

## Known Limitations

- "Raw" and other binary types (RPC, msgpack, protobuf) use `Uint8Array`; the library does not use `ArrayBuffer` directly for topic values.

## Contributing

Contributions are welcome and encouraged! If you encounter a bug, please open an issue and provide as much information as possible. If you'd like to open a PR, I'll be more than happy to review it as soon as I can!
