"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { revealHidden } from "@/components/ui/accordion";

/**
 * Llegar desde un aviso y ver qué ha cambiado: con `?focus=<id>[,<id>…]` en la
 * URL, busca los elementos con `data-focus-id` igual, se desplaza hasta el
 * primero y los resalta unos segundos (`[data-focus-flash]` en globals.css).
 *
 * Va montado una vez en el shell; cada pantalla destino solo tiene que poner
 * `data-focus-id` en la fila o tarjeta. Espera a que el elemento aparezca
 * (las listas cargan después de pintar), hasta 8 s. Si cae dentro de un
 * acordeón o un plegable cerrado, lo abre antes.
 */
export function FocusTarget() {
  const focus = useSearchParams().get("focus");

  useEffect(() => {
    const ids = (focus ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return;
    const pending = new Set(ids);
    let scrolled = false;
    const timers: number[] = [];

    const scan = () => {
      for (const id of [...pending]) {
        const nodes = document.querySelectorAll<HTMLElement>(`[data-focus-id="${CSS.escape(id)}"]`);
        if (nodes.length === 0) continue;
        pending.delete(id);
        nodes.forEach((node) => {
          revealHidden(node);
          if (!scrolled) {
            node.scrollIntoView({ block: "center", behavior: "smooth" });
            scrolled = true;
          }
          node.removeAttribute("data-focus-flash");
          // Reinicia la animación aunque el nodo ya la tuviera.
          void node.offsetWidth;
          node.setAttribute("data-focus-flash", "");
          timers.push(window.setTimeout(() => node.removeAttribute("data-focus-flash"), 3200));
        });
      }
      if (pending.size === 0) observer.disconnect();
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    const stop = window.setTimeout(() => observer.disconnect(), 8000);

    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [focus]);

  return null;
}
