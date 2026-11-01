"use client";

import type { ReactNode } from "react";
import { Banner } from "./banner";
import { Button } from "./button";

/**
 * Algo no se ha podido cargar o hacer. Con `onRetry` lleva el botón
 * «Reintentar» estándar; `action` es para cualquier otro botón.
 */
export function ErrorBlock({
  title,
  action,
  onRetry,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Banner
      tone="danger"
      title={title}
      action={action ?? (onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>Reintentar</Button> : null)}
      className={className}
    >
      {children}
    </Banner>
  );
}
