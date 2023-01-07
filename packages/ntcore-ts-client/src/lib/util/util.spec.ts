import { integerSchema } from '../types/schemas';
import { NetworkTableTypeInfos } from '../types/types';

import { Util } from './util';

import type { NetworkTablesTypes, TypeNum, TypeString } from '../types/types';

describe('Util', () => {
  describe('getMicros', () => {
    it('should return the current microseconds of the DOM', () => {
      // mock the performance object to return a specific value for now
      jest.spyOn(performance, 'now').mockImplementation(() => 123);

      expect(Util.getMicros()).toEqual(123000);
    });
  });

  describe('isDouble', () => {
    it('should return true for a double value', () => {
      expect(Util.isDouble(1.23)).toEqual(true);
    });

    it('should return false for an integer value', () => {
      expect(Util.isDouble(123)).toEqual(false);
    });

    it('should return false for a non-number value', () => {
      expect(Util.isDouble('123' as unknown as number)).toEqual(false);
    });
  });

  describe('getNetworkTableTypeFromObject', () => {
    it('should return the correct NT type for a boolean value', () => {
      expect(Util.getNetworkTableTypeFromObject(true)).toEqual(NetworkTableTypeInfos.kBoolean);
    });

    it('should return the correct NT type for a double value', () => {
      expect(Util.getNetworkTableTypeFromObject(1.23)).toEqual(NetworkTableTypeInfos.kDouble);
    });

    it('should return the correct NT type for an integer value', () => {
      expect(Util.getNetworkTableTypeFromObject(123)).toEqual(NetworkTableTypeInfos.kInteger);
    });

    it('should return the correct NT type for a string value', () => {
      expect(Util.getNetworkTableTypeFromObject('abc')).toEqual(NetworkTableTypeInfos.kString);
    });

    it('should return the correct NT type for an ArrayBuffer value', () => {
      expect(Util.getNetworkTableTypeFromObject(new ArrayBuffer(10))).toEqual(NetworkTableTypeInfos.kArrayBuffer);
    });

    it('should return the correct NT type for a boolean array value', () => {
      expect(Util.getNetworkTableTypeFromObject([true, false])).toEqual(NetworkTableTypeInfos.kBooleanArray);
    });

    it('should return the correct NT type for a double array value', () => {
      expect(Util.getNetworkTableTypeFromObject([1.23, 4.56])).toEqual(NetworkTableTypeInfos.kDoubleArray);
    });

    it('should return the correct NT type for an integer array value', () => {
      expect(Util.getNetworkTableTypeFromObject([1, 2, 3])).toEqual(NetworkTableTypeInfos.kIntegerArray);
    });

    it('should return the correct NT type for a string array value', () => {
      expect(Util.getNetworkTableTypeFromObject(['a', 'b', 'c'])).toEqual(NetworkTableTypeInfos.kStringArray);
    });

    it('should throw an error for an invalid data type', () => {
      expect(() => Util.getNetworkTableTypeFromObject({} as unknown as NetworkTablesTypes)).toThrow();
    });
  });

  describe('getNetworkTableTypeFromTypeNum', () => {
    it('should return the correct NT type for a boolean value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kBoolean[0])).toEqual(
        NetworkTableTypeInfos.kBoolean
      );
    });

    it('should return the correct NT type for a double value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kDouble[0])).toEqual(
        NetworkTableTypeInfos.kDouble
      );
    });

    it('should return the correct NT type for an integer value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kInteger[0])).toEqual(
        NetworkTableTypeInfos.kInteger
      );
    });

    it('should return the correct NT type for a string value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kString[0])).toEqual(
        NetworkTableTypeInfos.kString
      );
    });

    it('should return the correct NT type for an ArrayBuffer value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kArrayBuffer[0])).toEqual(
        NetworkTableTypeInfos.kArrayBuffer
      );
    });

    it('should return the correct NT type for a boolean array value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kBooleanArray[0])).toEqual(
        NetworkTableTypeInfos.kBooleanArray
      );
    });

    it('should return the correct NT type for a double array value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kDoubleArray[0])).toEqual(
        NetworkTableTypeInfos.kDoubleArray
      );
    });

    it('should return the correct NT type for an integer array value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kIntegerArray[0])).toEqual(
        NetworkTableTypeInfos.kIntegerArray
      );
    });

    it('should return the correct NT type for a string array value', () => {
      expect(Util.getNetworkTableTypeFromTypeNum(NetworkTableTypeInfos.kStringArray[0])).toEqual(
        NetworkTableTypeInfos.kStringArray
      );
    });

    it('should throw an error for an invalid type number', () => {
      expect(() => Util.getNetworkTableTypeFromTypeNum(999 as TypeNum)).toThrow();
    });
  });

  describe('getNetworkTableTypeFromTypeString', () => {
    it('should return the correct NT type for a boolean value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kBoolean[1])).toEqual(
        NetworkTableTypeInfos.kBoolean
      );
    });

    it('should return the correct NT type for a double value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kDouble[1])).toEqual(
        NetworkTableTypeInfos.kDouble
      );
    });

    it('should return the correct NT type for an integer value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kInteger[1])).toEqual(
        NetworkTableTypeInfos.kInteger
      );
    });

    it('should return the correct NT type for a string value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kString[1])).toEqual(
        NetworkTableTypeInfos.kString
      );
    });

    it('should return the correct NT type for an ArrayBuffer value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kArrayBuffer[1])).toEqual(
        NetworkTableTypeInfos.kArrayBuffer
      );
    });

    it('should return the correct NT type for a boolean array value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kBooleanArray[1])).toEqual(
        NetworkTableTypeInfos.kBooleanArray
      );
    });

    it('should return the correct NT type for a double array value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kDoubleArray[1])).toEqual(
        NetworkTableTypeInfos.kDoubleArray
      );
    });

    it('should return the correct NT type for an integer array value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kIntegerArray[1])).toEqual(
        NetworkTableTypeInfos.kIntegerArray
      );
    });

    it('should return the correct NT type for a string array value', () => {
      expect(Util.getNetworkTableTypeFromTypeString(NetworkTableTypeInfos.kStringArray[1])).toEqual(
        NetworkTableTypeInfos.kStringArray
      );
    });

    it('should throw an error for an invalid type string', () => {
      expect(() => Util.getNetworkTableTypeFromTypeString('invalid' as TypeString)).toThrow();
    });
  });

  describe('createBinaryMessage', () => {
    it('should create a binary message with the correct structure and values', () => {
      const message = Util.createBinaryMessage(1, 123456, 1.23);

      expect(message).toEqual([1, 123456, NetworkTableTypeInfos.kDouble[0], 1.23]);
    });
  });

  describe('generateUid', () => {
    let id1: number;
    let id2: number;

    beforeEach(() => {
      id1 = Util.generateUid();
      id2 = Util.generateUid();
    });

    it('should be a positive integer', () => {
      // make sure it's an integer
      expect(id1).toBeGreaterThanOrEqual(0);
      expect(id2).toBeGreaterThanOrEqual(0);
      expect(integerSchema.safeParse(id1).success).toBe(true);
      expect(integerSchema.safeParse(id2).success).toBe(true);
    });
    it('generates a different ID', () => {
      expect(id1).not.toEqual(id2);
    });
  });

  describe('splitArrayBuffer', () => {
    it('splits an ArrayBuffer into chunks of the specified size', () => {
      const buffer = new ArrayBuffer(51);
      const chunkSize = 17;
      const chunks = Util.splitArrayBuffer(buffer, chunkSize);
      expect(chunks).toEqual([new ArrayBuffer(17), new ArrayBuffer(17), new ArrayBuffer(17)]);

      const buffer2 = new ArrayBuffer(60);
      const chunkSize2 = 20;
      const chunks2 = Util.splitArrayBuffer(buffer2, chunkSize2);
      expect(chunks2).toEqual([new ArrayBuffer(20), new ArrayBuffer(20), new ArrayBuffer(20)]);
    });

    it('throws an error if the chunk size is not divisible by the ArrayBuffer size', () => {
      const buffer = new ArrayBuffer(51);
      const chunkSize = 16;
      expect(() => Util.splitArrayBuffer(buffer, chunkSize)).toThrow(
        'Chunk size must be divisible by ArrayBuffer size'
      );
    });
  });
});
