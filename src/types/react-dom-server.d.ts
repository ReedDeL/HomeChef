declare module 'react-dom/server' {
  import type { ReactNode } from 'react';

  export function renderToStaticMarkup(reactNode: ReactNode): string;
}
