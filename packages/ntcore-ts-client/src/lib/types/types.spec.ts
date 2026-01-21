import { NetworkTablesTypeInfos } from './types';

import type {
  AnnounceMessage,
  NetworkTablesTypeInfo,
  NetworkTablesTypes,
  PropertiesMessage,
  SetPropertiesMessage,
  SubscribeMessage,
  UnannounceMessage,
  UnpublishMessage,
  UnsubscribeMessage,
} from './types';

describe('NetworkTablesTypeInfos', () => {
  it('should have the correct values', () => {
    expect(NetworkTablesTypeInfos.kBoolean).toEqual([0, 'boolean']);
    expect(NetworkTablesTypeInfos.kDouble).toEqual([1, 'double']);
    expect(NetworkTablesTypeInfos.kInteger).toEqual([2, 'int']);
    expect(NetworkTablesTypeInfos.kFloat).toEqual([3, 'float']);
    expect(NetworkTablesTypeInfos.kString).toEqual([4, 'string']);
    expect(NetworkTablesTypeInfos.kJson).toEqual([4, 'json']);
    expect(NetworkTablesTypeInfos.kUint8Array).toEqual([5, 'raw']);
    expect(NetworkTablesTypeInfos.kRPC).toEqual([5, 'rpc']);
    expect(NetworkTablesTypeInfos.kMsgpack).toEqual([5, 'msgpack']);
    expect(NetworkTablesTypeInfos.kProtobuf).toEqual([5, 'protobuf']);
    expect(NetworkTablesTypeInfos.kBooleanArray).toEqual([16, 'boolean[]']);
    expect(NetworkTablesTypeInfos.kDoubleArray).toEqual([17, 'double[]']);
    expect(NetworkTablesTypeInfos.kIntegerArray).toEqual([18, 'int[]']);
    expect(NetworkTablesTypeInfos.kFloatArray).toEqual([19, 'float[]']);
    expect(NetworkTablesTypeInfos.kStringArray).toEqual([20, 'string[]']);
  });

  describe('validateData', () => {
    it('should return the correct NT type for a boolean value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kBoolean, true)).toEqual(true);
    });

    it('should return the correct NT type for a double value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kDouble, 1.23)).toEqual(1.23);
    });

    it('should return the correct NT type for an integer value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kInteger, 123)).toEqual(123);
    });

    it('should return the correct NT type for an float value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kFloat, 1.1)).toEqual(1.1);
    });

    it('should return the correct NT type for a string value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kString, 'abc')).toEqual('abc');
    });

    it('should return the correct NT type for a JSON value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kJson, '{ "someJson": true }')).toEqual({
        someJson: true,
      });
    });

    it('should throw for a bad JSON value', () => {
      expect(() => NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kJson, 'not json')).toThrow(
        /"not json" is not valid JSON/
      );
    });

    it('should throw for a non-object JSON value', () => {
      expect(() => NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kJson, 'null')).toThrow(
        /Bad JSON value: null/
      );
    });

    it('should return the correct NT type for an Uint8Array value', () => {
      const array = new Uint8Array(10);
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kUint8Array, array)).toEqual(array);
    });

    it('should throw for a bad Uint8Array value', () => {
      expect(() => NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kUint8Array, 'not a Uint8Array')).toThrow(
        /Invalid Uint8Array value: not a Uint8Array/
      );
    });

    it('should return the correct NT type for an RPC value', () => {
      const array = new Uint8Array(10);
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kRPC, array)).toEqual(array);
    });

    it('should throw for a bad RPC value', () => {
      expect(() => NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kRPC, 'not rpc')).toThrow(
        /Invalid RPC value: not rpc/
      );
    });

    it('should return the correct NT type for an Msgpack value', () => {
      const array = new Uint8Array(10);
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kMsgpack, array)).toEqual(array);
    });

    it('should throw for a bad Msgpack value', () => {
      expect(() => NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kMsgpack, 'not msgpack')).toThrow(
        /Invalid Msgpack value: not msgpack/
      );
    });

    it('should return the correct NT type for an Protobuf value', () => {
      const array = new Uint8Array(10);
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kProtobuf, array)).toEqual(array);
    });

    it('should throw for a bad Protobuf value', () => {
      expect(() => NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kProtobuf, 'not protobuf')).toThrow(
        /Invalid Protobuf value: not protobuf/
      );
    });

    it('should return the correct NT type for a boolean array value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kBooleanArray, [true, false])).toEqual([
        true,
        false,
      ]);
    });

    it('should return the correct NT type for a double array value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kDoubleArray, [1.23, 4.56])).toEqual([
        1.23, 4.56,
      ]);
    });

    it('should return the correct NT type for an integer array value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kIntegerArray, [1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should return the correct NT type for an float array value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kFloatArray, [1.1, 2.0, 3.12])).toEqual([
        1.1, 2.0, 3.12,
      ]);
    });

    it('should return the correct NT type for a string array value', () => {
      expect(NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kStringArray, ['a', 'b', 'c'])).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('should throw an error for an invalid data type', () => {
      expect(() => NetworkTablesTypeInfos.validateData(NetworkTablesTypeInfos.kBoolean, 'invalidDataType')).toThrow();
    });

    it('should throw an error for an invalid type info', () => {
      expect(() => NetworkTablesTypeInfos.validateData({} as NetworkTablesTypeInfo, 'invalidTypeInfo')).toThrow();
    });
  });
});

