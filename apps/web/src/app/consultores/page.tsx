import type { Metadata } from "next";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { HowItWorks, type HowItWorksStep } from "@/components/marketing/how-it-works";

export const metadata: Metadata = {
  title: "Software con IA para consultores de ecommerce",
  description: "Gestiona tu cartera de ecommerce con E-NORA. Prioriza clientes, prepara planes y revisa campañas e informes con tu marca. Conecta Shopify, Meta Ads y Klaviyo.",
  alternates: { canonical: "/consultores" },
};

// Las cuentas de consultor no se abren solas: se piden en /solicitar y las abre E-NORA.
const CTA = { label: "Pedir acceso como consultor", href: "/solicitar?rol=consultor" };

const STEPS: HowItWorksStep[] = [
  {
    label: "Priorizar",
    at: 5,
    title: "Tu atención, donde más hace falta",
    body: "Identifica qué clientes necesitan una revisión y por qué. E-NORA reúne las alertas de stock, anuncios y campañas para ayudarte a organizar el trabajo de tu cartera.",
    points: [
      "Cada cliente con su estado (Urgente, Revisar, Vigilar o Al día) y el motivo.",
      "Lo que espera tu decisión, contado y a mano.",
      "Vista de cartera, de cliente y de tienda.",
    ],
  },
  {
    label: "Entender",
    at: 15,
    title: "Cada tienda, con su análisis",
    body: "Los especialistas de NORA analizan los datos de Shopify, Meta Ads y Klaviyo de cada cliente. Consulta sus propuestas, revisa las fuentes y decide qué acciones pasan a tus tareas.",
    points: [
      "Especialistas de stock, anuncios y email sobre los datos de cada tienda.",
      "Cada lectura con sus fuentes a la vista.",
      "Aceptar una propuesta la convierte en tarea; descartarla no cambia nada.",
    ],
  },
  {
    label: "Planificar",
    at: 26,
    title: "Objetivos claros para cada cliente",
    body: "Prepara con NORA un plan basado en los datos de la tienda, con fases, hitos y una meta de ventas. Ajusta la propuesta y compártela con el cliente al activarla.",
    points: [
      "Fases e hitos pensados para la temporada y sus fechas comerciales.",
      "Una meta de ventas que parte de lo que vende hoy la tienda.",
      "Al activarlo, el cliente lo ve en su Mi camino.",
    ],
  },
  {
    label: "Revisar",
    at: 38,
    title: "Cada campaña, con tu criterio",
    body: "Revisa los emails que prepara tu cliente antes de programarlos. Edita el contenido, pide cambios a NORA y programa la campaña en la cuenta de Klaviyo de la tienda.",
    points: [
      "Te avisa cuando un cliente crea una campaña.",
      "La corriges en el editor o pides el cambio a NORA en una frase.",
      "Se programa en la cuenta de Klaviyo del cliente.",
    ],
  },
  {
    label: "Reunirte",
    at: 51,
    title: "Reuniones que se convierten en avances",
    body: "Añade la transcripción de una llamada y NORA prepara el resumen, los acuerdos y las tareas propuestas. Revisa qué se crea y asigna cada tarea a su responsable.",
    points: [
      "Vale la transcripción de Loom, Fathom, Meet o la que uses.",
      "Resumen, acuerdos y tareas con dueño: el cliente, tú o los dos.",
      "No se crea nada hasta que lo apruebas.",
    ],
  },
  {
    label: "Informar",
    at: 63,
    title: "El progreso de tus clientes, con tu marca",
    body: "Entrega informes con las cifras clave, el análisis del periodo y las recomendaciones de NORA. Revísalos, añade la identidad de tu consultoría y configura el envío mensual.",
    points: [
      "Con el nombre, el logo y el color de tu consultoría.",
      "En PDF, por correo o con envío mensual automático.",
      "Las cifras de cada plataforma por separado, sin sumar atribuciones.",
    ],
  },
];

export default function ConsultantsPage() {
  return (
    <PublicEntryShell active="consultants">
      <main id="public-content">
        <HowItWorks
          id="consultores-title"
          title="Toda tu consultoría de ecommerce en un mismo lugar"
          lead="E-NORA reúne los datos, los planes y el trabajo de tus clientes en una plataforma con IA. Prioriza las tiendas que necesitan atención, revisa sus campañas y entrega informes con tu marca."
          video="/video/consultores"
          videoLabel="Vídeo: cómo trabaja un consultor con E-NORA en seis pasos, con una cartera de ejemplo"
          steps={STEPS}
          cta={CTA}
        />
      </main>
    </PublicEntryShell>
  );
}
