import { useTopic, NetworkTablesTypeInfos } from '@ntcore/react';

export function AccelerometerCard() {
  const [x] = useTopic<number>('/MyTable/Accelerometer/X', NetworkTablesTypeInfos.kDouble);
  const [y] = useTopic<number>('/MyTable/Accelerometer/Y', NetworkTablesTypeInfos.kDouble);
  const [z] = useTopic<number>('/MyTable/Accelerometer/Z', NetworkTablesTypeInfos.kDouble);
  return (
    <div className="card">
      <h2>Accelerometer</h2>
      <div className="value">
        X: {x != null ? x.toFixed(2) : '—'} · Y: {y != null ? y.toFixed(2) : '—'} · Z: {z != null ? z.toFixed(2) : '—'}
      </div>
    </div>
  );
}
