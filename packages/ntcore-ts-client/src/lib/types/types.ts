import { z } from 'zod';

import { finiteNumSchema, integerSchema } from './schemas';

import type {
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
export type NetworkTablesTypeInfo = [TypeNum, TypeString];

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

export type NetworkTablesTypes = z.infer<typeof msgPackValueSchema>;
export type BinaryMessage = z.infer<typeof msgPackSchema>;
export type TopicProperties = z.infer<typeof topicPropertiesSchema>;

export class NetworkTablesTypeInfos {
  static readonly kBoolean: NetworkTablesTypeInfo = [0, 'boolean'];
  static readonly kDouble: NetworkTablesTypeInfo = [1, 'double'];
  static readonly kInteger: NetworkTablesTypeInfo = [2, 'int'];
  static readonly kFloat: NetworkTablesTypeInfo = [3, 'float'];
  static readonly kString: NetworkTablesTypeInfo = [4, 'string'];
  static readonly kJson: NetworkTablesTypeInfo = [4, 'json'];
  static readonly kArrayBuffer: NetworkTablesTypeInfo = [5, 'raw'];
  static readonly kRPC: NetworkTablesTypeInfo = [5, 'rpc'];
  static readonly kMsgpack: NetworkTablesTypeInfo = [5, 'msgpack'];
  static readonly kProtobuf: NetworkTablesTypeInfo = [5, 'protobuf'];
  static readonly kBooleanArray: NetworkTablesTypeInfo = [16, 'boolean[]'];
  static readonly kDoubleArray: NetworkTablesTypeInfo = [17, 'double[]'];
  static readonly kIntegerArray: NetworkTablesTypeInfo = [18, 'int[]'];
  static readonly kFloatArray: NetworkTablesTypeInfo = [19, 'float[]'];
  static readonly kStringArray: NetworkTablesTypeInfo = [20, 'string[]'];

  static readonly typeNumMap = new Map<number, NetworkTablesTypeInfo>();

  static {
    const all = [
      this.kBoolean,
      this.kDouble,
      this.kInteger,
      this.kFloat,
      this.kString,
      this.kJson,
      this.kArrayBuffer,
      this.kRPC,
      this.kMsgpack,
      this.kProtobuf,
      this.kBooleanArray,
      this.kDoubleArray,
      this.kIntegerArray,
      this.kFloatArray,
      this.kStringArray,
    ];

    for (const info of all) {
      const [num] = info;
      if (!this.typeNumMap.has(num)) {
        this.typeNumMap.set(num, info);
      }
    }
  }

  /**
   * Given a type number, find the NT type info.
   * @param typeNum - The NT type number.
   * @returns The corresponding type info.
   */
  static getFromTypeNum(typeNum: number): NetworkTablesTypeInfo {
    const info = this.typeNumMap.get(typeNum);
    if (!info) throw new Error(`Invalid type number: ${typeNum}`);
    return info;
  }

  /**
   * Validates and parses a value based on the expected NetworkTables type information.
   * @param expectedTypeInfo - The expected type information from `NetworkTablesTypeInfo`.
   * @param value - The value to validate and parse.
   * @returns The parsed value, matching the expected type.
   * @throws Will throw an error if the value does not match the expected type or if parsing fails.
   */
  static validateData(expectedTypeInfo: NetworkTablesTypeInfo, value: NetworkTablesTypes): NetworkTablesTypes {
    switch (expectedTypeInfo) {
      // 0
      case NetworkTablesTypeInfos.kBoolean:
        return z.boolean().parse(value);
      // 1
      case NetworkTablesTypeInfos.kDouble:
        return finiteNumSchema.parse(value);
      // 2
      case NetworkTablesTypeInfos.kInteger:
        return integerSchema.parse(value);
      // 3
      case NetworkTablesTypeInfos.kFloat:
        return finiteNumSchema.parse(value);
      // 4
      case NetworkTablesTypeInfos.kString:
        return z.string().parse(value);
      case NetworkTablesTypeInfos.kJson: {
        const parsedString = z.string().parse(value);
        const parsedJson = JSON.parse(parsedString);
        if (typeof parsedJson === 'object' && parsedJson !== null) {
          return parsedJson;
        } else {
          throw new Error(`Bad JSON value: ${value}`);
        }
      }
      // 5
      case NetworkTablesTypeInfos.kArrayBuffer:
        // Check if value is an ArrayBuffer, RPC, Msgpack, or Protobuf
        if (value instanceof ArrayBuffer) {
          return value;
        } else {
          throw new Error(`Invalid ArrayBuffer value: ${value}`);
        }
      case NetworkTablesTypeInfos.kRPC:
        if (value instanceof ArrayBuffer) {
          return value;
        } else {
          throw new Error(`Invalid RPC value: ${value}`);
        }
      case NetworkTablesTypeInfos.kMsgpack:
        if (value instanceof ArrayBuffer) {
          return value;
        } else {
          throw new Error(`Invalid Msgpack value: ${value}`);
        }
      case NetworkTablesTypeInfos.kProtobuf:
        if (value instanceof ArrayBuffer) {
          return new Uint8Array(value);
        } else {
          throw new Error(`Invalid Protobuf value: ${value}`);
        }
      // 16
      case NetworkTablesTypeInfos.kBooleanArray:
        return z.array(z.boolean()).parse(value);
      // 17
      case NetworkTablesTypeInfos.kDoubleArray:
        return z.array(finiteNumSchema).parse(value);
      // 18
      case NetworkTablesTypeInfos.kIntegerArray:
        return z.array(integerSchema).parse(value);
      // 19
      case NetworkTablesTypeInfos.kFloatArray:
        return z.array(finiteNumSchema).parse(value);
      // 20
      case NetworkTablesTypeInfos.kStringArray:
        return z.array(z.string()).parse(value);

      default:
        throw new Error(`Invalid type info: ${expectedTypeInfo}`);
    }
  }
}

export interface BinaryMessageData {
  topicId: number;
  serverTime: number;
  typeNum: TypeNum;
  value: NetworkTablesTypes;
}
