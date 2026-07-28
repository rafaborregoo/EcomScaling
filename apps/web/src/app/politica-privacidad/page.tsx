import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Política de privacidad — EcomScaling IA",
  description: "Política de privacidad de EcomScaling IA: qué datos tratamos, con qué finalidad y cómo ejercer tus derechos.",
};

const LAST_UPDATED = "28 de julio de 2026";
const CONTACT_EMAIL = "rafael@noraapp.es";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">EcomScaling IA</p>
        <h1 className="text-2xl font-semibold">Política de privacidad</h1>
        <p className="text-sm text-muted">Última actualización: {LAST_UPDATED}</p>
      </header>

      <Card title="Quiénes somos">
        <p>
          EcomScaling IA es una plataforma de consultoría para tiendas de e-commerce que centraliza
          métricas y automatiza tareas operativas para sus clientes, integrando datos de plataformas
          como Shopify y Meta (Facebook/Instagram) Ads. Esta política describe qué datos personales
          tratamos, con qué finalidad, y cómo puedes ejercer tus derechos sobre ellos.
        </p>
      </Card>

      <Card title="Qué datos tratamos">
        <p>Según los servicios que un cliente conecta a su cuenta, podemos tratar:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Datos de la cuenta del usuario: nombre, correo electrónico, rol dentro de su organización.
          </li>
          <li>
            Datos de negocio conectados por el propio cliente: métricas y datos de campañas de Meta
            Ads (identificadores de cuenta publicitaria, campañas, anuncios, métricas agregadas de
            rendimiento), y datos equivalentes de Shopify (pedidos, productos, costes) cuando el
            cliente conecta esa integración.
          </li>
          <li>
            Contenido generado en el uso del producto: notas, tareas, resúmenes de llamadas de
            consultoría y documentos que el cliente o su consultor suben a la plataforma.
          </li>
        </ul>
        <p>
          No solicitamos ni tratamos datos personales de los clientes finales de nuestros clientes
          más allá de los agregados/anonimizados que exponen las APIs de métricas de cada plataforma
          conectada.
        </p>
      </Card>

      <Card title="Con qué finalidad">
        <ul className="list-disc pl-5 space-y-1">
          <li>Mostrar métricas y diagnósticos operativos de la tienda del cliente.</li>
          <li>Generar recomendaciones y tareas mediante agentes de inteligencia artificial internos.</li>
          <li>Permitir que el equipo de consultoría asignado a cada cliente le dé seguimiento.</li>
        </ul>
        <p>No vendemos datos personales ni los compartimos con terceros con fines publicitarios.</p>
      </Card>

      <Card title="Base legal y acceso">
        <p>
          El acceso a los datos de cada organización está restringido por control de acceso
          multi-tenant: solo el propio cliente y los consultores asignados a su cuenta pueden verla.
          Los datos se almacenan en infraestructura de base de datos con controles de acceso a nivel
          de fila (Row Level Security) y cifrado en tránsito.
        </p>
      </Card>

      <Card title="Conservación y eliminación de datos">
        <p>
          Conservamos los datos mientras la cuenta del cliente esté activa. Un cliente puede solicitar
          en cualquier momento la eliminación de su cuenta y de los datos conectados (incluyendo
          tokens y datos importados desde Meta Ads o Shopify) escribiendo a{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . Atenderemos la solicitud en un plazo razonable y confirmaremos por correo cuando se haya
          completado.
        </p>
        <p>
          Si desconectas la integración con Meta desde el panel de integraciones, revocamos el token
          de acceso asociado y dejamos de sincronizar datos nuevos de esa cuenta publicitaria.
        </p>
      </Card>

      <Card title="Tus derechos">
        <p>
          Puedes solicitar en cualquier momento el acceso, la rectificación o la eliminación de tus
          datos personales, así como retirar tu consentimiento para el tratamiento, escribiendo a{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Card>

      <Card title="Contacto">
        <p>
          Para cualquier duda sobre esta política o sobre el tratamiento de tus datos, escríbenos a{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Card>
    </main>
  );
}
