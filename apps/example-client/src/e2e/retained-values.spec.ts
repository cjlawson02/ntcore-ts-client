/**
 * E2E: Retained Values & Connection Lifecycle
 *
 * Spec: apps/example-client/specs/retained-values.md
 *
 * Every test title below starts with the acceptance criteria IDs it covers
 * (e.g. `[RET-1, RET-2, RET-3] ...`). Keep this file and the spec
 * in sync — see apps/example-client/specs/README.md for the rules.
 */
/// <reference types="vitest/globals" />
import { NetworkTables, NetworkTablesTypeInfos } from '@ntcore-ts/client';

import { CONNECTION_WAIT_MS, NT_SERVER_HOST, NT_SERVER_PORT, VALUE_WAIT_MS, waitForConnection } from './_support';

describe('Feature: Retained Values & Connection Lifecycle', () => {
  const nt = NetworkTables.getInstanceByURI(NT_SERVER_HOST, NT_SERVER_PORT);

  beforeAll(async () => {
    // RET-3: initial connection listener fires with connected=true within timeout.
    await waitForConnection(nt);
  }, CONNECTION_WAIT_MS + 2_000);

  it(
    '[RET-1, RET-2, RET-3] retained AutoMode survives changeURI reconnect',
    async () => {
      const autoModeValue = 'E2E Retained After Reconnect';

      // RET-1: publish with retained=true and setValue.
      const autoModeTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
      await autoModeTopic.publish({ retained: true });
      autoModeTopic.setValue(autoModeValue);

      // RET-2 + RET-3: changeURI triggers a disconnect+reconnect, and
      // the retained value is re-delivered to a fresh subscriber.
      nt.changeURI(NT_SERVER_HOST, NT_SERVER_PORT);
      await waitForConnection(nt);

      const retained = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Retained readback timeout')), VALUE_WAIT_MS);
        const readTopic = nt.createTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, 'Default');
        readTopic.subscribe((v) => {
          if (v != null && v === autoModeValue) {
            clearTimeout(t);
            resolve(v);
          }
        });
      });

      expect(retained).toBe(autoModeValue);
    },
    VALUE_WAIT_MS + CONNECTION_WAIT_MS + 5_000
  );
});
