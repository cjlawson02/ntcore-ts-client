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
import { NetworkTables, NetworkTablesTypeInfos } from '@ntcore-ts/client';

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
      const gyroTopic = nt.createTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);

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
    '[SUB-2, SUB-4] receives Pose2d via createProtobufTopic and validates schema',
    async () => {
      const poseTopic = nt.createProtobufTopic<Pose2d>('/MyTable/Pose', {
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
    '[SUB-3, SUB-4] receives Pose2d via createStructTopic and validates schema',
    async () => {
      const poseStructTopic = nt.createStructTopic<Pose2d>('/MyTable/PoseStruct', {
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
});
