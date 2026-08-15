# Feature: Custom Struct Schema Auto-Fetch

The ntcore-ts client ships with a hard-coded table of WPILib built-in struct schemas
(`built-in-schemas.ts`: `Pose2d`, `Translation2d`, etc.). For any other struct type, the client
must fetch the schema at runtime from the server's `/.schema/struct:<TypeName>` topic and use it
to decode subsequent values. Unit tests mock `StructSchemaManager.fetchDescriptor`, so the
schema-fetch-and-decode path is only proven over the wire.

This spec uses a custom `Waypoint` struct (`double x; double y; double heading; int32 id`),
published by the example-robot via a WPILib `Struct<Waypoint>` implementation. The client must
decode it **without** passing a `schema` option.

## User stories

- As a dashboard developer, I want to subscribe to a struct topic whose type is not a WPILib
  built-in and have the client transparently fetch the schema from the server.
- As a dashboard developer, I want the fetched schema's fields (including non-double fields
  like `int32`) to decode correctly.

## Acceptance criteria

| ID    | Description                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| CSS-1 | `getStructTopic(name, { typeName: 'Waypoint' })` + `subscribe` shall decode values for a server-published non-built-in struct type. |
| CSS-2 | Integer fields (`int32`) in a fetched custom schema shall be decoded as JS `number` with the exact integer value.                   |
| CSS-3 | The decoded struct's double fields shall match the server-published values to within floating-point precision.                      |

## Tests

| Test                                                                         | Covers              | Status      |
| ---------------------------------------------------------------------------- | ------------------- | ----------- |
| `[CSS-1, CSS-2, CSS-3] receives Waypoint via auto-fetched /.schema/struct:*` | CSS-1, CSS-2, CSS-3 | Implemented |

## Coverage

All acceptance criteria (CSS-1…CSS-3) are covered by a single implemented test.
