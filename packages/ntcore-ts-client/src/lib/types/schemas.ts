import { z } from 'zod';

/** Schema for an integer. */
export const finiteNumSchema = z.number().finite();
export const integerSchema = finiteNumSchema.int();

/** Schema for type strings in the NT protocol. */
export const typeStringSchema = z.union([
  z.literal('boolean'),
  z.literal('double'),
  z.literal('int'),
  z.literal('float'),
  z.literal('string'),
  z.literal('json'),
  z.literal('raw'),
  z.literal('rpc'),
  z.literal('msgpack'),
  z.literal('protobuf'),
  z.literal('boolean[]'),
  z.literal('double[]'),
  z.literal('int[]'),
  z.literal('float[]'),
  z.literal('string[]'),
  z.string().startsWith('proto:'),
  z.string().startsWith('struct:'),
  z.string().startsWith('photonstruct:'),
]);

/** Schema for type numbers in the NT protocol. */
export const typeNumSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(16),
  z.literal(17),
  z.literal(18),
  z.literal(19),
  z.literal(20),
]);

/** Schema for topic properties in the NT protocol. */
export const topicPropertiesSchema = z
  .object({
    persistent: z.boolean(),
    retained: z.boolean(),
    cached: z.boolean(),
  })
  .partial();

/** Schema for a topic in the NT protocol. */
export const topicSchema = z.object({
  name: z.string(),
  id: integerSchema,
  type: typeStringSchema,
  properties: topicPropertiesSchema,
});

/** Schema for subscription options in the NT protocol. */
export const subscriptionOptionsSchema = z
  .object({
    periodic: integerSchema,
    all: z.boolean(),
    topicsonly: z.boolean(),
    prefix: z.boolean(),
  })
  .partial();

/** Schema for the publish message in the NT protocol. */
export const publishMessageParamsSchema = z.object({
  name: z.string(),
  pubuid: integerSchema,
  type: typeStringSchema,
  properties: topicPropertiesSchema,
});

/** Schema for the unpublish message params in the NT protocol. */
export const unpublishMessageParamsSchema = z.object({
  pubuid: integerSchema,
});

/** Schema for the set properties message params in the NT protocol. */
export const setPropertiesMessageParamsSchema = z.object({
  name: z.string(),
  update: topicPropertiesSchema,
});

/** Schema for the subscribe message params in the NT protocol. */
export const subscribeMessageParamsSchema = z.object({
  topics: z.array(z.string()),
  subuid: integerSchema,
  options: subscriptionOptionsSchema,
});

/** Schema for the unsubscribe message params in the NT protocol. */
export const unsubscribeMessageParamsSchema = z.object({
  subuid: integerSchema,
});

/** Schema for the announce message params in the NT protocol. */
export const announceMessageParamsSchema = topicSchema.extend({
  pubuid: integerSchema.optional(),
});

/** Schema for the unannounce message params in the NT protocol. */
export const unannounceMessageParamsSchema = z.object({
  name: z.string(),
  id: integerSchema,
});

/** Schema for the properties message params in the NT protocol. */
export const propertiesMessageParamsSchema = z.object({
  name: z.string(),
  ack: z.boolean().optional(),
  update: topicPropertiesSchema,
});

/** Schema for a publish message in the NT protocol. */
export const publishMessageSchema = z.object({
  method: z.literal('publish'),
  params: publishMessageParamsSchema,
});

/** Schema for an unpublish message in the NT protocol. */
export const unpublishMessageSchema = z.object({
  method: z.literal('unpublish'),
  params: unpublishMessageParamsSchema,
});

/** Schema for a setproperties message in the NT protocol. */
export const setPropertiesMessageSchema = z.object({
  method: z.literal('setproperties'),
  params: setPropertiesMessageParamsSchema,
});

/** Schema for a subscribe message in the NT protocol. */
export const subscribeMessageSchema = z.object({
  method: z.literal('subscribe'),
  params: subscribeMessageParamsSchema,
});

/** Schema for an unsubscribe message in the NT protocol. */
export const unsubscribeMessageSchema = z.object({
  method: z.literal('unsubscribe'),
  params: unsubscribeMessageParamsSchema,
});

/** Schema for an announce message in the NT protocol. */
export const announceMessageSchema = z.object({
  method: z.literal('announce'),
  params: announceMessageParamsSchema,
});

/** Schema for an unannounce message in the NT protocol. */
export const unannounceMessageSchema = z.object({
  method: z.literal('unannounce'),
  params: unannounceMessageParamsSchema,
});

/** Schema for a properties message in the NT protocol. */
export const propertiesMessageSchema = z.object({
  method: z.literal('properties'),
  params: propertiesMessageParamsSchema,
});

/** Schema for a text frame message in the NT protocol. */
export const messageSchema = z.array(
  z.discriminatedUnion('method', [
    publishMessageSchema,
    unpublishMessageSchema,
    setPropertiesMessageSchema,
    subscribeMessageSchema,
    unsubscribeMessageSchema,
    announceMessageSchema,
    unannounceMessageSchema,
    propertiesMessageSchema,
  ])
);

/** Schema for a value in the msgpack format. */
export const msgPackValueSchema = z.union([
  z.boolean(),
  integerSchema,
  finiteNumSchema,
  z.string(),
  z.custom<Uint8Array>((v) => v instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(v))),
  z.array(z.boolean()),
  z.array(z.string()),
  z.array(integerSchema),
  z.array(finiteNumSchema),
]);

/** Schema for a binary message in the msgpack format. */
export const msgPackSchema = z.tuple([
  z.union([integerSchema.nonnegative(), z.literal(-1)]),
  integerSchema.nonnegative(),
  typeNumSchema,
  msgPackValueSchema,
]);
