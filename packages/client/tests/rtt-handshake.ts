import { decode, encode } from '@msgpack/msgpack';

import type WSMock from 'vitest-websocket-mock';

/**
 * Completes NT timestamp sync against a mock server: consumes the client's RTT ping
 * (`id=-1`, timestamp `0`) and injects the spec-required echo.
 *
 * Binary replies are injected via the socket's `onMessage` handler because
 * vitest-websocket-mock stringifies ArrayBuffer payloads.
 */
export async function completeRttHandshake(server: WSMock, socket: object, serverTime = 1_000_000): Promise<void> {
  const ping = await server.nextMessage;
  const bytes = toUint8Array(ping);
  const decoded = decode(bytes) as unknown[];
  const clientEcho = decoded[3];
  const reply = encode([-1, serverTime, 2, clientEcho]);
  const onMessage = (socket as Record<string, (event: { data: Uint8Array }) => void>)['onMessage'];
  if (typeof onMessage !== 'function') {
    throw new Error('Socket has no onMessage handler for RTT handshake');
  }
  onMessage.call(socket, { data: reply });
  const clearIdleTimer = (socket as { clearIdleTimer?: () => void }).clearIdleTimer;
  clearIdleTimer?.call(socket);
  await Promise.resolve();
}

/**
 * Mock servers do not echo later RTT pings. Clear the current timer and ignore later
 * inbound frames so long-lived fixtures are not killed by the 3s idle timeout.
 */
export function disableSocketIdleTimeout(socket: object): void {
  const target = socket as {
    clearIdleTimer?: () => void;
    resetIdleTimer?: () => void;
  };
  target.clearIdleTimer?.call(socket);
  target.resetIdleTimer = function resetIdleTimerDisabled() {
    target.clearIdleTimer?.call(socket);
  };
}

function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  if (typeof data === 'string') {
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
  throw new Error(`Unexpected RTT ping payload: ${Object.prototype.toString.call(data)}`);
}
