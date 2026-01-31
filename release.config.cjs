/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main', { name: 'beta', prerelease: true }],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'packages/ntcore-ts-client/CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/ntcore-ts-client',
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'nx run ntcore-ts-client:build',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'dist/packages/ntcore-ts-client',
        npmPublish: true,
      },
    ],
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: [
          'packages/ntcore-ts-client/package.json',
          'packages/ntcore-ts-client/CHANGELOG.md',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
