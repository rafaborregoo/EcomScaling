"use client";

import type { ReactNode } from "react";
import { EmptyState } from "./empty-state";
import { ErrorBlock } from "./error-block";
import { LoadingBlock } from "./loading-block";

export type AsyncStateStatus = "loading" | "error" | "empty";

/** Estado asíncrono reutilizable para páginas y secciones del portal. */
export function AsyncState({
  status,
  loadingLabel,
  error,
  emptyTitle,
  emptyHint,
  action,
}: {
  status: AsyncStateStatus;
  loadingLabel?: string;
  error?: ReactNode;
  emptyTitle?: ReactNode;
  emptyHint?: ReactNode;
  action?: ReactNode;
}) {
  if (status === "loading") {
    return <LoadingBlock label={loadingLabel} />;
  }

  if (status === "error") {
    return (
      <ErrorBlock>{error ?? "No se pudo cargar esta sección."}</ErrorBlock>
    );
  }

  return (
    <EmptyState
      title={emptyTitle ?? "Todavía no hay datos"}
      hint={emptyHint}
      action={action}
    />
  );
}
