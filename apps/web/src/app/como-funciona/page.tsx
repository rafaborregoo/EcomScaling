import type { Metadata } from "next";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { HowItWorks, type HowItWorksStep } from "@/components/marketing/how-it-works";

export const metadata: Metadata = {
  title: "Cómo funciona la plataforma de ecommerce con IA",
  description: "Descubre cómo E-NORA conecta Shopify, Meta Ads y Klaviyo para analizar tus ventas, conocer tu beneficio y preparar campañas con IA. Tu ecommerce, en seis pasos.",
  alternates: { canonical: "/como-funciona" },
};

const STEPS: HowItWorksStep[] = [
  {
    label: "Conectar",
    at: 5,
    title: "Los datos de tu negocio, conectados",
    body: "Reúne tus pedidos, productos, anuncios y emails en E-NORA. Empieza conectando Shopify y añade Meta Ads y Klaviyo para ampliar la visión de tu ecommerce.",
    points: [
      "Shopify: pedidos, productos, stock por ubicación, clientes y descuentos.",
      "Meta Ads: campañas, anuncios, inversión y resultados que atribuye Meta.",
      "Klaviyo: flows, campañas de email y lo que atribuye a cada uno.",
      "Se sincroniza solo y te avisa si un permiso caduca.",
    ],
  },
  {
    label: "Medir",
    at: 15,
    title: "Tu rentabilidad, a la vista",
    body: "Conoce cuánto vendes y qué beneficio te queda después de los costes que hayas configurado. Compara los últimos 30 días con el periodo anterior y consulta el origen de cada cifra.",
    points: [
      "Un titular con lo más importante del día, escrito por NORA.",
      "El beneficio desglosado: producto, envíos, comisiones, publicidad y gastos fijos.",
      "Cada cifra comparada con el periodo anterior.",
    ],
  },
  {
    label: "Decidir",
    at: 27,
    title: "Cada decisión, con datos detrás",
    body: "La IA de NORA detecta qué necesita atención y te propone acciones con sus fuentes. Revisa cada propuesta y convierte en tarea las que encajen con tu negocio.",
    points: [
      "Propuestas de stock, anuncios y emails con su porqué y sus fuentes.",
      "Aceptarla la convierte en una tarea tuya; descartarla no cambia nada.",
      "NORA no toca tus cuentas por su cuenta: propone y tú decides.",
    ],
  },
  {
    label: "Planificar",
    at: 40,
    title: "Un plan compartido con tu consultor",
    body: "Trabaja con tu consultor sobre los mismos datos, objetivos y tareas. Define un plan por fases, reparte responsabilidades y sigue los avances desde tu tienda.",
    points: [
      "Un plan por fases, con hitos, fechas y una meta de ventas.",
      "Tareas con dueño: tú, tu consultor o los dos.",
      "Notas y mensajes con tu consultor en el mismo sitio que tus datos.",
    ],
  },
  {
    label: "Ejecutar",
    at: 51,
    title: "De tu idea a una campaña lista para revisar",
    body: "Describe qué quieres comunicar y NORA prepara un borrador de email con tus productos y tu marca. Ajústalo con tu consultor y prográmalo en tu cuenta de Klaviyo.",
    points: [
      "NORA escribe el primer borrador del email a partir de tu idea.",
      "Lo ajustas en un editor de bloques con tus productos y tu marca.",
      "Se programa y se envía desde tu propia cuenta de Klaviyo.",
      "Los flows de Klaviyo se diseñan aquí y se crean allí como borrador.",
    ],
  },
  {
    label: "Comprobar",
    at: 65,
    title: "Tus resultados, con contexto",
    body: "Pregunta a NORA qué ha cambiado en tu negocio y consulta los datos que explican su respuesta. Revisa las ventas de Shopify y las atribuciones de Meta y Klaviyo por separado.",
    points: [
      "Preguntas con tus palabras; respuestas con las fuentes a la vista.",
      "Lo que atribuye Meta, lo que atribuye Klaviyo y lo que ve tu tienda, por separado.",
      "Informes en PDF cuando los necesites.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <PublicEntryShell active="platform">
      <main id="public-content">
        <HowItWorks
          id="como-funciona-title"
          title="De los datos de tu tienda a un plan de acción"
          lead="Con E-NORA conectas tus herramientas, entiendes tus resultados y organizas el trabajo de tu ecommerce. La IA te ayuda a analizar y preparar acciones; tú y tu consultor decidís el siguiente paso."
          video="/video/como-funciona"
          videoLabel="Vídeo: cómo funciona E-NORA en seis pasos, con una tienda de ejemplo"
          steps={STEPS}
          cta={{ label: "Pedir acceso", href: "/solicitar" }}
        />
      </main>
    </PublicEntryShell>
  );
}
