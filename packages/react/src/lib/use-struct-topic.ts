import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isStructTypeDescriptor,
  type StructTypeDescriptor,
  type SubscribeOptions,
  type TopicProperties,
} from '@ntcore-ts/client';
import { toError, useNtcore } from './context';
import { trackPublish, unpublishWhenDone, claimPublishOwner, type TrackedPublish } from './unpublish-when-done';
import type { ZodSchema } from 'zod';

/**
 * Options for useStructTopic (defaultValue, validator, typeName, schema, subscribeOptions, publish).
 */
export type UseStructTopicOptions<T extends object | object[] = object> = {
  defaultValue?: T;
  validator?: ZodSchema<T>;
  typeName?: string;
  schema?: string;
  subscribeOptions?: SubscribeOptions;
  /**
   * Make this client the publisher of the topic so you can write with setValue.
   * When provided, only call setValue after isReadyToWrite is true.
   */
  publish?: true | TopicProperties;
  /** When `publish` is set, call `topic.unpublish()` on unmount (default `true`). */
  unpublishOnUnmount?: boolean;
};

export type UseStructTopicTypeOptions<T extends object> = Omit<UseStructTopicOptions<T>, 'typeName' | 'validator'>;

/**
 * Result of useStructTopic. When you pass `publish`, setValue is defined and you must
 * wait for isReadyToWrite before calling it.
 */
export type UseStructTopicResult<T extends object | object[]> = {
  value: T | null;
  setValue: ((value: T) => void) | undefined;
  /** True once the server has acknowledged our publish request. */
  isReadyToWrite: boolean;
  error: Error | null;
};

function toStructTopicOptions<T extends object | object[]>(options: UseStructTopicOptions<T>) {
  return {
    ...(options.typeName !== undefined ? { typeName: options.typeName } : {}),
    ...(options.validator !== undefined ? { validator: options.validator } : {}),
    ...(options.defaultValue !== undefined ? { defaultValue: options.defaultValue } : {}),
    ...(options.schema !== undefined ? { schema: options.schema } : {}),
  };
}

/**
 * Subscribes to a NetworkTables struct topic using a WPILib-style type descriptor
 * (e.g. `useStructTopic('/MyTable/PoseStruct', Pose2d)`).
 */
export function useStructTopic<T extends object>(
  name: string,
  type: StructTypeDescriptor<T>,
  options?: UseStructTopicTypeOptions<T>
): UseStructTopicResult<T>;
/**
 * Subscribes to a NetworkTables struct topic and returns the latest decoded value.
 * Unsubscribes on unmount.
 *
 * **Reading only:** Omit `publish` in options.
 *
 * **Reading and writing:** Pass `publish: true` or `publish: { retained: true }` in options.
 * Only call setValue when isReadyToWrite is true.
 *
 * Subscription is re-created only when `nt` or `name` change. Optional options are read at subscribe time.
 */
export function useStructTopic<T extends object | object[]>(
  name: string,
  options?: UseStructTopicOptions<T>
): UseStructTopicResult<T>;
export function useStructTopic<T extends object | object[]>(
  name: string,
  typeOrOptions?: StructTypeDescriptor<object> | UseStructTopicOptions<T>,
  maybeOptions?: UseStructTopicTypeOptions<object>
): UseStructTopicResult<T> {
  const resolved: UseStructTopicOptions<T> = isStructTypeDescriptor(typeOrOptions)
    ? {
        typeName: typeOrOptions.typeName,
        validator: typeOrOptions.schema as ZodSchema<T>,
        ...(maybeOptions as UseStructTopicTypeOptions<T> | undefined),
      }
    : (typeOrOptions ?? {});

  const nt = useNtcore();
  const [state, setState] = useState<T | null>(resolved.defaultValue ?? null);
  const [isReadyToWrite, setIsReadyToWrite] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [identity, setIdentity] = useState({ nt, name, typeName: resolved.typeName });
  const optionsRef = useRef(resolved);
  optionsRef.current = resolved;

  const typeOrOptionsRef = useRef(typeOrOptions);
  typeOrOptionsRef.current = typeOrOptions;
  const maybeOptionsRef = useRef(maybeOptions);
  maybeOptionsRef.current = maybeOptions;

  if (nt !== identity.nt || name !== identity.name || resolved.typeName !== identity.typeName) {
    setIdentity({ nt, name, typeName: resolved.typeName });
    setState(resolved.defaultValue ?? null);
    setIsReadyToWrite(false);
    setError(null);
  }

  const getTopic = () => {
    const arg = typeOrOptionsRef.current;
    if (isStructTypeDescriptor(arg)) {
      return nt.getStructTopic(name, arg, maybeOptionsRef.current);
    }
    return nt.getStructTopic(name, toStructTopicOptions(optionsRef.current));
  };

  useEffect(() => {
    let cancelled = false;
    const topic = getTopic();
    const subuid = topic.subscribe((v) => {
      if (cancelled) return;
      try {
        setState((v ?? null) as T | null);
      } catch (e) {
        setError(toError(e));
      }
    }, optionsRef.current.subscribeOptions ?? undefined);
    const publish = optionsRef.current.publish;
    const unpublishOnUnmount = optionsRef.current.unpublishOnUnmount ?? publish !== undefined;
    const shouldPublish = publish !== undefined;
    let trackedPublish: TrackedPublish | undefined;
    let ownerToken: number | undefined;
    if (shouldPublish) {
      ownerToken = claimPublishOwner(topic);
      const properties = publish === true ? {} : publish;
      trackedPublish = trackPublish(
        topic
          .publish(properties)
          .then(() => {
            if (!cancelled) setIsReadyToWrite(true);
          })
          .catch((e) => {
            if (!cancelled) setError(toError(e));
          })
      );
    }
    return () => {
      cancelled = true;
      topic.unsubscribe(subuid);
      if (shouldPublish && unpublishOnUnmount && ownerToken !== undefined) {
        unpublishWhenDone(topic, trackedPublish, setError, ownerToken);
      }
    };
  }, [nt, name, resolved.typeName]);

  const setValueCb = useCallback(
    (value: T) => {
      const publish = optionsRef.current.publish;
      if (publish !== undefined && !isReadyToWrite) return;
      try {
        getTopic().setValue(value);
      } catch (e) {
        setError(toError(e));
      }
    },
    [nt, name, isReadyToWrite]
  );

  const setValue = resolved.publish !== undefined ? setValueCb : undefined;

  return { value: state, setValue, isReadyToWrite, error };
}
