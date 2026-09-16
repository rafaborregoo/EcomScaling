"use client";

/**
 * Modo "ver como": un platform admin entra en modo lectura a la vista de un
 * cliente, para ver exactamente lo que ve su dueño sin suplantarlo de verdad.
 *
 * Vive en su propio modulo (no dentro de portal-shell) porque `apiFetch`
 * (bootstrap.ts) necesita leerlo para bloquear escrituras, y el shell
 * necesita escribirlo al entrar/salir -- meterlo en cualquiera de los dos
 * ficheros habria creado un ciclo de imports entre ellos.
 *
 * sessionStorage y no localStorage: "ver como" es de esta pestaña, no algo
 * que deba sobrevivir a cerrarla ni colarse en una pestaña nueva donde el
 * admin no eligio entrar en modo lectura.
 */

const STORAGE_KEY = "ecomscaling.view_as";

export type ViewAs = { organizationId: string; displayName: string };

export function getViewAs(): ViewAs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ViewAs>;
    if (!parsed.organizationId || !parsed.displayName) return null;
    return { organizationId: parsed.organizationId, displayName: parsed.displayName };
  } catch {
    return null;
  }
}

export function setViewAs(value: ViewAs) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Privado, cuota llena... "ver como" simplemente no persiste entre
    // recargas. No es motivo para romper la navegacion.
  }
}

export function clearViewAs() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ver arriba
  }
}
