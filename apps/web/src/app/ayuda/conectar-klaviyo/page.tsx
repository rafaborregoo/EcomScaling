import type { Metadata } from "next";
import { BrandLogo, Heading, Link, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

// Articulo publico de ayuda que pide el formulario de registro de apps de
// Klaviyo (campo "Articulo n.o 1"). No cuelga de ningun menu del panel: es
// para enlazarlo desde fuera, igual que /condiciones y /politica-privacidad.

export const metadata: Metadata = {
  title: "Conecta Klaviyo con E-NORA — E-NORA IA",
  description:
    "Cómo autorizar tu cuenta de Klaviyo desde E-NORA para ver campañas, flujos e ingresos atribuidos junto al resto de tus canales.",
};

export default function ConnectKlaviyoArticlePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <BrandLogo />
        <Heading level={1} size="lg">
          Conecta Klaviyo con E-NORA
        </Heading>
        <p className="text-sm text-muted">
          Autoriza tu cuenta de Klaviyo desde el panel de E-NORA y
          empieza a ver campañas, flujos e ingresos atribuidos junto al resto
          de tus canales.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Qué hace la conexión</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Una vez conectado, E-NORA importa campañas, flujos, listas,
            segmentos y métricas de tu cuenta de Klaviyo para generar informes
            de rendimiento de email y SMS junto a los datos de Shopify y Meta
            Ads. También puedes publicar en tu cuenta de Klaviyo, como
            plantilla, cualquier pieza de email que apruebes en la sección de
            Marketing.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo conectar</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Entra en{" "}
              <span className="font-medium">Integraciones → Klaviyo</span>{" "}
              dentro de tu panel de E-NORA.
            </li>
            <li>
              Pulsa <span className="font-medium">Conectar Klaviyo (OAuth)</span>.
              Te llevamos a Klaviyo para que inicies sesión y autorices el
              acceso.
            </li>
            <li>
              Revisa los permisos solicitados y confirma la autorización en
              Klaviyo.
            </li>
            <li>
              Vuelves automáticamente a E-NORA con la cuenta ya conectada;
              la primera sincronización empieza sola.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué permisos se piden</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Lectura de cuentas, campañas, flujos, formularios, listas,
            segmentos y métricas, y permiso de lectura/escritura sobre
            plantillas de email para poder publicar las piezas que apruebes.
            Klaviyo nunca envía nada por su cuenta: las campañas, la audiencia
            y el envío los decides siempre tú, dentro de Klaviyo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revocar el acceso</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Puedes desconectar Klaviyo cuando quieras desde{" "}
            <span className="font-medium">Integraciones → Klaviyo</span> en
            E-NORA, o revocando la autorización directamente en Klaviyo
            (Settings → OAuth Clients). Más detalle sobre qué pasa con tus
            datos al desconectar en{" "}
            <Link className="underline" href="/eliminacion-de-datos">
              eliminación de datos
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
