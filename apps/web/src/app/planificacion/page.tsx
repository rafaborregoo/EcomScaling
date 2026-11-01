import { redirect } from "next/navigation";

// El antiguo "Resumen" repetía cifras de Inicio y Rentabilidad y su agenda y
// tracking ya tienen pantalla propia: la entrada es la Agenda.
export default function PlanningPage() {
  redirect("/planificacion/calendario");
}
