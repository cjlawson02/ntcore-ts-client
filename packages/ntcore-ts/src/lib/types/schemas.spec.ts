import {
  typeStringSchema,
  typeNumSchema,
  topicPropertiesSchema,
  subscriptionOptionsSchema,
  publishMessageParamsSchema,
  unpublishMessageParamsSchema,
  setPropertiesMessageParamsSchema,
  subscribeMessageParamsSchema,
  unsubscribeMessageParamsSchema,
  announceMessageParamsSchema,
  unannounceMessageParamsSchema,
  propertiesMessageParamsSchema,
  publishMessageSchema,
  unpublishMessageSchema,
  setPropertiesMessageSchema,
  subscribeMessageSchema,
  unsubscribeMessageSchema,
  announceMessageSchema,
  unannounceMessageSchema,
  propertiesMessageSchema,
} from './schemas';

describe('schema', () => {
  describe('typeStringSchema', () => {
    it('accepts valid type strings', () => {
      expect(typeStringSchema.safeParse('boolean').success).toBe(true);
      expect(typeStringSchema.safeParse('string').success).toBe(true);
    });

    it('rejects invalid type strings', () => {
      expect(typeStringSchema.safeParse('invalidType').success).toBe(false);
    });
  });

  describe('typeNumSchema', () => {
    it('accepts valid type numbers', () => {
      expect(typeNumSchema.safeParse(0).success).toBe(true);
      expect(typeNumSchema.safeParse(4).success).toBe(true);
    });

    it('rejects invalid type numbers', () => {
      expect(typeNumSchema.safeParse(7).success).toBe(false);
    });
  });

  describe('topicPropertiesSchema', () => {
    it('accepts objects with the "persistent" and/or "retained" properties', () => {
      expect(topicPropertiesSchema.safeParse({ persistent: true, retained: true }).success).toBe(true);
      expect(topicPropertiesSchema.safeParse({}).success).toBe(true);
    });

    it('rejects objects with invalid properties', () => {
      expect(topicPropertiesSchema.safeParse({ invalidProperty: true }).success).toBe(false);
    });
  });

  describe('subscriptionOptionsSchema', () => {
    it('accepts objects with the correct optional properties', () => {
      expect(
        subscriptionOptionsSchema.safeParse({
          periodic: 100,
          all: true,
          topicsonly: true,
          prefix: true,
        }).success
      ).toBe(true);
      expect(subscriptionOptionsSchema.safeParse({}).success).toBe(true);
    });

    it('rejects objects with invalid properties', () => {
      expect(subscriptionOptionsSchema.safeParse({ invalidProperty: true }).success).toBe(false);
    });
  });

  describe('publishMessageParamsSchema', () => {
    it('accepts objects with the correct required properties', () => {
      expect(
        publishMessageParamsSchema.safeParse({
          name: 'testTopic',
          pubuid: 1,
          type: 'string',
          properties: { persistent: true },
        }).success
      ).toBe(true);
    });
    it('rejects objects without the required properties', () => {
      expect(
        publishMessageParamsSchema.safeParse({
          pubuid: 1,
          type: 'string',
          properties: { persistent: true },
        }).success
      ).toBe(false);
    });
  });

  describe('unpublishMessageParamsSchema', () => {
    it('accepts objects with the "pubuid" property', () => {
      expect(unpublishMessageParamsSchema.safeParse({ pubuid: 1 }).success).toBe(true);
    });

    it('rejects objects without the "pubuid" property', () => {
      expect(unpublishMessageParamsSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('setPropertiesMessageParamsSchema', () => {
    it('accepts objects with the "name" and "update" properties', () => {
      expect(
        setPropertiesMessageParamsSchema.safeParse({
          name: 'testTopic',
          update: { persistent: true },
        }).success
      ).toBe(true);
    });

    it('rejects objects without the "name" property', () => {
      expect(
        setPropertiesMessageParamsSchema.safeParse({
          update: { persistent: true },
        }).success
      ).toBe(false);
    });
  });

  describe('subscribeMessageParamsSchema', () => {
    it('accepts objects with the correct required properties', () => {
      expect(
        subscribeMessageParamsSchema.safeParse({
          topics: ['testTopic1', 'testTopic2'],
          subuid: 1,
          options: { all: true },
        }).success
      ).toBe(true);
      expect(
        subscribeMessageParamsSchema.safeParse({
          topics: ['testTopic1', 'testTopic2'],
          subuid: 1,
          options: {},
        }).success
      ).toBe(true);
    });

    it('rejects objects without the "topics" and "subuid" properties', () => {
      expect(subscribeMessageParamsSchema.safeParse({ options: { all: true } }).success).toBe(false);
    });
  });

  describe('unsubscribeMessageParamsSchema', () => {
    it('accepts objects with the "subuid" property', () => {
      expect(unsubscribeMessageParamsSchema.safeParse({ subuid: 1 }).success).toBe(true);
    });

    it('rejects objects without the "subuid" property', () => {
      expect(unsubscribeMessageParamsSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('announceMessageParamsSchema', () => {
    it('accepts objects with the required properties', () => {
      expect(
        announceMessageParamsSchema.safeParse({
          name: 'testTopic',
          id: 1,
          type: 'string',
          properties: { persistent: true },
        }).success
      ).toBe(true);
    });

    it('accepts objects with the optional "pubuid" property', () => {
      expect(
        announceMessageParamsSchema.safeParse({
          name: 'testTopic',
          id: 1,
          type: 'string',
          properties: { persistent: true },
          pubuid: 1,
        }).success
      ).toBe(true);
    });

    it('rejects objects without the required properties', () => {
      expect(
        announceMessageParamsSchema.safeParse({
          id: 1,
          type: 'string',
          properties: { persistent: true },
        }).success
      ).toBe(false);
    });
  });

  describe('unannounceMessageParamsSchema', () => {
    it('accepts objects with the "name" and "id" properties', () => {
      expect(unannounceMessageParamsSchema.safeParse({ name: 'testTopic', id: 1 }).success).toBe(true);
    });

    it('rejects objects without the "name" and "id" properties', () => {
      expect(unannounceMessageParamsSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('propertiesMessageParamsSchema', () => {
    it('accepts objects with the "name" and "ack" properties', () => {
      expect(
        propertiesMessageParamsSchema.safeParse({
          name: 'testTopic',
          ack: true,
        }).success
      ).toBe(true);
    });

    it('rejects objects without the "name" and "ack" properties', () => {
      expect(propertiesMessageParamsSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('publishMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        publishMessageSchema.safeParse({
          method: 'publish',
          params: {
            name: 'testTopic',
            pubuid: 1,
            type: 'string',
            properties: { persistent: true },
          },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        publishMessageSchema.safeParse({
          method: 'invalidMethod',
          params: {
            name: 'testTopic',
            pubuid: 1,
            type: 'string',
            properties: { persistent: true },
          },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(
        publishMessageSchema.safeParse({
          method: 'publish',
          params: {
            name: 'testTopic',
            pubuid: 1,
            type: 'invalidType',
            properties: { persistent: true },
          },
        }).success
      ).toBe(false);
    });
  });

  describe('unpublishMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        unpublishMessageSchema.safeParse({
          method: 'unpublish',
          params: { pubuid: 1 },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        unpublishMessageSchema.safeParse({
          method: 'invalidMethod',
          params: { pubuid: 1 },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(unpublishMessageSchema.safeParse({ method: 'unpublish', params: {} }).success).toBe(false);
    });
  });

  describe('setPropertiesMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        setPropertiesMessageSchema.safeParse({
          method: 'setproperties',
          params: { name: 'testTopic', update: { persistent: true } },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        setPropertiesMessageSchema.safeParse({
          method: 'invalidMethod',
          params: { name: 'testTopic', update: { persistent: true } },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(
        setPropertiesMessageSchema.safeParse({
          method: 'setproperties',
          params: { update: { persistent: true } },
        }).success
      ).toBe(false);
    });
  });

  describe('subscribeMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        subscribeMessageSchema.safeParse({
          method: 'subscribe',
          params: {
            topics: ['testTopic1', 'testTopic2'],
            subuid: 1,
            options: { all: true },
          },
        }).success
      ).toBe(true);
      expect(
        subscribeMessageSchema.safeParse({
          method: 'subscribe',
          params: {
            topics: ['testTopic1', 'testTopic2'],
            subuid: 1,
            options: {},
          },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        subscribeMessageSchema.safeParse({
          method: 'invalidMethod',
          params: { topics: ['testTopic1', 'testTopic2'], subuid: 1 },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(
        subscribeMessageSchema.safeParse({
          method: 'subscribe',
          params: {
            topics: ['testTopic1', 'testTopic2'],
            options: { all: true },
          },
        }).success
      ).toBe(false);
    });
  });

  describe('unsubscribeMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        unsubscribeMessageSchema.safeParse({
          method: 'unsubscribe',
          params: { subuid: 1 },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        unsubscribeMessageSchema.safeParse({
          method: 'invalidMethod',
          params: { subuid: 1 },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(
        unsubscribeMessageSchema.safeParse({
          method: 'unsubscribe',
          params: {},
        }).success
      ).toBe(false);
    });
  });

  describe('announceMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        announceMessageSchema.safeParse({
          method: 'announce',
          params: {
            name: 'testTopic',
            id: 1,
            type: 'string',
            properties: { persistent: true },
          },
        }).success
      ).toBe(true);
      expect(
        announceMessageSchema.safeParse({
          method: 'announce',
          params: {
            name: 'testTopic',
            id: 1,
            type: 'string',
            properties: { persistent: true },
            pubuid: 1,
          },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        announceMessageSchema.safeParse({
          method: 'invalidMethod',
          params: {
            name: 'testTopic',
            id: 1,
            type: 'string',
            properties: { persistent: true },
          },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(
        announceMessageSchema.safeParse({
          method: 'announce',
          params: { id: 1, type: 'string', properties: { persistent: true } },
        }).success
      ).toBe(false);
    });
  });

  describe('unannounceMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        unannounceMessageSchema.safeParse({
          method: 'unannounce',
          params: { name: 'testTopic', id: 1 },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        unannounceMessageSchema.safeParse({
          method: 'invalidMethod',
          params: { name: 'testTopic', id: 1 },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(unannounceMessageSchema.safeParse({ method: 'unannounce', params: {} }).success).toBe(false);
    });
  });

  describe('propertiesMessageSchema', () => {
    it('accepts objects with the "method" and "params" properties set to the correct values', () => {
      expect(
        propertiesMessageSchema.safeParse({
          method: 'properties',
          params: { name: 'testTopic', ack: true },
        }).success
      ).toBe(true);
    });

    it('rejects objects with the incorrect "method" value', () => {
      expect(
        propertiesMessageSchema.safeParse({
          method: 'invalidMethod',
          params: { name: 'testTopic', ack: true },
        }).success
      ).toBe(false);
    });

    it('rejects objects with invalid "params" values', () => {
      expect(
        propertiesMessageSchema.safeParse({
          method: 'properties',
          params: { ack: true },
        }).success
      ).toBe(false);
    });
  });
});
