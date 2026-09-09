"use client";

import type { ReactNode } from "react";
import { Alert } from "@heroui/react";

type BannerTone = "success" | "warn" | "danger";

const statusMap: Record<BannerTone, "success" | "warning" | "danger"> = {
  success: "success",
  warn: "warning",
  danger: "danger",
};

// Un Banner casi siempre aparece por algo que acaba de pasar (guardar, fallar
// una accion, volver de un OAuth). Sin region viva, con lector de pantalla no
// pasaba nada: el foco seguia en el boton y el mensaje quedaba en pantalla sin
// anunciarse. `alert` para los de error (interrumpe), `status` para el resto.
export function Banner({
  tone = "danger",
  className,
  children,
}: {
  tone?: BannerTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Alert
      status={statusMap[tone]}
      className={className}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
