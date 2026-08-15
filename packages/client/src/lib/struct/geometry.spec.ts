import {
  Pose2d,
  Pose2dSchema,
  Pose3d,
  Pose3dSchema,
  Quaternion,
  QuaternionSchema,
  Rotation2d,
  Rotation2dSchema,
  Rotation3d,
  Rotation3dSchema,
  Transform2d,
  Transform2dSchema,
  Transform3d,
  Transform3dSchema,
  Translation2d,
  Translation2dSchema,
  Translation3d,
  Translation3dSchema,
  Twist2d,
  Twist2dSchema,
  Twist3d,
  Twist3dSchema,
} from './geometry';

describe('geometry', () => {
  describe('Pose2dSchema', () => {
    it('parses a valid Pose2d unpack shape', () => {
      const value = {
        translation: { x: 1, y: 2 },
        rotation: { value: 0.5 },
      };
      expect(Pose2dSchema.parse(value)).toEqual(value);
    });

    it('rejects missing nested fields', () => {
      expect(() => Pose2dSchema.parse({ translation: { x: 1 } })).toThrow();
    });
  });

  describe('2d schemas', () => {
    it('parses Translation2d, Rotation2d, Transform2d, and Twist2d', () => {
      expect(Translation2dSchema.parse({ x: 1.5, y: -2.25 })).toEqual({ x: 1.5, y: -2.25 });
      expect(Rotation2dSchema.parse({ value: 1.2 })).toEqual({ value: 1.2 });
      expect(Transform2dSchema.parse({ translation: { x: 0, y: 1 }, rotation: { value: 0 } })).toEqual({
        translation: { x: 0, y: 1 },
        rotation: { value: 0 },
      });
      expect(Twist2dSchema.parse({ dx: 1, dy: 2, dtheta: 3 })).toEqual({ dx: 1, dy: 2, dtheta: 3 });
    });
  });

  describe('3d schemas', () => {
    it('parses Translation3d, Quaternion, Rotation3d, Pose3d, Transform3d, and Twist3d', () => {
      expect(Translation3dSchema.parse({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
      expect(QuaternionSchema.parse({ w: 1, x: 0, y: 0, z: 0 })).toEqual({ w: 1, x: 0, y: 0, z: 0 });
      expect(Rotation3dSchema.parse({ q: { w: 1, x: 0, y: 0, z: 0 } })).toEqual({
        q: { w: 1, x: 0, y: 0, z: 0 },
      });
      const pose3d = {
        translation: { x: 1, y: 2, z: 3 },
        rotation: { q: { w: 1, x: 0, y: 0, z: 0 } },
      };
      expect(Pose3dSchema.parse(pose3d)).toEqual(pose3d);
      expect(Transform3dSchema.parse(pose3d)).toEqual(pose3d);
      expect(Twist3dSchema.parse({ dx: 1, dy: 2, dz: 3, rx: 4, ry: 5, rz: 6 })).toEqual({
        dx: 1,
        dy: 2,
        dz: 3,
        rx: 4,
        ry: 5,
        rz: 6,
      });
    });
  });

  describe('struct descriptors', () => {
    it('exposes WPILib-style typeName and schema on each geometry type', () => {
      const descriptors = [
        Translation2d,
        Rotation2d,
        Pose2d,
        Transform2d,
        Twist2d,
        Translation3d,
        Quaternion,
        Rotation3d,
        Pose3d,
        Transform3d,
        Twist3d,
      ];
      for (const descriptor of descriptors) {
        expect(descriptor.typeName).toBeTruthy();
        expect(typeof descriptor.schema.parse).toBe('function');
      }
      expect(Pose2d.typeName).toBe('Pose2d');
      expect(Pose2d.schema).toBe(Pose2dSchema);
    });
  });
});
