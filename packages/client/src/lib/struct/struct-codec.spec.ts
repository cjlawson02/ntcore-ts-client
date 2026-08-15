import { pack, unpack, type StructPlainObject } from './struct-codec';
import { getBuiltInDescriptor } from './built-in-schemas';
import { buildStructDescriptor } from './struct-parser';
import { parseSchema } from './struct-parser';

describe('struct-codec', () => {
  describe('round-trip', () => {
    it('round-trip Translation2d pack then unpack', () => {
      const desc = getBuiltInDescriptor('Translation2d');
      if (!desc) throw new Error('expected Translation2d descriptor');
      const value = { x: 1.5, y: -2.25 };
      const buf = pack(value, desc);
      expect(buf.length).toBe(16);
      const back = unpack(buf, desc);
      expect(back).toEqual(value);
    });

    it('round-trip Pose2d (nested structs)', () => {
      const desc = getBuiltInDescriptor('Pose2d');
      if (!desc) throw new Error('expected Pose2d descriptor');
      const value = {
        translation: { x: 1, y: 2 },
        rotation: { value: 0.5 },
      };
      const buf = pack(value, desc);
      expect(buf.length).toBe(24);
      const back = unpack(buf, desc);
      expect(back).toEqual(value);
    });

    it('little-endian byte order', () => {
      const fields = parseSchema('int32 a');
      const desc = buildStructDescriptor('LE', fields, () => null);
      const buf = pack({ a: 0x01020304 }, desc);
      expect(buf[0]).toBe(0x04);
      expect(buf[1]).toBe(0x03);
      expect(buf[2]).toBe(0x02);
      expect(buf[3]).toBe(0x01);
      expect(unpack(buf, desc)).toEqual({ a: 0x01020304 });
    });
  });

  describe('arrays', () => {
    it('array of primitives pack/unpack', () => {
      const fields = parseSchema('int32 arr[4]');
      const desc = buildStructDescriptor('Arr', fields, () => null);
      const value = { arr: [1, 2, 3, 4] };
      const buf = pack(value, desc);
      expect(buf.length).toBe(16);
      expect(unpack(buf, desc)).toEqual(value);
    });
  });

  describe('bitfield', () => {
    it('single bitfield pack/unpack', () => {
      const fields = parseSchema('uint8 flags:4');
      const desc = buildStructDescriptor('Flags', fields, () => null);
      const value = { flags: 0b1010 };
      const buf = pack(value, desc);
      expect(buf.length).toBe(1);
      expect(unpack(buf, desc)).toEqual(value);
    });

    it('consecutive same-type bitfields coalesce into one storage unit', () => {
      const fields = parseSchema('uint8 a:4;uint8 b:4');
      const desc = buildStructDescriptor('Packed', fields, () => null);
      expect(desc.size).toBe(1);
      expect(desc.fields[0].bitShift).toBe(0);
      expect(desc.fields[1].bitShift).toBe(4);
      const value = { a: 0b0101, b: 0b1010 };
      const buf = pack(value, desc);
      expect(buf.length).toBe(1);
      expect(buf[0]).toBe(0b10100101);
      expect(unpack(buf, desc)).toEqual(value);
    });

    it('bitfield overflow starts new storage unit', () => {
      const fields = parseSchema('uint8 a:6;uint8 b:6');
      const desc = buildStructDescriptor('Overflow', fields, () => null);
      expect(desc.size).toBe(2);
      expect(desc.fields[0].bitShift).toBe(0);
      expect(desc.fields[0].offset).toBe(0);
      expect(desc.fields[1].bitShift).toBe(0);
      expect(desc.fields[1].offset).toBe(1);
    });

    it('31-bit bitfield uses correct unsigned mask (no JS overflow)', () => {
      const fields = parseSchema('uint32 wide:31');
      const desc = buildStructDescriptor('Wide', fields, () => null);
      const value = { wide: 0x7fffffff };
      const buf = pack(value, desc);
      expect(buf.length).toBe(4);
      expect(unpack(buf, desc)).toEqual(value);
    });
  });

  describe('errors', () => {
    it('reject buffer too small for unpack', () => {
      const desc = getBuiltInDescriptor('Translation2d');
      if (!desc) throw new Error('expected Translation2d descriptor');
      const short = new Uint8Array(8);
      expect(() => unpack(short, desc)).toThrow(/buffer too small/);
    });

    it('reject invalid value for pack (missing fields)', () => {
      const desc = getBuiltInDescriptor('Translation2d');
      if (!desc) throw new Error('expected Translation2d descriptor');
      expect(() => pack({} as StructPlainObject, desc)).toThrow(/missing required field/);
      expect(() => pack({ x: 1 } as StructPlainObject, desc)).toThrow(/missing required field/);
    });
  });
});
