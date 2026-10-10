import { redirect } from "next/navigation";

// "Mi código" es ahora la pestaña Captación de Clientes. La ruta se queda para
// los enlaces y marcadores antiguos.
export default function ReferidosPage() {
  redirect("/consultor?tab=captacion");
}
