import type WSMock from 'vitest-websocket-mock';

import type { PubSubClient } from '../src/lib/pubsub/pubsub';
import type { Message, PublishMessageParams } from '../src/lib/types/types';

/**
 * Makes a mock NT server reply to every client `publish` with an `announce` that includes
 * `pubuid`, matching WPILib 2027 (allwpilib#8515) behavior.
 */
export function autoAnnounceOnPublish(client: PubSubClient, server: WSMock): void {
  const socket = client.messenger.socket;
  const original = socket.sendTextFrame.bind(socket);
  vi.spyOn(socket, 'sendTextFrame').mockImplementation((msg: Message) => {
    original(msg);
    if (msg.method !== 'publish') {
      return;
    }
    const params = msg.params as PublishMessageParams;
    queueMicrotask(() => {
      server.send(
        JSON.stringify([
          {
            method: 'announce',
            params: {
              name: params.name,
              pubuid: params.pubuid,
              type: params.type,
              id: 1,
              properties: params.properties ?? {},
            },
          },
        ])
      );
    });
  });
}
