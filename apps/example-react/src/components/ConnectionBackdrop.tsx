import './ConnectionBackdrop.scss';
import { KeyboardEvent, useEffect, useState } from 'react';
import { useNtcore } from '@ntcore/react';
import { HelpDialog } from './HelpDialog';

type ConnectionBackdropProps = {
  open: boolean;
  onClose: (escape: boolean) => void;
};

export function ConnectionBackdrop({ open, onClose }: ConnectionBackdropProps) {
  const nt = useNtcore();
  const [uri, setUri] = useState('');
  const [port, setPort] = useState(5810);
  const [helpOpen, setHelpOpen] = useState(false);

  // Sync form from current client when available
  useEffect(() => {
    if (!nt) return;
    setUri(nt.getURI());
    setPort(nt.getPort());
  }, [nt]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      nt?.stopAutoConnect();
      onClose(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nt?.changeURI(uri, port);
  };

  return (
    <>
      {open && (
        <div
          className="connection-backdrop"
          role="region"
          aria-label="Connect to the robot"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="connection-backdrop__content">
            <p className="connection-backdrop__heading">Connect to the robot</p>
            <form onSubmit={handleSubmit} className="connection-backdrop__form">
              <label className="connection-backdrop__label">
                <span>Server address</span>
                <input
                  type="text"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="e.g. localhost or roborio-973-frc.local"
                  className="connection-backdrop__input"
                  autoComplete="off"
                />
              </label>
              <label className="connection-backdrop__label connection-backdrop__label--port">
                <span>Port</span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || 5810)}
                  className="connection-backdrop__input connection-backdrop__input--port"
                />
              </label>
              <button type="submit" className="connection-backdrop__submit">
                Connect
              </button>
            </form>
            <p className="connection-backdrop__escape">Press Escape to dismiss and stop auto-reconnect.</p>
            <button
              type="button"
              className="connection-backdrop__help"
              onClick={() => setHelpOpen(true)}
              aria-haspopup="dialog"
            >
              Need help?
            </button>
          </div>
        </div>
      )}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
