import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SubscribeOptions, TopicProperties } from '@ntcore/client';
import { useNtcore } from './context';
import type { ZodSchema } from 'zod';

/**
 * Options for useStructTopic (defaultValue, validator, typeName, schema, subscribeOptions, publish).
 */
export type UseStructTopicOptions<T extends Record<string, unknown> | Record<string, unknown>[]> = {
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
};

/**
 * Result of useStructTopic. When you pass `publish`, setValue is defined and you must
 * wait for isReadyToWrite before calling it.
 */
export type UseStructTopicResult<T extends Record<string, unknown> | Record<string, unknown>[]> = {
  value: T | null;
  setValue: ((value: T) => void) | undefined;
  /** True once the server has acknowledged our publish request. */
  isReadyToWrite: boolean;
};

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
 *
 * @param name - Topic name (e.g. "/MyTable/PoseStruct").
 * @param options - Optional typeName, schema, defaultValue, validator, subscribeOptions, publish.
 * @returns { value, setValue, isReadyToWrite }.
 */
export function useStructTopic<T extends Record<string, unknown> | Record<string, unknown>[]>(
  name: string,
  options?: UseStructTopicOptions<T>
): UseStructTopicResult<T> {
  const nt = useNtcore();
  const [state, setState] = useState<T | null>(options?.defaultValue ?? null);
  const [isReadyToWrite, setIsReadyToWrite] = useState(false);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!nt) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setState(optionsRef.current?.defaultValue ?? null);
        setIsReadyToWrite(false);
      }
    });
    const topic = nt.createStructTopic<T>(name, optionsRef.current);
    const subuid = topic.subscribe((v) => setState(v ?? null), optionsRef.current?.subscribeOptions ?? undefined);
    const publish = optionsRef.current?.publish;
    if (publish !== undefined) {
      const properties = publish === true ? {} : publish;
      topic
        .publish(properties)
        .then(() => {
          if (!cancelled) setIsReadyToWrite(true);
        })
        .catch(() => {
          /* publish failure: do not update state */
        });
      return () => {
        cancelled = true;
        topic.unsubscribe(subuid);
      };
    }
    return () => {
      cancelled = true;
      topic.unsubscribe(subuid);
    };
  }, [nt, name]);

  const setValueCb = useCallback(
    (value: T) => {
      if (!nt) return;
      const publish = optionsRef.current?.publish;
      if (publish !== undefined && !isReadyToWrite) return;
      const topic = nt.createStructTopic<T>(name, optionsRef.current);
      topic.setValue(value);
    },
    [nt, name, isReadyToWrite]
  );

  const isPublisher = options?.publish !== undefined;
  const setValue = nt !== null && isPublisher ? setValueCb : undefined;

  return { value: state, setValue, isReadyToWrite };
}
