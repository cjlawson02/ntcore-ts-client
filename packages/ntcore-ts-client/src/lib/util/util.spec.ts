import { NetworkTablesTypeInfos } from '../types/types';

import { Util } from './util';

import type { NetworkTablesTypes } from '../types/types';

describe('Util', () => {
  describe('getMicros', () => {
    it('should return the current microseconds of the DOM', () => {
      // mock the performance object to return a specific value for now
      vi.spyOn(performance, 'now').mockImplementation(() => 123);

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

    it('should return the correct NT type for an Uint8Array value', () => {
      expect(Util.getNetworkTablesTypeFromObject(new Uint8Array(10))).toEqual(NetworkTablesTypeInfos.kUint8Array);
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

  describe('createBinaryMessage', () => {
    it('should create a binary message with the correct structure and values', () => {
      const message = Util.createBinaryMessage(1, 123456, 1.23);

      expect(message).toEqual([1, 123456, NetworkTablesTypeInfos.kDouble[0], 1.23]);
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
