import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'lucide-react': path.resolve(__dirname, './src/features/ekchat/native/vendor/lucide-react.tsx'),
      'react-markdown': path.resolve(__dirname, './src/features/ekchat/native/vendor/react-markdown.tsx'),
      'remark-gfm': path.resolve(__dirname, './src/features/ekchat/native/vendor/remark-gfm.ts'),
      'rehype-raw': path.resolve(__dirname, './src/features/ekchat/native/vendor/rehype-raw.ts'),
      'rehype-sanitize': path.resolve(__dirname, './src/features/ekchat/native/vendor/rehype-sanitize.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/ekchat': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          charts: ['recharts'],
        },
      },
    },
  },
})
