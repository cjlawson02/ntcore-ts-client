import type { Configuration } from 'lint-staged';

const config: Configuration = {
  '*': () => [
    'npx nx format:write --uncommitted',
    'npx nx affected --target=lint-fix --uncommitted',
    'npx nx affected --target=test --uncommitted',
    'npx nx affected --target=build --uncommitted',
  ],
};

export default config;
