"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/** Monta el panel cuando está cerca de verse. Diagnóstico tiene ~70 paneles y cada uno pide su
 * endpoint: montarlos todos a la vez agotaba el límite de peticiones (429) y dejaba la mitad en error. */
export function LazyPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === "undefined") return setVisible(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return <div ref={ref} style={visible ? undefined : { minHeight: 96 }}>{visible ? children : null}</div>;
}
