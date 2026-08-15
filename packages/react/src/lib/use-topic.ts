import { useCallback, useEffect, useState } from 'react';
import {
  NetworkTablesTypeInfos,
  type NetworkTablesTypeInfo,
  type NetworkTablesTypes,
  type SubscribeOptions,
  type TopicProperties,
} from '@ntcore-ts/client';
import { toError, useNtcore } from './context';
import { trackPublish, unpublishWhenDone, claimPublishOwner, type TrackedPublish } from './unpublish-when-done';
import { useLatestRef } from './use-latest-ref';

/**
 * Options for useTopic. Use `publish: true` to become the publisher with default
 * properties (not retained). Use `publish: { retained: true }` (or other TopicProperties)
 * to become the publisher with specific properties.
 */
export type UseTopicOptions<T = NetworkTablesTypes> = {
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
  /**
   * When `publish` is set, call `topic.unpublish()` on unmount (default `true`).
   * Set to `false` to keep publishing after the component unmounts.
   */
  unpublishOnUnmount?: boolean;
};

/**
 * Result of useTopic. When you pass `publish`, setValue is defined and you must
 * wait for isReadyToWrite before calling it.
 */
export type UseTopicResult<T = NetworkTablesTypes> = {
  value: T | null;
  setValue: ((value: T) => void) | undefined;
  /** True once the server has acknowledged our publish request. Only check this when you passed `publish`. */
  isReadyToWrite: boolean;
  /** Last publish or setValue error, if any. */
  error: Error | null;
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
 * @returns { value, setValue, isReadyToWrite, error }.
 */
export function useTopic<T extends object>(
  name: string,
  typeInfo: typeof NetworkTablesTypeInfos.kJson,
  options?: UseTopicOptions<T>
): UseTopicResult<T>;
export function useTopic<T extends NetworkTablesTypes>(
  name: string,
  typeInfo: NetworkTablesTypeInfo,
  options?: UseTopicOptions<T>
): UseTopicResult<T>;
export function useTopic<T>(
  name: string,
  typeInfo: NetworkTablesTypeInfo,
  options?: UseTopicOptions<T>
): UseTopicResult<T> {
  const nt = useNtcore();
  const publishOpt = options?.publish;
  const typeNum = typeInfo[0];
  const typeStr = typeInfo[1];

  const [state, setState] = useState<T | null>(options?.defaultValue ?? null);
  const [isReadyToWrite, setIsReadyToWrite] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [identity, setIdentity] = useState({ nt, name, typeNum, typeStr });
  const optionsRef = useLatestRef(options);

  if (nt !== identity.nt || name !== identity.name || typeNum !== identity.typeNum || typeStr !== identity.typeStr) {
    setIdentity({ nt, name, typeNum, typeStr });
    setState(options?.defaultValue ?? null);
    setIsReadyToWrite(false);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    const topic =
      typeInfo[1] === 'json'
        ? nt.getJsonTopic(name, optionsRef.current?.defaultValue as object | undefined)
        : nt.createTopic(name, typeInfo, optionsRef.current?.defaultValue as NetworkTablesTypes | undefined);
    const subuid = topic.subscribe((v) => {
      if (cancelled) return;
      try {
        setState(v as T);
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
  }, [nt, name, typeNum, typeStr, optionsRef, typeInfo]);

  const setValueCb = useCallback(
    (value: T) => {
      const publish = optionsRef.current?.publish;
      if (publish !== undefined && !isReadyToWrite) return;
      try {
        const topic =
          typeInfo[1] === 'json'
            ? nt.getJsonTopic(name, optionsRef.current?.defaultValue as object | undefined)
            : nt.createTopic(name, typeInfo, optionsRef.current?.defaultValue as NetworkTablesTypes | undefined);
        topic.setValue(value as never);
      } catch (e) {
        setError(toError(e));
      }
    },
    [nt, name, typeInfo, isReadyToWrite, optionsRef]
  );

  const setValue = publishOpt !== undefined ? setValueCb : undefined;

  return { value: state, setValue, isReadyToWrite, error };
}
