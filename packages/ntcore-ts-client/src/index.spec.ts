import * as root from './index';
import * as lib from './lib';
import * as pubsub from './lib/pubsub';
import * as types from './lib/types';

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
  });
});
