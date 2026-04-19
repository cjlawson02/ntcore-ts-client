import './AutoModeCard.scss';
import { useTopic, NetworkTablesTypeInfos } from '@ntcore-ts/react';

const OPTIONS = ['Default', 'My Auto'];

export function AutoModeCard() {
  const { value, setValue, isReadyToWrite } = useTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, {
    defaultValue: 'Default',
    publish: { retained: true },
  });

  const displayValue = value ?? 'Default';

  return (
    <div className="card auto-mode">
      <h2>Auto Mode</h2>
      {setValue ? (
        <>
          <select
            value={displayValue}
            onChange={(e) => setValue(e.target.value)}
            disabled={!isReadyToWrite}
            aria-label="Auto mode"
            title={!isReadyToWrite ? 'Waiting for robot connection…' : undefined}
          >
            {OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <div className="auto-mode-status" aria-live="polite">
            {!isReadyToWrite ? (
              <span className="auto-mode-waiting">Waiting for robot…</span>
            ) : (
              <span className="auto-mode-confirmed">
                <span className="auto-mode-confirmed-icon" aria-hidden>
                  ✓
                </span>
                Robot will use: <strong>{displayValue}</strong>
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="auto-mode-status">{displayValue}</div>
      )}
    </div>
  );
}
