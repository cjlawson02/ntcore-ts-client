import { beforeAll, bench } from 'vitest';
import { encode } from '@msgpack/msgpack';
import WSMock from 'vitest-websocket-mock';

import { NetworkTablesTypeInfos } from '../types/types';
import { LogLevel, setModuleLogLevel } from '../util/logger';
import { Util } from '../util/util';

import { NetworkTablesSocket } from './socket';

import type { BinaryMessage } from '../types/types';

const serverUrl = 'ws://localhost:5811/nt/bench';

const noop = () => {
  /* empty */
};
let socket: NetworkTablesSocket;
let singleFrame: Uint8Array;
let frame10: Uint8Array;
let frame100: Uint8Array;

function buildBinaryMessage(topicId: number, value: number): BinaryMessage {
  return Util.createBinaryMessage(topicId, 0, value, NetworkTablesTypeInfos.kDouble);
}

function buildMultiMessageFrame(messageCount: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < messageCount; i++) {
    chunks.push(encode(buildBinaryMessage(i, i)));
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const frame = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    frame.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return frame;
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

  const server = new WSMock(serverUrl);
  socket = NetworkTablesSocket.getInstance(serverUrl, noop, noop, noop, noop, noop, noop, false);
  await server.connected;

  singleFrame = encode(buildBinaryMessage(0, 1.0));
  frame10 = buildMultiMessageFrame(10);
  frame100 = buildMultiMessageFrame(100);
});

bench('process one binary frame (1 message)', () => {
  socket['handleBinaryFrame'](singleFrame);
});

bench('process one binary frame (10 messages)', () => {
  socket['handleBinaryFrame'](frame10);
});

bench('process one binary frame (100 messages)', () => {
  socket['handleBinaryFrame'](frame100);
});