describe('Message', () => {
  it('should have the correct shape for an unpublish message', () => {
    const unpublishMessage: UnpublishMessage = {
      method: 'unpublish',
      params: {
        pubuid: 0,
      },
    };
    expect(unpublishMessage).toEqual({
      method: expect.any(String),
      params: expect.any(Object),
    });
  });

  it('should have the correct shape for a set properties message', () => {
    const setPropertiesMessage: SetPropertiesMessage = {
      method: 'setproperties',
      params: {
        name: 'some name',
        update: {
          persistent: true,
          retained: false,
        },
      },
    };
    expect(setPropertiesMessage).toEqual({
      method: expect.any(String),
      params: expect.any(Object),
    });
  });

  it('should have the correct shape for a subscribe message', () => {
    const subscribeMessage: SubscribeMessage = {
      method: 'subscribe',
      params: {
        topics: ['some topic'],
        subuid: 0,
        options: {
          periodic: 0,
          all: false,
          topicsonly: true,
          prefix: false,
        },
      },
    };
    expect(subscribeMessage).toEqual({
      method: expect.any(String),
      params: expect.any(Object),
    });
  });

  it('should have the correct shape for an unsubscribe message', () => {
    const unsubscribeMessage: UnsubscribeMessage = {
      method: 'unsubscribe',
      params: {
        subuid: 0,
      },
    };
    expect(unsubscribeMessage).toEqual({
      method: expect.any(String),
      params: expect.any(Object),
    });
  });

  it('should have the correct shape for an announce message', () => {
    const announceMessage: AnnounceMessage = {
      method: 'announce',
      params: {
        name: 'some name',
        id: 0,
        type: 'string',
        properties: {
          persistent: false,
          retained: true,
        },
        pubuid: 0,
      },
    };
    expect(announceMessage).toEqual({
      method: expect.any(String),
      params: expect.any(Object),
    });
  });
  it('should have the correct shape for an unannounce message', () => {
    const unannounceMessage: UnannounceMessage = {
      method: 'unannounce',
      params: {
        name: 'some name',
        id: 0,
      },
    };
    expect(unannounceMessage).toEqual({
      method: expect.any(String),
      params: expect.any(Object),
    });
  });

  it('should have the correct shape for a properties message', () => {
    const propertiesMessage: PropertiesMessage = {
      method: 'properties',
      params: {
        name: 'some name',
        ack: false,
      },
    };
    expect(propertiesMessage).toEqual({
      method: expect.any(String),
      params: expect.any(Object),
    });
  });
});

describe('NetworkTablesTypes', () => {
  it('should have the correct shape for a number', () => {
    const number: NetworkTablesTypes = 1;
    expect(number).toEqual(expect.any(Number));
  });

  it('should have the correct shape for a boolean', () => {
    const boolean: NetworkTablesTypes = true;
    expect(boolean).toEqual(expect.any(Boolean));
  });

  it('should have the correct shape for a string', () => {
    const string: NetworkTablesTypes = 'some string';
    expect(string).toEqual(expect.any(String));
  });

  it('should have the correct shape for a number array', () => {
    const numberArray: NetworkTablesTypes = [1, 2, 3];
    expect(numberArray).toEqual(expect.any(Array));
  });

  it('should have the correct shape for a boolean array', () => {
    const booleanArray: NetworkTablesTypes = [true, false, true];
    expect(booleanArray).toEqual(expect.any(Array));
    expect(booleanArray[0]).toEqual(expect.any(Boolean));
    expect(booleanArray[1]).toEqual(expect.any(Boolean));
    expect(booleanArray[2]).toEqual(expect.any(Boolean));
  });

  it('should have the correct shape for a string array', () => {
    const stringArray: NetworkTablesTypes = ['some string', 'another string'];

    expect(stringArray).toEqual(expect.any(Array));
    expect(stringArray[0]).toEqual(expect.any(String));
    expect(stringArray[1]).toEqual(expect.any(String));
  });

  it('should have the correct shape for an Uint8Array', () => {
    const array: NetworkTablesTypes = new Uint8Array(10);

    expect(array).toEqual(expect.any(Uint8Array));
  });
});
