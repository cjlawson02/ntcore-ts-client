import { useTopic, NetworkTablesTypeInfos } from '@ntcore/react';
import { mathDegreesToDisplayDegrees, normalizeDegrees, useShortestPathDisplay } from '../utils/angle';
import { ValueCard } from './ValueCard';
import './GyroCard.scss';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

const GYRO_SIZE = 88;
const GYRO_CX = GYRO_SIZE / 2;
const GYRO_CY = GYRO_SIZE / 2;
const GYRO_R = GYRO_SIZE / 2 - 2; // radius to inner edge of ring (2px stroke sits outside this)
const TICK_MINOR_LEN = 4;
const TICK_EIGHTH_LEN = 6; // 45°, 135°, 225°, 315°
const TICK_QUARTER_LEN = 8; // 0°, 90°, 180°, 270°

function headingToCardinal(degrees: number): string {
  const normalized = normalizeDegrees(degrees);
  const index = Math.round(normalized / 45) % 8;
  return CARDINALS[index];
}

function GyroTicks() {
  // 72 ticks every 5° so quarters (0,90,180,270) and eighths (45,135,225,315) land on ticks
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const deg = i * 5; // 0° at index 0 (north/top)
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const isQuarter = i % 18 === 0; // 0°, 90°, 180°, 270°
    const isEighth = i % 9 === 0 && !isQuarter; // 45°, 135°, 225°, 315°
    const len = isQuarter ? TICK_QUARTER_LEN : isEighth ? TICK_EIGHTH_LEN : TICK_MINOR_LEN;
    const rInner = GYRO_R - len;
    const x1 = GYRO_CX + GYRO_R * sin;
    const y1 = GYRO_CY - GYRO_R * cos;
    const x2 = GYRO_CX + rInner * sin;
    const y2 = GYRO_CY - rInner * cos;
    const className = isQuarter ? 'gyro-tick-quarter' : isEighth ? 'gyro-tick-eighth' : 'gyro-tick-minor';
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={className} />;
  });
  return <g>{ticks}</g>;
}

function GyroContent() {
  const { value } = useTopic<number>('/MyTable/Gyro', NetworkTablesTypeInfos.kDouble);
  // Robot sends math angle (0° = +X, CCW); convert to display (0° = up, CW) for needle/cardinal
  const displayAngle = value != null ? mathDegreesToDisplayDegrees(value) : null;
  const normalized = displayAngle != null ? normalizeDegrees(displayAngle) : null;
  const needleDegrees = useShortestPathDisplay(normalized);

  return (
    <>
      <div className="gyro-indicator" aria-hidden>
        <div className="gyro-compass">
          <svg className="gyro-svg" viewBox={`0 0 ${GYRO_SIZE} ${GYRO_SIZE}`} aria-hidden>
            <circle className="gyro-circle" cx={GYRO_CX} cy={GYRO_CY} r={GYRO_R} />
            <GyroTicks />
          </svg>
        </div>
        <div className="gyro-needle" style={{ transform: `rotate(${needleDegrees}deg)` }} aria-hidden />
      </div>
      <div className="gyro-readout">
        <span className="gyro-degrees">{normalized != null ? normalized.toFixed(1) : '—'}°</span>
        {normalized != null && <span className="gyro-cardinal">{headingToCardinal(normalized)}</span>}
      </div>
    </>
  );
}

interface GyroCardProps {
  noCard?: boolean;
}

export function GyroCard({ noCard }: GyroCardProps = {}) {
  if (noCard) {
    return (
      <div className="gyro-card">
        <div className="value">
          <GyroContent />
        </div>
      </div>
    );
  }
  return (
    <ValueCard title="Gyro" className="gyro-card">
      <GyroContent />
    </ValueCard>
  );
}
