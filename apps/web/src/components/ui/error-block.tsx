"use client";

import type { ReactNode } from "react";
import { Alert } from "@heroui/react";

export function ErrorBlock({ children }: { children: ReactNode }) {
  return (
    <Alert status="danger">
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
