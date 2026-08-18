import { NetworkTablesTypeInfos } from '../types/types';

import { Util, getRobotAddress, getTeamIpAddress, parseRobotAddress, SYSTEMCORE_MDNS_HOST } from './util';

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
    it('returns the RoboRIO mDNS address by default', () => {
      expect(Util.getRobotAddress(973)).toEqual('roborio-973-frc.local');
      expect(getRobotAddress(973)).toEqual('roborio-973-frc.local');
    });

    it('returns the SystemCore team IP when platform is systemcore', () => {
      expect(getRobotAddress(973, 'systemcore')).toEqual('10.9.73.2');
      expect(getRobotAddress(254, 'systemcore')).toEqual('10.2.54.2');
      expect(getRobotAddress(1, 'systemcore')).toEqual('10.0.1.2');
    });
  });

  describe('getTeamIpAddress', () => {
    it('maps team numbers to 10.TE.AM.2', () => {
      expect(getTeamIpAddress(973)).toEqual('10.9.73.2');
      expect(getTeamIpAddress(25599)).toEqual('10.255.99.2');
    });

    it('rejects team numbers outside 1–25599', () => {
      expect(() => getTeamIpAddress(0)).toThrow(/1 to 25599/);
      expect(() => getTeamIpAddress(25600)).toThrow(/1 to 25599/);
    });
  });

  describe('parseRobotAddress', () => {
    it('parses RoboRIO mDNS names', () => {
      expect(parseRobotAddress('roborio-973-frc.local')).toEqual({ platform: 'roborio', team: 973 });
    });

    it('parses SystemCore team IPs', () => {
      expect(parseRobotAddress('10.9.73.2')).toEqual({ platform: 'systemcore', team: 973 });
    });

    it('returns null for other hosts', () => {
      expect(parseRobotAddress('localhost')).toEqual({ platform: null, team: null });
      expect(parseRobotAddress(SYSTEMCORE_MDNS_HOST)).toEqual({ platform: null, team: null });
      expect(parseRobotAddress('10.9.73.1')).toEqual({ platform: null, team: null });
    });
  });
});
