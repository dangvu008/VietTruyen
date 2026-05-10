import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyAppearanceToDocument, useAppearanceStore } from './store/use_appearance_store';
import './index.css';
import './wizard.css';

const { theme, editorFontSize } = useAppearanceStore.getState();
applyAppearanceToDocument(theme, editorFontSize);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// [Perf] Defer non-critical startup tasks until after first paint
const deferInit = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (cb: () => void) => setTimeout(cb, 100);

deferInit(() => {
  import('./lib/memory/embedding_initializer').then(({ initializeEmbeddingAdapter }) => {
    initializeEmbeddingAdapter();
  });
  import('./lib/debug/story_debug_trace').then(({ installStoryDebugLifecycleTrace }) => {
    installStoryDebugLifecycleTrace();
  });
});

