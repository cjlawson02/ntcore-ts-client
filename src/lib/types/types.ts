import { z } from 'zod';
import {
  typeStringSchema,
  announceMessageSchema,
  msgPackSchema,
  msgPackValueSchema,
  propertiesMessageSchema,
  publishMessageSchema,
  setPropertiesMessageSchema,
  subscribeMessageSchema,
  subscriptionOptionsSchema,
  topicPropertiesSchema,
  unannounceMessageSchema,
  unpublishMessageSchema,
  unsubscribeMessageSchema,
  typeNumSchema,
} from './schemas';

export type TypeString = z.infer<typeof typeStringSchema>;
export type TypeNum = z.infer<typeof typeNumSchema>;
export type NetworkTableTypeInfo = [TypeNum, TypeString];

export type PublishMessage = z.infer<typeof publishMessageSchema>;
export type UnpublishMessage = z.infer<typeof unpublishMessageSchema>;
export type SetPropertiesMessage = z.infer<typeof setPropertiesMessageSchema>;
export type SubscribeMessage = z.infer<typeof subscribeMessageSchema>;
export type SubscribeOptions = z.infer<typeof subscriptionOptionsSchema>;
export type UnsubscribeMessage = z.infer<typeof unsubscribeMessageSchema>;
export type AnnounceMessage = z.infer<typeof announceMessageSchema>;
export type UnannounceMessage = z.infer<typeof unannounceMessageSchema>;
export type PropertiesMessage = z.infer<typeof propertiesMessageSchema>;

export type Message =
  | PublishMessage
  | UnpublishMessage
  | SetPropertiesMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | AnnounceMessage
  | UnannounceMessage
  | PropertiesMessage;

export type PublishMessageParams = PublishMessage['params'];
export type UnpublishMessageParams = UnpublishMessage['params'];
export type SetPropertiesMessageParams = SetPropertiesMessage['params'];
export type SubscribeMessageParams = SubscribeMessage['params'];
export type UnsubscribeMessageParams = UnsubscribeMessage['params'];
export type AnnounceMessageParams = AnnounceMessage['params'];
export type UnannounceMessageParams = UnannounceMessage['params'];
export type PropertiesMessageParams = PropertiesMessage['params'];

export type NetworkTableTypes = z.infer<typeof msgPackValueSchema>;
export type BinaryMessage = z.infer<typeof msgPackSchema>;
export type TopicProperties = z.infer<typeof topicPropertiesSchema>;

export class NetworkTableTypeInfos {
  public static readonly kBoolean: NetworkTableTypeInfo = [0, 'boolean'];
  public static readonly kDouble: NetworkTableTypeInfo = [1, 'double'];
  public static readonly kInteger: NetworkTableTypeInfo = [2, 'int'];
  public static readonly kString: NetworkTableTypeInfo = [4, 'string'];
  public static readonly kArrayBuffer: NetworkTableTypeInfo = [3, 'raw'];
  public static readonly kBooleanArray: NetworkTableTypeInfo = [
    16,
    'boolean[]',
  ];
  public static readonly kDoubleArray: NetworkTableTypeInfo = [17, 'double[]'];
  public static readonly kIntegerArray: NetworkTableTypeInfo = [18, 'int[]'];
  public static readonly kStringArray: NetworkTableTypeInfo = [20, 'string[]'];
}

export type BinaryMessageData = {
  topicId: number;
  serverTime: number;
  typeInfo: NetworkTableTypeInfos;
  value: NetworkTableTypes;
};
