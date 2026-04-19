import { NetworkTables } from './client';
import { NetworkTablesTypeInfos } from './types/types';
import { LogLevel } from './util/logger';

describe('NetworkTables', () => {
  beforeEach(() => {
    NetworkTables['_instances'].clear();
  });

  it('gets the client', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables['_client']).toBe(NetworkTables.getInstanceByTeam(973)['_client']);
    const anotherClient = NetworkTables.getInstanceByTeam(9973)['_client'];
    expect(anotherClient).not.toBe(networkTables['_client']);
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

  it('returns the same instance by new URI/port after changeURI', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    networkTables.changeURI('roborio-9973-frc.local');
    const byNewUri = NetworkTables.getInstanceByURI('roborio-9973-frc.local');
    expect(byNewUri).toBe(networkTables);
    expect(byNewUri.getURI()).toBe('roborio-9973-frc.local');
  });

  it('returns the correct value for isRobotConnected', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.isRobotConnected()).toBe(false);
  });

  it('returns the correct value for isRobotConnecting', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.isRobotConnecting()).toBe(true);
  });

  it('allows adding and removing robot connection listeners', async () => {
    const spy = vi.fn();
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const removeListener = networkTables.addRobotConnectionListener(spy, true);
    expect(spy).not.toHaveBeenCalled();
    await Promise.resolve();
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

  it('creates a protobuf topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.createProtobufTopic<{ value: number }>('/proto/test');
    expect(topic).toBeDefined();
    expect(topic.getValue()).toBeNull();
  });

  it('creates a protobuf topic with options', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.createProtobufTopic<{ value: number }>('/proto/opts', {
      defaultValue: { value: 42 },
    });
    expect(topic).toBeDefined();
    expect(topic.getValue()).toEqual({ value: 42 });
  });

  it('returns existing protobuf topic with options applied on subsequent createProtobufTopic calls', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic1 = networkTables.createProtobufTopic<{ value: number }>('/proto/reuse');
    expect(topic1.getValue()).toBeNull();

    const topic2 = networkTables.createProtobufTopic<{ value: number }>('/proto/reuse', {
      defaultValue: { value: 99 },
    });
    expect(topic2).toBe(topic1);
    expect(topic2.getValue()).toEqual({ value: 99 });
  });

  it('throws when createTopic is called with kProtobuf type', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(() => networkTables.createTopic('/proto/bad', NetworkTablesTypeInfos.kProtobuf)).toThrow(
      "Protobuf types are not allowed in createTopic. Use createProtobufTopic('/proto/bad', options) instead for proper encoding/decoding support."
    );
  });

  it('throws when createTopic is called with struct type', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(() => networkTables.createTopic('/struct/bad', [5, 'struct:Pose2d'])).toThrow(
      "Struct types are not allowed in createTopic. Use createStructTopic('/struct/bad', options) instead for proper encoding/decoding support."
    );
  });

  it('creates a struct topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.createStructTopic<{ x: number; y: number }>('/struct/pose', {
      typeName: 'Translation2d',
    });
    expect(topic).toBeDefined();
    expect(topic.getValue()).toBeNull();
  });

  it('returns existing struct topic with options applied on subsequent createStructTopic calls', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic1 = networkTables.createStructTopic<{ x: number; y: number }>('/struct/reuse', {
      typeName: 'Translation2d',
    });
    const topic2 = networkTables.createStructTopic<{ x: number; y: number }>('/struct/reuse', {
      typeName: 'Translation2d',
      defaultValue: { x: 1, y: 2 },
    });
    expect(topic2).toBe(topic1);
    expect(topic2.getValue()).toEqual({ x: 1, y: 2 });
  });

  it('creates struct topic with array type (Translation2d[]) and getValue/setValue work', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.createStructTopic<Array<{ x: number; y: number }>>('/struct/arr', {
      typeName: 'Translation2d[]',
    });
    expect(topic).toBeDefined();
    expect(topic.getValue()).toBeNull();
    expect(topic.typeInfo[1]).toBe('struct:Translation2d[]');
    topic['_pubuid'] = 1;
    topic['_publisher'] = true;
    const arr = [
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
    ];
    topic.setValue(arr);
    expect(topic.getValue()).toEqual(arr);
  });

  it('setLogLevel sets global log level', () => {
    NetworkTables.setLogLevel(LogLevel.DEBUG);
    expect(NetworkTables.getModuleLogLevel('default')).toBe(LogLevel.DEBUG);
    NetworkTables.setLogLevel(LogLevel.INFO);
  });

  it('setModuleLogLevel and getModuleLogLevel work per module', () => {
    NetworkTables.setModuleLogLevel('socket', LogLevel.WARN);
    expect(NetworkTables.getModuleLogLevel('socket')).toBe(LogLevel.WARN);
    expect(NetworkTables.getModuleLogLevel()).toBe(LogLevel.INFO);
    NetworkTables.setModuleLogLevel('socket', LogLevel.INFO);
  });

  it('stopAutoConnect and startAutoConnect delegate to socket', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const stopSpy = vi.spyOn(networkTables['_client'].messenger.socket, 'stopAutoConnect');
    const startSpy = vi.spyOn(networkTables['_client'].messenger.socket, 'startAutoConnect');
    networkTables.stopAutoConnect();
    expect(stopSpy).toHaveBeenCalled();
    networkTables.startAutoConnect();
    expect(startSpy).toHaveBeenCalled();
  });

  it('getRttMs returns -1 when not connected', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.getRttMs()).toBe(-1);
  });
});
