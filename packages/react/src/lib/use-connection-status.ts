import { useEffect, useState } from 'react';
import { useNtcore } from './context';

const RTT_POLL_MS = 1000;

/**
 * Subscribes to robot connection status and returns the current state. Listener is removed on unmount.
 * When connected, RTT (round-trip time in ms) is polled periodically; -1 when not connected or not yet measured.
 * The client auto-reconnects after disconnect (with a short backoff); there is no separate "connecting" state.
 *
 * @returns { connected: boolean, rtt: number } when inside NtcoreProvider, or { connected: false, rtt: -1 } when outside.
 */
export function useConnectionStatus(): { connected: boolean; rtt: number } {
  const nt = useNtcore();
  const [listenerConnected, setListenerConnected] = useState(false);
  const [rtt, setRtt] = useState(-1);

  useEffect(() => {
    if (!nt) return;
    const remove = nt.addRobotConnectionListener(setListenerConnected, true);
    return remove;
  }, [nt]);

  useEffect(() => {
    if (!nt || !listenerConnected) return;
    const updateRtt = () => setRtt(nt.getRttMs());
    updateRtt();
    const interval = setInterval(updateRtt, RTT_POLL_MS);
    return () => clearInterval(interval);
  }, [nt, listenerConnected]);

  const connected = nt !== null ? listenerConnected : false;
  const rttValue = connected ? rtt : -1;
  return { connected, rtt: rttValue };
}
