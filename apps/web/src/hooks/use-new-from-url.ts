"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * `?nueva=1` (lo que pone la paleta ⌘K en "Crear tarea", "Nueva campaña"…)
 * abre el alta de la pantalla. El parámetro se quita al usarlo: así, si se
 * cancela y se vuelve a pedir desde la paleta, la URL cambia y abre otra vez.
 */
export function useNewFromUrl(onNew: () => void, enabled = true) {
  const wantsNew = useSearchParams().get("nueva") === "1";
  const latest = useRef(onNew);
  useEffect(() => {
    latest.current = onNew;
  });
  useEffect(() => {
    if (!wantsNew || !enabled) return;
    latest.current();
    const url = new URL(window.location.href);
    url.searchParams.delete("nueva");
    window.history.replaceState(null, "", url);
  }, [wantsNew, enabled]);
}
