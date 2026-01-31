import { useTopic, NetworkTablesTypeInfos } from '@ntcore/react';

export function GyroCard() {
  const [value] = useTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);
  return (
    <div className="card">
      <h2>Gyro</h2>
      <div className="value">{value != null ? value.toFixed(3) : '—'}</div>
    </div>
  );
}
