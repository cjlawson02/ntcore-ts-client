import { z } from 'zod';

import { BUILT_IN_STRUCT_TYPE_NAMES } from './built-in-schemas';

/** WPILib built-in struct type names (geometry). */
export type BuiltInStructTypeName = (typeof BUILT_IN_STRUCT_TYPE_NAMES)[number];

/**
 * Struct type name accepted by getStructTopic.
 * Built-in names, their array forms, or any custom type string.
 */
export type StructTypeName = BuiltInStructTypeName | `${BuiltInStructTypeName}[]` | (string & {});

/**
 * WPILib-style struct type descriptor (e.g. `Pose2d`) used to infer the topic value type.
 * `schema` is a Zod schema matching the unpacked plain-object shape.
 */
export interface StructTypeDescriptor<T extends object = object> {
  readonly typeName: string;
  readonly schema: z.ZodType<T>;
}

function isZodType(value: unknown): value is z.ZodType<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { parse?: unknown }).parse === 'function';
}

/**
 * Returns true when the argument is a WPILib-style struct type descriptor (e.g. `Pose2d`).
 * @param value - The value to check.
 * @returns Whether the value is a struct type descriptor.
 */
export function isStructTypeDescriptor(value: unknown): value is StructTypeDescriptor<object> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { typeName?: unknown }).typeName === 'string' &&
    isZodType((value as { schema?: unknown }).schema)
  );
}

// ---------------------------------------------------------------------------
// 2D geometry
// ---------------------------------------------------------------------------

/** Unpacked `Translation2d` (`double x; double y`). */
export interface Translation2d {
  x: number;
  y: number;
}

/** Zod schema for {@link Translation2d}. */
export const Translation2dSchema: z.ZodType<Translation2d> = z.object({
  x: z.number(),
  y: z.number(),
});

/** WPILib-style `Translation2d.struct` descriptor. */
export const Translation2d: StructTypeDescriptor<Translation2d> = {
  typeName: 'Translation2d',
  schema: Translation2dSchema,
};

/** Unpacked `Rotation2d` (`double value`). */
export interface Rotation2d {
  value: number;
}

/** Zod schema for {@link Rotation2d}. */
export const Rotation2dSchema: z.ZodType<Rotation2d> = z.object({
  value: z.number(),
});

/** WPILib-style `Rotation2d.struct` descriptor. */
export const Rotation2d: StructTypeDescriptor<Rotation2d> = {
  typeName: 'Rotation2d',
  schema: Rotation2dSchema,
};

/** Unpacked `Pose2d` (`Translation2d translation; Rotation2d rotation`). */
export interface Pose2d {
  translation: Translation2d;
  rotation: Rotation2d;
}

/** Zod schema for {@link Pose2d}. */
export const Pose2dSchema: z.ZodType<Pose2d> = z.object({
  translation: Translation2dSchema,
  rotation: Rotation2dSchema,
});

/** WPILib-style `Pose2d.struct` descriptor. */
export const Pose2d: StructTypeDescriptor<Pose2d> = {
  typeName: 'Pose2d',
  schema: Pose2dSchema,
};

/** Unpacked `Transform2d` (`Translation2d translation; Rotation2d rotation`). */
export interface Transform2d {
  translation: Translation2d;
  rotation: Rotation2d;
}

/** Zod schema for {@link Transform2d}. */
export const Transform2dSchema: z.ZodType<Transform2d> = z.object({
  translation: Translation2dSchema,
  rotation: Rotation2dSchema,
});

/** WPILib-style `Transform2d.struct` descriptor. */
export const Transform2d: StructTypeDescriptor<Transform2d> = {
  typeName: 'Transform2d',
  schema: Transform2dSchema,
};

/** Unpacked `Twist2d` (`double dx; double dy; double dtheta`). */
export interface Twist2d {
  dx: number;
  dy: number;
  dtheta: number;
}

