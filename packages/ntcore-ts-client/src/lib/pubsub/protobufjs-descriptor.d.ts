/**
 * Type declarations for protobufjs/ext/descriptor extension
 *
 * The protobufjs library's descriptor extension provides functionality for
 * working with FileDescriptorProto and FileDescriptorSet, but these types
 * are not properly exported in the TypeScript definitions. This file
 * augments the protobufjs module to provide proper types.
 *
 * Why these types are needed:
 * - protobuf.Root.fromDescriptor() is a static method added by the descriptor extension
 * - IFileDescriptorProto and IFileDescriptorSet are used internally but not exported
 * - Without these types, we'd need to use 'any' everywhere, losing type safety
 *
 * These types match the structure defined in:
 * https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/descriptor.proto
 */

import type * as protobuf from 'protobufjs';

/**
 * Represents a single .proto file descriptor.
 * This matches the structure of google.protobuf.FileDescriptorProto
 */
export interface IFileDescriptorProto {
  /** File name, relative to root of source tree */
  name?: string;
  /** e.g. "foo", "foo.bar", etc. */
  package?: string;
  /** Names of files imported by this file */
  dependency?: string[];
  /** All top-level definitions in this file */
  messageType?: unknown[];
  enumType?: unknown[];
  service?: unknown[];
  extension?: unknown[];
  options?: unknown;
  sourceCodeInfo?: unknown;
  /** The syntax of the proto file (e.g. "proto2", "proto3") */
  syntax?: string;
  /** Additional fields that may be present */
  [key: string]: unknown;
}

/**
 * Represents a set of file descriptors.
 * This matches the structure of google.protobuf.FileDescriptorSet
 */
export interface IFileDescriptorSet {
  /** List of file descriptors */
  file: IFileDescriptorProto[];
}

/**
 * Represents a descriptor for a message type.
 * This matches the structure of google.protobuf.DescriptorProto
 */
export interface IDescriptorProto {
  /** Message name */
  name?: string;
  /** Fields defined in this message */
  field?: unknown[];
  /** Extensions defined in this message */
  extension?: unknown[];
  /** Nested message types */
  nestedType?: unknown[];
  /** Nested enum types */
  enumType?: unknown[];
  /** Extension ranges */
  extensionRange?: unknown[];
  /** Oneof declarations */
  oneofDecl?: unknown[];
  /** Message options */
  options?: unknown;
  /** Reserved ranges */
  reservedRange?: unknown[];
  /** Reserved field names */
  reservedName?: string[];
  /** Additional fields that may be present */
  [key: string]: unknown;
}

/**
 * Represents a descriptor for an enum type.
 * This matches the structure of google.protobuf.EnumDescriptorProto
 */
export interface IEnumDescriptorProto {
  /** Enum name */
  name?: string;
  /** Enum values */
  value?: unknown[];
  /** Enum options */
  options?: unknown;
  /** Reserved ranges */
  reservedRange?: unknown[];
  /** Reserved enum names */
  reservedName?: string[];
  /** Additional fields that may be present */
  [key: string]: unknown;
}

/**
 * Augment protobufjs/ext/descriptor to export these types
 */
declare module 'protobufjs/ext/descriptor' {
  export type { IFileDescriptorProto, IFileDescriptorSet, IDescriptorProto, IEnumDescriptorProto };
}

/**
 * Augment protobufjs to include descriptor extension methods.
 * These methods are added by protobufjs/ext/descriptor.
 */
declare module 'protobufjs' {
  namespace Root {
    /**
     * Creates a Root from a FileDescriptorSet.
     * This is a static method added by protobufjs/ext/descriptor.
     *
     * @param descriptor - The FileDescriptorSet containing file descriptors
     * @returns A Root instance (actually returns Namespace, but we know it's a Root)
     */
    function fromDescriptor(descriptor: import('./protobufjs-descriptor').IFileDescriptorSet): protobuf.Namespace;
  }

  interface Root {
    /**
     * Converts this Root to a FileDescriptorSet.
     * This method is added by protobufjs/ext/descriptor.
     *
     * @param protoVersion - The proto syntax version (e.g., "proto2", "proto3"). Defaults to "proto2".
     * @returns A FileDescriptorSet containing the file descriptor.
     *          The return type is both a protobuf.Message and IFileDescriptorSet.
     */
    toDescriptor(protoVersion?: string): protobuf.Message<IFileDescriptorSet> & IFileDescriptorSet;
  }

  interface Type {
    /**
     * Converts this Type to a DescriptorProto.
     * This method is added by protobufjs/ext/descriptor.
     *
     * @param protoVersion - The proto syntax version (e.g., "proto2", "proto3"). Defaults to "proto2".
     * @returns A DescriptorProto for this message type.
     *          The return type is both a protobuf.Message and IDescriptorProto.
     */
    toDescriptor(protoVersion?: string): protobuf.Message<IDescriptorProto> & IDescriptorProto;
  }

  interface Enum {
    /**
     * Converts this Enum to an EnumDescriptorProto.
     * This method is added by protobufjs/ext/descriptor.
     *
     * @param protoVersion - The proto syntax version (e.g., "proto2", "proto3"). Defaults to "proto2".
     * @returns An EnumDescriptorProto for this enum type.
     *          The return type is both a protobuf.Message and IEnumDescriptorProto.
     */
    toDescriptor(protoVersion?: string): protobuf.Message<IEnumDescriptorProto> & IEnumDescriptorProto;
  }
}
