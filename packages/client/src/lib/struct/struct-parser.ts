import {
  isPrimitiveType,
  getPrimitiveSize,
  type PrimitiveTypeName,
  type StructDescriptor,
  type StructFieldDescriptor,
} from './struct-descriptor';

/** Single punctuation or keyword token. */
const PUNCT = /^[[\]{}:;,=]/;
/** Identifier: letter or _ then alphanumeric or _. */
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*/;
/** Integer: optional minus then digits. */
const INT = /^-?\d+/;
/** Whitespace. */
const WS = /^[\s\r\n\t]+/;

export type ParsedField = {
  typeName: string;
  name: string;
  arraySize: number;
  bitWidth: number;
  enumValues?: Record<string, number>;
};

class Lexer {
  private input: string;
  private pos = 0;

  constructor(input: string) {
    this.input = input;
  }

  eof(): boolean {
    this.skipWhitespace();
    return this.pos >= this.input.length;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const m = this.input.slice(this.pos).match(WS);
      if (m) {
        this.pos += m[0].length;
      } else {
        break;
      }
    }
  }

  /** Returns next token as string, or null if eof. */
  next(): string | null {
    this.skipWhitespace();
    if (this.pos >= this.input.length) return null;
    const rest = this.input.slice(this.pos);
    const p = rest.match(PUNCT);
    if (p) {
      this.pos += p[0].length;
      return p[0];
    }
    const i = rest.match(INT);
    if (i) {
      this.pos += i[0].length;
      return i[0];
    }
    const id = rest.match(IDENT);
    if (id) {
      this.pos += id[0].length;
      return id[0];
    }
    throw new Error(`Struct schema lexer: unexpected character at position ${this.pos}`);
  }

  /** Peek next token without consuming. */
  peek(): string | null {
    const saved = this.pos;
    const t = this.next();
    this.pos = saved;
    return t;
  }
}

/**
 * Parses a WPILib struct schema string into a list of field declarations.
 * @param schema - Schema string (e.g. "double x;double y" or "Translation2d translation;Rotation2d rotation").
 * @returns Array of parsed fields.
 * @throws Error on malformed schema.
 */
export function parseSchema(schema: string): ParsedField[] {
  const lex = new Lexer(schema);
  const fields: ParsedField[] = [];

  while (!lex.eof()) {
    let enumValues: Record<string, number> | undefined;

    const first = lex.next();
    if (!first) break;

    if (first === 'enum') {
      const open = lex.next();
      if (open !== '{') throw new Error('Struct schema: expected "{" after enum');
      enumValues = parseEnumEntries(lex);
      const close = lex.next();
      if (close !== '}') throw new Error('Struct schema: expected "}" after enum entries');
    } else if (first === '{') {
      enumValues = parseEnumEntries(lex);
      const close = lex.next();
      if (close !== '}') throw new Error('Struct schema: expected "}" after enum entries');
    }

    const typeName = first === 'enum' || first === '{' ? lex.next() : first;
    if (!typeName || PUNCT.test(typeName) || INT.test(typeName)) {
      throw new Error('Struct schema: expected type after declaration start');
    }

    const name = lex.next();
    if (!name || PUNCT.test(name) || INT.test(name)) {
      throw new Error('Struct schema: expected identifier after type');
    }

    let arraySize = 1;
    let bitWidth = 0;

    const afterName = lex.peek();
    if (afterName === '[') {
      lex.next();
      const sizeTok = lex.next();
      if (!sizeTok || !INT.test(sizeTok)) throw new Error('Struct schema: expected integer in array size');
      const n = parseInt(sizeTok, 10);
      if (n <= 0) throw new Error('Struct schema: array size must be positive');
      arraySize = n;
      const close = lex.next();
      if (close !== ']') throw new Error('Struct schema: expected "]" after array size');
    } else if (afterName === ':') {
      lex.next();
      const widthTok = lex.next();
      if (!widthTok || !INT.test(widthTok)) throw new Error('Struct schema: expected integer in bitfield width');
      bitWidth = parseInt(widthTok, 10);
      if (bitWidth <= 0) throw new Error('Struct schema: bitfield width must be positive');
    }

    fields.push({ typeName, name, arraySize, bitWidth, enumValues });

    while (lex.peek() === ';') {
      lex.next();
    }
  }

  return fields;
}

function parseEnumEntries(lex: Lexer): Record<string, number> {
  const enumValues: Record<string, number> = {};
  for (;;) {
    if (lex.peek() === '}') break;
    const id = lex.next();
    if (!id) break;
    if (PUNCT.test(id) || INT.test(id)) throw new Error('Struct schema: expected identifier in enum entry');
    const eq = lex.next();
    if (eq !== '=') throw new Error('Struct schema: expected "=" in enum entry');
    const num = lex.next();
    if (!num || !INT.test(num)) throw new Error('Struct schema: expected integer in enum value');
    enumValues[id] = parseInt(num, 10);
    const next = lex.peek();
    if (next === ',') {
      lex.next();
    } else if (next === '}') {
      break;
    } else if (next !== null) {
      throw new Error(`Struct schema: unexpected token "${next}" in enum`);
    }
  }
  return enumValues;
}

