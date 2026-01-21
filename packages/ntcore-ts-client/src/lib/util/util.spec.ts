import { NetworkTablesTypeInfos } from '../types/types';

import { Util } from './util';

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

  describe('createBinaryMessage', () => {
    it('should create a binary message with the correct structure and values', () => {
      const message = Util.createBinaryMessage(1, 123456, 1.23, NetworkTablesTypeInfos.kDouble);

      expect(message).toEqual([1, 123456, 1, 1.23]);
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
