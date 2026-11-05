import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: 'dist/app',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Valores ficticios para que los tests carguen sin .env (antes 7 archivos fallaban al importar)
    env: {
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    exclude: [
      '**/node_modules/**',
      '**/e2e/**'
    ]
  }
})