import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // `supabase/.temp` is scratch state written by the Supabase CLI (it is
  // gitignored); linting vendored files from it is noise.
  { ignores: ['.next/**', 'node_modules/**', 'supabase/.temp/**'] },
  {
    // These files are plain Node CommonJS (no "type": "module", no transform
    // step) — require()/module.exports is what actually runs, not a style choice.
    files: ['app/api/submit-brief/route.js', 'lib/submit-brief.js', 'lib/submit-brief.test.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]

export default config
