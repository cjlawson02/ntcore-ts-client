# ntcore-ts-client

A TypeScript library for communication over [WPILib's NetworkTables 4.0 protocol](https://github.com/wpilibsuite/allwpilib/blob/main/ntcore/doc/networktables4.adoc).

## Features

- NodeJS and DOM support
- Togglable auto-reconnect
- Callbacks for new data on subscriptions
- Callbacks for connection listeners
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

The NetworkTables class is a singleton that will keep the same instance

### Importing `NetworkTables`

Use this at the top of your file:

```typescript
import { NetworkTables } from 'ntcore-ts-client'
```

### With Team Number

Use this function:

```typescript
NetworkTables.createInstanceByTeam(team: number, port = 5810)
```

> This creates the instance using the team number. Connects to `roborio-frc-<team>.local`

### With URI

Use this function:

```typescript
NetworkTables.createInstanceByURI(uri: string, port?)
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
> - `NetworkTableTypeInfos.kBoolean`
> - `NetworkTableTypeInfos.kDouble`
> - `NetworkTableTypeInfos.kInteger`
> - `NetworkTableTypeInfos.kString`
> - `NetworkTableTypeInfos.kArrayBuffer`
> - `NetworkTableTypeInfos.kBooleanArray`
> - `NetworkTableTypeInfos.kDoubleArray`
> - `NetworkTableTypeInfos.kIntegerArray`
> - `NetworkTableTypeInfos.kStringArray`

Once a topic has been created, it can be used as a subscriber:

```typescript
 subscribe(
    callback: (_: T | null) => void,
    immediateNotify = false,
    options: SubscribeOptions = {},
    id?: number,
    save = true
  )
```

and/or a publisher:

```typescript
publish(properties: TopicProperties = {}, id?: number)
```

For example, here's a subscription for a Gyro:

```typescript
import { NetworkTables, NetworkTableTypeInfos } from 'ntcore-ts-client';

// Create the NT client instance
const ntcore = NetworkTables.createInstanceByTeam(973);

// Create the gyro topic
const gyroTopic = ntcore.createTopic<number>('/MyTable/Gyro', NetworkTableTypeInfos.kDouble);

// Subscribe and immediately call the callback with the current value
gyroTopic.subscribe((value) => {
  console.log(`Got Gyro Value: ${value}`);
}, true);
```

Or a publisher for an auto mode:

```typescript
import { NetworkTables, NetworkTableTypeInfos } from 'ntcore-ts-client';

// We're assuming we have already done a createInstance in our app, or this will throw an error!
const ntcore = NetworkTables.getInstance();

// Create the autoMode topic w/ a default return value of 'No Auto'
const autoModeTopic = ntcore.createTopic<string>('/MyTable/autoMode', NetworkTableTypeInfos.kString, 'No Auto');

// Make us the publisher
autoModeTopic.publish();

// Set a new value, this will error if we aren't the publisher!
autoModeTopic.setValue('25 Ball Auto and Climb');
```

### More info

The API for Topics is much more exhaustive than this quick example. Feel free to view the docs at [https://ntcore.chrislawson.dev](https://ntcore.chrislawson.dev).

## Known Limitations

- "Raw" type only supports ArrayBuffer

## Contributing

Contributions are welcome and encouraged! If you encounter a bug, please open an issue and provide as much information as possible. If you'd like to open a PR, I'll be more than happy to review it as soon as I can!
