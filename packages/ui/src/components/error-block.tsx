"use client";

import type { ReactNode } from "react";

export function ErrorBlock({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-brand py-0.5 pl-3 text-sm leading-6 text-brand-deep" role="alert">
      {children}
    </div>
  );
}
