/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CARTO_BASEMAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "bootstrap/dist/js/bootstrap.bundle.min.js";

declare module "bootstrap/js/dist/popover" {
  type PopoverOptions = {
    container?: string | Element | false;
    placement?: "auto" | "top" | "bottom" | "left" | "right";
    trigger?: string;
  };

  export default class Popover {
    constructor(element: Element, options?: PopoverOptions);
    dispose(): void;
  }
}
