import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SubscribeOptions, TopicProperties } from '@ntcore/client';
import { useNtcore } from './context';
import z from 'zod';

/**
 * Options for useProtobufTopic (defaultValue, validator, protoFilePath, subscribeOptions, publishOptions).
 * validator is compatible with z.ZodSchema<T> from 'zod'.
 */
export type UseProtobufTopicOptions<T extends object> = {
  defaultValue?: T;
  validator?: z.ZodSchema<T>;
  protoFilePath?: string;
  subscribeOptions?: SubscribeOptions;
  /** When provided, the hook publishes the topic; setValue is safe only after canPublish is true. */
  publishOptions?: TopicProperties;
};

/**
 * Subscribes to a NetworkTables protobuf topic and returns the latest decoded value.
 * Unsubscribes on unmount. Returns [value, setValue, canPublish]. When ntcore is not available,
 * setValue is undefined and canPublish is false.
 *
 * Pass `publishOptions` (e.g. `{ retained: true }`) in options to publish the topic;
 * setValue is safe to call only after canPublish becomes true.
 *
 * Subscription is re-created only when `nt` or `name` change. Optional options are read at subscribe time.
 *
 * @param name - Topic name (e.g. "/MyTable/Pose").
 * @param options - Optional defaultValue, validator, protoFilePath, subscribeOptions, publishOptions.
 * @returns [current decoded value or null, setValue function or undefined, canPublish].
 */
export function useProtobufTopic<T extends object>(
  name: string,
  options?: UseProtobufTopicOptions<T>
): [T | null, ((value: T) => void) | undefined, boolean] {
  const nt = useNtcore();
  const [state, setState] = useState<T | null>(options?.defaultValue ?? null);
  const [canPublish, setCanPublish] = useState(false);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!nt) return;
    queueMicrotask(() => {
      setState(optionsRef.current?.defaultValue ?? null);
      setCanPublish(false);
    });
    const topic = nt.createProtobufTopic<T>(name, optionsRef.current);
    const subuid = topic.subscribe((v) => setState(v ?? null), optionsRef.current?.subscribeOptions ?? undefined);
    const publishOpts = optionsRef.current?.publishOptions;
    if (publishOpts !== undefined) {
      void topic.publish(publishOpts).then(() => setCanPublish(true));
    }
    return () => topic.unsubscribe(subuid);
  }, [nt, name]);

  const setValueCb = useCallback(
    (value: T) => {
      if (!nt) return;
      const publishOpts = optionsRef.current?.publishOptions;
      if (publishOpts !== undefined && !canPublish) return;
      const topic = nt.createProtobufTopic<T>(name, optionsRef.current);
      topic.setValue(value);
    },
    [nt, name, canPublish]
  );

  const setValue = nt !== null ? setValueCb : undefined;
  return [state, setValue, canPublish];
}
