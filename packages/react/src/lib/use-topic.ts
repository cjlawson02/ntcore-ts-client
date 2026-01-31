import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NetworkTablesTypeInfo, NetworkTablesTypes } from '@ntcore/client';
import type { SubscribeOptions, TopicProperties } from '@ntcore/client';
import { useNtcore } from './context';

/**
 * Subscribes to a NetworkTables topic and returns the latest value. Unsubscribes on unmount.
 * Returns [value, setValue, canPublish]. When ntcore is not available, setValue is undefined
 * and canPublish is false.
 *
 * Pass `publishOptions` (e.g. `{ retained: true }`) to publish the topic; setValue is safe to
 * call only after canPublish becomes true.
 *
 * Subscription is re-created only when `nt`, `name`, or `typeInfo` change. Optional
 * `subscribeOptions`, `defaultValue`, and `publishOptions` are read at subscribe time.
 *
 * @param name - Topic name (e.g. "/MyTable/Gyro").
 * @param typeInfo - Type info from NetworkTablesTypeInfos (e.g. NetworkTablesTypeInfos.kDouble).
 * @param defaultValue - Optional default value shown before the first update.
 * @param subscribeOptions - Optional subscribe options (e.g. { periodic: 0.02 }).
 * @param publishOptions - Optional publish options (e.g. { retained: true }). When provided, the hook publishes the topic and canPublish becomes true when the server acknowledges.
 * @returns [current value or null, setValue function or undefined, canPublish].
 */
export function useTopic<T extends NetworkTablesTypes>(
  name: string,
  typeInfo: NetworkTablesTypeInfo,
  defaultValue?: T,
  subscribeOptions?: SubscribeOptions,
  publishOptions?: TopicProperties
): [T | null, ((value: T) => void) | undefined, boolean] {
  const nt = useNtcore();
  const [state, setState] = useState<T | null>(defaultValue ?? null);
  const [canPublish, setCanPublish] = useState(false);
  const subscribeOptionsRef = useRef(subscribeOptions);
  const defaultValueRef = useRef(defaultValue);
  const publishOptionsRef = useRef(publishOptions);

  useLayoutEffect(() => {
    subscribeOptionsRef.current = subscribeOptions;
    defaultValueRef.current = defaultValue;
    publishOptionsRef.current = publishOptions;
  });

  useEffect(() => {
    if (!nt) return;
    queueMicrotask(() => {
      setState(defaultValueRef.current ?? null);
      setCanPublish(false);
    });
    const topic = nt.createTopic<T>(name, typeInfo, defaultValueRef.current);
    const subuid = topic.subscribe((v) => setState(v), subscribeOptionsRef.current ?? undefined);
    const opts = publishOptionsRef.current;
    if (opts !== undefined) {
      void topic.publish(opts).then(() => setCanPublish(true));
    }
    return () => topic.unsubscribe(subuid);
  }, [nt, name, typeInfo]);

  const setValueCb = useCallback(
    (value: T) => {
      if (!nt) return;
      const opts = publishOptionsRef.current;
      if (opts !== undefined && !canPublish) return;
      const topic = nt.createTopic<T>(name, typeInfo, defaultValueRef.current);
      topic.setValue(value);
    },
    [nt, name, typeInfo, canPublish]
  );

  const setValue = nt !== null ? setValueCb : undefined;
  return [state, setValue, canPublish];
}
