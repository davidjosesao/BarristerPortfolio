import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: ['.next/**', 'node_modules/**'] },
  {
    // These files are plain Node CommonJS (no "type": "module", no transform
    // step) — require()/module.exports is what actually runs, not a style choice.
    files: ['app/api/submit-brief/route.js', 'lib/submit-brief.js', 'lib/submit-brief.test.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]

export default config
