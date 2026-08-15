/**
 * E2E: Topic Subscription (robot → client)
 *
 * Spec: apps/example-client/specs/topic-subscription.md
 *
 * Every test title below starts with the acceptance criteria IDs it covers
 * (e.g. `[SUB-1] ...`). Keep this file and the spec in sync — see
 * apps/example-client/specs/README.md for the rules.
 */
/// <reference types="vitest/globals" />
import { NetworkTables } from '@ntcore-ts/client';

import {
  CONNECTION_WAIT_MS,
  NT_SERVER_HOST,
  NT_SERVER_PORT,
  VALUE_WAIT_MS,
  pose2dSchema,
  waitForConnection,
  waitForValue,
  type Pose2d,
} from './_support';

describe('Feature: Topic Subscription (robot → client)', () => {
  const nt = NetworkTables.getInstanceByURI(NT_SERVER_HOST, NT_SERVER_PORT);

  beforeAll(async () => {
    await waitForConnection(nt);
  }, CONNECTION_WAIT_MS + 2_000);

  it(
    '[SUB-1] receives kDouble Gyro value from server',
    async () => {
      const gyroTopic = nt.getDoubleTopic('/MyTable/Gyro');

      const value = await waitForValue<number>(
        gyroTopic,
        (v) => typeof v === 'number' && Number.isFinite(v),
        'Gyro value timeout'
      );

      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-180);
      expect(value).toBeLessThanOrEqual(180);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-2, SUB-4] receives Pose2d via getProtobufTopic and validates schema',
    async () => {
      const poseTopic = nt.getProtobufTopic<Pose2d>('/MyTable/Pose', {
        validator: pose2dSchema,
      });

      const value = await waitForValue<Pose2d>(
        poseTopic,
        (v) => v?.translation != null && v?.rotation != null,
        'Pose value timeout'
      );

      expect(value.translation.x).toBeGreaterThanOrEqual(-2);
      expect(value.translation.x).toBeLessThanOrEqual(2);
      expect(value.translation.y).toBeGreaterThanOrEqual(0);
      expect(value.translation.y).toBeLessThanOrEqual(3);
      expect(value.rotation.value).toBeGreaterThanOrEqual(-Math.PI);
      expect(value.rotation.value).toBeLessThanOrEqual(Math.PI);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-3, SUB-4] receives Pose2d via getStructTopic and validates schema',
    async () => {
      const poseStructTopic = nt.getStructTopic<Pose2d>('/MyTable/PoseStruct', {
        typeName: 'Pose2d',
        validator: pose2dSchema,
      });

      const value = await waitForValue<Pose2d>(
        poseStructTopic,
        (v) => v?.translation != null && v?.rotation != null,
        'PoseStruct value timeout'
      );

      expect(value.translation.x).toBeGreaterThanOrEqual(-2);
      expect(value.translation.x).toBeLessThanOrEqual(2);
      expect(value.translation.y).toBeGreaterThanOrEqual(0);
      expect(value.translation.y).toBeLessThanOrEqual(3);
      expect(value.rotation.value).toBeGreaterThanOrEqual(-Math.PI);
      expect(value.rotation.value).toBeLessThanOrEqual(Math.PI);
    },
    VALUE_WAIT_MS + 5_000
  );

  // SUB-5…SUB-12: one test per NT wire type, each exercising the full msgpack
  // encode/decode + type-number ↔ type-string interop path against a real server.
  // (Unit tests only cover the local zod/validateData layer.)

  it(
    '[SUB-5] receives kBoolean value from server',
    async () => {
      const topic = nt.getBooleanTopic('/MyTable/Scalars/Bool');
      const value = await waitForValue<boolean>(topic, (v) => typeof v === 'boolean', 'Bool scalar timeout');
      expect(typeof value).toBe('boolean');
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-6] receives kInteger value from server',
    async () => {
      const topic = nt.getIntegerTopic('/MyTable/Scalars/Int');
      const value = await waitForValue<number>(
        topic,
        (v) => typeof v === 'number' && Number.isInteger(v),
        'Int scalar timeout'
      );
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBe(42);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-7] receives kFloat value from server',
    async () => {
      const topic = nt.getFloatTopic('/MyTable/Scalars/Float');
      const value = await waitForValue<number>(
        topic,
        (v) => typeof v === 'number' && Number.isFinite(v),
        'Float scalar timeout'
      );
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeCloseTo(1.5, 5);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-8] receives kBooleanArray value from server',
    async () => {
      const topic = nt.getBooleanArrayTopic('/MyTable/Scalars/BoolArray');
      const value = await waitForValue<boolean[]>(
        topic,
        (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'boolean'),
        'BoolArray timeout'
      );
      expect(value).toEqual([true, false, true]);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-9] receives kDoubleArray value from server',
    async () => {
      const topic = nt.getDoubleArrayTopic('/MyTable/Scalars/DoubleArray');
      const value = await waitForValue<number[]>(
        topic,
        (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite),
        'DoubleArray timeout'
      );
      expect(value).toHaveLength(3);
      expect(value[0]).toBeCloseTo(1.1);
      expect(value[1]).toBeCloseTo(2.2);
      expect(value[2]).toBeCloseTo(3.3);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-10] receives kIntegerArray value from server',
    async () => {
      const topic = nt.getIntegerArrayTopic('/MyTable/Scalars/IntArray');
      const value = await waitForValue<number[]>(
        topic,
        (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isInteger),
        'IntArray timeout'
      );
      expect(value).toEqual([10, 20, 30]);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-11] receives kFloatArray value from server',
    async () => {
      const topic = nt.getFloatArrayTopic('/MyTable/Scalars/FloatArray');
      const value = await waitForValue<number[]>(
        topic,
        (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite),
        'FloatArray timeout'
      );
      expect(value).toHaveLength(3);
      expect(value[0]).toBeCloseTo(0.5, 5);
      expect(value[1]).toBeCloseTo(1.5, 5);
      expect(value[2]).toBeCloseTo(2.5, 5);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[SUB-12] receives kStringArray value from server',
    async () => {
      const topic = nt.getStringArrayTopic('/MyTable/Scalars/StringArray');
      const value = await waitForValue<string[]>(
        topic,
        (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'string'),
        'StringArray timeout'
      );
      expect(value).toEqual(['alpha', 'beta', 'gamma']);
    },
    VALUE_WAIT_MS + 5_000
  );
});
