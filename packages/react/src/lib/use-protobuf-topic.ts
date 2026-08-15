import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubscribeOptions, TopicProperties } from '@ntcore-ts/client';
import { toError, useNtcore } from './context';
import { trackPublish, unpublishWhenDone, claimPublishOwner, type TrackedPublish } from './unpublish-when-done';
import type { ZodSchema } from 'zod';

/**
 * Options for useProtobufTopic (defaultValue, validator, protoFilePath, protoSource, messageType, subscribeOptions, publish).
 * validator is compatible with ZodSchema<T> from 'zod'.
 */
export type UseProtobufTopicOptions<T extends object> = {
  defaultValue?: T;
  validator?: ZodSchema<T>;
  protoFilePath?: string;
  protoSource?: string;
  messageType?: import('protobufjs').Type;
  subscribeOptions?: SubscribeOptions;
  /**
   * Make this client the publisher of the topic so you can write with setValue.
   * - `true` → publish with default properties (not retained).
   * - `{ retained: true }` (or other TopicProperties) → publish with those properties.
   * When provided, only call setValue after isReadyToWrite is true.
   */
  publish?: true | TopicProperties;
  /** When `publish` is set, call `topic.unpublish()` on unmount (default `true`). */
  unpublishOnUnmount?: boolean;
};

/**
 * Result of useProtobufTopic. When you pass `publish`, setValue is defined and you must
 * wait for isReadyToWrite before calling it.
 */
export type UseProtobufTopicResult<T extends object> = {
  value: T | null;
  setValue: ((value: T) => void) | undefined;
  /** True once the server has acknowledged our publish request. Only check this when you passed `publish`. */
  isReadyToWrite: boolean;
  error: Error | null;
};

/**
 * Subscribes to a NetworkTables protobuf topic and returns the latest decoded value.
 * Unsubscribes on unmount.
 *
 * **Reading only:** Omit `publish` in options. You get `{ value, setValue: undefined, isReadyToWrite: false }`.
 *
 * **Reading and writing:** Pass `publish: true` or `publish: { retained: true }` (etc.) in options.
 * You get `{ value, setValue, isReadyToWrite }`. Only call setValue when isReadyToWrite is true.
 *
 * Subscription is re-created only when `nt` or `name` change. Optional options are read at subscribe time.
 *
 * @param name - Topic name (e.g. "/MyTable/Pose").
 * @param options - Optional defaultValue, validator, protoFilePath, protoSource, messageType, subscribeOptions, publish.
 * @returns { value, setValue, isReadyToWrite, error }.
 */
export function useProtobufTopic<T extends object>(
  name: string,
  options?: UseProtobufTopicOptions<T>
): UseProtobufTopicResult<T> {
  const nt = useNtcore();
  const [state, setState] = useState<T | null>(options?.defaultValue ?? null);
  const [isReadyToWrite, setIsReadyToWrite] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [identity, setIdentity] = useState({ nt, name });
  const optionsRef = useRef(options);
  optionsRef.current = options;

  if (nt !== identity.nt || name !== identity.name) {
    setIdentity({ nt, name });
    setState(options?.defaultValue ?? null);
    setIsReadyToWrite(false);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    const topic = nt.getProtobufTopic<T>(name, optionsRef.current);
    const subuid = topic.subscribe((v) => {
      if (cancelled) return;
      try {
        setState(v ?? null);
      } catch (e) {
        setError(toError(e));
      }
    }, optionsRef.current?.subscribeOptions ?? undefined);
    const publish = optionsRef.current?.publish;
    const unpublishOnUnmount = optionsRef.current?.unpublishOnUnmount ?? publish !== undefined;
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
  }, [nt, name]);

  const setValueCb = useCallback(
    (value: T) => {
      const publish = optionsRef.current?.publish;
      if (publish !== undefined && !isReadyToWrite) return;
      try {
        const topic = nt.getProtobufTopic<T>(name, optionsRef.current);
        topic.setValue(value);
      } catch (e) {
        setError(toError(e));
      }
    },
    [nt, name, isReadyToWrite]
  );

  const setValue = options?.publish !== undefined ? setValueCb : undefined;

  return { value: state, setValue, isReadyToWrite, error };
}
