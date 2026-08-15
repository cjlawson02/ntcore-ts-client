# @ntcore-ts/client

A TypeScript library for communication over [WPILib's NetworkTables 4.1 protocol](https://github.com/wpilibsuite/allwpilib/blob/main/ntcore/doc/networktables4.adoc).

## Usage

For a quick start guide on how to use the library, see the [repository README](../../README.md) and the [documentation website](https://ntcore.chrislawson.dev).

## Building

Run `nx build client` to build the library.

## Running unit tests

Run `nx run client:test` (or `npm test` from the repo root) to execute the unit tests via [Vitest](https://vitest.dev).

## Benchmarks

Benchmarks measure how fast the client processes WebSocket messages. They are **not** run in the default test suite.

**How to run**

- From the repo root: `npm run bench` or `nx run client:bench`
- From the package: `npx vitest bench --run` (in `packages/client`)

**What is measured**

- **Tier 1 (hot path)**: Binary frame processing in isolation—decode (msgpack), schema parse, and callback. Benchmarks: one frame with 1, 10, or 100 messages.
- **Tier 2 (mock WebSocket)**: End-to-end from mock server send to `onTopicUpdate` callback—WebSocket event → `onMessage` → `handleBinaryFrame` → callback.

Both tiers use a mock server (no real NT server or robot). Results are reported as Hz (ops/sec), with min/max/mean and percentiles (e.g. p99).

**Findings**

- **Tier 1 (hot path)** on typical hardware: ~550k–875k single-message frames/sec; ~115k–146k frames/sec with 10 messages per frame (~1.15M–1.5M messages/sec); ~12k–16k frames/sec with 100 messages per frame (~1.2M–1.6M messages/sec). Mean latency per frame is in the **microseconds** (e.g. ~1.1 µs for one message, ~6–7 µs for 10, ~63–67 µs for 100).
- **Tier 2 (mock WebSocket)** exercises the full path from mock send to `onTopicUpdate`; throughput is in the same order of magnitude as Tier 1 for batched frames.
- **Conclusion**: For normal FRC/NetworkTables use (tens to low thousands of topic updates per second over the network), the client can process far more than real traffic. The bottleneck in practice is the **network** (latency, bandwidth) and the NT server, not this client’s message processing.
