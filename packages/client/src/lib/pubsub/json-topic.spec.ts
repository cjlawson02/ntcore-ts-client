import WSMock from 'vitest-websocket-mock';
import { z } from 'zod';

import { NetworkTablesJsonTopic } from './json-topic';
import { PubSubClient } from './pubsub';

import type { AnnounceMessage } from '../types/types';

describe('NetworkTablesJsonTopic', () => {
  let topic: NetworkTablesJsonTopic<{ foo: string; n: number }>;
  let server: WSMock;
  let client: PubSubClient;
  const serverUrl = 'ws://localhost:5813/nt/json';

  beforeAll(async () => {
    server = new WSMock(serverUrl);
    client = PubSubClient.getInstance(serverUrl);
    await server.connected;
  });

  beforeEach(() => {
    topic = new NetworkTablesJsonTopic(client, '/json/test', { foo: 'bar', n: 1 });
  });

  afterEach(() => {
    topic['client']['topics'].clear();
    topic.subscribers.clear();
    topic['_publisher'] = false;
    topic['_pubuid'] = undefined;
  });

  it('returns the default parsed object from getValue', () => {
    expect(topic.getValue()).toEqual({ foo: 'bar', n: 1 });
    expect(topic.typeInfo).toEqual([4, 'json']);
  });

  it('round-trips JSON.stringify on setValue and JSON.parse on updateValue', async () => {
    const announceMessage: AnnounceMessage = {
      method: 'announce',
      params: {
        name: '/json/test',
        id: 1,
        pubuid: 42,
        type: 'json',
        properties: {},
      },
    };
    const publishPromise = topic.publish({}, 42);
    server.send(JSON.stringify([announceMessage]));
    await publishPromise;

    topic.setValue({ foo: 'baz', n: 2 });
    expect(topic.getValue()).toEqual({ foo: 'baz', n: 2 });

    topic.updateValue(JSON.stringify({ foo: 'from-wire', n: 3 }), Date.now());
    expect(topic.getValue()).toEqual({ foo: 'from-wire', n: 3 });
  });

  it('throws when setValue is called without being the publisher', () => {
    expect(() => topic.setValue({ foo: 'x', n: 0 })).toThrow('Cannot set value on topic without being the publisher');
  });

  it('throws on non-object JSON in updateValue', () => {
    expect(() => topic.updateValue('null', Date.now())).toThrow(/Bad JSON value/);
  });

  it('validates parsed JSON with a zod schema on updateValue', () => {
    const schema = z.object({ foo: z.string(), n: z.number() });
    const validated = new NetworkTablesJsonTopic(client, '/json/validated', undefined, { validator: schema });
    expect(() => validated.updateValue(JSON.stringify({ foo: 'ok', n: 1 }), Date.now())).not.toThrow();
    expect(validated.getValue()).toEqual({ foo: 'ok', n: 1 });
    expect(() => validated.updateValue(JSON.stringify({ foo: 1, n: 'nope' }), Date.now())).toThrow();
    expect(validated.getValue()).toEqual({ foo: 'ok', n: 1 });
  });

  it('validates on setValue when a validator is provided', async () => {
    const schema = z.object({ foo: z.string(), n: z.number() });
    const validated = new NetworkTablesJsonTopic(client, '/json/set-validated', undefined, { validator: schema });
    const announceMessage: AnnounceMessage = {
      method: 'announce',
      params: {
        name: '/json/set-validated',
        id: 2,
        pubuid: 43,
        type: 'json',
        properties: {},
      },
    };
    const publishPromise = validated.publish({}, 43);
    server.send(JSON.stringify([announceMessage]));
    await publishPromise;

    expect(() => validated.setValue({ foo: 'x', n: 0 })).not.toThrow();
    expect(() => validated.setValue({ foo: 'x', n: 'bad' } as unknown as { foo: string; n: number })).toThrow();
  });
});
