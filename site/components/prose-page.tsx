import type { ReactNode } from 'react';
import { Footer } from './footer';

export function ProsePage({
  title,
  children,
  landmark = false,
}: {
  title: string;
  children: ReactNode;
  landmark?: boolean;
}) {
  const Element = landmark ? 'main' : 'div';
  return (
    <Element id="main-content" tabIndex={-1} className="prose-page">
      <h1>{title}</h1>
      {children}
      <Footer />
    </Element>
  );
}
