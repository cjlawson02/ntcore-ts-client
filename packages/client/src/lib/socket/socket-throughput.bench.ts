import { beforeAll, bench } from 'vitest';
import { encode } from '@msgpack/msgpack';
import WSMock from 'vitest-websocket-mock';

import { NetworkTablesTypeInfos } from '../types/types';
import { LogLevel, setModuleLogLevel } from '../util/logger';
import { Util } from '../util/util';

import { NetworkTablesSocket } from './socket';

import type { BinaryMessage } from '../types/types';

const serverUrl = 'ws://localhost:5812/nt/throughput-bench';

const MESSAGES_PER_BATCH = 100;

let updateCount = 0;
let resolveBatch: () => void;

const onTopicUpdate = () => {
  updateCount++;
  if (updateCount >= MESSAGES_PER_BATCH) {
    resolveBatch?.();
  }
};

const noop = () => {
  /* empty */
};
let server: WSMock;
let singleFrame: Uint8Array;

function buildBinaryMessage(topicId: number, value: number): BinaryMessage {
  return Util.createBinaryMessage(topicId, 0, value, NetworkTablesTypeInfos.kDouble);
}

beforeAll(async () => {
  setModuleLogLevel('socket', LogLevel.SILENT);

  NetworkTablesSocket['instances'].forEach((instance: NetworkTablesSocket) => {
    instance.stopAutoConnect();
    try {
      instance.close();
    } catch {
      // best-effort cleanup
    }
  });
  NetworkTablesSocket['instances'].clear();

  server = new WSMock(serverUrl);
  NetworkTablesSocket.getInstance(serverUrl, noop, noop, onTopicUpdate, noop, noop, noop, false);
  await server.connected;

  singleFrame = encode(buildBinaryMessage(0, 1.0));
});

bench(`mock WebSocket: process ${MESSAGES_PER_BATCH} binary frames (end-to-end)`, async () => {
  updateCount = 0;
  const p = new Promise<void>((r) => {
    resolveBatch = r;
  });
  for (let i = 0; i < MESSAGES_PER_BATCH; i++) {
    server.send(singleFrame);
  }
  await p;
});
