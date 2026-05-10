import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  worker: {
    format: 'es',
  },

  // [Perf] Pre-bundle heavy deps to eliminate waterfall discovery in dev
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'zustand/shallow',
      'zustand/middleware',
      '@supabase/supabase-js',
      'lucide-react',
      'clsx',
      'dexie',
    ],
  },

  build: {
    // [Perf] CSS code splitting — only load CSS for active route
    cssCodeSplit: true,
    // [Perf] Increase chunk size warning to suppress noise from vendor chunks
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'zustand'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-docs': ['mammoth', 'docx', '@llamaindex/liteparse', 'jszip'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

