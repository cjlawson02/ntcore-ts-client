/**
 * E2E: Struct Topic Options
 *
 * Spec: apps/example-client/specs/struct-topic-options.md
 *
 * Every test title below starts with the acceptance criteria IDs it covers
 * (e.g. `[STR-1, STR-2, STR-3] ...`). Keep this file and the spec
 * in sync — see apps/example-client/specs/README.md for the rules.
 */
/// <reference types="vitest/globals" />
import { NetworkTables } from '@ntcore-ts/client';

import { CONNECTION_WAIT_MS, NT_SERVER_HOST, NT_SERVER_PORT, VALUE_WAIT_MS, waitForConnection } from './_support';

describe('Feature: Struct Topic Options', () => {
  const nt = NetworkTables.getInstanceByURI(NT_SERVER_HOST, NT_SERVER_PORT);

  beforeAll(async () => {
    await waitForConnection(nt);
  }, CONNECTION_WAIT_MS + 2_000);

  it(
    '[STR-1, STR-2, STR-3] getStructTopic reuse applies options (schema + defaultValue)',
    () => {
      const name = '/MyTable/StructReuseE2E';

      const topic1 = nt.getStructTopic<{ x: number; y: number }>(name, { typeName: 'Translation2d' });
      const topic2 = nt.getStructTopic<{ x: number; y: number }>(name, {
        typeName: 'Translation2d',
        schema: 'double x;double y',
        defaultValue: { x: 10, y: 20 },
      });

      // STR-1: same name returns the same instance
      expect(topic2).toBe(topic1);

      // STR-2 + STR-3: new options (schema + defaultValue) are merged into the cached topic,
      // and the defaultValue is what getValue() returns when no other value has been produced.
      expect(topic2.getValue()).toEqual({ x: 10, y: 20 });
    },
    VALUE_WAIT_MS + 2_000
  );
});
