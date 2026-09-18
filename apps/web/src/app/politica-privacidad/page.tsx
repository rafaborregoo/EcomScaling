import type { Metadata } from "next";
import { BrandLogo, Card, Heading, Link } from "@/components/ui";

export const metadata: Metadata = {
  title: "Política de privacidad — EcomScaling IA",
  description: "Política de privacidad de EcomScaling IA: qué datos tratamos, con qué finalidad y cómo ejercer tus derechos.",
};

const LAST_UPDATED = "10 de septiembre de 2026";
const CONTACT_EMAIL = "ricardo@ecomscaling.es";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <BrandLogo />
        <Heading level={1} size="lg">Política de privacidad</Heading>
        <p className="text-sm text-muted">Última actualización: {LAST_UPDATED}</p>
      </header>

      <Card title="Quiénes somos">
        <p>
          EcomScaling IA es una plataforma de consultoría para tiendas de e-commerce que centraliza
          métricas y automatiza tareas operativas para sus clientes, integrando datos de plataformas
          como Shopify, Meta (Facebook/Instagram) Ads y Klaviyo. Esta política describe qué datos personales
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
            rendimiento), datos equivalentes de Shopify (pedidos, productos, costes) y métricas de campañas y
            flujos de email/SMS de Klaviyo, cuando el cliente conecta esas integraciones.
          </li>
          <li>
            Contenido generado en el uso del producto: notas, tareas, resúmenes de llamadas de
            consultoría y documentos que el cliente o su consultor suben a la plataforma.
          </li>
        </ul>
        <p>
          De los <strong>clientes finales</strong> de la tienda tratamos únicamente un identificador
          de referencia con hash, su número de pedidos, el importe gastado, la moneda, el estado y las
          etiquetas, y sus estados de consentimiento de marketing (email y SMS). No tratamos su
          nombre, correo electrónico, teléfono, dirección postal ni ubicación, y los pedidos y
          checkouts que almacenamos tampoco incluyen email ni dirección de envío.
        </p>
      </Card>

      <Card title="Con quién compartimos los datos">
        <p>
          Nos apoyamos en proveedores que tratan datos por cuenta nuestra: Supabase (base de datos,
          autenticación y copias de seguridad, en la Unión Europea), Vercel e IONOS (alojamiento), y
          Anthropic y OpenAI (modelos de lenguaje que generan los diagnósticos). A los proveedores de
          modelos de lenguaje les enviamos métricas agregadas del negocio, nunca listados de clientes
          ni el identificador de referencia. Las transferencias fuera de la Unión Europea se amparan
          en las cláusulas contractuales tipo de cada proveedor.
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
          tokens y datos importados desde Meta Ads, Shopify o Klaviyo) escribiendo a{" "}
          <Link className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </Link>
          . Atenderemos la solicitud en un plazo razonable y confirmaremos por correo cuando se haya
          completado.
        </p>
        <p>
          Al desconectar una tienda o dar de baja una cuenta, los datos quedan marcados para borrado y
          se eliminan definitivamente a los <strong>30 días</strong>. Ese plazo es un periodo de
          gracia para poder deshacer una desconexión accidental; si prefieres el borrado inmediato,
          pídelo y lo hacemos.
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
          <Link className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </Link>
          .
        </p>
      </Card>

      <Card title="Contacto">
        <p>
          Para cualquier duda sobre esta política o sobre el tratamiento de tus datos, escríbenos a{" "}
          <Link className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </Link>
          .
        </p>
      </Card>
    </main>
  );
}
