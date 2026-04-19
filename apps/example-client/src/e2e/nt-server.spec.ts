/**
 * E2E tests against a live NetworkTables server (e.g. example-robot via simulateJava).
 * Requires a server on localhost:5810. Run example-robot first: nx run example-robot:serve
 */
/// <reference types="vitest/globals" />
import { z as zod } from 'zod';

import { NetworkTables, NetworkTablesTypeInfos } from '@ntcore-ts/client';

const NT_SERVER_PORT = 5810;
const CONNECTION_WAIT_MS = 10_000;
const VALUE_WAIT_MS = 10_000;

// Pose2d schema matching WPILib (translation x/y, rotation value)
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

function waitForConnection(nt: NetworkTables): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_WAIT_MS);
    const remove = nt.addRobotConnectionListener((connected: boolean) => {
      if (connected) {
        clearTimeout(timeout);
        remove();
        resolve();
      }
    }, true);
  });
}

describe('E2E: NT server (example-robot)', () => {
  const nt = NetworkTables.getInstanceByURI('localhost', NT_SERVER_PORT);
  const prefixAccelValues: Record<string, number> = {};

  beforeAll(async () => {
    await waitForConnection(nt);
    const accelerometerPrefix = nt.createPrefixTopic('/MyTable/Accelerometer/');
    accelerometerPrefix.subscribe((value, params) => {
      if (value !== undefined && value !== null && params.name) {
        if (params.name.endsWith('X')) prefixAccelValues.X = Number(value);
        else if (params.name.endsWith('Y')) prefixAccelValues.Y = Number(value);
        else if (params.name.endsWith('Z')) prefixAccelValues.Z = Number(value);
      }
    });
  }, CONNECTION_WAIT_MS + 2000);

  describe('robot → client', () => {
    it(
      'receives Gyro value from server',
      async () => {
        const gyroTopic = nt.createTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);
        const value = await new Promise<number>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Gyro value timeout')), VALUE_WAIT_MS);
          gyroTopic.subscribe((v) => {
            if (v != null && typeof v === 'number') {
              clearTimeout(t);
              resolve(v);
            }
          });
        });
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(-180);
        expect(value).toBeLessThanOrEqual(180);
      },
      VALUE_WAIT_MS + 5000
    );

    it(
      'receives Pose (protobuf) from server',
      async () => {
        const poseTopic = nt.createProtobufTopic<zod.infer<typeof pose2dSchema>>('/MyTable/Pose', {
          validator: pose2dSchema,
        });
        const value = await new Promise<zod.infer<typeof pose2dSchema>>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Pose value timeout')), VALUE_WAIT_MS);
          poseTopic.subscribe((v) => {
            if (v?.translation != null && v?.rotation != null) {
              clearTimeout(t);
              resolve(v);
            }
          });
        });
        expect(value.translation.x).toBeGreaterThanOrEqual(-2);
        expect(value.translation.x).toBeLessThanOrEqual(2);
        expect(value.translation.y).toBeGreaterThanOrEqual(0);
        expect(value.translation.y).toBeLessThanOrEqual(3);
        expect(value.rotation.value).toBeGreaterThanOrEqual(-Math.PI);
        expect(value.rotation.value).toBeLessThanOrEqual(Math.PI);
      },
      VALUE_WAIT_MS + 5000
    );

    it(
      'receives Pose (struct) from server via createStructTopic',
      async () => {
        const poseStructTopic = nt.createStructTopic<zod.infer<typeof pose2dSchema>>('/MyTable/PoseStruct', {
          typeName: 'Pose2d',
          validator: pose2dSchema,
        });
        const value = await new Promise<zod.infer<typeof pose2dSchema>>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('PoseStruct value timeout')), VALUE_WAIT_MS);
          poseStructTopic.subscribe((v) => {
            if (v?.translation != null && v?.rotation != null) {
              clearTimeout(t);
              resolve(v);
            }
          });
        });
        expect(value.translation.x).toBeGreaterThanOrEqual(-2);
        expect(value.translation.x).toBeLessThanOrEqual(2);
        expect(value.translation.y).toBeGreaterThanOrEqual(0);
        expect(value.translation.y).toBeLessThanOrEqual(3);
        expect(value.rotation.value).toBeGreaterThanOrEqual(-Math.PI);
        expect(value.rotation.value).toBeLessThanOrEqual(Math.PI);
      },
      VALUE_WAIT_MS + 5000
    );
  });

  describe('client → robot', () => {
    it(
      'client publishes Pose2d struct; robot consumes and echoes to PoseStructEcho',
      async () => {
        const publishTopic = nt.createStructTopic<zod.infer<typeof pose2dSchema>>('/MyTable/PoseStructFromClient', {
          typeName: 'Pose2d',
          validator: pose2dSchema,
        });
        await publishTopic.publish({ retained: true });

        const testPose = {
          translation: { x: 0.5, y: 1.25 },
          rotation: { value: Math.PI / 4 },
        };
        publishTopic.setValue(testPose);

        const echoTopic = nt.createStructTopic<zod.infer<typeof pose2dSchema>>('/MyTable/PoseStructEcho', {
          typeName: 'Pose2d',
          validator: pose2dSchema,
        });
        const echoed = await new Promise<zod.infer<typeof pose2dSchema>>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('PoseStructEcho value timeout')), VALUE_WAIT_MS);
          echoTopic.subscribe((v) => {
            if (
              v?.translation != null &&
              v?.rotation != null &&
              Math.abs(v.translation.x - testPose.translation.x) < 1e-6 &&
              Math.abs(v.translation.y - testPose.translation.y) < 1e-6
            ) {
              clearTimeout(t);
              resolve(v);
            }
          });
        });
        expect(echoed.translation.x).toBeCloseTo(testPose.translation.x);
        expect(echoed.translation.y).toBeCloseTo(testPose.translation.y);
        expect(echoed.rotation.value).toBeCloseTo(testPose.rotation.value);
      },
      VALUE_WAIT_MS + 5000
    );

    it(
      'createStructTopic reuse applies options (schema + defaultValue) when same name called again',
      async () => {
        const name = '/MyTable/StructReuseE2E';
        const topic1 = nt.createStructTopic<{ x: number; y: number }>(name, { typeName: 'Translation2d' });
        const topic2 = nt.createStructTopic<{ x: number; y: number }>(name, {
          typeName: 'Translation2d',
          schema: 'double x;double y',
          defaultValue: { x: 10, y: 20 },
        });
        expect(topic2).toBe(topic1);
        expect(topic2.getValue()).toEqual({ x: 10, y: 20 });
      },
      VALUE_WAIT_MS + 2000
    );

    it(
      'createStructTopic with array type (Translation2d[]): publish, setValue, getValue round-trip',
      async () => {
        type Translation2d = { x: number; y: number };
        const topic = nt.createStructTopic<Translation2d[]>('/MyTable/Translation2dArray', {
          typeName: 'Translation2d[]',
        });
        expect(topic.typeInfo[1]).toBe('struct:Translation2d[]');
        await topic.publish({ retained: true });

        const arr: Translation2d[] = [
          { x: 1.5, y: 2.5 },
          { x: 3.5, y: 4.5 },
        ];
        topic.setValue(arr);
        expect(topic.getValue()).toEqual(arr);
      },
      VALUE_WAIT_MS + 5000
    );
  });

  describe('prefix topic (Accelerometer) + our AutoMode change', () => {
    it(
      'sees Accelerometer via createPrefixTopic("/MyTable/Accelerometer/") and our AutoMode publish',
      async () => {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Accelerometer prefix value timeout')), VALUE_WAIT_MS);
          const id = setInterval(() => {
            if (prefixAccelValues.X != null && prefixAccelValues.Y != null) {
              clearInterval(id);
              clearTimeout(t);
              resolve();
            }
          }, 50);
        });

        expect(Number.isFinite(prefixAccelValues.X)).toBe(true);
        expect(Number.isFinite(prefixAccelValues.Y)).toBe(true);

        const autoModeValue = 'E2E Test Auto';
        const autoModeTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
        await autoModeTopic.publish({ retained: true });
        autoModeTopic.setValue(autoModeValue);

        const autoModeRead = await new Promise<string>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('AutoMode readback timeout')), VALUE_WAIT_MS);
          const readTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
          readTopic.subscribe((v) => {
            if (v !== undefined && v !== null && v === autoModeValue) {
              clearTimeout(t);
              resolve(v);
            }
          });
        });
        expect(autoModeRead).toBe(autoModeValue);
      },
      VALUE_WAIT_MS + 10_000
    );

    it(
      'retained AutoMode survives disconnect and reconnect',
      async () => {
        const autoModeValue = 'E2E Retained After Reconnect';
        const autoModeTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
        await autoModeTopic.publish({ retained: true });
        autoModeTopic.setValue(autoModeValue);

        nt.changeURI('localhost', NT_SERVER_PORT);
        await waitForConnection(nt);

        const retained = await new Promise<string>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Retained readback timeout')), VALUE_WAIT_MS);
          const readTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
          readTopic.subscribe((v) => {
            if (v !== undefined && v !== null && v === autoModeValue) {
              clearTimeout(t);
              resolve(v);
            }
          });
        });
        expect(retained).toBe(autoModeValue);
      },
      VALUE_WAIT_MS + CONNECTION_WAIT_MS + 5000
    );
  });
});