/**
 * Builds a StructDescriptor from parsed fields and a resolver for nested struct sizes.
 *
 * Implements the WPILib `StructDescriptor.calculateOffsets()` algorithm for bitfield
 * coalescing. Fields are densely packed with no alignment padding. Consecutive bitfields
 * of the same underlying type share a single storage unit (e.g. two `uint8:4` fields
 * occupy 1 byte, not 2). When the type changes or bits overflow the storage unit, a new
 * unit starts.
 *
 * @see https://github.com/wpilibsuite/allwpilib — StructDescriptor.java, calculateOffsets()
 */
export function buildStructDescriptor(
  typeName: string,
  parsedFields: ParsedField[],
  getNestedDescriptor: (name: string) => StructDescriptor | null
): StructDescriptor {
  function resolveElemSize(f: ParsedField): { elemSize: number; nested: StructDescriptor | null } {
    if (isPrimitiveType(f.typeName)) {
      const elemSize = getPrimitiveSize(f.typeName as PrimitiveTypeName);
      if (f.bitWidth > 0 && f.bitWidth > elemSize * 8) {
        throw new Error(
          `Struct schema: bitfield width ${f.bitWidth} exceeds type ${f.typeName} size (${elemSize} bytes)`
        );
      }
      return { elemSize, nested: null };
    }
    if (f.typeName === typeName) {
      throw new Error(`Struct schema: circular struct reference "${f.typeName}" in "${typeName}"`);
    }
    const nested = getNestedDescriptor(f.typeName);
    if (!nested) {
      throw new Error(`Struct schema: unknown or circular struct type "${f.typeName}" in "${typeName}"`);
    }
    return { elemSize: nested.size, nested };
  }

  const fields: StructFieldDescriptor[] = [];
  // Mirrors WPILib's calculateOffsets state: byte offset, bit position within the
  // current bitfield storage unit, and the byte-size of that storage unit (0 = none active).
  let offset = 0;
  let shift = 0;
  let prevBitfieldSize = 0;

  for (const f of parsedFields) {
    const { elemSize, nested } = resolveElemSize(f);
    const isBitfield = f.bitWidth > 0 && f.bitWidth < elemSize * 8;

    if (!isBitfield) {
      // Non-bitfield: close any active bitfield storage unit, then lay out normally.
      shift = 0;
      offset += prevBitfieldSize;
      prevBitfieldSize = 0;

      if (nested) {
        fields.push({
          name: f.name,
          offset,
          size: elemSize,
          arraySize: f.arraySize,
          bitWidth: 0,
          bitShift: 0,
          nestedDescriptor: nested,
        });
      } else {
        fields.push({
          name: f.name,
          offset,
          size: elemSize,
          arraySize: f.arraySize,
          bitWidth: 0,
          bitShift: 0,
          enumValues: f.enumValues,
          primitive: f.typeName as PrimitiveTypeName,
        });
      }
      offset += elemSize * f.arraySize;
    } else {
      // Bitfield coalescing: consecutive bitfields of the same underlying type pack into
      // a shared storage unit at increasing bitShift offsets (LSB-first). Three cases:
      const bitWidth = f.bitWidth;
      const isBool = f.typeName === 'bool';

      if (isBool && prevBitfieldSize !== 0 && shift + 1 <= prevBitfieldSize * 8) {
        // Case 1: Bool adopts the preceding bitfield's storage type if it fits (1 bit).
        // This is a WPILib special case — a bool:1 packs into any active storage unit.
      } else if (elemSize !== prevBitfieldSize || shift + bitWidth > elemSize * 8) {
        // Case 2: Type changed or bits won't fit — start a new storage unit.
        shift = 0;
        offset += prevBitfieldSize;
      }
      // Case 3 (implicit): Same type, fits — continues packing into current unit.

      prevBitfieldSize =
        isBool && prevBitfieldSize !== 0 && shift + 1 <= prevBitfieldSize * 8 ? prevBitfieldSize : elemSize;

      fields.push({
        name: f.name,
        offset,
        size: prevBitfieldSize,
        arraySize: 1,
        bitWidth,
        bitShift: shift,
        enumValues: f.enumValues,
        primitive: f.typeName as PrimitiveTypeName,
      });
      shift += bitWidth;
    }
  }

  // Account for any trailing bitfield storage unit.
  const totalSize = offset + prevBitfieldSize;
  return { typeName, size: totalSize, fields };
}