/** Zod schema for {@link Twist2d}. */
export const Twist2dSchema: z.ZodType<Twist2d> = z.object({
  dx: z.number(),
  dy: z.number(),
  dtheta: z.number(),
});

/** WPILib-style `Twist2d.struct` descriptor. */
export const Twist2d: StructTypeDescriptor<Twist2d> = {
  typeName: 'Twist2d',
  schema: Twist2dSchema,
};

// ---------------------------------------------------------------------------
// 3D geometry
// ---------------------------------------------------------------------------

/** Unpacked `Translation3d` (`double x; double y; double z`). */
export interface Translation3d {
  x: number;
  y: number;
  z: number;
}

/** Zod schema for {@link Translation3d}. */
export const Translation3dSchema: z.ZodType<Translation3d> = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

/** WPILib-style `Translation3d.struct` descriptor. */
export const Translation3d: StructTypeDescriptor<Translation3d> = {
  typeName: 'Translation3d',
  schema: Translation3dSchema,
};

/** Unpacked `Quaternion` (`double w; double x; double y; double z`). */
export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

/** Zod schema for {@link Quaternion}. */
export const QuaternionSchema: z.ZodType<Quaternion> = z.object({
  w: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

/** WPILib-style `Quaternion.struct` descriptor. */
export const Quaternion: StructTypeDescriptor<Quaternion> = {
  typeName: 'Quaternion',
  schema: QuaternionSchema,
};

/** Unpacked `Rotation3d` (`Quaternion q`). */
export interface Rotation3d {
  q: Quaternion;
}

/** Zod schema for {@link Rotation3d}. */
export const Rotation3dSchema: z.ZodType<Rotation3d> = z.object({
  q: QuaternionSchema,
});

/** WPILib-style `Rotation3d.struct` descriptor. */
export const Rotation3d: StructTypeDescriptor<Rotation3d> = {
  typeName: 'Rotation3d',
  schema: Rotation3dSchema,
};

/** Unpacked `Pose3d` (`Translation3d translation; Rotation3d rotation`). */
export interface Pose3d {
  translation: Translation3d;
  rotation: Rotation3d;
}

/** Zod schema for {@link Pose3d}. */
export const Pose3dSchema: z.ZodType<Pose3d> = z.object({
  translation: Translation3dSchema,
  rotation: Rotation3dSchema,
});

/** WPILib-style `Pose3d.struct` descriptor. */
export const Pose3d: StructTypeDescriptor<Pose3d> = {
  typeName: 'Pose3d',
  schema: Pose3dSchema,
};

/** Unpacked `Transform3d` (`Translation3d translation; Rotation3d rotation`). */
export interface Transform3d {
  translation: Translation3d;
  rotation: Rotation3d;
}

/** Zod schema for {@link Transform3d}. */
export const Transform3dSchema: z.ZodType<Transform3d> = z.object({
  translation: Translation3dSchema,
  rotation: Rotation3dSchema,
});

/** WPILib-style `Transform3d.struct` descriptor. */
export const Transform3d: StructTypeDescriptor<Transform3d> = {
  typeName: 'Transform3d',
  schema: Transform3dSchema,
};

/** Unpacked `Twist3d` (`double dx; double dy; double dz; double rx; double ry; double rz`). */
export interface Twist3d {
  dx: number;
  dy: number;
  dz: number;
  rx: number;
  ry: number;
  rz: number;
}

/** Zod schema for {@link Twist3d}. */
export const Twist3dSchema: z.ZodType<Twist3d> = z.object({
  dx: z.number(),
  dy: z.number(),
  dz: z.number(),
  rx: z.number(),
  ry: z.number(),
  rz: z.number(),
});

/** WPILib-style `Twist3d.struct` descriptor. */
export const Twist3d: StructTypeDescriptor<Twist3d> = {
  typeName: 'Twist3d',
  schema: Twist3dSchema,
};
