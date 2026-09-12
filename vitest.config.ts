import { defineConfig } from 'vitest/config'

// Keep tests separate from the Start/devtools application plugins. Loading
// those plugins in jsdom creates a second React runtime for component tests.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ['react', 'react-dom'] },
})
