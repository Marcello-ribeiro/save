import type { DetailedHTMLProps, HTMLAttributes } from "react";

// <model-viewer> é um web component; o React só precisa saber que a tag existe.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { [attr: string]: unknown };
    }
  }
}
