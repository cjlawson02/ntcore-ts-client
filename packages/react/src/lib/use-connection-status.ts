import { useEffect, useState } from 'react';
import { useNtcore } from './context';

const STATUS_POLL_MS = 1000;

/**
 * Subscribes to robot connection status and returns the current state. Listener is removed on unmount.
 * When connected, RTT (round-trip time in ms) is polled periodically; -1 when not connected or not yet measured.
 * When disconnected, `connecting` reflects `NetworkTables.isRobotConnecting()`.
 *
 * @returns { connected, connecting, rtt }.
 */
export function useConnectionStatus(): { connected: boolean; connecting: boolean; rtt: number } {
  const nt = useNtcore();
  const [listenerConnected, setListenerConnected] = useState(false);
  const [connecting, setConnecting] = useState(() => nt.isRobotConnecting());
  const [rtt, setRtt] = useState(-1);
  const [identity, setIdentity] = useState(nt);

  if (nt !== identity) {
    setIdentity(nt);
    setListenerConnected(false);
    setConnecting(nt.isRobotConnecting());
    setRtt(-1);
  }

  useEffect(() => {
    const remove = nt.addRobotConnectionListener(setListenerConnected, true);
    return remove;
  }, [nt]);

  useEffect(() => {
    if (listenerConnected) return;
    const updateConnecting = () => setConnecting(nt.isRobotConnecting());
    updateConnecting();
    const interval = setInterval(updateConnecting, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [nt, listenerConnected]);

  useEffect(() => {
    if (!listenerConnected) return;
    const updateRtt = () => setRtt(nt.getRttMs());
    updateRtt();
    const interval = setInterval(updateRtt, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [nt, listenerConnected]);

  return {
    connected: listenerConnected,
    connecting: listenerConnected ? false : connecting,
    rtt: listenerConnected ? rtt : -1,
  };
}
