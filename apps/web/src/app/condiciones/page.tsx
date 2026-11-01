import type { Metadata } from "next";
import { Link, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { LegalPage, MailLink } from "@/components/legal-page";
import { LEGAL_ENTITY } from "@/lib/legal";

// URL publica que piden las plataformas al registrar la app (Meta la exige en
// "URL de las Condiciones del servicio"; Shopify la pide para el App Store).
// Igual que /politica-privacidad, no cuelga de ningun menu: existe para ser
// enlazada desde fuera.

export const metadata: Metadata = {
  title: "Condiciones del servicio — E-NORA IA",
  description:
    "Condiciones del servicio de E-NORA IA: qué incluye la plataforma, qué responsabilidades asume cada parte y cómo se contrata o cancela.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Condiciones del servicio" current="/condiciones">

      <Card>
        <CardHeader>
          <CardTitle>Titular</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            {LEGAL_ENTITY.brand} es una marca comercial de {LEGAL_ENTITY.name} (NIF{" "}
            {LEGAL_ENTITY.taxId}), con domicilio en {LEGAL_ENTITY.address}. Los datos
            completos están en el{" "}
            <Link className="underline" href="/aviso-legal">
              aviso legal
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objeto</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            E-NORA IA es una plataforma de consultoría para tiendas de
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
            </Link>{" "}
            y, para los datos de la tienda del cliente, en el{" "}
            <Link className="underline" href="/dpa">
              contrato de encargado del tratamiento
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quién puede usar la plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            El servicio está dirigido a empresas y profesionales. Las cuentas las
            crea el equipo de consultoría o el propio cliente dentro de su
            organización, y cada persona accede con sus credenciales, que son
            personales e intransferibles. El titular de la cuenta es responsable
            de la actividad que se realice con ellas y debe avisarnos si sospecha
            de un acceso no autorizado.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integraciones con plataformas de terceros</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnósticos y contenido generado por IA</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Precios, facturación y cancelación</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilidad del servicio</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Trabajamos para que la plataforma esté disponible de forma continua,
            pero no ofrecemos un nivel de servicio garantizado salvo que se pacte
            por escrito. Puede haber interrupciones por mantenimiento, incidencias
            de nuestros proveedores de infraestructura o fallos de las plataformas
            integradas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uso aceptable</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protección de datos</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Respecto a los datos personales de los clientes finales y visitantes de la
            tienda, el cliente es el responsable del tratamiento y E-NORA su
            encargado, conforme al{" "}
            <Link className="underline" href="/dpa">
              contrato de encargado del tratamiento
            </Link>
            , que forma parte de estas condiciones. Los proveedores que intervienen
            están en{" "}
            <Link className="underline" href="/subencargados">
              subencargados del tratamiento
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confidencialidad</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Cada parte mantendrá en secreto la información no pública de la otra a
            la que acceda por el servicio —datos de negocio, métricas, estrategias
            y condiciones comerciales— y la usará solo para cumplir estas
            condiciones. Esta obligación no alcanza a la información que sea
            pública, la que ya se conociera legítimamente o la que deba
            comunicarse por mandato legal o de una autoridad, y se mantiene tras
            la baja.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Propiedad</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            El software, la interfaz y la lógica de la plataforma son propiedad de
            E-NORA. Los datos de negocio del cliente y el contenido que sube
            siguen siendo suyos: no adquirimos derechos sobre ellos más allá de lo
            necesario para prestar el servicio, y no los usamos para entrenar
            modelos propios ni de terceros.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsabilidad</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duración, suspensión y terminación</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            El servicio dura el periodo contratado y se renueva según lo descrito
            en «Precios, facturación y cancelación». Podemos suspenderlo por
            impago, por incumplimiento grave de estas condiciones o por riesgo para
            la seguridad del servicio, avisando al cliente salvo que la urgencia lo
            impida, y resolver el contrato si la causa no se corrige en un plazo
            razonable. Tras la terminación, el cliente puede descargar sus datos
            y después se eliminan como se explica en{" "}
            <Link className="underline" href="/eliminacion-de-datos">
              eliminación de datos
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fuerza mayor</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Ninguna parte responde de los retrasos o incumplimientos causados por
            hechos fuera de su control razonable, como caídas generalizadas de
            internet o de proveedores de infraestructura, cambios o cortes de las
            APIs de plataformas de terceros, ataques informáticos pese a haber
            aplicado medidas razonables, o decisiones de una autoridad.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comunicaciones y cesión</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Las comunicaciones se hacen por correo electrónico a la dirección de la
            cuenta o a la indicada arriba, y también dentro de la plataforma. El
            cliente no puede ceder estas condiciones sin nuestro consentimiento;
            nosotros podemos hacerlo a quien continúe el negocio, avisando al
            cliente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambios en estas condiciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Podemos actualizar estas condiciones cuando cambie el servicio o la
            normativa aplicable. Si el cambio es relevante, lo comunicaremos por
            correo o dentro de la plataforma con antelación razonable. Seguir
            usando el servicio después de que entren en vigor supone aceptarlas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ley aplicable y contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Estas condiciones se rigen por la legislación española. Para cualquier
            controversia, las partes se someten a los juzgados y tribunales de
            Málaga, salvo que la normativa de consumo imponga otro fuero.
          </p>
          <p>
            Para cualquier duda sobre estas condiciones, escríbenos a <MailLink />.
          </p>
        </CardContent>
      </Card>
    </LegalPage>
  );
}
