import { NetworkTables } from './ntcore-ts';
import { PubSubClient } from './pubsub/pubsub';
import { NetworkTableTypeInfos } from './types/types';

describe('uninitialized NetworkTables', () => {
    it('throws an error when trying to get the instance', () => {
        expect(() => NetworkTables.getInstance()).toThrowError();
    });
});

describe('NetworkTables', () => {
    let networkTables: NetworkTables;

    beforeEach(() => {
        networkTables = NetworkTables.createInstanceByTeam(973);
    });

    it('gets the instance', () => {
        expect(NetworkTables.getInstance()).toBe(networkTables);
    });

    it('gets the client', () => {
        expect(networkTables.client).toBe(PubSubClient.getInstance(networkTables.getServerUrl()));
    });

    it('creates a new NetworkTables instance with the correct port number', () => {
        expect(networkTables.getPort()).toBe(5810);
    });

    it('creates a new NetworkTables instance with the correct server URL', () => {
        expect(networkTables.getServerUrl()).toMatch(/^ws:\/\/roborio-frc-973\.local:5810\/nt\/.+$/);
    });

    it('creates a new NetworkTables instance with the correct robot address', () => {
        expect(networkTables.getFQDN()).toBe('roborio-frc-973.local');
    });

    it('lets you change the FQDN', () => {
        networkTables.changeFQDN('roborio-frc-9973.local');
        expect(networkTables.getFQDN()).toBe('roborio-frc-9973.local');
    });

    it('returns the correct value for isRobotConnected', () => {
        expect(networkTables.isRobotConnected()).toBe(false);
    });

    it('returns the correct value for isRobotConnecting', () => {
        expect(networkTables.isRobotConnecting()).toBe(true);
    });

    it('allows adding and removing robot connection listeners', () => {
        const spy = jest.fn();
        const removeListener = networkTables.addRobotConnectionListener(spy, true);
        expect(spy).toHaveBeenCalledWith(false);
        removeListener();
    });

    it('creates a topic', () => {
        const topic = networkTables.createTopic<number>('/foo', NetworkTableTypeInfos.kDouble, 1.0);
        expect(topic).toBeDefined();
    });
});
