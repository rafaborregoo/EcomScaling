"use client";

import ReactMarkdown, { type Components } from "react-markdown";

// Sin plugin de Tailwind Typography en el proyecto: estilos minimos por
// elemento via `components`, con los mismos tokens de texto que el resto de
// @/components/ui (text-foreground / text-muted / border-separator).
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 text-lg font-semibold text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2 text-base font-semibold text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-sm font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-6 text-foreground last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm leading-6 text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface px-1 py-0.5 text-xs">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-md border border-separator bg-surface p-3 text-xs leading-5">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 rounded-md border border-separator bg-surface-subtle p-3 text-sm text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-separator" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-separator px-2 py-1 text-left font-medium text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-separator px-2 py-1 text-muted">
      {children}
    </td>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
