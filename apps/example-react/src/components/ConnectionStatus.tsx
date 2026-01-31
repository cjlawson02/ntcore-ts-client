import { useConnectionStatus } from '@ntcore/react';

export function ConnectionStatus() {
  const { connected, rtt } = useConnectionStatus();
  return (
    <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
      {connected ? 'CONNECTED' : 'NOT CONNECTED'}
      {connected && rtt >= 0 && (
        <span className="rtt" aria-label={`Round-trip time ${rtt} ms`}>
          {' '}
          · {rtt} ms
        </span>
      )}
    </span>
  );
}
