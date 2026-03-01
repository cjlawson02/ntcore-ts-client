import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NetworkTablesTypeInfo, NetworkTablesTypes } from '@ntcore/client';
import type { SubscribeOptions, TopicProperties } from '@ntcore/client';
import { useNtcore } from './context';

/**
 * Options for useTopic. Use `publish: true` to become the publisher with default
 * properties (not retained). Use `publish: { retained: true }` (or other TopicProperties)
 * to become the publisher with specific properties.
 */
export type UseTopicOptions<T extends NetworkTablesTypes> = {
  /** Shown before the first update. */
  defaultValue?: T;
  /** Subscribe options (e.g. { periodic: 0.02 }). */
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
 * Result of useTopic. When you pass `publish`, setValue is defined and you must
 * wait for isReadyToWrite before calling it.
 */
export type UseTopicResult<T extends NetworkTablesTypes> = {
  value: T | null;
  setValue: ((value: T) => void) | undefined;
  /** True once the server has acknowledged our publish request. Only check this when you passed `publish`. */
  isReadyToWrite: boolean;
};

/**
 * Subscribes to a NetworkTables topic and returns the latest value. Unsubscribes on unmount.
 *
 * **Reading only:** Omit `publish` in options. You get `{ value, setValue: undefined, isReadyToWrite: false }`.
 *
 * **Reading and writing:** Pass `publish: true` or `publish: { retained: true }` (etc.) in options.
 * You get `{ value, setValue, isReadyToWrite }`. Only call setValue when isReadyToWrite is true.
 *
 * Subscription is re-created only when `nt`, `name`, or `typeInfo` change. Optional
 * options are read at subscribe time.
 *
 * @param name - Topic name (e.g. "/MyTable/Gyro").
 * @param typeInfo - Type info from NetworkTablesTypeInfos (e.g. NetworkTablesTypeInfos.kDouble).
 * @param options - Optional defaultValue, subscribeOptions, and publish (make me the publisher).
 * @returns { value, setValue, isReadyToWrite }.
 */
export function useTopic<T extends NetworkTablesTypes>(
  name: string,
  typeInfo: NetworkTablesTypeInfo,
  options?: UseTopicOptions<T>
): UseTopicResult<T> {
  const nt = useNtcore();
  const defaultValue = options?.defaultValue;
  const publishOpt = options?.publish;

  const [state, setState] = useState<T | null>(defaultValue ?? null);
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
    const topic = nt.createTopic<T>(name, typeInfo, optionsRef.current?.defaultValue);
    const subuid = topic.subscribe((v) => setState(v), optionsRef.current?.subscribeOptions ?? undefined);
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
  }, [nt, name, typeInfo]);

  const setValueCb = useCallback(
    (value: T) => {
      if (!nt) return;
      const publish = optionsRef.current?.publish;
      if (publish !== undefined && !isReadyToWrite) return;
      const topic = nt.createTopic<T>(name, typeInfo, optionsRef.current?.defaultValue);
      topic.setValue(value);
    },
    [nt, name, typeInfo, isReadyToWrite]
  );

  const isPublisher = publishOpt !== undefined;
  const setValue = nt !== null && isPublisher ? setValueCb : undefined;

  return { value: state, setValue, isReadyToWrite };
}
