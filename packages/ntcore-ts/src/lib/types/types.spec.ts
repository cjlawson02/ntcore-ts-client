import { NetworkTableTypeInfos } from './types';

import type {
    AnnounceMessage,
    BinaryMessageData,
    NetworkTableTypes,
    PropertiesMessage,
    PublishMessage,
    SetPropertiesMessage,
    SubscribeMessage,
    UnannounceMessage,
    UnpublishMessage,
    UnsubscribeMessage,
} from './types';

describe('NetworkTableTypeInfos', () => {
    it('should have the correct values', () => {
        expect(NetworkTableTypeInfos.kBoolean).toEqual([0, 'boolean']);
        expect(NetworkTableTypeInfos.kDouble).toEqual([1, 'double']);
        expect(NetworkTableTypeInfos.kInteger).toEqual([2, 'int']);
        expect(NetworkTableTypeInfos.kString).toEqual([4, 'string']);
        expect(NetworkTableTypeInfos.kArrayBuffer).toEqual([3, 'raw']);
        expect(NetworkTableTypeInfos.kBooleanArray).toEqual([16, 'boolean[]']);
        expect(NetworkTableTypeInfos.kDoubleArray).toEqual([17, 'double[]']);
        expect(NetworkTableTypeInfos.kIntegerArray).toEqual([18, 'int[]']);
        expect(NetworkTableTypeInfos.kStringArray).toEqual([20, 'string[]']);
    });
});

describe('BinaryMessageData', () => {
    it('should have the correct shape', () => {
        const binaryMessageData: BinaryMessageData = {
            topicId: 0,
            serverTime: 0,
            typeInfo: NetworkTableTypeInfos.kString,
            value: 'some value',
        };

        expect(binaryMessageData).toEqual({
            topicId: expect.any(Number),
            serverTime: expect.any(Number),
            typeInfo: expect.arrayContaining([expect.any(Number), expect.any(String)]),
            value: expect.any(String),
        });
    });
});

describe('Message', () => {
    it('should have the correct shape for a publish message', () => {
        const publishMessage: PublishMessage = {
            method: 'publish',
            params: {
                name: 'some name',
                pubuid: 0,
                type: 'string',
                properties: {
                    persistent: false,
                    retained: true,
                },
            },
        };

        expect(publishMessage).toEqual({
            method: expect.any(String),
            params: expect.any(Object),
        });
    });

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

describe('NetworkTableTypes', () => {
    it('should have the correct shape for a number', () => {
        const number: NetworkTableTypes = 1;
        expect(number).toEqual(expect.any(Number));
    });

    it('should have the correct shape for a boolean', () => {
        const boolean: NetworkTableTypes = true;
        expect(boolean).toEqual(expect.any(Boolean));
    });

    it('should have the correct shape for a string', () => {
        const string: NetworkTableTypes = 'some string';
        expect(string).toEqual(expect.any(String));
    });

    it('should have the correct shape for a number array', () => {
        const numberArray: NetworkTableTypes = [1, 2, 3];
        expect(numberArray).toEqual(expect.any(Array));
    });

    it('should have the correct shape for a boolean array', () => {
        const booleanArray: NetworkTableTypes = [true, false, true];
        expect(booleanArray).toEqual(expect.any(Array));
        expect(booleanArray[0]).toEqual(expect.any(Boolean));
        expect(booleanArray[1]).toEqual(expect.any(Boolean));
        expect(booleanArray[2]).toEqual(expect.any(Boolean));
    });

    it('should have the correct shape for a string array', () => {
        const stringArray: NetworkTableTypes = ['some string', 'another string'];

        expect(stringArray).toEqual(expect.any(Array));
        expect(stringArray[0]).toEqual(expect.any(String));
        expect(stringArray[1]).toEqual(expect.any(String));
    });

    it('should have the correct shape for an array buffer', () => {
        const arrayBuffer: NetworkTableTypes = new ArrayBuffer(10);

        expect(arrayBuffer).toEqual(expect.any(ArrayBuffer));
    });
});
