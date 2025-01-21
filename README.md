# ntcore-ts-client

A TypeScript library for communication over [WPILib's NetworkTables 4.1 protocol](https://github.com/wpilibsuite/allwpilib/blob/main/ntcore/doc/networktables4.adoc).

## Features

- NodeJS and DOM support
- Togglable auto-reconnect
- Callbacks for new data on subscriptions
- Callbacks for connection listeners
- Wildcard prefix listeners for multiple topics
- Retrying for messages queued during a connection loss
- On-the-fly server switching with resubscribing and republishing
- Generic types for Topics
- Client-side data validation using [Zod](https://github.com/colinhacks/zod)
- Server-matching timestamping using RTT calculation

## Documentation

TypeDocs are available at [https://ntcore.chrislawson.dev](https://ntcore.chrislawson.dev)

## Quick Start

This section will help get you started with sending and receiving data over NetworkTables

### Installation

`npm install --save ntcore-ts-client`

### Connecting to the NetworkTables Server

The NetworkTables class is instance-based, but allows for connections to multiple teams/URIs.

### Importing `NetworkTables`

Use this at the top of your file:

```typescript
import { NetworkTables } from 'ntcore-ts-client';
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

### Publishing and Subscribing to a Topic

To use a Topic, it must be created through the NetworkTables client using the function:

```typescript
createTopic<T extends NetworkTablesTypes>(name: string, typeInfo: NetworkTablesTypeInfo, defaultValue?: T)
```

> The valid `NetworkTablesTypes` are `string | number | boolean | string[] | ArrayBuffer | boolean[] | number[]`
>
> The valid `NetworkTablesTypeInfo`s are:
>
> - `NetworkTablesTypeInfos.kBoolean`
> - `NetworkTablesTypeInfos.kDouble`
> - `NetworkTablesTypeInfos.kInteger`
> - `NetworkTablesTypeInfos.kString`
> - `NetworkTablesTypeInfos.kArrayBuffer`
> - `NetworkTablesTypeInfos.kBooleanArray`
> - `NetworkTablesTypeInfos.kDoubleArray`
> - `NetworkTablesTypeInfos.kIntegerArray`
> - `NetworkTablesTypeInfos.kStringArray`

Once a topic has been created, it can be used as a subscriber:

```typescript
subscribe(
  callback: (value: T | null, params: AnnounceMessageParams) => void,
  options: SubscribeOptions = {},
  id?: number,
  save = true
)
```

and/or a publisher:

```typescript
await publish(properties: TopicProperties = {}, id?: number)
```

For example, here's a subscription for a Gyro:

```typescript
import { NetworkTables, NetworkTablesTypeInfos } from 'ntcore-ts-client';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByTeam(973);

// Create the gyro topic
const gyroTopic = ntcore.createTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);

// Subscribe and immediately call the callback with the current value
gyroTopic.subscribe((value) => {
  console.log(`Got Gyro Value: ${value}`);
});

// Or you can use the topic's announce parameters to get more info, like the topic ID
gyroTopic.subscribe((value, params) => {
  console.log(`Got Gyro Value: ${value} at from topic id ${params.id}`);
});
```

Or a publisher for an auto mode:

```typescript
import { NetworkTables, NetworkTablesTypeInfos } from 'ntcore-ts-client';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByTeam(973);

// Create the autoMode topic w/ a default return value of 'No Auto'
const autoModeTopic = ntcore.createTopic<string>('/MyTable/autoMode', NetworkTablesTypeInfos.kString, 'No Auto');

// Make us the publisher
await autoModeTopic.publish();

// Set a new value, this will error if we aren't the publisher!
autoModeTopic.setValue('25 Ball Auto and Climb');
```

### Subscribing to Multiple Topics

You can also subscribe to multiple topics by using a "wildcard" through creating a prefix topic.

For example, here's a subscription for an Accelerometer with topics `/MyTable/Accelerometer/X`, `/MyTable/Accelerometer/Y`, and `/MyTable/Accelerometer/Z`:

```typescript
import { NetworkTables } from 'ntcore-ts-client';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByTeam(973);

// Create the accelerator topic
const accelerometerTopic = ntcore.createPrefixTopic('/MyTable/Accelerometer/');

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

### Subscribing to All Topics

You can also subscribe to all topics by doing the above, but with a prefix of `/`.

For example, here's a subscription for all topics:

```typescript
import { NetworkTables } from 'ntcore-ts-client';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByTeam(973);

// Create a prefix for all topics
const allTopics = ntcore.createPrefixTopic('/');

// Subscribe to all topics
allTopics.subscribe((value, params) => {
  console.log(`Got Value: ${value} from topic ${params.name}`);
});
```

### More Info

The API for Topics is much more exhaustive than this quick example. Feel free to view the docs at [https://ntcore.chrislawson.dev](https://ntcore.chrislawson.dev).

## Known Limitations

- "Raw" type only supports ArrayBuffer

## Contributing

Contributions are welcome and encouraged! If you encounter a bug, please open an issue and provide as much information as possible. If you'd like to open a PR, I'll be more than happy to review it as soon as I can!
