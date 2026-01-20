import * as path from 'path';
import { z as zod } from 'zod';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { NetworkTables, NetworkTablesTypeInfos } from '../../../packages/ntcore-ts-client/src';

// Import types generated from the proto file
import type { TestData } from './generated/customproto';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByURI('localhost');

// ------------------------------------------------ //
// Example of using a topic to subscribe to a value //
// ------------------------------------------------ //

const test = ntcore.createPrefixTopic('/MyTable/');
test.subscribe((value) => {
  console.log(`[Test Topic] Got Value: ${value}`);
});

// Create the gyro topic
const gyroTopic = ntcore.createTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);

// Subscribe and immediately call the callback with the current value
gyroTopic.subscribe((value) => {
  console.log(`[Gryo Topic] Got Gyro Value: ${value}`);
});

// Or you can use the topic's announce parameters to get more info, like the topic ID
gyroTopic.subscribe((value, params) => {
  console.log(`[Gryo Topic] Got Gyro Value: ${value} at from topic id ${params.id}`);
});

// --------------------------------------------------------- //
// Example of using a protobuf topic to subscribe to a value //
// --------------------------------------------------------- //

// The library automatically fetches the protobuf schema from NetworkTables
// and decodes values in subscriber callbacks. However, we cannot know at
// compile time what the schema will be, so the library supports passing a
// Zod schema to validate the decoded values at runtime.
const translation2dSchema = zod.object({
  x: zod.number(),
  y: zod.number(),
});
const rotation2dSchema = zod.object({
  value: zod.number(),
});
const pose2dSchema = zod.object({
  translation: translation2dSchema,
  rotation: rotation2dSchema,
});
const poseTopic = ntcore.createProtobufTopic<zod.infer<typeof pose2dSchema>>('/MyTable/Pose', {
  validator: pose2dSchema,
});
poseTopic.subscribe((value) => {
  console.log(
    `[Pose Topic] Got Pose Value: x: ${value.translation.x}, y: ${value.translation.y}, rotation: ${value.rotation.value}`
  );
});

// --------------------------------------------------------------- //
// Example of using a prefix topic to subscribe to multiple topics //
// --------------------------------------------------------------- //

// Create the accelerator topic
const accelerometerTopic = ntcore.createPrefixTopic('/MyTable/Accelerometer/');

let x: number, y: number, z: number;

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

// Create a prefix for all topics
const allTopics = ntcore.createPrefixTopic('');

// Sub scribe to all topics
allTopics.subscribe((value, params) => {
  console.log(`[All Topics] Got Value: ${value} from topic ${params.name}`);
});

// ---------------------------------------------- //
// Example of using a topic to publish to a value //
// ---------------------------------------------- //

// Create the AutoMode topic w/ a default return value of 'No Auto'
(async () => {
  const autoModeTopic = ntcore.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'No Auto');

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
// Example of using a protobuf topic to publish a value //
// --------------------------------------------------------- //

(async () => {
  // Create a protobuf topic with the proto file path
  // The schema will be automatically registered to NetworkTables when publishing
  const customProtoTopic = ntcore.createProtobufTopic<TestData>('/MyTable/CustomProto', {
    protoFilePath: path.join(__dirname, '../../..', 'customproto.proto'),
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
