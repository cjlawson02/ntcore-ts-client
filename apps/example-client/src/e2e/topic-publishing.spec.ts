/**
 * E2E: Topic Publishing (client → robot)
 *
 * Spec: apps/example-client/specs/topic-publishing.md
 *
 * Every test title below starts with the acceptance criteria IDs it covers
 * (e.g. `[PUB-1, PUB-2] ...`). Keep this file and the spec in sync —
 * see apps/example-client/specs/README.md for the rules.
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

describe('Feature: Topic Publishing (client → robot)', () => {
  const nt = NetworkTables.getInstanceByURI(NT_SERVER_HOST, NT_SERVER_PORT);

  beforeAll(async () => {
    await waitForConnection(nt);
  }, CONNECTION_WAIT_MS + 2_000);

  it(
    '[PUB-1, PUB-2] publishes Pose2d struct and server echoes it back to PoseStructEcho',
    async () => {
      const publishTopic = nt.getStructTopic<Pose2d>('/MyTable/PoseStructFromClient', {
        typeName: 'Pose2d',
        validator: pose2dSchema,
      });
      await publishTopic.publish({ retained: true });

      const testPose: Pose2d = {
        translation: { x: 0.5, y: 1.25 },
        rotation: { value: Math.PI / 4 },
      };
      publishTopic.setValue(testPose);

      const echoTopic = nt.getStructTopic<Pose2d>('/MyTable/PoseStructEcho', {
        typeName: 'Pose2d',
        validator: pose2dSchema,
      });

      const echoed = await waitForValue<Pose2d>(
        echoTopic,
        (v) =>
          v?.translation != null &&
          v?.rotation != null &&
          Math.abs(v.translation.x - testPose.translation.x) < 1e-6 &&
          Math.abs(v.translation.y - testPose.translation.y) < 1e-6,
        'PoseStructEcho value timeout'
      );

      expect(echoed.translation.x).toBeCloseTo(testPose.translation.x);
      expect(echoed.translation.y).toBeCloseTo(testPose.translation.y);
      expect(echoed.rotation.value).toBeCloseTo(testPose.rotation.value);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[PUB-3, PUB-4, PUB-5] publishes Translation2d[] struct array with correct typeInfo and round-trips via getValue',
    async () => {
      type Translation2d = { x: number; y: number };
      const topic = nt.getStructTopic<Translation2d[]>('/MyTable/Translation2dArray', {
        typeName: 'Translation2d[]',
      });

      // PUB-5: struct array topics have typeInfo[1] === 'struct:<TypeName>[]'
      expect(topic.typeInfo[1]).toBe('struct:Translation2d[]');

      await topic.publish({ retained: true });

      const arr: Translation2d[] = [
        { x: 1.5, y: 2.5 },
        { x: 3.5, y: 4.5 },
      ];
      topic.setValue(arr);

      // PUB-4: getValue reflects locally set values without a server round-trip
      expect(topic.getValue()).toEqual(arr);
    },
    VALUE_WAIT_MS + 5_000
  );
});
