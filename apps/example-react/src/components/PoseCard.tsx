import { z as zod } from 'zod';
import { useProtobufTopic } from '@ntcore/react';

const translation2dSchema = zod.object({ x: zod.number(), y: zod.number() });
const rotation2dSchema = zod.object({ value: zod.number() });
const pose2dSchema = zod.object({
  translation: translation2dSchema,
  rotation: rotation2dSchema,
});
type Pose2d = zod.infer<typeof pose2dSchema>;

export function PoseCard() {
  const [pose] = useProtobufTopic<Pose2d>('/MyTable/Pose', { validator: pose2dSchema });

  if (pose == null) {
    return (
      <div className="card">
        <h2>Pose</h2>
        <div className="value">—</div>
      </div>
    );
  }
  const { translation, rotation } = pose;
  return (
    <div className="card">
      <h2>Pose</h2>
      <div className="value">
        x: {translation.x.toFixed(2)} · y: {translation.y.toFixed(2)} · rot: {rotation.value.toFixed(2)}
      </div>
    </div>
  );
}
