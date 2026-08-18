import * as lib from './lib';
import * as pubsub from './lib/pubsub';
import * as types from './lib/types';

import * as root from './index';

describe('barrel exports', () => {
  it('should export expected symbols from root and nested barrels', () => {
    expect(root).toBeDefined();
    expect(lib).toBeDefined();
    expect(pubsub).toBeDefined();
    expect(types).toBeDefined();

    // Root barrel should expose LogLevel via lib/index.ts.
    expect(root.LogLevel).toBeDefined();

    // PubSub barrels should export the topic classes.
    expect(pubsub.NetworkTablesTopic).toBeDefined();
    expect(pubsub.NetworkTablesPrefixTopic).toBeDefined();
    expect(pubsub.NetworkTablesProtobufTopic).toBeDefined();
    expect(pubsub.NetworkTablesJsonTopic).toBeDefined();

    // Geometry types are public; protocol Zod schemas are not.
    expect(root.Pose2d).toBeDefined();
    expect(root.Pose2dSchema).toBeDefined();
    expect(root.getRobotAddress).toBeDefined();
    expect(root.getTeamIpAddress).toBeDefined();
    expect(root.SYSTEMCORE_MDNS_HOST).toBe('robot.local');
    expect((root as { finiteNumSchema?: unknown }).finiteNumSchema).toBeUndefined();
    expect((types as { finiteNumSchema?: unknown }).finiteNumSchema).toBeUndefined();
  });
});
