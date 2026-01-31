/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NT_URI?: string;
  readonly VITE_NT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
