import './ConnectionStatus.scss';
import { useConnectionStatus } from '@ntcore/react';

type ConnectionStatusProps = {
  /** When set, clicking the indicator (when disconnected) opens the connection backdrop */
  onConnectionClick?: () => void;
};

export function ConnectionStatus({ onConnectionClick }: ConnectionStatusProps) {
  const { connected, rtt } = useConnectionStatus();
  const openBackdropOnClick = !connected && Boolean(onConnectionClick);

  return (
    <span
      className={`status ${connected ? 'connected' : 'disconnected'} ${openBackdropOnClick ? 'clickable' : ''}`}
      role={openBackdropOnClick ? 'button' : undefined}
      tabIndex={openBackdropOnClick ? 0 : undefined}
      onClick={openBackdropOnClick ? onConnectionClick : undefined}
      onKeyDown={
        openBackdropOnClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onConnectionClick?.();
              }
            }
          : undefined
      }
      aria-label={connected ? 'Connected to robot' : 'Not connected. Click to open connection settings.'}
    >
      {connected ? 'CONNECTED' : 'NOT CONNECTED'}
      {connected && rtt >= 0 && (
        <span className="rtt" aria-label={`Round-trip time ${rtt} ms`}>
          {' · '}
          {rtt} ms
        </span>
      )}
    </span>
  );
}
