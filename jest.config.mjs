import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
}

// next/jest compiles with SWC (the same transform the app build uses) and
// normally excludes node_modules from transformation entirely. @react-pdf and
// its dependency tree (color-string, restructure, fontkit, …) publish ESM
// only, which the CommonJS test runtime cannot require. Allow-listing them
// individually turned into whack-a-mole, so everything is transformed —
// slower on a cold cache, but stable, and jest caches the result.
const buildConfig = async () => {
  const config = await createJestConfig(customConfig)()
  config.transformIgnorePatterns = ['^.+\\.module\\.(css|sass|scss)$']
  return config
}

export default buildConfig
