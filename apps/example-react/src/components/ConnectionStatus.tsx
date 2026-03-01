import './ConnectionStatus.scss';
import { useConnectionStatus } from '@ntcore/react';

type ConnectionStatusProps = {
  /** When set, clicking the indicator opens the connection backdrop (disconnected or connected) */
  onConnectionClick?: () => void;
};

export function ConnectionStatus({ onConnectionClick }: ConnectionStatusProps) {
  const { connected, rtt } = useConnectionStatus();
  const isClickable = Boolean(onConnectionClick);

  return (
    <span
      className={`status ${connected ? 'connected' : 'disconnected'} ${isClickable ? 'clickable' : ''}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onConnectionClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onConnectionClick?.();
              }
            }
          : undefined
      }
      aria-label={
        connected
          ? 'Connected to robot. Click to change connection settings.'
          : 'Not connected. Click to open connection settings.'
      }
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
