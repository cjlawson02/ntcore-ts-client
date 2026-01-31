/**
 * E2E tests against a live NetworkTables server (e.g. example-robot via simulateJava).
 * Requires a server on localhost:5810. Run example-robot first: nx run example-robot:serve
 */
/// <reference types="vitest/globals" />
import { z as zod } from 'zod';

import { NetworkTables, NetworkTablesTypeInfos } from '@ntcore/client';

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
            if (v !== undefined && v !== null) {
              clearTimeout(t);
              resolve(v);
            }
          });
        });
        expect(value).toBeCloseTo(1.234, 10);
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
        expect(value.translation.x).toBeCloseTo(1, 10);
        expect(value.translation.y).toBeCloseTo(2, 10);
        expect(value.rotation.value).toBeCloseTo(Math.PI, 10);
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
            if (prefixAccelValues.X != null && prefixAccelValues.Y != null && prefixAccelValues.Z != null) {
              clearInterval(id);
              clearTimeout(t);
              resolve();
            }
          }, 50);
        });

        expect(prefixAccelValues.X).toBeCloseTo(1.4, 10);
        expect(prefixAccelValues.Y).toBeCloseTo(2.5, 10);
        expect(prefixAccelValues.Z).toBeCloseTo(3.6, 10);

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
