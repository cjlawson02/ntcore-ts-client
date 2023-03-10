# Changelog

Note: there may be breaking changes between each beta version, but if a breaking change is introduced out of beta, it will be a major version change

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

* chore: update deps
* style: prepend nt client id with `ntcore-ts-`
* chore: update deps
* chore: bump version to 0.2.0

### Non-library changes

- Improve docs by @Pokesi in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/15>

* fix(ci): temporarily disable linting through CI by @Chris2fourlaw in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/16>
* chore: upgrade tslib and dev deps by @Chris2fourlaw in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/17>
* feat(dev): add commitlint for conventional commits enforcement by @Chris2fourlaw in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/18>
* build(deps-dev): bump @typescript-eslint/eslint-plugin from 5.48.2 to 5.49.0 by @dependabot in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/20>
* build(deps-dev): bump @typescript-eslint/parser from 5.48.2 to 5.49.0 by @dependabot in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/19>
* build(deps-dev): bump eslint-plugin-jsdoc from 39.6.7 to 40.0.0 by @dependabot in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/27>
* build(deps): bump tslib from 2.4.1 to 2.5.0 by @dependabot in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/25>
* build(deps-dev): bump jest and @types/jest by @dependabot in <https://github.com/Chris2fourlaw/ntcore-ts-client/pull/28>

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
