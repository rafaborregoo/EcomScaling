import type { Metadata } from "next";
import { Card, EYEBROW, Heading, Link } from "@/components/ui";

// URL publica que piden las plataformas al registrar la app (Meta la exige en
// "URL de las Condiciones del servicio"; Shopify la pide para el App Store).
// Igual que /politica-privacidad, no cuelga de ningun menu: existe para ser
// enlazada desde fuera.

export const metadata: Metadata = {
  title: "Condiciones del servicio — EcomScaling IA",
  description:
    "Condiciones del servicio de EcomScaling IA: qué incluye la plataforma, qué responsabilidades asume cada parte y cómo se contrata o cancela.",
};

const LAST_UPDATED = "14 de septiembre de 2026";
const CONTACT_EMAIL = "ricardo@ecomscaling.es";

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className={EYEBROW}>EcomScaling IA</p>
        <Heading level={1} size="lg">
          Condiciones del servicio
        </Heading>
        <p className="text-sm text-muted">Última actualización: {LAST_UPDATED}</p>
      </header>

      <Card title="Objeto">
        <p>
          EcomScaling IA es una plataforma de consultoría para tiendas de
          e-commerce. Centraliza en un mismo sitio los datos de las plataformas
          que el cliente conecta —Shopify, Meta Ads y Klaviyo—, calcula métricas
          sobre ellos y genera diagnósticos, recomendaciones y tareas de
          seguimiento con ayuda de agentes de inteligencia artificial.
        </p>
        <p>
          Estas condiciones regulan el uso de la plataforma. Al crear una cuenta
          o usarla, el cliente las acepta. El tratamiento de datos personales se
          describe aparte, en la{" "}
          <Link className="underline" href="/politica-privacidad">
            política de privacidad
          </Link>
          .
        </p>
      </Card>

      <Card title="Quién puede usar la plataforma">
        <p>
          El servicio está dirigido a empresas y profesionales. Las cuentas las
          crea el equipo de consultoría o el propio cliente dentro de su
          organización, y cada persona accede con sus credenciales, que son
          personales e intransferibles. El titular de la cuenta es responsable
          de la actividad que se realice con ellas y debe avisarnos si sospecha
          de un acceso no autorizado.
        </p>
      </Card>

      <Card title="Integraciones con plataformas de terceros">
        <p>
          Para funcionar, la plataforma necesita que el cliente autorice el
          acceso a sus cuentas de Shopify, Meta Ads o Klaviyo. Esa autorización
          la concede el cliente y puede revocarla cuando quiera desde la sección
          de integraciones o desde la propia plataforma de origen.
        </p>
        <p>
          Cada una de esas plataformas tiene sus propias condiciones, límites de
          uso y disponibilidad, y no dependen de nosotros. Si una de ellas
          cambia su API, retira un permiso o deja de responder, parte de las
          métricas puede dejar de actualizarse; lo avisaremos en la propia
          interfaz, pero no podemos garantizar un servicio que no controlamos.
        </p>
      </Card>

      <Card title="Diagnósticos y contenido generado por IA">
        <p>
          Los análisis, recomendaciones, textos y tareas que genera la
          plataforma son <strong>apoyo a la decisión, no asesoramiento
          garantizado</strong>. Se calculan sobre los datos disponibles en el
          momento y pueden contener errores, quedarse desactualizados o no
          aplicar al caso concreto de una tienda.
        </p>
        <p>
          Las decisiones de negocio —cambiar precios, subir o bajar inversión
          publicitaria, enviar una campaña, comprar inventario— son siempre del
          cliente, que debe revisarlas antes de ejecutarlas. No respondemos de
          los resultados comerciales derivados de seguir una recomendación.
        </p>
      </Card>

      <Card title="Precios, facturación y cancelación">
        <p>
          El precio depende del plan contratado y del número de tiendas
          conectadas a la cuenta. Es una suscripción periódica que se renueva
          automáticamente al final de cada periodo salvo que el cliente la
          cancele. Los importes se indican sin impuestos, que se añaden cuando
          corresponda.
        </p>
        <p>
          El cliente puede cancelar cuando quiera, sin penalización. La
          cancelación surte efecto al final del periodo ya pagado; no se
          reembolsan periodos empezados salvo error por nuestra parte. Tras la
          baja, los datos se eliminan según lo descrito en{" "}
          <Link className="underline" href="/eliminacion-de-datos">
            eliminación de datos
          </Link>
          .
        </p>
      </Card>

      <Card title="Disponibilidad del servicio">
        <p>
          Trabajamos para que la plataforma esté disponible de forma continua,
          pero no ofrecemos un nivel de servicio garantizado salvo que se pacte
          por escrito. Puede haber interrupciones por mantenimiento, incidencias
          de nuestros proveedores de infraestructura o fallos de las plataformas
          integradas.
        </p>
      </Card>

      <Card title="Uso aceptable">
        <p>
          No está permitido usar la plataforma para acceder a datos de terceros
          sin autorización, intentar saltarse los controles de acceso entre
          organizaciones, sobrecargar deliberadamente el servicio, revenderlo
          sin acuerdo previo, ni emplearlo para actividades ilícitas o
          contrarias a las condiciones de las plataformas integradas.
        </p>
        <p>
          Podemos suspender una cuenta que incumpla estas reglas, avisando al
          cliente salvo que la gravedad o la urgencia lo impidan.
        </p>
      </Card>

      <Card title="Propiedad">
        <p>
          El software, la interfaz y la lógica de la plataforma son propiedad de
          EcomScaling. Los datos de negocio del cliente y el contenido que sube
          siguen siendo suyos: no adquirimos derechos sobre ellos más allá de lo
          necesario para prestar el servicio, y no los usamos para entrenar
          modelos propios ni de terceros.
        </p>
      </Card>

      <Card title="Responsabilidad">
        <p>
          Respondemos de los daños directos que causemos por incumplimiento de
          estas condiciones, con el límite del importe abonado por el cliente en
          los doce meses anteriores al hecho que los origine. No respondemos del
          lucro cesante, la pérdida de oportunidades de negocio ni de los daños
          derivados de decisiones comerciales del cliente, del uso de datos
          incompletos de una plataforma de terceros o del incumplimiento por
          parte del cliente de las condiciones de esas plataformas.
        </p>
        <p>Nada de lo anterior limita la responsabilidad que la ley no permita excluir.</p>
      </Card>

      <Card title="Cambios en estas condiciones">
        <p>
          Podemos actualizar estas condiciones cuando cambie el servicio o la
          normativa aplicable. Si el cambio es relevante, lo comunicaremos por
          correo o dentro de la plataforma con antelación razonable. Seguir
          usando el servicio después de que entren en vigor supone aceptarlas.
        </p>
      </Card>

      <Card title="Ley aplicable y contacto">
        <p>
          Estas condiciones se rigen por la legislación española. Para cualquier
          controversia, las partes se someten a los juzgados y tribunales de
          Málaga, salvo que la normativa de consumo imponga otro fuero.
        </p>
        <p>
          Para cualquier duda sobre estas condiciones, escríbenos a{" "}
          <Link className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </Link>
          .
        </p>
      </Card>
    </main>
  );
}
