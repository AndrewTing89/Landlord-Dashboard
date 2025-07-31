import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      }
    }
  },
  build: {
    // Optimize for AWS S3/CloudFront
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'chart-vendor': ['recharts'],
        }
      }
    }
  },
  define: {
    'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL || ''),
    'process.env.REACT_APP_SIMPLEFIN_CONFIGURED': JSON.stringify(process.env.REACT_APP_SIMPLEFIN_CONFIGURED || 'false')
  }
})