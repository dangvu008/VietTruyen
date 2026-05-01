/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_LOCAL_AI_PROXY?: string;
  readonly VITE_PREFER_OPENROUTER?: string;
  readonly VITE_LOCAL_AI_PROXY_URL?: string;
  readonly VITE_LOCAL_AI_PROXY_KEY?: string;
  readonly VITE_LOCAL_AI_PROXY_MODEL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_REDIRECT_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_CLAUDE_API_KEY?: string;
  readonly VITE_HOCAI_API_KEY?: string;
  readonly VITE_CLAUDE_PLUGIN_BRIDGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
