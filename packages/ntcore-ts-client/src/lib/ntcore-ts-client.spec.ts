import { NetworkTables } from './ntcore-ts-client';
import { NetworkTablesTypeInfos } from './types/types';

describe('NetworkTables', () => {
  beforeEach(() => {
    NetworkTables['_instances'].clear();
  });

  it('gets the client', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.client).toBe(NetworkTables.getInstanceByTeam(973).client);
    const anotherClient = NetworkTables.getInstanceByTeam(9973).client;
    expect(anotherClient).not.toBe(networkTables.client);
  });

  it('creates a new NetworkTables instance with the correct port number', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.getPort()).toBe(5810);
  });

  it('creates a new NetworkTables instance with the correct robot address', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.getURI()).toBe('roborio-973-frc.local');
  });

  it('returns the same instance when calling getInstance multiple times', () => {
    const instance1 = NetworkTables.getInstanceByTeam(973);
    const instance2 = NetworkTables.getInstanceByTeam(973);
    expect(instance1).toBe(instance2);
  });

  it('returns the same instance when calling getInstanceByURI multiple times', () => {
    const instance1 = NetworkTables.getInstanceByURI('roborio-973-frc.local');
    const instance2 = NetworkTables.getInstanceByURI('roborio-973-frc.local');
    expect(instance1).toBe(instance2);
  });

  it('lets you change the URI', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    networkTables.changeURI('roborio-9973-frc.local');
    expect(networkTables.getURI()).toBe('roborio-9973-frc.local');
  });

  it('returns the correct value for isRobotConnected', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.isRobotConnected()).toBe(false);
  });

  it('returns the correct value for isRobotConnecting', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.isRobotConnecting()).toBe(true);
  });

  it('allows adding and removing robot connection listeners', () => {
    const spy = jest.fn();
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const removeListener = networkTables.addRobotConnectionListener(spy, true);
    expect(spy).toHaveBeenCalledWith(false);
    removeListener();
  });

  it('creates a topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.createTopic<number>('/foo', NetworkTablesTypeInfos.kDouble, 1.0);
    expect(topic).toBeDefined();
  });

  it('creates a prefix topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.createPrefixTopic('/');
    expect(topic).toBeDefined();
  });
});
