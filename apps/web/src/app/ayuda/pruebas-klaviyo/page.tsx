import type { Metadata } from "next";
import { BrandLogo, Card, Heading, Link } from "@/components/ui";

// Instrucciones de prueba que pide el formulario de registro de apps de
// Klaviyo ("Registro y seguridad" -> URL con las instrucciones de prueba).
// No lleva credenciales: las comparte Rafa por separado, fuera de este
// documento publico. Mismo patron que /ayuda/conectar-klaviyo.

export const metadata: Metadata = {
  title: "Instrucciones de prueba — Integración con Klaviyo",
  description:
    "Cómo probar el flujo de instalación y la funcionalidad de la integración de E-NORA con Klaviyo.",
};

export default function KlaviyoTestInstructionsPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <BrandLogo />
        <Heading level={1} size="lg">
          Instrucciones de prueba — Integración con Klaviyo
        </Heading>
        <p className="text-sm text-muted">
          Para el equipo de revisión de Klaviyo: cómo probar el flujo de
          instalación (OAuth) y la funcionalidad de la app E-NORA.
        </p>
      </header>

      <Card title="Antes de empezar">
        <p>
          Necesitas dos cosas, que te hemos proporcionado por separado (no van
          en este documento público):
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Un usuario de prueba de E-NORA ya dado de alta.</li>
          <li>
            Una cuenta de Klaviyo (de prueba o sandbox) con la que autorizar
            la conexión.
          </li>
        </ul>
        <p>
          Si no las tienes, escríbenos a{" "}
          <Link className="underline" href="mailto:rafael@noraapp.es">
            rafael@noraapp.es
          </Link>
          .
        </p>
      </Card>

      <Card title="1. Instalar la app (flujo OAuth)">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Entra en la app con el usuario de prueba (te pasamos la URL por
            separado).
          </li>
          <li>
            Ve a <span className="font-medium">Integraciones → Klaviyo</span>.
          </li>
          <li>
            Pulsa <span className="font-medium">Conectar Klaviyo (OAuth)</span>
            . Te redirige a Klaviyo.
          </li>
          <li>
            Inicia sesión en Klaviyo con la cuenta de prueba y revisa los
            permisos solicitados (lectura de campañas, flujos, listas,
            segmentos, métricas y formularios; lectura/escritura de
            plantillas de email).
          </li>
          <li>Confirma la autorización.</li>
          <li>
            Klaviyo te devuelve a E-NORA. La conexión debe aparecer como{" "}
            <span className="font-medium">conectada</span>, con el nombre de
            la cuenta de Klaviyo autorizada.
          </li>
        </ol>
        <p className="mt-3">
          <strong>Resultado esperado:</strong> la tarjeta de Klaviyo pasa de
          &quot;Conectar&quot; a mostrar el estado conectado, sin errores. La
          primera sincronización arranca sola en segundo plano.
        </p>
      </Card>

      <Card title="2. Comprobar la sincronización">
        <p>
          Unos minutos después de conectar (puede tardar, según el volumen de
          la cuenta de prueba), en la misma pantalla de Klaviyo:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            El desplegable{" "}
            <span className="font-medium">Métrica primaria de conversión</span>{" "}
            se rellena con las métricas de la cuenta conectada.
          </li>
          <li>
            La sección <span className="font-medium">Reporting</span> muestra
            al menos una ejecución de sincronización, con campañas o flujos si
            la cuenta de prueba tiene actividad reciente.
          </li>
        </ul>
      </Card>

      <Card title="3. Publicar una plantilla (opcional)">
        <p>
          Esta función escribe en la cuenta de Klaviyo, así que solo se activa
          si la cuenta de prueba tiene contenido aprobado en{" "}
          <span className="font-medium">Marketing</span> dentro de
          E-NORA:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            En E-NORA, crea o abre una pieza de email en{" "}
            <span className="font-medium">Marketing</span> y apruébala.
          </li>
          <li>
            Pulsa <span className="font-medium">Enviar a Klaviyo</span>.
          </li>
          <li>
            Comprueba en Klaviyo (<span className="font-medium">Content → Templates</span>)
            que la plantilla se ha creado con el mismo HTML.
          </li>
        </ol>
      </Card>

      <Card title="4. Revocar el acceso">
        <p>Dos formas de probar la desconexión:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Desde E-NORA: <span className="font-medium">Integraciones → Klaviyo</span>,
            desconectar la cuenta.
          </li>
          <li>
            Desde Klaviyo: <span className="font-medium">Settings → OAuth Clients</span>,
            revocar el acceso de E-NORA.
          </li>
        </ul>
        <p>
          En ambos casos, E-NORA deja de poder leer datos nuevos de esa
          cuenta.
        </p>
      </Card>

      <Card title="Contacto">
        <p>
          Cualquier duda durante la revisión, escríbenos a{" "}
          <Link className="underline" href="mailto:rafael@noraapp.es">
            rafael@noraapp.es
          </Link>
          .
        </p>
      </Card>
    </main>
  );
}
