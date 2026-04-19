/**
 * Shared helpers & schemas for the e2e specs in this folder.
 *
 * Each `*.spec.ts` file in this folder corresponds 1:1 to a feature spec
 * under `apps/example-client/specs/`. Tests reference acceptance criteria
 * IDs (e.g. `SUB-1`) from those spec files in their titles.
 */
import { z as zod } from 'zod';

import type { NetworkTables } from '@ntcore-ts/client';

export const NT_SERVER_HOST = 'localhost';
export const NT_SERVER_PORT = 5810;
export const CONNECTION_WAIT_MS = 10_000;
export const VALUE_WAIT_MS = 10_000;

export const translation2dSchema = zod.object({
  x: zod.number(),
  y: zod.number(),
});

export const rotation2dSchema = zod.object({
  value: zod.number(),
});

export const pose2dSchema = zod.object({
  translation: translation2dSchema,
  rotation: rotation2dSchema,
});

export type Pose2d = zod.infer<typeof pose2dSchema>;

/** Resolves once the NT client reports `connected=true`, or rejects on timeout. */
export function waitForConnection(nt: NetworkTables, timeoutMs = CONNECTION_WAIT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs);
    const remove = nt.addRobotConnectionListener((connected: boolean) => {
      if (connected) {
        clearTimeout(timeout);
        remove();
        resolve();
      }
    }, true);
  });
}

/**
 * Subscribes to `topic` and resolves with the first value that passes `predicate`.
 * Rejects after `timeoutMs` with `message` if no matching value arrives.
 */
export function waitForValue<T>(
  topic: { subscribe: (cb: (value: T | null) => void) => void },
  predicate: (value: T) => boolean,
  message: string,
  timeoutMs = VALUE_WAIT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${message} (after ${timeoutMs}ms)`)), timeoutMs);
    topic.subscribe((value) => {
      if (value != null && predicate(value as T)) {
        clearTimeout(timer);
        resolve(value as T);
      }
    });
  });
}
