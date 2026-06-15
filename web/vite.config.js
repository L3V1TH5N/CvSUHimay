import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    tailwindcss(),
  ],
  server: {
    // NEW: Proxy configuration for avatar uploads and API calls
    proxy: {
      // Proxy /uploads requests to the backend server
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy /api requests to the backend server
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      }
    },
    // Existing CSP headers (updated img-src to explicitly allow localhost:4000)
    headers: {
      // Allow Google's sign-in popup to postMessage back to the opener.
      // Without this header pair, COOP defaults block the credential
      // round-trip and the GIS button silently fails.
      'Cross-Origin-Opener-Policy':   'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Content-Security-Policy': [
        "default-src 'self' blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://accounts.google.com https://apis.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: http://localhost:4000 https: https://lh3.googleusercontent.com",
        "connect-src 'self' blob: http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* ws://127.0.0.1:* wss://127.0.0.1:* https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
        "frame-src 'self' https://accounts.google.com",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    }
  },
  resolve: {
    // Force a single React instance — prevents "Invalid hook call" when
    // recharts (or any dependency) bundles its own copy of React.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})