import * as path from 'path';
import { fileURLToPath } from 'url';
import { z as zod } from 'zod';

import { NetworkTables, Pose2d, Pose2dSchema } from '@ntcore-ts/client';

// Import types generated from the proto file
import type { TestData } from './generated/customproto';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByURI('localhost');

ntcore.addRobotConnectionListener((connected) => {
  console.log(`[Connection] Robot ${connected ? 'connected' : 'disconnected'}`);
});

// ------------------------------------------------ //
// Example of using a topic to subscribe to a value //
// ------------------------------------------------ //

const gyroTopic = ntcore.getDoubleTopic('/MyTable/Gyro');

// Subscribe; the callback runs when the server sends a value
gyroTopic.subscribe((value) => {
  console.log(`[Gyro Topic] Got Gyro Value: ${value}`);
});

// Or you can use the topic's announce parameters to get more info, like the topic ID
gyroTopic.subscribe((value, params) => {
  console.log(`[Gyro Topic] Got Gyro Value: ${value} at from topic id ${params.id}`);
});

// ---------------------------------------------- //
// Example of using a topic to publish to a value //
// ---------------------------------------------- //

// Create the AutoMode topic w/ a default return value of 'No Auto'
// Note: this retained publisher contends with example-react if both run against the same server.
(async () => {
  const autoModeTopic = ntcore.getStringTopic('/MyTable/AutoMode', 'No Auto');

  // Make us the publisher
  console.log('[Auto Topic] Publishing Auto Mode Topic');
  await autoModeTopic.publish({
    retained: true,
  });
  console.log('[Auto Topic] Published Auto Mode Topic');

  // Set a new value, this will error if we aren't the publisher!
  autoModeTopic.setValue('25 Ball Auto and Climb');
})();

// --------------------------------------------------------- //
// Example of using a protobuf topic to subscribe to a value //
// --------------------------------------------------------- //

const poseTopic = ntcore.getProtobufTopic<Pose2d>('/MyTable/Pose', {
  validator: Pose2dSchema,
});
poseTopic.subscribe((value) => {
  console.log(
    `[Pose Topic] Got Pose Value: x: ${value?.translation.x}, y: ${value?.translation.y}, rotation: ${value?.rotation.value}`
  );
});

// --------------------------------------------------------- //
// Example of using a struct topic to subscribe to a value    //
// --------------------------------------------------------- //

const poseStructTopic = ntcore.getStructTopic('/MyTable/PoseStruct', Pose2d);
poseStructTopic.subscribe((value) => {
  console.log(
    `[Pose Struct Topic] Got Pose Value: x: ${value?.translation.x}, y: ${value?.translation.y}, rotation: ${value?.rotation.value}`
  );
});

// --------------------------------------------------------------- //
// Example of using a prefix topic to subscribe to multiple topics //
// --------------------------------------------------------------- //

const accelerometerTopic = ntcore.getPrefixTopic('/MyTable/Accelerometer/');

let x: number;
let y: number;
let z: number;

// Subscribe to all topics under the prefix /MyTable/Accelerometer/
accelerometerTopic.subscribe((value, params) => {
  console.log(`[Accel Prefix Topic] Got Accelerometer Value: ${value} from topic ${params.name}`); // i.e. Got Accelerometer Value: 9.81 from topic /MyTable/Accelerometer/Y

  // You can also use the topic name to determine which value to set
  if (params.name.endsWith('X')) {
    x = zod.number().parse(value);
  } else if (params.name.endsWith('Y')) {
    y = zod.number().parse(value);
  } else if (params.name.endsWith('Z')) {
    z = zod.number().parse(value);
  }

  // Since there can be THAT many different types in subtopics,
  // you can use the type information for other checks...
  if (params.type === 'int') {
    console.warn('[Accel Prefix Topic] Hmm... the accelerometer seems low precision');
  } else if (params.type === 'double') {
    console.log('[Accel Prefix Topic] The accelerometer is high precision');

    console.log(`[Accel Prefix Topic] Latest update: X: ${x}, Y: ${y}, Z: ${z}`);
  }
});

// x, y, and z will be updated as new values come in

// ---------------------------------------------------------- //
// Example of using a prefix topic to subscribe to all topics //
// ---------------------------------------------------------- //

if (process.env.NT_DUMP_ALL === '1') {
  // Create a prefix for all topics (very noisy — opt in with NT_DUMP_ALL=1)
  const allTopics = ntcore.getPrefixTopic('/');

  allTopics.subscribe((value, params) => {
    console.log(`[All Topics] Got Value: ${value} from topic ${params.name}`);
  });
}

// --------------------------------------------------------- //
// Example of using a protobuf topic to publish a value //
// --------------------------------------------------------- //

(async () => {
  // Create a protobuf topic with the proto file path
  // The schema will be automatically registered to NetworkTables when publishing
  const customProtoTopic = ntcore.getProtobufTopic<TestData>('/MyTable/CustomProto', {
    // The build copies `customproto.proto` next to the output JS file
    protoFilePath: path.join(currentDir, 'customproto.proto'),
  });

  // Make us the publisher
  console.log('[Custom Proto Topic] Publishing Custom Proto Topic');
  await customProtoTopic.publish();
  console.log('[Custom Proto Topic] Published Custom Proto Topic');

  // Create a TestData value object matching the proto schema
  // The TestData type is automatically inferred from the proto file
  const testDataValue: TestData = {
    timestamp: Date.now(),
    value: 42.5,
    info: 'Example sensor data',
  };

  customProtoTopic.setValue(testDataValue);
})();
