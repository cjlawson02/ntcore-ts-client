import './HelpDialog.scss';
import type { ReactNode } from 'react';

const DEFAULT_HELP_CONTENT = (
  <>
    <ol className="help-dialog__steps">
      <li>Connect to the robot&apos;s network or FMS.</li>
      <li>
        If the dashboard doesn&apos;t automatically connect, set &quot;Server address&quot; to the robot&apos;s host
        (e.g. <code>roborio-973-frc.local</code> or <code>localhost</code> for simulation).
      </li>
      <li>
        Enter the port (default <code>5810</code>) and click Connect.
      </li>
    </ol>
    <p className="help-dialog__hint">
      Press <kbd>Escape</kbd> on the connection screen to dismiss it and stop auto-reconnect (e.g. to use the app
      offline).
    </p>
  </>
);

export interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
}

export function HelpDialog({ open, onClose, title = 'Connect to the robot', children }: HelpDialogProps) {
  if (!open) return null;

  return (
    <div className="help-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title">
      <div className="help-dialog">
        <h2 id="help-dialog-title" className="help-dialog__title">
          {title}
        </h2>
        <div className="help-dialog__content">{children ?? DEFAULT_HELP_CONTENT}</div>
        <div className="help-dialog__actions">
          <button type="button" className="help-dialog__close" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
