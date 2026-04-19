import { z } from 'zod';
import { useStructTopic } from '@ntcore-ts/react';
import { mathDegreesToDisplayDegrees, normalizeDegrees, useShortestPathDisplay } from '../utils/angle';
import { ValueCard } from './ValueCard';
import './PoseCard.scss';

const translation2dSchema = z.object({ x: z.number(), y: z.number() });
const rotation2dSchema = z.object({ value: z.number() });
const pose2dSchema = z.object({
  translation: translation2dSchema,
  rotation: rotation2dSchema,
});
type Pose2d = z.infer<typeof pose2dSchema>;

const FIELD_HALF = 4;

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function PoseStructCard() {
  const { value: pose } = useStructTopic<Pose2d>('/MyTable/PoseStruct', {
    typeName: 'Pose2d',
    validator: pose2dSchema,
  });

  const x = pose?.translation.x ?? 0;
  const y = pose?.translation.y ?? 0;
  const rotRad = pose?.rotation.value ?? 0;
  const rotDeg = radToDeg(rotRad);
  const displayAngleDeg = pose != null ? mathDegreesToDisplayDegrees(rotDeg) : null;
  const normalized = displayAngleDeg != null ? normalizeDegrees(displayAngleDeg) : null;
  const displayRotation = useShortestPathDisplay(normalized);

  const percentX = 50 + (x / FIELD_HALF) * 50;
  const percentY = 50 - (y / FIELD_HALF) * 50;

  return (
    <ValueCard title="Pose (Struct)" className="pose-card">
      <div className="pose-field" aria-label="Robot pose on field (struct topic, top-down)">
        <div className="pose-grid" aria-hidden />
        <div
          className="pose-robot"
          style={{
            left: `${Math.max(5, Math.min(95, percentX))}%`,
            top: `${Math.max(5, Math.min(95, percentY))}%`,
            transform: `translate(-50%, -50%) rotate(${displayRotation}deg)`,
          }}
          aria-hidden
        />
      </div>
      <div className="pose-readout">
        <span>x: {pose != null ? pose.translation.x.toFixed(2) : '—'}</span>
        <span>y: {pose != null ? pose.translation.y.toFixed(2) : '—'}</span>
        <span>rot: {pose != null ? pose.rotation.value.toFixed(2) : '—'} rad</span>
      </div>
    </ValueCard>
  );
}
