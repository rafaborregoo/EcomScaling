"use client";

import type { ReactNode } from "react";
import { Alert } from "@heroui/react";

type BannerTone = "success" | "warn" | "danger";

const statusMap: Record<BannerTone, "success" | "warning" | "danger"> = {
  success: "success",
  warn: "warning",
  danger: "danger",
};

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
    <Alert status={statusMap[tone]} className={className}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
