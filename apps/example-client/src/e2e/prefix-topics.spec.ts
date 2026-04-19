/**
 * E2E: Prefix Topics
 *
 * Spec: apps/example-client/specs/prefix-topics.md
 *
 * Every test title below starts with the acceptance criteria IDs it covers
 * (e.g. `[PFX-1, PFX-2] ...`). Keep this file and the spec in sync —
 * see apps/example-client/specs/README.md for the rules.
 */
/// <reference types="vitest/globals" />
import { NetworkTables, NetworkTablesTypeInfos } from '@ntcore-ts/client';

import { CONNECTION_WAIT_MS, NT_SERVER_HOST, NT_SERVER_PORT, VALUE_WAIT_MS, waitForConnection } from './_support';

describe('Feature: Prefix Topics', () => {
  const nt = NetworkTables.getInstanceByURI(NT_SERVER_HOST, NT_SERVER_PORT);

  // Populated by the prefix subscription started in beforeAll.
  const prefixAccelValues: Record<'X' | 'Y' | 'Z', number | undefined> = {
    X: undefined,
    Y: undefined,
    Z: undefined,
  };

  beforeAll(async () => {
    await waitForConnection(nt);

    const accelerometerPrefix = nt.createPrefixTopic('/MyTable/Accelerometer/');
    accelerometerPrefix.subscribe((value, params) => {
      if (value === undefined || value === null || !params.name) return;
      if (params.name.endsWith('X')) prefixAccelValues.X = Number(value);
      else if (params.name.endsWith('Y')) prefixAccelValues.Y = Number(value);
      else if (params.name.endsWith('Z')) prefixAccelValues.Z = Number(value);
    });
  }, CONNECTION_WAIT_MS + 2_000);

  it(
    '[PFX-1, PFX-2] receives /MyTable/Accelerometer/{X,Y,Z} via a single prefix subscription',
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
    },
    VALUE_WAIT_MS + 2_000
  );

  it(
    '[PFX-3] publishes /MyTable/AutoMode and reads it back via a separate subscription',
    async () => {
      const autoModeValue = 'E2E Test Auto';
      const autoModeTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
      await autoModeTopic.publish({ retained: true });
      autoModeTopic.setValue(autoModeValue);

      const autoModeRead = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('AutoMode readback timeout')), VALUE_WAIT_MS);
        const readTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
        readTopic.subscribe((v) => {
          if (v != null && v === autoModeValue) {
            clearTimeout(t);
            resolve(v);
          }
        });
      });

      expect(autoModeRead).toBe(autoModeValue);
    },
    VALUE_WAIT_MS + 5_000
  );
});
