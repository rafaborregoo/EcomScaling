"use client";

import { useEffect, useState } from "react";

/**
 * Los paneles del header (notificaciones, IA) se muestran como Popover anclado
 * en desktop y como hoja inferior en movil: la misma lista, cambia el
 * contenedor. Se decide por `matchMedia`, no por el ancho de un contenedor,
 * porque el header ocupa el viewport entero.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
