import { useTopic, NetworkTablesTypeInfos } from '@ntcore/react';

const OPTIONS = ['Default', 'My Auto'];

export function AutoModeCard() {
  const [value, setValue, canPublish] = useTopic<string>(
    '/MyTable/AutoMode',
    NetworkTablesTypeInfos.kString,
    'Default',
    undefined,
    { retained: true }
  );

  const handleChange = (newValue: string) => {
    if (!canPublish) return;
    setValue?.(newValue);
  };

  return (
    <div className="card auto-mode">
      <h2>Auto Mode</h2>
      <div className="value">{value ?? 'Default'}</div>
      {canPublish && setValue && (
        <select value={value ?? 'Default'} onChange={(e) => handleChange(e.target.value)} aria-label="Auto mode">
          {OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
