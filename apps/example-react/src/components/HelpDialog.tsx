import './HelpDialog.scss';
import type { ReactNode } from 'react';

const DEFAULT_HELP_CONTENT = (
  <ol className="help-dialog__steps">
    <li>Connect to the robot&apos;s network or FMS.</li>
    <li>
      If the dashboard doesn&apos;t automatically connect, choose &quot;Team number&quot; and enter your team (e.g.{' '}
      <code>973</code>), picking SystemCore (<code>10.TE.AM.2</code>) or RoboRIO (
      <code>roborio-&lt;team&gt;-frc.local</code>
      ). Or choose &quot;Address&quot; for a hostname (e.g. <code>localhost</code> or <code>robot.local</code>) and
      optionally the port.
    </li>
    <li>Click Connect.</li>
  </ol>
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
