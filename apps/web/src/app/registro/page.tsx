import { redirect } from "next/navigation";

/**
 * El registro libre está cerrado (`REGISTRO_CERRADO` en
 * apps/api/src/consultant.ts): mientras no haya precios, las cuentas las abre
 * E-NORA al aprobar una solicitud. Cualquier enlace viejo a /registro acaba en
 * /solicitar. El formulario de alta propia está en el historial de git, para
 * cuando se reabra.
 */
export default function RegistroPage() {
  redirect("/solicitar");
}
