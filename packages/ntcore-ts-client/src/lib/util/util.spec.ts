import { NetworkTablesTypeInfos } from '../types/types';

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

  describe('getNetworkTablesTypeFromObject', () => {
    it('should return the correct NT type for a boolean value', () => {
      expect(Util.getNetworkTablesTypeFromObject(true)).toEqual(NetworkTablesTypeInfos.kBoolean);
    });

    it('should return the correct NT type for a double value', () => {
      expect(Util.getNetworkTablesTypeFromObject(1.23)).toEqual(NetworkTablesTypeInfos.kDouble);
    });

    it('should return the correct NT type for an integer value', () => {
      expect(Util.getNetworkTablesTypeFromObject(123)).toEqual(NetworkTablesTypeInfos.kInteger);
    });

    it('should return the correct NT type for a string value', () => {
      expect(Util.getNetworkTablesTypeFromObject('abc')).toEqual(NetworkTablesTypeInfos.kString);
    });

    it('should return the correct NT type for an ArrayBuffer value', () => {
      expect(Util.getNetworkTablesTypeFromObject(new ArrayBuffer(10))).toEqual(NetworkTablesTypeInfos.kArrayBuffer);
    });

    it('should return the correct NT type for a boolean array value', () => {
      expect(Util.getNetworkTablesTypeFromObject([true, false])).toEqual(NetworkTablesTypeInfos.kBooleanArray);
    });

    it('should return the correct NT type for a double array value', () => {
      expect(Util.getNetworkTablesTypeFromObject([1.23, 4.56])).toEqual(NetworkTablesTypeInfos.kDoubleArray);
    });

    it('should return the correct NT type for an integer array value', () => {
      expect(Util.getNetworkTablesTypeFromObject([1, 2, 3])).toEqual(NetworkTablesTypeInfos.kIntegerArray);
    });

    it('should return the correct NT type for a string array value', () => {
      expect(Util.getNetworkTablesTypeFromObject(['a', 'b', 'c'])).toEqual(NetworkTablesTypeInfos.kStringArray);
    });

    it('should throw an error for an invalid data type', () => {
      expect(() => Util.getNetworkTablesTypeFromObject({} as unknown as NetworkTablesTypes)).toThrow();
    });
  });

  describe('getNetworkTablesTypeFromTypeNum', () => {
    it('should return the correct NT type for a boolean value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kBoolean[0])).toEqual(
        NetworkTablesTypeInfos.kBoolean
      );
    });

    it('should return the correct NT type for a double value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kDouble[0])).toEqual(
        NetworkTablesTypeInfos.kDouble
      );
    });

    it('should return the correct NT type for an integer value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kInteger[0])).toEqual(
        NetworkTablesTypeInfos.kInteger
      );
    });

    it('should return the correct NT type for a string value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kString[0])).toEqual(
        NetworkTablesTypeInfos.kString
      );
    });

    it('should return the correct NT type for an ArrayBuffer value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kArrayBuffer[0])).toEqual(
        NetworkTablesTypeInfos.kArrayBuffer
      );
    });

    it('should return the correct NT type for a boolean array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kBooleanArray[0])).toEqual(
        NetworkTablesTypeInfos.kBooleanArray
      );
    });

    it('should return the correct NT type for a double array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kDoubleArray[0])).toEqual(
        NetworkTablesTypeInfos.kDoubleArray
      );
    });

    it('should return the correct NT type for an integer array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kIntegerArray[0])).toEqual(
        NetworkTablesTypeInfos.kIntegerArray
      );
    });

    it('should return the correct NT type for a string array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeNum(NetworkTablesTypeInfos.kStringArray[0])).toEqual(
        NetworkTablesTypeInfos.kStringArray
      );
    });

    it('should throw an error for an invalid type number', () => {
      expect(() => Util.getNetworkTablesTypeFromTypeNum(999 as TypeNum)).toThrow();
    });
  });

  describe('getNetworkTablesTypeFromTypeString', () => {
    it('should return the correct NT type for a boolean value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kBoolean[1])).toEqual(
        NetworkTablesTypeInfos.kBoolean
      );
    });

    it('should return the correct NT type for a double value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kDouble[1])).toEqual(
        NetworkTablesTypeInfos.kDouble
      );
    });

    it('should return the correct NT type for an integer value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kInteger[1])).toEqual(
        NetworkTablesTypeInfos.kInteger
      );
    });

    it('should return the correct NT type for a string value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kString[1])).toEqual(
        NetworkTablesTypeInfos.kString
      );
    });

    it('should return the correct NT type for an ArrayBuffer value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kArrayBuffer[1])).toEqual(
        NetworkTablesTypeInfos.kArrayBuffer
      );
    });

    it('should return the correct NT type for a boolean array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kBooleanArray[1])).toEqual(
        NetworkTablesTypeInfos.kBooleanArray
      );
    });

    it('should return the correct NT type for a double array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kDoubleArray[1])).toEqual(
        NetworkTablesTypeInfos.kDoubleArray
      );
    });

    it('should return the correct NT type for an integer array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kIntegerArray[1])).toEqual(
        NetworkTablesTypeInfos.kIntegerArray
      );
    });

    it('should return the correct NT type for a string array value', () => {
      expect(Util.getNetworkTablesTypeFromTypeString(NetworkTablesTypeInfos.kStringArray[1])).toEqual(
        NetworkTablesTypeInfos.kStringArray
      );
    });

    it('should throw an error for an invalid type string', () => {
      expect(() => Util.getNetworkTablesTypeFromTypeString('invalid' as TypeString)).toThrow();
    });
  });

  describe('createBinaryMessage', () => {
    it('should create a binary message with the correct structure and values', () => {
      const message = Util.createBinaryMessage(1, 123456, 1.23);

      expect(message).toEqual([1, 123456, NetworkTablesTypeInfos.kDouble[0], 1.23]);
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

  describe('createServerUrl', () => {
    it('creates a new NetworkTables instance with the correct server URL', () => {
      expect(Util.createServerUrl('roborio-973-frc.local', 5810)).toMatch(
        /^ws:\/\/roborio-973-frc\.local:5810\/nt\/ntcore-ts-.+$/
      );
    });
  });

  describe('getRobotAddress', () => {
    it('returns the correct address for a team number', () => {
      expect(Util.getRobotAddress(973)).toEqual('roborio-973-frc.local');
    });
  });
});
