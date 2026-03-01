import { parseSchema, buildStructDescriptor } from './struct-parser';
import type { StructDescriptor } from './struct-descriptor';

describe('struct-parser', () => {
  describe('parseSchema', () => {
    it('parses simple schema double x;double y', () => {
      const fields = parseSchema('double x;double y');
      expect(fields).toHaveLength(2);
      expect(fields[0]).toEqual({ typeName: 'double', name: 'x', arraySize: 1, bitWidth: 0 });
      expect(fields[1]).toEqual({ typeName: 'double', name: 'y', arraySize: 1, bitWidth: 0 });
    });

    it('parses schema with nested struct Translation2d t;Rotation2d r', () => {
      const fields = parseSchema('Translation2d t;Rotation2d r');
      expect(fields).toHaveLength(2);
      expect(fields[0]).toEqual({ typeName: 'Translation2d', name: 't', arraySize: 1, bitWidth: 0 });
      expect(fields[1]).toEqual({ typeName: 'Rotation2d', name: 'r', arraySize: 1, bitWidth: 0 });
    });

    it('parses schema with array int32 arr[4]', () => {
      const fields = parseSchema('int32 arr[4]');
      expect(fields).toHaveLength(1);
      expect(fields[0]).toEqual({ typeName: 'int32', name: 'arr', arraySize: 4, bitWidth: 0 });
    });

    it('parses schema with bitfield uint8 flags:4', () => {
      const fields = parseSchema('uint8 flags:4');
      expect(fields).toHaveLength(1);
      expect(fields[0]).toEqual({ typeName: 'uint8', name: 'flags', arraySize: 1, bitWidth: 4 });
    });

    it('parses schema with enum enum { A=0,B=1 } int32 x', () => {
      const fields = parseSchema('enum { A=0,B=1 } int32 x');
      expect(fields).toHaveLength(1);
      expect(fields[0].typeName).toBe('int32');
      expect(fields[0].name).toBe('x');
      expect(fields[0].enumValues).toEqual({ A: 0, B: 1 });
    });

    it('rejects invalid schema malformed tokens', () => {
      expect(() => parseSchema('double x [')).toThrow();
      expect(() => parseSchema('double')).toThrow();
      expect(() => parseSchema('double x ; ; double')).toThrow();
    });

    it('handles whitespace and optional semicolons', () => {
      const fields = parseSchema('  double   x  ;  double   y  ');
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('x');
      expect(fields[1].name).toBe('y');

      const noSemicolon = parseSchema('double x double y');
      expect(noSemicolon).toHaveLength(2);
    });
  });

  describe('buildStructDescriptor', () => {
    it('builds descriptor for primitive-only schema', () => {
      const fields = parseSchema('double x;double y');
      const getNested = () => null;
      const desc = buildStructDescriptor('Translation2d', fields, getNested);
      expect(desc.typeName).toBe('Translation2d');
      expect(desc.size).toBe(16);
      expect(desc.fields[0]).toMatchObject({ name: 'x', offset: 0, size: 8, primitive: 'double' });
      expect(desc.fields[1]).toMatchObject({ name: 'y', offset: 8, size: 8, primitive: 'double' });
    });

    it('rejects circular struct reference', () => {
      const fieldsA = parseSchema('B a');
      const fieldsB = parseSchema('A b');
      const cache = new Map<string, StructDescriptor>();
      function getNested(name: string): StructDescriptor | null {
        if (name === 'B') {
          if (!cache.has('B')) {
            cache.set('B', buildStructDescriptor('B', fieldsB, getNested));
          }
          return cache.get('B') ?? null;
        }
        return cache.get(name) ?? null;
      }
      expect(() => buildStructDescriptor('A', fieldsA, getNested)).toThrow(/circular|unknown/);
    });

    it('rejects bitfield width exceeding type size', () => {
      const fields = parseSchema('uint8 flags:16');
      const getNested = () => null;
      expect(() => buildStructDescriptor('Bad', fields, getNested)).toThrow(/bitfield width/);
    });
  });
});
