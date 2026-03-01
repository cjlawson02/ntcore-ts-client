import { buildStructDescriptor, parseSchema } from './struct-parser';
import type { StructDescriptor } from './struct-descriptor';

const SCHEMAS: Record<string, string> = {
  Translation2d: 'double x;double y',
  Rotation2d: 'double value',
  Pose2d: 'Translation2d translation;Rotation2d rotation',
  Transform2d: 'Translation2d translation;Rotation2d rotation',
  Twist2d: 'double dx;double dy;double dtheta',
  Translation3d: 'double x;double y;double z',
  Quaternion: 'double w;double x;double y;double z',
  Rotation3d: 'Quaternion q',
  Pose3d: 'Translation3d translation;Rotation3d rotation',
  Transform3d: 'Translation3d translation;Rotation3d rotation',
  Twist3d: 'double dx;double dy;double dz;double rx;double ry;double rz',
};

const builtInDescriptors = new Map<string, StructDescriptor>();

function getBuiltIn(name: string): StructDescriptor | null {
  return builtInDescriptors.get(name) ?? null;
}

function initBuiltIns(): void {
  const order = [
    'Translation2d',
    'Rotation2d',
    'Translation3d',
    'Quaternion',
    'Pose2d',
    'Transform2d',
    'Twist2d',
    'Rotation3d',
    'Pose3d',
    'Transform3d',
    'Twist3d',
  ];
  for (const typeName of order) {
    if (builtInDescriptors.has(typeName)) continue;
    const schema = SCHEMAS[typeName];
    if (!schema) continue;
    const fields = parseSchema(schema);
    const descriptor = buildStructDescriptor(typeName, fields, getBuiltIn);
    builtInDescriptors.set(typeName, descriptor);
  }
}

export function getBuiltInDescriptor(typeName: string): StructDescriptor | null {
  if (builtInDescriptors.size === 0) initBuiltIns();
  const cached = builtInDescriptors.get(typeName);
  if (cached) return cached;
  const schema = SCHEMAS[typeName];
  if (!schema) return null;
  const fields = parseSchema(schema);
  const descriptor = buildStructDescriptor(typeName, fields, getBuiltIn);
  builtInDescriptors.set(typeName, descriptor);
  return descriptor;
}

/** All built-in struct type names (WPILib geometry). */
export const BUILT_IN_STRUCT_TYPE_NAMES = Object.keys(SCHEMAS);

/** Returns the schema string for a built-in type, or undefined. */
export function getBuiltInSchemaString(typeName: string): string | undefined {
  return SCHEMAS[typeName];
}
