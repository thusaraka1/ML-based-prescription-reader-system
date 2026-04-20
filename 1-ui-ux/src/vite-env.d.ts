/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLOUD_API_KEY: string;
  readonly VITE_GOOGLE_CLOUD_PROJECT_ID: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_ENABLE_CLOUD_NLP: string;
  readonly VITE_ENABLE_GEMINI_VERIFICATION: string;
  readonly VITE_ENABLE_MEAL_SUGGESTIONS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
