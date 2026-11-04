import type { Metadata } from "next";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { HowItWorks, type HowItWorksStep } from "@/components/marketing/how-it-works";

export const metadata: Metadata = {
  title: "Software para consultores de ecommerce: toda tu cartera Shopify en una pantalla",
  description: "Ve qué cliente te necesita, qué han detectado los especialistas de NORA y qué te toca aprobar. Informes con tu marca. Plazas limitadas para consultores.",
  alternates: { canonical: "/consultores" },
};

// Las cuentas de consultor no se abren solas: se piden en /solicitar y las abre E-NORA.
const CTA = { label: "Pedir acceso como consultor", href: "/solicitar?rol=consultor" };

const STEPS: HowItWorksStep[] = [
  {
    label: "Priorizar",
    at: 5,
    title: "Toda tu cartera, por orden de urgencia",
    body: "Cada mañana ves qué cliente te necesita y por qué: stock que se agota, una campaña por revisar, anuncios que caen.",
    points: [
      "Cada cliente con su estado (Urgente, Revisar, Vigilar o Al día) y el motivo.",
      "Lo que espera tu decisión, contado y a mano.",
      "Vista de cartera, de cliente y de tienda.",
    ],
  },
  {
    label: "Entender",
    at: 15,
    title: "Los especialistas de NORA analizan cada tienda",
    body: "Leen Shopify, Meta y Klaviyo y te proponen qué hacer, con sus fuentes. Tú decides qué se convierte en tarea.",
    points: [
      "Especialistas de stock, anuncios y email sobre los datos de cada tienda.",
      "Cada lectura con sus fuentes a la vista.",
      "Aceptar una propuesta la convierte en tarea; descartarla no cambia nada.",
    ],
  },
  {
    label: "Planificar",
    at: 26,
    title: "Preparas el plan del cliente con NORA",
    body: "NORA propone fases, hitos y una meta de ventas a partir de sus datos. Lo ajustas, lo activas y el cliente lo ve en su pantalla.",
    points: [
      "Fases e hitos pensados para la temporada y sus fechas comerciales.",
      "Una meta de ventas que parte de lo que vende hoy la tienda.",
      "Al activarlo, el cliente lo ve en su Mi camino.",
    ],
  },
  {
    label: "Revisar",
    at: 38,
    title: "Revisas lo que crea tu cliente",
    body: "Sus campañas te llegan para revisar. Las corriges a mano o se lo pides a NORA, y las programas en su Klaviyo.",
    points: [
      "Te avisa cuando un cliente crea una campaña.",
      "La corriges en el editor o pides el cambio a NORA en una frase.",
      "Se programa en la cuenta de Klaviyo del cliente.",
    ],
  },
  {
    label: "Reunirte",
    at: 51,
    title: "De la llamada, a las tareas",
    body: "Pegas la transcripción de la llamada. NORA resume lo hablado y propone las tareas; tú eliges cuáles se crean y con qué dueño.",
    points: [
      "Vale la transcripción de Loom, Fathom, Meet o la que uses.",
      "Resumen, acuerdos y tareas con dueño: el cliente, tú o los dos.",
      "No se crea nada hasta que lo apruebas.",
    ],
  },
  {
    label: "Informar",
    at: 63,
    title: "Un informe al mes, con tu marca",
    body: "NORA prepara el informe de cada cliente: lectura del periodo, cifras clave y recomendaciones. Lo revisas y se envía solo.",
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
          title="E-NORA para consultores"
          lead="Toda tu cartera en una pantalla: qué cliente te necesita, qué han visto los especialistas de NORA y qué te toca aprobar. En seis pasos."
          video="/video/consultores"
          videoLabel="Vídeo: cómo trabaja un consultor con E-NORA en seis pasos, con una cartera de ejemplo"
          steps={STEPS}
          cta={CTA}
        />
      </main>
    </PublicEntryShell>
  );
}
