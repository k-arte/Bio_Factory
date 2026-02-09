import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    fs: {
      strict: false
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  ssr: {
    noExternal: ['three']
  }
})
