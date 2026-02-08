import './AutoModeCard.scss';
import { useTopic, NetworkTablesTypeInfos } from '@ntcore/react';

const OPTIONS = ['Default', 'My Auto'];

export function AutoModeCard() {
  const { value, setValue, isReadyToWrite } = useTopic<string>('/MyTable/AutoMode', NetworkTablesTypeInfos.kString, {
    defaultValue: 'Default',
    publish: { retained: true },
  });

  return (
    <div className="card auto-mode">
      <h2>Auto Mode</h2>
      <div className="value">{value ?? 'Default'}</div>
      {setValue && (
        <>
          <select
            value={value ?? 'Default'}
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
          {!isReadyToWrite && (
            <span className="auto-mode-waiting" aria-live="polite">
              Waiting for robot…
            </span>
          )}
        </>
      )}
    </div>
  );
}
