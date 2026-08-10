/**
 * The existing suite (lib/submit-brief.test.js) is plain CommonJS and ran fine
 * on bare jest defaults. The transform below is scoped to .ts/.tsx only, so
 * those files still pass through untouched — this adds TypeScript support
 * without disturbing what already worked.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // The app's tsconfig targets the bundler (esnext modules, jsx preserve,
        // noEmit). Jest needs real CommonJS output, so the module settings are
        // overridden here rather than compromising the Next build config.
        module: 'commonjs',
        target: 'es2022',
        esModuleInterop: true,
        jsx: 'react-jsx',
        verbatimModuleSyntax: false,
        isolatedModules: false,
      },
    }],
  },
  testMatch: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
}
