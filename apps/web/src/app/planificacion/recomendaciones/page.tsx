import { redirect } from "next/navigation";

// Las propuestas de la IA se aprueban y se trabajan en Tareas: tener también esta
// pantalla duplicaba lo mismo en dos sitios. Se mantiene la ruta para los enlaces viejos.
export default function RecommendationsPage() {
  redirect("/tareas");
}
