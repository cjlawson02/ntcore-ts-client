import { NetworkTableTypeInfos } from '../types/types';

import { PubSubClient } from './pubsub';
import { Topic } from './topic';

import type { SubscribeMessageParams } from '../types/types';

describe('Topic', () => {
    let topic: Topic<string>;
    beforeEach(() => {
        const serverUrl = 'ws://localhost:5810/nt/1234';
        const client = PubSubClient.getInstance(serverUrl);

        topic = new Topic<string>(client, 'test', NetworkTableTypeInfos.kString, 'default');
    });

    afterEach(() => {
        topic['client']['topics'].clear();
        topic.subscribers.clear();
    });

    describe('constructor', () => {
        it('returns the existing topic if it already exists', () => {
            const newTopic = new Topic<string>(topic['client'], 'test', NetworkTableTypeInfos.kString, 'default');
            expect(topic).toBe(newTopic);
        });

        it('should return null if there is no default value', () => {
            const newTopic = new Topic<string>(topic['client'], 'test-no-default', NetworkTableTypeInfos.kString);
            expect(newTopic.getValue()).toBeNull();
        });
    });

    describe('setValue', () => {
        it('throws an error if the client is not the publisher', () => {
            expect(() => topic.setValue('new value')).toThrowError(
                'Cannot set value on topic without being the publisher'
            );
        });

        it('allows the value to be set if the client is the publisher', () => {
            topic.publish();
            topic.announce(1);
            topic.setValue('new value');
            expect(topic.getValue()).toEqual('new value');
        });
    });

    describe('getValue', () => {
        it('gets the correct default value', () => {
            expect(topic.getValue()).toEqual('default');
        });
    });

    describe('updateValue', () => {
        it('updates the value correctly', () => {
            topic.announce(1);
            topic.updateValue('new value', Date.now());
            expect(topic.getValue()).toEqual('new value');
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect(topic.lastChangedTime! - Date.now()).toBeLessThan(10);
        });
    });

    describe('announce', () => {
        it('marks the topic as announced when announce is called', () => {
            expect(topic.announced).toBe(false);
            topic.announce(1);
            expect(topic.announced).toBe(true);
            expect(topic.id).toEqual(1);
        });
    });

    describe('unannounce', () => {
        it('marks the topic as unannounced when unannounce is called', () => {
            topic.announce(1);
            expect(topic.announced).toBe(true);
            topic.unannounce();
            expect(topic.announced).toBe(false);
        });
    });

    describe('subscribe', () => {
        let callback: jest.Mock;
        beforeEach(() => {
            callback = jest.fn();
        });

        it('should add the callback to the list of subscribers', () => {
            topic.subscribe(callback);
            expect(topic.subscribers.size).toEqual(1);
            expect(topic.subscribers.values().next().value).toEqual({
                callback,
                immediateNotify: false,
                options: {},
            });
        });

        it('should send a subscribe message to the server', () => {
            const send = jest.fn();
            topic['client']['_messenger']['_socket']['sendTextFrame'] = send;
            topic.subscribe(callback, true);
            expect(send).toHaveBeenCalledWith({
                method: 'subscribe',
                params: {
                    topics: ['test'],
                    subuid: expect.any(Number),
                    options: {},
                } as SubscribeMessageParams,
            });
        });

        it('should immediately notify the callback if immediateNotify is true and there is a value', () => {
            topic['value'] = 'foo';
            topic.subscribe(callback, true);
            expect(callback).toHaveBeenCalledWith('foo');
        });

        it('should not immediately notify the callback if immediateNotify is false', () => {
            topic['value'] = 'foo';
            topic.subscribe(callback, false);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('unsubscribe', () => {
        it('removes the subscriber from the topic', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const callback = (_: string | null) => jest.fn();
            const options = {};
            topic.subscribe(callback, true, options);
            expect(topic.subscribers.size).toBe(1);
            topic.unsubscribe(topic.subscribers.keys().next().value, true);
            expect(topic.subscribers.size).toBe(0);
        });
        it('does nothing if the callback is not a subscriber', () => {
            expect(topic.subscribers.size).toBe(0);
            topic.unsubscribe(topic.subscribers.keys().next().value);
            expect(topic.subscribers.size).toBe(0);
        });
    });

    describe('unsubscribeAll', () => {
        it('removes all subscribers from the topic', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const callback = (_: string | null) => jest.fn();
            const options = {};
            topic.subscribe(callback, true, options);
            topic.subscribe(callback, true, options);
            expect(topic.subscribers.size).toBe(2);
            topic.unsubscribeAll();
            expect(topic.subscribers.size).toBe(0);
        });
    });

    describe('resubscribeAll', () => {
        it('resubscribes all subscribers to the topic', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const callback = (_: string | null) => jest.fn();
            const options = {};
            topic.subscribe(callback, true, options);
            topic.subscribe(callback, true, options);
            expect(topic.subscribers.size).toBe(2);
            topic.resubscribeAll(topic['client']);
            expect(topic.subscribers.size).toBe(2);
        });
    });

    describe('notifySubscribers', () => {
        it('calls the callback with the value', () => {
            const callback = jest.fn();
            topic.subscribe(callback);
            topic['value'] = 'foo';
            topic['notifySubscribers']();
            expect(callback).toHaveBeenCalledWith('foo');
        });
    });

    describe('publish', () => {
        it('sets the publisher to the client', () => {
            topic.publish();
            expect(topic.publisher).toBe(true);
        });

        it('does not set the publisher if the client is already the publisher', () => {
            topic.publish();
            const id = topic.pubuid;
            topic.publish();
            expect(id).toEqual(topic.pubuid);
        });
    });

    describe('unpublish', () => {
        it('sets the publisher to null', () => {
            topic.publish();
            topic.unpublish();
            expect(topic.publisher).toBe(false);
        });

        it('should throw an error if the client is not the publisher', () => {
            expect(() => topic.unpublish()).toThrowError('Cannot unpublish topic without being the publisher');
        });
    });

    describe('republish', () => {
        it('should republish', () => {
            topic.publish();
            topic['publish'] = jest.fn();
            topic.republish(topic['client']);
            expect(topic['publish']).toHaveBeenCalledWith({}, topic.pubuid);
            expect(topic.publisher).toBe(true);
        });

        it('should throw error if the client is not the publisher', () => {
            expect(() => topic.republish(topic['client'])).toThrowError(
                'Cannot republish topic without being the publisher'
            );
        });
    });

    describe('setProperties', () => {
        it('should set the properties', () => {
            topic['client']['messenger']['_socket']['sendTextFrame'] = jest.fn();
            topic.setProperties(true, true);
            expect(topic['client']['messenger']['_socket']['sendTextFrame']).toHaveBeenCalledWith({
                method: 'setproperties',
                params: {
                    name: 'test',
                    update: {
                        persistent: true,
                        retained: true,
                    },
                },
            });
        });
    });
});
