/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // [Wave 0] Pin test collection to app-owned files only.
    // Prevents vitest from picking up .tmp-*, e2e Playwright specs, or dist artifacts.
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.tmp-*/**',
      '**/e2e/**',
      '**/src-tauri/**',
    ],
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
        manualChunks(id) {
          // Vendor buckets — order matters: check narrower libs first to avoid
          // greedy `includes('react')` swallowing lucide-react etc.
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('pdfjs-dist')) return 'vendor-pdf';
            if (
              id.includes('mammoth') ||
              id.includes('docx') ||
              id.includes('@llamaindex/liteparse') ||
              id.includes('jszip')
            ) {
              return 'vendor-docs';
            }
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/zustand/')
            ) {
              return 'vendor-react';
            }
          }
          // [Bundle / D-Bundle=Aggressive] Isolate story template seed data so
          // it stays cacheable independently from the (small) Zustand wrapper
          // and isn't pulled into other lazy chunks that touch use_template_store.
          if (id.includes('/data/story_templates/')) return 'story-templates-data';
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
});

