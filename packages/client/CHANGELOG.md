# Changelog

Note: there may be breaking changes between each beta version, but if a breaking change is introduced out of beta, it will be a major version change

## 4.0.0

This release renames the package from `ntcore-ts-client` to `@ntcore/client` and introduces
protobuf topics, struct topics, a configurable logging system, and runtime data validation
with zod.

### Breaking Changes

- **Package renamed** from `ntcore-ts-client` to `@ntcore/client`. Update your imports accordingly.
- **Removed `client` getter** from `NetworkTables`. The underlying `PubSubClient` is now private.
- **Renamed `NetworkTablesTypeInfos.kArrayBuffer`** to `kUint8Array` to match the actual value type (`Uint8Array`).

### New Features

- **Protobuf topics** — `createProtobufTopic()` for publishing and subscribing to protobuf-encoded topics with automatic schema registration, encoding/decoding, and optional zod validation.
- **Struct topics** — `createStructTopic()` for WPILib struct-encoded topics (`Pose2d`, `Rotation2d`, etc.) with automatic schema parsing, binary encoding/decoding, and built-in schemas for common WPILib types.
- **Configurable logging** — per-module log levels via `NetworkTables.setLogLevel()`, `NetworkTables.setModuleLogLevel()`, and `NetworkTables.getModuleLogLevel()`. Exported `LogLevel` enum and `LoggerModule` type.
- **`stopAutoConnect()` / `startAutoConnect()`** — control automatic reconnection behavior.
- **`getRttMs()`** — returns the best round-trip time to the robot in milliseconds.
- **Runtime data validation** — all topic values are validated against their declared type using zod schemas.
- **Prefix topic local notifications** — prefix topics now fire callbacks for locally published values, not just server-announced ones.
- **Optimistic publisher resolution** — workaround for WPILib server bug ([wpilibsuite/allwpilib#7680](https://github.com/wpilibsuite/allwpilib/issues/7680)) where announcements may not arrive after publish.
- **In-flight operation management** — prevents duplicate schema registrations and topic publishes during reconnection.
- **Additional type numbers** — added `float`, `json`, `rpc`, `msgpack`, `protobuf`, `structschema`, and `float[]` to `NetworkTablesTypeInfos`.

### Bug Fixes

- Fixed `raw` type number (now correctly `5` instead of `3`).
- Fixed `setProperties` filtering for `'announce'` messages instead of `'properties'` with `ack` field, which caused unnecessary timeouts.
- Fixed race condition where publish/setProperties timeouts weren't cleared on success.
- Fixed publisher updates not being queued until topic announcement.
- Fixed `pubuid` not being sent correctly on updates.
- Fixed heartbeat handling and exposed RTT measurement.

### Migration from `ntcore-ts-client` 3.x

1. Change your dependency from `ntcore-ts-client` to `@ntcore/client`.
2. Replace `NetworkTablesTypeInfos.kArrayBuffer` with `NetworkTablesTypeInfos.kUint8Array`.
3. Remove any usage of the `client` getter on `NetworkTables` instances.
4. Install `zod` (>=4.0.0) as a peer dependency.

## 3.1.3

- Hotfix: Fix `raw` type number to be `5` instead of `3`
- Updated dependencies

### Non-library changes

- Swap from jest to vitest

## 3.1.2

- Hotfix: WPILib 2025.2.1 needs a subscription after publish to receive the announcement. Implements this hotfix and other small null-check fixes.

## 3.1.1

- Hotfix: export modules correctly and fix doc generation

## 3.1.0

- Fix 2025 Robot issues
  - Fixes publisher and subscriber ID generations to start counting at 0. Avoids integer overflows.
  - Remove RTT websocket that is unnecessary since the client can respond to PING and PONG messages

- Fix timeout for publishing pre-connection to wait for robot connection

## 3.0.0-beta.1

### Breaking Changes

- **BREAKING CHANGE: Remove immediateNotify from subscribe**
  - This complicated prefix topics and was not a very valuable feature
  - Workaround: you can manually call the subscription's callback yourself after subscribing

### Changes

- Add prefix topic support
  - You can now subscribe to multiple topics with a single subscription
  - This is done by creating a topic with a prefix, and then subscribing to that topic
  - For example, if you have topics `/MyTable/Accelerometer/X`, `/MyTable/Accelerometer/Y`, and `/MyTable/Accelerometer/Z`, you can create a prefix topic `/MyTable/Accelerometer/` and subscribe to that to get notifications for all three subtopics

## 2.0.0

### Breaking Changes

- **BREAKING CHANGE: Drop support for v4.0**
  - The API now requires NT v4.1 to function
- **BRAKING CHANGE: publish and setProperties are now asynchronous**
  - Please await these calls to know when the changes take effect
    - After awaiting publish, it is safe to set new values to the topic

### Changes

- Add support for v4.1
  - No support for PING/PONG messages - Node/JS limitation
  - No support added yet for cached messages
- Updated dependencies

## 1.0.0

### Breaking Changes

- **BREAKING CHANGE: removed NetworkTables.createInstance\*()**
  - Please use NetworkTables.getInstanceByTeam() and NetworkTables.getInstanceByURI()
- **BREAKING CHANGE: removed NetworkTableTypeInfos**
  - Fixed typo: now called `NetworkTablesTypeInfos` (NetworkTables plural! With **S**!)

## 0.2.2

### Changes

- Updated dependencies
- Existing topics are type checked better

## 0.2.1

### Changes

- Updated dependencies and changelog

## 0.2.0

### Breaking Changes

- **BREAKING CHANGE: deprecated NetworkTables.createInstance\*()**
  - Please use NetworkTables.getInstanceByTeam() and NetworkTables.getInstanceByURI()
- **BREAKING CHANGE: removed NetworkTables.getInstance() and NetworkTables.getServerURL()**
- **BREAKING CHANGE: deprecated NetworkTableTypeInfos**
  - Fixed typo: now called `NetworkTablesTypeInfos` (NetworkTables plural! With **S**!)

### New Features

- feat: allow multiple connections

### Bug fixes

- fix: rename NetworkTableTypeInfos to NetworkTablesTypeInfos
- fix: connect to the correct mDNS address
  - We were trying to connect to `roborio-frc-<team>.local` instead of `roborio-<team>-frc.local`
- fix: bug with creating instance on same URI w/ different port
- fix: queue value to published topic w/o server connection

### Misc commits

- chore: bump version

- chore: update deps
- style: prepend nt client id with `ntcore-ts-`
- chore: update deps
- chore: bump version to 0.2.0

### Non-library changes

- Improve docs by @Pokesi in <https://github.com/cjlawson02/ntcore-ts-client/pull/15>

- fix(ci): temporarily disable linting through CI by @cjlawson02 in <https://github.com/cjlawson02/ntcore-ts-client/pull/16>
- chore: upgrade tslib and dev deps by @cjlawson02 in <https://github.com/cjlawson02/ntcore-ts-client/pull/17>
- feat(dev): add commitlint for conventional commits enforcement by @cjlawson02 in <https://github.com/cjlawson02/ntcore-ts-client/pull/18>
- build(deps-dev): bump @typescript-eslint/eslint-plugin from 5.48.2 to 5.49.0 by @dependabot in <https://github.com/cjlawson02/ntcore-ts-client/pull/20>
- build(deps-dev): bump @typescript-eslint/parser from 5.48.2 to 5.49.0 by @dependabot in <https://github.com/cjlawson02/ntcore-ts-client/pull/19>
- build(deps-dev): bump eslint-plugin-jsdoc from 39.6.7 to 40.0.0 by @dependabot in <https://github.com/cjlawson02/ntcore-ts-client/pull/27>
- build(deps): bump tslib from 2.4.1 to 2.5.0 by @dependabot in <https://github.com/cjlawson02/ntcore-ts-client/pull/25>
- build(deps-dev): bump jest and @types/jest by @dependabot in <https://github.com/cjlawson02/ntcore-ts-client/pull/28>

## 0.0.1-beta.5

- Breaking changes:
  - renamed NetworkTableTypes to NetworkTablesTypes

## 0.0.1-beta.4

- Note: beta.1-beta.3 were tests of publishing to NPM and small fixes
- Fixed dependency issue
- Added keywords
- Breaking changes:
  - renamed Topic to NetworkTablesTopic
  - renamed NetworkTableTypeInfo to NetworkTablesTypeInfo
  - Moved to ES5/CommonJS compiling

## 0.0.1-beta.0

- Initial Release
