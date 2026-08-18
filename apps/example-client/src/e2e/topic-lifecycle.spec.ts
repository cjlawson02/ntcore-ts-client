/**
 * E2E: Topic Lifecycle (unsubscribe / unpublish)
 *
 * Spec: apps/example-client/specs/topic-lifecycle.md
 *
 * Every test title below starts with the acceptance criteria IDs it covers
 * (e.g. `[LIF-1] ...`). Keep this file and the spec in sync — see
 * apps/example-client/specs/README.md for the rules.
 */
/// <reference types="vitest/globals" />
import { NetworkTables } from '@ntcore-ts/client';

import {
  CONNECTION_WAIT_MS,
  NT_SERVER_HOST,
  NT_SERVER_PORT,
  VALUE_WAIT_MS,
  waitForConnection,
  waitForValue,
} from './_support';

/** Short "quiet window" used to verify a callback stops firing after unsubscribe. */
const POST_UNSUBSCRIBE_QUIET_MS = 500;

describe('Feature: Topic Lifecycle (unsubscribe / unpublish)', () => {
  const nt = NetworkTables.getInstanceByURI(NT_SERVER_HOST, NT_SERVER_PORT);

  beforeAll(async () => {
    await waitForConnection(nt);
  }, CONNECTION_WAIT_MS + 2_000);

  it(
    '[LIF-1] unsubscribe stops further value updates',
    async () => {
      // Gyro is published continuously by the robot in utilityPeriodic; even in disabled mode
      // its initial value (0) is delivered once via retained/last-value semantics. We use the
      // accelerometer X which is set on disabledInit so we always see at least one update.
      const topic = nt.getDoubleTopic('/MyTable/Accelerometer/X');

      // First: wait for any value to confirm the subscription is live.
      let callCount = 0;
      let lastSubuid = -1;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('initial value timeout')), VALUE_WAIT_MS);
        lastSubuid = topic.subscribe((v) => {
          if (v != null) {
            callCount++;
            clearTimeout(timer);
            resolve();
          }
        });
      });

      expect(callCount).toBeGreaterThanOrEqual(1);

      // Now unsubscribe and confirm no further callbacks fire within the quiet window.
      topic.unsubscribe(lastSubuid);
      const beforeQuiet = callCount;
      await new Promise((r) => setTimeout(r, POST_UNSUBSCRIBE_QUIET_MS));
      expect(callCount).toBe(beforeQuiet);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[LIF-2] unsubscribeAll removes every subscriber and stops updates',
    async () => {
      const topic = nt.getDoubleTopic('/MyTable/Accelerometer/Y');
      let calls = 0;
      topic.subscribe(() => {
        calls++;
      });
      topic.subscribe(() => {
        calls++;
      });
      expect(topic.subscribers.size).toBe(2);

      // Wait for at least one delivery per subscriber.
      await waitForValue<number>(topic, (v) => typeof v === 'number' && Number.isFinite(v), 'Accel/Y timeout');
      const before = calls;
      expect(before).toBeGreaterThanOrEqual(1);

      topic.unsubscribeAll();
      expect(topic.subscribers.size).toBe(0);

      await new Promise((r) => setTimeout(r, POST_UNSUBSCRIBE_QUIET_MS));
      // No new callback invocations should occur for subscribers we removed.
      expect(calls).toBe(before);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[LIF-3] unpublish clears publisher state and causes setValue to throw',
    async () => {
      const topic = nt.getStringTopic('/MyTable/Lifecycle/UnpublishTarget', 'initial');
      await topic.publish({ retained: true });
      expect(topic.publisher).toBe(true);
      expect(topic.pubuid).toBeDefined();

      topic.setValue('before unpublish');

      topic.unpublish();
      expect(topic.publisher).toBe(false);
      expect(topic.pubuid).toBeUndefined();
      expect(() => topic.setValue('should throw')).toThrow(/Cannot set value on topic without being the publisher/);
    },
    VALUE_WAIT_MS + 5_000
  );

  it(
    '[LIF-4] republish after unpublish allocates a new pubuid and accepts new setValue',
    async () => {
      const topic = nt.getStringTopic('/MyTable/Lifecycle/RepublishTarget', 'initial');
      await topic.publish({ retained: true });
      const firstPubuid = topic.pubuid;
      expect(firstPubuid).toBeDefined();

      topic.setValue('v1');

      topic.unpublish();
      expect(topic.publisher).toBe(false);

      await topic.publish({ retained: true });
      expect(topic.publisher).toBe(true);
      expect(topic.pubuid).toBeDefined();
      expect(topic.pubuid).not.toBe(firstPubuid);

      expect(() => topic.setValue('v2')).not.toThrow();
      expect(topic.getValue()).toBe('v2');
    },
    VALUE_WAIT_MS + 5_000
  );
});
