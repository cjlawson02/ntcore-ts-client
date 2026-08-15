/**
 * E2E: Custom Struct Schema Auto-Fetch
 *
 * Spec: apps/example-client/specs/custom-struct-schema.md
 *
 * Every test title below starts with the acceptance criteria IDs it covers
 * (e.g. `[CSS-1, CSS-2, CSS-3] ...`). Keep this file and the spec in sync — see
 * apps/example-client/specs/README.md for the rules.
 */
/// <reference types="vitest/globals" />
import { NetworkTables } from '@ntcore-ts/client';
import { z as zod } from 'zod';

import {
  CONNECTION_WAIT_MS,
  NT_SERVER_HOST,
  NT_SERVER_PORT,
  VALUE_WAIT_MS,
  waitForConnection,
  waitForValue,
} from './_support';

const waypointSchema = zod.object({
  x: zod.number(),
  y: zod.number(),
  heading: zod.number(),
  id: zod.number().int(),
});
type Waypoint = zod.infer<typeof waypointSchema>;

describe('Feature: Custom Struct Schema Auto-Fetch', () => {
  const nt = NetworkTables.getInstanceByURI(NT_SERVER_HOST, NT_SERVER_PORT);

  beforeAll(async () => {
    await waitForConnection(nt);
  }, CONNECTION_WAIT_MS + 2_000);

  it(
    '[CSS-1, CSS-2, CSS-3] receives Waypoint via auto-fetched /.schema/struct:*',
    async () => {
      // Note: we deliberately do NOT pass a `schema` option — the client must fetch the
      // Waypoint schema from the server's /.schema/struct:Waypoint topic at runtime.
      const topic = nt.getStructTopic<Waypoint>('/MyTable/Waypoint', {
        typeName: 'Waypoint',
        validator: waypointSchema,
      });

      const value = await waitForValue<Waypoint>(
        topic,
        (v) =>
          v != null &&
          typeof v.x === 'number' &&
          typeof v.y === 'number' &&
          typeof v.heading === 'number' &&
          typeof v.id === 'number',
        'Waypoint value timeout'
      );

      // CSS-2: int32 field decodes as an integer with the exact server-published value.
      expect(Number.isInteger(value.id)).toBe(true);
      expect(value.id).toBe(7);

      // CSS-3: double fields round-trip to within floating-point precision.
      expect(value.x).toBeCloseTo(1.25);
      expect(value.y).toBeCloseTo(-2.5);
      expect(value.heading).toBeCloseTo(Math.PI / 3);
    },
    VALUE_WAIT_MS + 5_000
  );
});
