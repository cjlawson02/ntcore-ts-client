import { useTopic, NetworkTablesTypeInfos } from '@ntcore/react';
import { ValueCard } from './ValueCard';
import './AccelerometerCard.scss';

const AXIS_MAX = 2; // ±2g or equivalent; values beyond clamp to bar ends

function AxisBar({ label, value, color }: { label: string; value: number | null; color: 'x' | 'y' }) {
  const normalized = value == null ? 0 : Math.max(-1, Math.min(1, value / AXIS_MAX));
  const percent = 50 + normalized * 50;

  return (
    <div className="axis-row">
      <span className={`axis-label axis-${color}`}>{label}</span>
      <div className="axis-track">
        <div className="axis-center" aria-hidden />
        <div className={`axis-fill axis-${color}`} style={{ width: `${percent}%` }} aria-hidden />
      </div>
      <span className="axis-value">{value != null ? value.toFixed(2) : '—'}</span>
    </div>
  );
}

interface AccelerometerCardProps {
  noCard?: boolean;
}

export function AccelerometerCard({ noCard }: AccelerometerCardProps = {}) {
  const { value: x } = useTopic<number>('/MyTable/Accelerometer/X', NetworkTablesTypeInfos.kDouble);
  const { value: y } = useTopic<number>('/MyTable/Accelerometer/Y', NetworkTablesTypeInfos.kDouble);

  const content = (
    <>
      <AxisBar label="X" value={x} color="x" />
      <AxisBar label="Y" value={y} color="y" />
    </>
  );

  if (noCard) {
    return (
      <div className="accelerometer-card">
        <div className="value">{content}</div>
      </div>
    );
  }
  return (
    <ValueCard title="Accelerometer" className="accelerometer-card">
      {content}
    </ValueCard>
  );
}
