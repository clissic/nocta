/// <reference types="vite/client" />

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
