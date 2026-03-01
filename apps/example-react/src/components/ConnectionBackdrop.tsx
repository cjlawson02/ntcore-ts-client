import './ConnectionBackdrop.scss';
import { useEffect, useState } from 'react';
import { useConnectionStatus, useNtcore } from '@ntcore/react';
import { HelpDialog } from './HelpDialog';

type ConnectionBackdropProps = {
  open: boolean;
  onClose: () => void;
};

type ConnectionMode = 'team' | 'address';

export function ConnectionBackdrop({ open, onClose }: ConnectionBackdropProps) {
  const nt = useNtcore();
  const { connected } = useConnectionStatus();
  const [mode, setMode] = useState<ConnectionMode>('team');
  const [team, setTeam] = useState('973');
  const [uri, setUri] = useState('');
  const [port, setPort] = useState(5810);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!open) setHelpOpen(false);
  }, [open]);

  useEffect(() => {
    if (connected && isConnecting) setIsConnecting(false);
  }, [connected, isConnecting]);

  const handleFormChange = () => {
    nt?.stopAutoConnect();
    setIsConnecting(false);
  };

  useEffect(() => {
    if (!nt) return;
    const currentUri = nt.getURI();
    const match = currentUri.match(/^roborio-(\d+)-frc\.local$/);
    if (match) {
      setMode('team');
      setTeam(match[1]);
    } else {
      setUri(currentUri);
    }
    setPort(nt.getPort());
  }, [nt]);

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectivePort = mode === 'address' ? port : 5810;
    if (mode === 'team') {
      const teamNum = parseInt(team.trim(), 10);
      if (!Number.isFinite(teamNum) || teamNum < 1 || teamNum > 99999) return;
      setIsConnecting(true);
      nt?.changeURI(`roborio-${teamNum}-frc.local`, effectivePort);
    } else {
      const trimmed = uri.trim();
      if (!trimmed) return;
      setIsConnecting(true);
      nt?.changeURI(trimmed, effectivePort);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="connection-dialog-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-dialog-title"
      >
        <div className="connection-dialog">
          <div className="connection-dialog__header">
            <button
              type="button"
              className="connection-dialog__help"
              onClick={() => setHelpOpen(true)}
              aria-label="Help"
            >
              ?
            </button>
            <h2 id="connection-dialog-title" className="connection-dialog__title">
              Connect to the robot
            </h2>
            <button type="button" className="connection-dialog__close" onClick={handleClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className="connection-dialog__body">
            <form onSubmit={handleSubmit} className="connection-dialog__form">
              <fieldset className="connection-dialog__fieldset">
                <legend className="connection-dialog__legend">Connection type</legend>
                <label className="connection-dialog__radio">
                  <input
                    type="radio"
                    name="mode"
                    value="team"
                    checked={mode === 'team'}
                    onChange={() => {
                      handleFormChange();
                      setMode('team');
                    }}
                  />
                  <span>Team number</span>
                </label>
                <label className="connection-dialog__radio">
                  <input
                    type="radio"
                    name="mode"
                    value="address"
                    checked={mode === 'address'}
                    onChange={() => {
                      handleFormChange();
                      setMode('address');
                    }}
                  />
                  <span>Address</span>
                </label>
              </fieldset>
              {mode === 'team' ? (
                <label className="connection-dialog__label">
                  <span>Team number</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={team}
                    onChange={(e) => {
                      handleFormChange();
                      setTeam(e.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="e.g. 973"
                    className="connection-dialog__input"
                    autoComplete="off"
                  />
                </label>
              ) : (
                <div className="connection-dialog__form-row">
                  <label className="connection-dialog__label">
                    <span>Robot address</span>
                    <input
                      type="text"
                      value={uri}
                      onChange={(e) => {
                        handleFormChange();
                        setUri(e.target.value);
                      }}
                      placeholder="e.g. localhost or roborio-973-frc.local"
                      className="connection-dialog__input"
                      autoComplete="off"
                    />
                  </label>
                  <label className="connection-dialog__label connection-dialog__label--port">
                    <span>Port</span>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={port}
                      onChange={(e) => {
                        handleFormChange();
                        setPort(Number(e.target.value) || 5810);
                      }}
                      className="connection-dialog__input connection-dialog__input--port"
                    />
                  </label>
                </div>
              )}
              <button
                type="submit"
                className="connection-dialog__submit"
                disabled={isConnecting}
                aria-busy={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <span className="connection-dialog__submit-spinner" aria-hidden />
                    Connecting…
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
