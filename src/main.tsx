import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyAppearanceToDocument, useAppearanceStore } from './store/use_appearance_store';
import { initializeEmbeddingAdapter } from './lib/memory/embedding_initializer';
import { installStoryDebugLifecycleTrace } from './lib/debug/story_debug_trace';
import './index.css';
import './wizard.css';

const { theme, editorFontSize } = useAppearanceStore.getState();
applyAppearanceToDocument(theme, editorFontSize);

// [Domain:NarrativeMemory] Bootstrap semantic embedding adapter
// Detects VITE_GEMINI_API_KEY → upgrades from 48-dim hash to 768-dim Gemini
initializeEmbeddingAdapter();
installStoryDebugLifecycleTrace();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
