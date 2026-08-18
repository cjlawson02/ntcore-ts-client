import { NetworkTables } from './client';
import { PubSubClient } from './pubsub/pubsub';
import { Messenger } from './socket/messenger';
import { NetworkTablesSocket } from './socket/socket';
import { Pose2d } from './struct/geometry';
import { NetworkTablesTypeInfos } from './types/types';
import { LogLevel } from './util/logger';
import { z } from 'zod';

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

  it('creates a SystemCore instance from the team IP', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973, 5810, 'systemcore');
    expect(networkTables.getURI()).toBe('10.9.73.2');
    expect(NetworkTables.getInstanceByURI('10.9.73.2')).toBe(networkTables);
  });

  it('keeps RoboRIO and SystemCore team instances separate', () => {
    const roborio = NetworkTables.getInstanceByTeam(973, 5810, 'roborio');
    const systemcore = NetworkTables.getInstanceByTeam(973, 5810, 'systemcore');
    expect(roborio).not.toBe(systemcore);
    expect(roborio.getURI()).toBe('roborio-973-frc.local');
    expect(systemcore.getURI()).toBe('10.9.73.2');
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

  it('lets you change the team and platform', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    networkTables.changeTeam(254, 5810, 'systemcore');
    expect(networkTables.getURI()).toBe('10.2.54.2');
    expect(NetworkTables.getInstanceByURI('10.2.54.2')).toBe(networkTables);
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
    const topic = networkTables.getPrefixTopic('/');
    expect(topic).toBeDefined();
  });

  it('creates a protobuf topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.getProtobufTopic<{ value: number }>('/proto/test');
    expect(topic).toBeDefined();
    expect(topic.getValue()).toBeNull();
  });

  it('creates a protobuf topic with options', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.getProtobufTopic<{ value: number }>('/proto/opts', {
      defaultValue: { value: 42 },
    });
    expect(topic).toBeDefined();
    expect(topic.getValue()).toEqual({ value: 42 });
  });

  it('returns existing protobuf topic with options applied on subsequent getProtobufTopic calls', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic1 = networkTables.getProtobufTopic<{ value: number }>('/proto/reuse');
    expect(topic1.getValue()).toBeNull();

    const topic2 = networkTables.getProtobufTopic<{ value: number }>('/proto/reuse', {
      defaultValue: { value: 99 },
    });
    expect(topic2).toBe(topic1);
    expect(topic2.getValue()).toEqual({ value: 99 });
  });

  it('throws when createTopic is called with kProtobuf type', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(() => networkTables.createTopic('/proto/bad', NetworkTablesTypeInfos.kProtobuf)).toThrow(
      "Protobuf types are not allowed in createTopic. Use getProtobufTopic('/proto/bad', options) instead for proper encoding/decoding support."
    );
  });

  it('throws when createTopic is called with struct type', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(() => networkTables.createTopic('/struct/bad', [5, 'struct:Pose2d'])).toThrow(
      "Struct types are not allowed in createTopic. Use getStructTopic('/struct/bad', options) instead for proper encoding/decoding support."
    );
  });

  it('creates a struct topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.getStructTopic<{ x: number; y: number }>('/struct/pose', {
      typeName: 'Translation2d',
    });
    expect(topic).toBeDefined();
    expect(topic.getValue()).toBeNull();
  });

  it('returns existing struct topic with options applied on subsequent getStructTopic calls', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic1 = networkTables.getStructTopic<{ x: number; y: number }>('/struct/reuse', {
      typeName: 'Translation2d',
    });
    const topic2 = networkTables.getStructTopic<{ x: number; y: number }>('/struct/reuse', {
      typeName: 'Translation2d',
      defaultValue: { x: 1, y: 2 },
    });
    expect(topic2).toBe(topic1);
    expect(topic2.getValue()).toEqual({ x: 1, y: 2 });
  });

  it('throws when getStructTopic creates a new topic without typeName', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(() => networkTables.getStructTopic('/no-type')).toThrow(
      /Pass a descriptor \(e\.g\. Pose2d\) or \{ typeName \}/
    );
  });

  it('returns the existing struct topic when getStructTopic is called again without typeName', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const first = networkTables.getStructTopic('/pose-mm', Pose2d);
    const second = networkTables.getStructTopic('/pose-mm');
    expect(second).toBe(first);
  });

  it('throws when getStructTopic reuses a topic with a mismatched array type', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    networkTables.getStructTopic('/pose-mm', Pose2d);
    expect(() => networkTables.getStructTopic('/pose-mm', { typeName: 'Pose2d[]' })).toThrow(/type mismatch/);
  });

  it('creates struct topic with array type (Translation2d[]) and getValue/setValue work', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.getStructTopic<Array<{ x: number; y: number }>>('/struct/arr', {
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

  it('creates typed topics from WPILib-style factories', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    expect(networkTables.getBooleanTopic('/b', true).getValue()).toBe(true);
    expect(networkTables.getDoubleTopic('/d', 1.5).getValue()).toBe(1.5);
    expect(networkTables.getIntegerTopic('/i', 3).getValue()).toBe(3);
    expect(networkTables.getFloatTopic('/f', 1.25).getValue()).toBe(1.25);
    expect(networkTables.getStringTopic('/s', 'hi').getValue()).toBe('hi');
    expect(networkTables.getBooleanArrayTopic('/ba', [true]).getValue()).toEqual([true]);
    expect(networkTables.getDoubleArrayTopic('/da', [1, 2]).getValue()).toEqual([1, 2]);
    expect(networkTables.getIntegerArrayTopic('/ia', [1]).getValue()).toEqual([1]);
    expect(networkTables.getFloatArrayTopic('/fa', [0.5]).getValue()).toEqual([0.5]);
    expect(networkTables.getStringArrayTopic('/sa', ['a']).getValue()).toEqual(['a']);
    expect(networkTables.getRawTopic('/raw', new Uint8Array([1, 2])).getValue()).toEqual(new Uint8Array([1, 2]));
    expect(networkTables.getPrefixTopic('/')).toBeDefined();
  });

  it('creates a JSON topic that stores a parsed object', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.getJsonTopic('/json', { a: 1 });
    expect(topic.getValue()).toEqual({ a: 1 });
    expect(topic.typeInfo).toEqual([4, 'json']);
  });

  it('createTopic with kJson returns a JSON topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.createTopic('/json2', NetworkTablesTypeInfos.kJson, { b: true });
    expect(topic.getValue()).toEqual({ b: true });
  });

  it('getJsonTopic applies a validator on a reused topic', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const schema = z.object({ a: z.number() });
    const first = networkTables.getJsonTopic('/json-v', { a: 1 });
    const second = networkTables.getJsonTopic('/json-v', { a: 1 }, { validator: schema });
    expect(second).toBe(first);
    expect(() => second.updateValue(JSON.stringify({ a: 'nope' }), Date.now())).toThrow();
  });

  it('getJsonTopic reuse does not wipe an existing value', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const first = networkTables.getJsonTopic('/json-keep', { a: 1 });
    first.updateValue(JSON.stringify({ a: 99 }), Date.now());
    const second = networkTables.getJsonTopic('/json-keep', { a: 0 });
    expect(second).toBe(first);
    expect(second.getValue()).toEqual({ a: 99 });
  });

  it('getStructTopic with Pose2d infers the geometry type', () => {
    const networkTables = NetworkTables.getInstanceByTeam(973);
    const topic = networkTables.getStructTopic('/MyTable/PoseStruct', Pose2d);
    expect(topic.typeInfo[1]).toBe('struct:Pose2d');
    expect(topic.getValue()).toBeNull();
  });

  it('close removes the instance so a later getInstance creates a new one', () => {
    const first = NetworkTables.getInstanceByURI('close-test.local');
    const serverUrl = first['_client'].messenger.socket['serverUrl'] as string;
    first.close();
    expect(NetworkTables['_instances'].has('close-test.local:5810')).toBe(false);
    expect(PubSubClient['_instances'].has(serverUrl)).toBe(false);
    expect(Messenger['_instances'].has(serverUrl)).toBe(false);
    expect(NetworkTablesSocket['instances'].has(serverUrl)).toBe(false);
    const second = NetworkTables.getInstanceByURI('close-test.local');
    expect(second).not.toBe(first);
    second.close();
  });

  it('release closes the instance only when retain count reaches zero', () => {
    const nt = NetworkTables.getInstanceByURI('retain-test.local');
    nt.retain();
    nt.retain();
    nt.release();
    expect(NetworkTables['_instances'].has('retain-test.local:5810')).toBe(true);
    nt.release();
    expect(NetworkTables['_instances'].has('retain-test.local:5810')).toBe(false);
  });
});
