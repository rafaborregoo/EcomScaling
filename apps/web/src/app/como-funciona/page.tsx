import type { Metadata } from "next";
import { PublicEntryShell } from "@/components/public-entry-shell";
import { HowItWorks, type HowItWorksStep } from "@/components/marketing/how-it-works";

export const metadata: Metadata = {
  title: "Cómo funciona E-NORA",
  description: "Conecta Shopify, Meta y Klaviyo, deja que NORA te diga qué hacer cada día y decide tú, con tu consultor si trabajas con uno. En seis pasos.",
};

const STEPS: HowItWorksStep[] = [
  {
    label: "Conectar",
    at: 5,
    title: "Conecta Shopify, Meta y Klaviyo",
    body: "E-NORA importa tus pedidos, tu stock, tus anuncios y tus emails. Para empezar basta con Shopify.",
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
    title: "NORA revisa tus números cada mañana",
    body: "Ventas, pedidos, beneficio y conversión de los últimos 30 días, frente al mes anterior. Y te enseña de dónde sale cada cifra.",
    points: [
      "Un titular con lo más importante del día, escrito por NORA.",
      "El beneficio desglosado: producto, envíos, comisiones, publicidad y gastos fijos.",
      "Cada cifra comparada con el periodo anterior.",
    ],
  },
  {
    label: "Decidir",
    at: 27,
    title: "Te propone qué hacer, y por qué",
    body: "Cada propuesta trae los datos que la justifican. Si la aceptas, pasa a tus tareas. Si no te encaja, la descartas.",
    points: [
      "Propuestas de stock, anuncios y emails con su porqué y sus fuentes.",
      "Aceptarla la convierte en una tarea tuya; descartarla no cambia nada.",
      "NORA no toca tus cuentas por su cuenta: propone y tú decides.",
    ],
  },
  {
    label: "Planificar",
    at: 40,
    title: "Tu consultor, en la misma pantalla",
    body: "Si trabajas con un consultor, ve tus datos y tus tareas, te deja notas y prepara contigo un plan con meta de ventas.",
    points: [
      "Un plan por fases, con hitos, fechas y una meta de ventas.",
      "Tareas con dueño: tú, tu consultor o los dos.",
      "Notas y mensajes con tu consultor en el mismo sitio que tus datos.",
    ],
  },
  {
    label: "Ejecutar",
    at: 51,
    title: "Creas la campaña sin salir de aquí",
    body: "Escribes la idea en una frase. NORA prepara el email, tu consultor lo revisa y se programa en tu Klaviyo.",
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
    title: "Pregunta qué ha funcionado",
    body: "NORA responde con tus datos y te dice de dónde salen. Cada plataforma con su cifra, sin sumarlas.",
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
          title="Así funciona E-NORA"
          lead="Conecta tu tienda, deja que NORA te diga qué hacer cada día y decide tú, con tu consultor si trabajas con uno. En seis pasos."
          video="/video/como-funciona"
          videoLabel="Vídeo: cómo funciona E-NORA en seis pasos, con una tienda de ejemplo"
          steps={STEPS}
          cta={{ label: "Pedir acceso", href: "/solicitar" }}
        />
      </main>
    </PublicEntryShell>
  );
}
