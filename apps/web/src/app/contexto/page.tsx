import { redirect } from "next/navigation";

// El contexto del negocio vive en Configuración > Tu tienda.
export default function ContextPage() {
  redirect("/configuracion?section=negocio");
}
