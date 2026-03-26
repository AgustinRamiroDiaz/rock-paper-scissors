/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __RPS_ROOM_ID?: string;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
