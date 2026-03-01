/**
 * Primitive type names and their byte sizes (WPILib struct schema).
 */
export const PRIMITIVE_SIZES = {
  bool: 1,
  char: 1,
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  int32: 4,
  uint32: 4,
  int64: 8,
  uint64: 8,
  float: 4,
  float32: 4,
  double: 8,
  float64: 8,
} as const satisfies Record<string, number>;

export type PrimitiveTypeName = keyof typeof PRIMITIVE_SIZES;

/**
 * Descriptor for a single field in a struct (with resolved offset/size for layout).
 */
export interface StructFieldDescriptor {
  name: string;
  /** Byte offset of this field within the struct. */
  offset: number;
  /** Storage size in bytes for one element. */
  size: number;
  /** 1 for non-array, >1 for fixed-size array. */
  arraySize: number;
  /** 0 for non-bitfield, 1–N for bitfield width in bits. */
  bitWidth: number;
  /** Bit offset within the storage unit (for coalesced bitfields). */
  bitShift: number;
  /** For enum fields: enum name → integer value. */
  enumValues?: Record<string, number>;
  /** Set for primitive fields. */
  primitive?: PrimitiveTypeName;
  /** Set for nested struct fields (resolved descriptor). */
  nestedDescriptor?: StructDescriptor;
}

/**
 * Descriptor for a struct type: type name, total size, and ordered fields.
 */
export interface StructDescriptor {
  typeName: string;
  /** Total size in bytes. */
  size: number;
  fields: StructFieldDescriptor[];
}

/**
 * Returns the size in bytes of a primitive type.
 */
export function getPrimitiveSize(primitive: PrimitiveTypeName): number {
  const size = PRIMITIVE_SIZES[primitive];
  if (size === undefined) {
    throw new Error(`Unknown primitive type: ${primitive}`);
  }
  return size;
}

/**
 * Returns whether the given string is a known primitive type name.
 */
export function isPrimitiveType(typeName: string): typeName is PrimitiveTypeName {
  return typeName in PRIMITIVE_SIZES;
}
