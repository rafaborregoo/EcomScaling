"use client";

import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle, type AlertVariant } from "./alert";

export type BannerTone = "info" | "success" | "warn" | "danger";

const VARIANT: Record<BannerTone, AlertVariant> = {
  info: "default",
  success: "success",
  warn: "warning",
  danger: "destructive",
};

const ICON = { info: Info, success: CircleCheck, warn: TriangleAlert, danger: CircleAlert };

/**
 * Atajo de Alert con el icono de su tono. `title` = qué pasa, en una frase;
 * `children` = el detalle o qué hacer; `action` = el botón que lo resuelve.
 */
export function Banner({
  tone = "danger",
  title,
  action,
  className,
  children,
}: {
  tone?: BannerTone;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const Icon = ICON[tone];
  return (
    <Alert variant={VARIANT[tone]} className={className}>
      <Icon aria-hidden />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children ? <AlertDescription>{children}</AlertDescription> : null}
      {action ? <AlertAction>{action}</AlertAction> : null}
    </Alert>
  );
}
