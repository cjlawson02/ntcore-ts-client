import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SubscribeOptions, TopicProperties } from '@ntcore/client';
import { useNtcore } from './context';
import { z } from 'zod';

/**
 * Options for useProtobufTopic (defaultValue, validator, protoFilePath, subscribeOptions, publish).
 * validator is compatible with z.ZodSchema<T> from 'zod'.
 */
export type UseProtobufTopicOptions<T extends object> = {
  defaultValue?: T;
  validator?: z.ZodSchema<T>;
  protoFilePath?: string;
  subscribeOptions?: SubscribeOptions;
  /**
   * Make this client the publisher of the topic so you can write with setValue.
   * - `true` → publish with default properties (not retained).
   * - `{ retained: true }` (or other TopicProperties) → publish with those properties.
   * When provided, only call setValue after isReadyToWrite is true.
   */
  publish?: true | TopicProperties;
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
 * @param options - Optional defaultValue, validator, protoFilePath, subscribeOptions, publish.
 * @returns { value, setValue, isReadyToWrite }.
 */
export function useProtobufTopic<T extends object>(
  name: string,
  options?: UseProtobufTopicOptions<T>
): UseProtobufTopicResult<T> {
  const nt = useNtcore();
  const [state, setState] = useState<T | null>(options?.defaultValue ?? null);
  const [isReadyToWrite, setIsReadyToWrite] = useState(false);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!nt) return;
    queueMicrotask(() => {
      setState(optionsRef.current?.defaultValue ?? null);
      setIsReadyToWrite(false);
    });
    const topic = nt.createProtobufTopic<T>(name, optionsRef.current);
    const subuid = topic.subscribe((v) => setState(v ?? null), optionsRef.current?.subscribeOptions ?? undefined);
    const publish = optionsRef.current?.publish;
    if (publish !== undefined) {
      const properties = publish === true ? {} : publish;
      void topic.publish(properties).then(() => setIsReadyToWrite(true));
    }
    return () => topic.unsubscribe(subuid);
  }, [nt, name]);

  const setValueCb = useCallback(
    (value: T) => {
      if (!nt) return;
      const publish = optionsRef.current?.publish;
      if (publish !== undefined && !isReadyToWrite) return;
      const topic = nt.createProtobufTopic<T>(name, optionsRef.current);
      topic.setValue(value);
    },
    [nt, name, isReadyToWrite]
  );

  const isPublisher = options?.publish !== undefined;
  const setValue = nt !== null && isPublisher ? setValueCb : undefined;

  return { value: state, setValue, isReadyToWrite };
}
