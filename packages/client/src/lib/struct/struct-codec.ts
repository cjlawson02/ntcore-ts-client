import type { StructDescriptor, StructFieldDescriptor } from './struct-descriptor';
import { getPrimitiveSize } from './struct-descriptor';

/** Plain object representation of a struct (for pack input / unpack output). */
export type StructPlainObject = Record<string, unknown>;

/**
 * Unpacks a little-endian binary buffer into a plain object using the struct descriptor.
 * @throws Error if buffer is too small for the descriptor size.
 */
export function unpack(buffer: Uint8Array, descriptor: StructDescriptor): StructPlainObject {
  if (buffer.length < descriptor.size) {
    throw new Error(
      `Struct unpack: buffer too small (${buffer.length} bytes, need ${descriptor.size} for ${descriptor.typeName})`
    );
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const out: StructPlainObject = {};
  for (const field of descriptor.fields) {
    out[field.name] = unpackField(view, field);
  }
  return out;
}

/**
 * Packs a plain object into a little-endian Uint8Array using the struct descriptor.
 * @throws Error if value is missing required fields or has invalid types.
 */
export function pack(value: StructPlainObject, descriptor: StructDescriptor): Uint8Array {
  const buffer = new Uint8Array(descriptor.size);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  for (const field of descriptor.fields) {
    const v = value[field.name];
    if (v === undefined) {
      throw new Error(`Struct pack: missing required field "${field.name}" for ${descriptor.typeName}`);
    }
    packField(view, field, v);
  }
  return buffer;
}

function unpackField(view: DataView, field: StructFieldDescriptor): unknown {
  const offset = field.offset;
  if (field.nestedDescriptor) {
    if (field.arraySize === 1) {
      return unpack(new Uint8Array(view.buffer, view.byteOffset + offset, field.size), field.nestedDescriptor);
    }
    const arr: StructPlainObject[] = [];
    const elemSize = field.nestedDescriptor.size;
    for (let i = 0; i < field.arraySize; i++) {
      arr.push(
        unpack(
          new Uint8Array(view.buffer, view.byteOffset + offset + i * elemSize, elemSize),
          field.nestedDescriptor
        ) as StructPlainObject
      );
    }
    return arr;
  }
  const prim = field.primitive;
  if (!prim) throw new Error(`Struct field "${field.name}" has neither nestedDescriptor nor primitive`);
  if (field.arraySize > 1) {
    const elemSize = getPrimitiveSize(prim);
    const arr: unknown[] = [];
    for (let i = 0; i < field.arraySize; i++) {
      arr.push(readPrimitive(view, offset + i * elemSize, prim));
    }
    return arr;
  }
  if (field.bitWidth > 0 && field.bitWidth < field.size * 8) {
    const bitfieldValue = readBitfield(view, offset, field.size, field.bitWidth, field.bitShift);
    return prim === 'bool' ? bitfieldValue !== 0 : bitfieldValue;
  }
  return readPrimitive(view, offset, prim);
}

function packField(view: DataView, field: StructFieldDescriptor, value: unknown): void {
  const offset = field.offset;
  if (field.nestedDescriptor) {
    if (field.arraySize === 1) {
      const buf = pack(value as StructPlainObject, field.nestedDescriptor);
      new Uint8Array(view.buffer, view.byteOffset + offset, field.size).set(buf);
      return;
    }
    const arr = value as StructPlainObject[];
    if (!Array.isArray(arr) || arr.length !== field.arraySize) {
      throw new Error(`Struct pack: field "${field.name}" expects array of size ${field.arraySize}`);
    }
    const elemSize = field.nestedDescriptor.size;
    for (let i = 0; i < field.arraySize; i++) {
      const slice = new Uint8Array(view.buffer, view.byteOffset + offset + i * elemSize, elemSize);
      slice.set(pack(arr[i] as StructPlainObject, field.nestedDescriptor));
    }
    return;
  }
  const prim = field.primitive;
  if (!prim) throw new Error(`Struct field "${field.name}" has neither nestedDescriptor nor primitive`);
  if (field.arraySize > 1) {
    const arr = value as unknown[];
    if (!Array.isArray(arr) || arr.length !== field.arraySize) {
      throw new Error(`Struct pack: field "${field.name}" expects array of size ${field.arraySize}`);
    }
    const elemSize = getPrimitiveSize(prim);
    for (let i = 0; i < field.arraySize; i++) {
      writePrimitive(view, offset + i * elemSize, prim, arr[i]);
    }
    return;
  }
  if (field.bitWidth > 0 && field.bitWidth < field.size * 8) {
    writeBitfield(view, offset, field.size, field.bitWidth, field.bitShift, value);
    return;
  }
  writePrimitive(view, offset, prim, value);
}

function readPrimitive(view: DataView, offset: number, prim: string): unknown {
  switch (prim) {
    case 'bool':
      return view.getUint8(offset) !== 0;
    case 'char':
      return view.getInt8(offset);
    case 'int8':
      return view.getInt8(offset);
    case 'uint8':
      return view.getUint8(offset);
    case 'int16':
      return view.getInt16(offset, true);
    case 'uint16':
      return view.getUint16(offset, true);
    case 'int32':
      return view.getInt32(offset, true);
    case 'uint32':
      return view.getUint32(offset, true);
    case 'int64':
      // Converted to Number (loses precision beyond ±2^53). BigInt is avoided because it
      // can't mix with Number in arithmetic and breaks JSON.stringify / Zod / React state.
      // No built-in WPILib struct types use int64; revisit if full precision is needed.
      return Number(view.getBigInt64(offset, true));
    case 'uint64':
      return Number(view.getBigUint64(offset, true));
    case 'float':
    case 'float32':
      return view.getFloat32(offset, true);
    case 'double':
    case 'float64':
      return view.getFloat64(offset, true);
    default:
      throw new Error(`Unknown primitive: ${prim}`);
  }
}

function writePrimitive(view: DataView, offset: number, prim: string, value: unknown): void {
  switch (prim) {
    case 'bool':
      view.setUint8(offset, (value as boolean) ? 1 : 0);
      break;
    case 'char':
    case 'int8':
      view.setInt8(offset, value as number);
      break;
    case 'uint8':
      view.setUint8(offset, value as number);
      break;
    case 'int16':
      view.setInt16(offset, value as number, true);
      break;
    case 'uint16':
      view.setUint16(offset, value as number, true);
      break;
    case 'int32':
      view.setInt32(offset, value as number, true);
      break;
    case 'uint32':
      view.setUint32(offset, value as number, true);
      break;
    case 'int64': {
      const v =
        typeof value === 'bigint'
          ? value
          : typeof value === 'number' && Number.isSafeInteger(value)
            ? BigInt(value)
            : (() => {
                throw new Error(
                  `Struct pack int64: value ${String(value)} is not a safe integer. ` +
                    `Pass a BigInt for values outside ±2^53.`
                );
              })();
      view.setBigInt64(offset, v, true);
      break;
    }
    case 'uint64': {
      const v =
        typeof value === 'bigint'
          ? value
          : typeof value === 'number' && Number.isSafeInteger(value)
            ? BigInt(value)
            : (() => {
                throw new Error(
                  `Struct pack uint64: value ${String(value)} is not a safe integer. ` +
                    `Pass a BigInt for values outside ±2^53.`
                );
              })();
      view.setBigUint64(offset, v, true);
      break;
    }
    case 'float':
    case 'float32':
      view.setFloat32(offset, value as number, true);
      break;
    case 'double':
    case 'float64':
      view.setFloat64(offset, value as number, true);
      break;
    default:
      throw new Error(`Unknown primitive: ${prim}`);
  }
}

function readStorageUnit(view: DataView, offset: number, byteSize: number): number {
  switch (byteSize) {
    case 1:
      return view.getUint8(offset);
    case 2:
      return view.getUint16(offset, true);
    case 4:
      return view.getUint32(offset, true);
    default:
      return Number(view.getBigUint64(offset, true));
  }
}

function writeStorageUnit(view: DataView, offset: number, byteSize: number, value: number): void {
  switch (byteSize) {
    case 1:
      view.setUint8(offset, value);
      break;
    case 2:
      view.setUint16(offset, value, true);
      break;
    case 4:
      view.setUint32(offset, value, true);
      break;
    default:
      view.setBigUint64(offset, BigInt(value), true);
  }
}

const MAX_BITFIELD_WIDTH = 31;

/**
 * Reads a bitfield value from a storage unit. Mirrors WPILib's unsigned read path:
 * `(rawVal >>> bitShift) & bitMask`. Signed sign-extension is not implemented since
 * WPILib only allows unsigned/bool bitfields in practice.
 * JS bitwise ops are 32-bit; bitfields wider than 31 bits or 8-byte storage are unsupported.
 *
 * @see DynamicStruct.java — getFieldImpl()
 */
function readBitfield(view: DataView, offset: number, byteSize: number, bitWidth: number, bitShift: number): number {
  if (byteSize === 8 || bitWidth > MAX_BITFIELD_WIDTH) {
    throw new Error(
      `Struct codec: bitfield read unsupported for byteSize=${byteSize} bitWidth=${bitWidth} (max ${MAX_BITFIELD_WIDTH} bits)`
    );
  }
  const raw = readStorageUnit(view, offset, byteSize);
  // Use unsigned mask so bitWidth=31 works: (1 << 31) would overflow to negative in JS.
  const mask = (0xffffffff >>> (32 - bitWidth)) >>> 0;
  return (raw >>> bitShift) & mask;
}

/**
 * Writes a bitfield value into a storage unit via read-modify-write. Clears the target
 * bits with `~(mask << shift)`, then sets with `(value & mask) << shift`.
 * JS bitwise ops are 32-bit; bitfields wider than 31 bits or 8-byte storage are unsupported.
 *
 * @see DynamicStruct.java — setFieldImpl()
 */
function writeBitfield(
  view: DataView,
  offset: number,
  byteSize: number,
  bitWidth: number,
  bitShift: number,
  value: unknown
): void {
  if (byteSize === 8 || bitWidth > MAX_BITFIELD_WIDTH) {
    throw new Error(
      `Struct codec: bitfield write unsupported for byteSize=${byteSize} bitWidth=${bitWidth} (max ${MAX_BITFIELD_WIDTH} bits)`
    );
  }
  // Use unsigned mask so bitWidth=31 works: (1 << 31) would overflow to negative in JS.
  const mask = (0xffffffff >>> (32 - bitWidth)) >>> 0;
  const v = ((value as number) & mask) >>> 0;
  const raw = readStorageUnit(view, offset, byteSize);
  const updated = (raw & ~(mask << bitShift)) | (v << bitShift);
  writeStorageUnit(view, offset, byteSize, updated);
}
