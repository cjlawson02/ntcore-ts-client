// eslint-disable-next-line @nx/enforce-module-boundaries
import { NetworkTables, NetworkTablesTypeInfos } from '../../../packages/ntcore-ts-client/src';

// Get or create the NT client instance
const ntcore = NetworkTables.getInstanceByURI('localhost');

// ------------------------------------------------ //
// Example of using a topic to subscribe to a value //
// ------------------------------------------------ //

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

// ---------------------------------------------- //
// Example of using a topic to publish to a value //
// ---------------------------------------------

// Create the AutoMode topic w/ a default return value of 'No Auto'
(async () => {
  const autoModeTopic = ntcore.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'No Auto');

  // Make us the publisher
  await autoModeTopic.publish();

  // Set a new value, this will error if we aren't the publisher!
  autoModeTopic.setValue('25 Ball Auto and Climb');
})();

// --------------------------------------------------------------- //
// Example of using a prefix topic to subscribe to multiple topics //
// --------------------------------------------------------------- //

// Create the accelerator topic
const accelerometerTopic = ntcore.createPrefixTopic('/MyTable/Accelerometer/');

let x, y, z: any;

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

  // Since there can be THAT many different types in subtopics,
  // you can use the type information for other checks...
  if (params.type === 'int') {
    console.warn('Hmm... the accelerometer seems low precision');
  } else if (params.type === 'double') {
    console.log('The accelerometer is high precision');

    const typedX = x as number;
    const typedY = y as number;
    const typedZ = z as number;

    console.log(`Latest update: X: ${typedX}, Y: ${typedY}, Z: ${typedZ}`);
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
  console.log(`Got Value: ${value} from topic ${params.name}`);
});
