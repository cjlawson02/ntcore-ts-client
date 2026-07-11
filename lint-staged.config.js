/** @type {import('lint-staged').Config} */
export default {
  '*': () => [
    'npx nx format:write --uncommitted',
    'npx nx affected --target=lint-fix --uncommitted',
    'npx nx affected --target=test --uncommitted',
    'npx nx affected --target=build --uncommitted',
  ],
};
