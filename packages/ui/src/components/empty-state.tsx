"use client";

import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-t border-edge py-10 text-center">
      <p className="font-display text-2xl">{title}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
