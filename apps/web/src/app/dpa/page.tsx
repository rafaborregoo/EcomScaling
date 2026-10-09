import type { Metadata } from "next";
import { Link } from "@/components/ui";
import { LegalPage, LegalSection, LegalTable, MailLink } from "@/components/legal-page";
import { LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contrato de encargado del tratamiento — E-NORA IA",
  description:
    "Contrato de encargado del tratamiento (artículo 28 RGPD) entre el cliente de E-NORA IA y E-NORA: instrucciones, seguridad, subencargados, derechos y devolución de datos.",
};

const PROCESSING = [
  {
    id: "object",
    item: "Objeto",
    detail:
      "Prestar la plataforma E-NORA IA: centralizar los datos de las plataformas conectadas, calcular métricas y generar diagnósticos y tareas.",
  },
  {
    id: "nature",
    item: "Naturaleza y finalidad",
    detail:
      "Recogida desde las APIs de Shopify, Meta Ads y Klaviyo, almacenamiento, cálculo de métricas, visualización y análisis con modelos de lenguaje. Solo para prestar el servicio al cliente.",
  },
  {
    id: "duration",
    item: "Duración",
    detail: "La del servicio contratado, más 30 días de periodo de gracia hasta la eliminación definitiva.",
  },
  {
    id: "data",
    item: "Tipos de datos personales",
    detail:
      "Identificador de referencia con hash de clientes finales, número de pedidos, importe gastado, moneda, estado, etiquetas y consentimientos de marketing; vistas de producto con identificador de visitante con hash (píxel); datos de los usuarios de la cuenta (nombre, correo, rol).",
  },
  {
    id: "subjects",
    item: "Categorías de interesados",
    detail:
      "Clientes finales y visitantes de la tienda del cliente; usuarios y empleados del cliente que acceden a la plataforma.",
  },
];

export default function DataProcessingAgreementPage() {
  return (
    <LegalPage
      title="Contrato de encargado del tratamiento"
      current="/dpa"
      intro="Contrato conforme al artículo 28 del RGPD. Forma parte de las condiciones del servicio y se entiende aceptado al contratarlas."
    >
      <LegalSection title="1. Partes y alcance">
        <p>
          <strong>Responsable del tratamiento:</strong> el cliente, es decir, la empresa o profesional titular de la
          cuenta y de las tiendas conectadas. <strong>Encargado del tratamiento:</strong> {LEGAL_ENTITY.name} (NIF{" "}
          {LEGAL_ENTITY.taxId}), con domicilio en {LEGAL_ENTITY.address}, que opera como {LEGAL_ENTITY.brand}.
        </p>
        <p>
          Este contrato se aplica a los datos personales que E-NORA trata por cuenta del cliente al prestarle el
          servicio, en particular los de sus clientes finales y visitantes. No se aplica a los datos de las personas que
          usan la plataforma, de los que E-NORA es responsable según su{" "}
          <Link className="underline" href="/politica-privacidad">
            política de privacidad
          </Link>
          . Si hay contradicción con las condiciones del servicio sobre protección de datos, prevalece este contrato.
        </p>
        <p>
          Se formaliza por medios electrónicos, como permite el artículo 28.9 del RGPD, y no requiere firma manuscrita.
          Si necesitas un ejemplar firmado, pídelo a <MailLink />.
        </p>
      </LegalSection>

      <LegalSection title="2. Descripción del tratamiento">
        <LegalTable
          ariaLabel="Descripción del tratamiento de datos"
          columns={[
            { key: "item", label: "Elemento" },
            { key: "detail", label: "Detalle" },
          ]}
          rows={PROCESSING}
        />
      </LegalSection>

      <LegalSection title="3. Obligaciones de E-NORA como encargado">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Instrucciones.</strong> Tratar los datos solo siguiendo las instrucciones documentadas del cliente,
            que son este contrato, las condiciones del servicio y el uso que el cliente hace de la plataforma. Si una
            instrucción infringe el RGPD u otra norma de protección de datos, avisaremos al cliente.
          </li>
          <li>
            <strong>Finalidad.</strong> No tratar los datos para fines propios ni comunicarlos a terceros, salvo a los
            subencargados autorizados o por obligación legal; en ese caso, avisaremos antes al cliente si la ley lo
            permite.
          </li>
          <li>
            <strong>Confidencialidad.</strong> Obligar a confidencialidad a todas las personas autorizadas a tratar los
            datos, incluidos los consultores asignados, y limitar su acceso a lo necesario.
          </li>
          <li>
            <strong>Seguridad.</strong> Aplicar las medidas técnicas y organizativas del apartado 5.
          </li>
          <li>
            <strong>Subencargados.</strong> Cumplir lo previsto en el apartado 6.
          </li>
          <li>
            <strong>Derechos de los interesados.</strong> Ayudar al cliente, con medidas técnicas y organizativas
            apropiadas, a atender las solicitudes de acceso, rectificación, supresión, oposición, limitación y
            portabilidad. Si un interesado se dirige a nosotros, se lo trasladaremos al cliente sin dilación indebida y
            no responderemos nosotros salvo que la ley lo exija.
          </li>
          <li>
            <strong>Brechas de seguridad.</strong> Notificar al cliente sin dilación indebida desde que tengamos
            conocimiento de una violación de seguridad que afecte a sus datos, con la información disponible para que
            pueda cumplir los artículos 33 y 34 del RGPD.
          </li>
          <li>
            <strong>Evaluaciones de impacto y consulta previa.</strong> Ayudar al cliente, si lo pide por escrito, con
            las evaluaciones de impacto y las consultas a la autoridad de control (arts. 35 y 36 RGPD) relativas a este
            tratamiento.
          </li>
          <li>
            <strong>Registro.</strong> Llevar el registro de actividades de tratamiento que corresponde a los encargados
            (art. 30.2 RGPD).
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="4. Obligaciones del cliente como responsable">
        <ul className="list-disc space-y-1 pl-5">
          <li>Contar con una base legal válida para tratar los datos y para encargárnoslos.</li>
          <li>
            Informar a sus clientes finales y visitantes conforme a los artículos 13 y 14 del RGPD y, cuando
            corresponda, recabar su consentimiento, incluido el de cookies y tecnologías similares en su tienda, donde
            actúa el píxel de E-NORA.
          </li>
          <li>Darnos instrucciones lícitas y no incluir categorías especiales de datos ni datos de menores.</li>
          <li>Custodiar las credenciales de acceso de sus usuarios y avisarnos si sospecha un acceso no autorizado.</li>
          <li>
            Atender las solicitudes de los interesados, con nuestra ayuda según el apartado 3, y mantener al día las
            integraciones y permisos que concede.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Medidas de seguridad">
        <p>Teniendo en cuenta el estado de la técnica, los costes y los riesgos, aplicamos entre otras estas medidas:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Aislamiento de los datos por organización con control de acceso a nivel de fila (Row Level Security).</li>
          <li>Acceso de los consultores limitado a las cuentas que tienen asignadas.</li>
          <li>Cifrado de las comunicaciones en tránsito.</li>
          <li>
            Seudonimización: los identificadores de clientes finales se almacenan con hash y no guardamos sus datos de
            contacto.
          </li>
          <li>Autenticación de usuarios con contraseñas almacenadas cifradas y una política de contraseñas mínima.</li>
          <li>Tokens de las integraciones con acceso restringido y revocables desde el panel.</li>
          <li>Copias de seguridad periódicas y registro de las operaciones sensibles.</li>
          <li>Separación de los entornos de desarrollo y de producción.</li>
        </ul>
        <p>Podemos actualizar estas medidas siempre que no reduzcan el nivel general de protección.</p>
      </LegalSection>

      <LegalSection title="6. Subencargados">
        <p>
          El cliente nos autoriza de forma general a recurrir a subencargados. La lista vigente, con su función y
          ubicación, está en{" "}
          <Link className="underline" href="/subencargados">
            subencargados del tratamiento
          </Link>
          .
        </p>
        <p>
          Antes de añadir o sustituir a uno, lo comunicaremos al cliente con al menos 15 días de antelación. Si se opone
          por motivos razonables de protección de datos y no llegamos a una solución, podrá cancelar el servicio. A cada
          subencargado le imponemos por contrato obligaciones de protección de datos equivalentes a las de este
          contrato, y seguimos siendo responsables ante el cliente de su cumplimiento.
        </p>
      </LegalSection>

      <LegalSection title="7. Transferencias internacionales">
        <p>
          Los datos se alojan en la Unión Europea. Si un subencargado los trata en un país fuera del Espacio Económico
          Europeo sin decisión de adecuación, la transferencia se ampara en las cláusulas contractuales tipo de la
          Comisión Europea u otro mecanismo válido del capítulo V del RGPD.
        </p>
      </LegalSection>

      <LegalSection title="8. Inteligencia artificial">
        <p>
          No usamos datos personales del cliente para entrenar ni mejorar modelos de inteligencia artificial, propios o
          de terceros, y prohibimos a los subencargados de modelos de lenguaje que lo hagan. A estos solo les enviamos
          datos agregados o los textos de trabajo necesarios, nunca listados de clientes finales ni su identificador de
          referencia.
        </p>
        <p>
          El servicio no adopta decisiones automatizadas con efectos jurídicos sobre los interesados: las
          recomendaciones de la IA las revisa y las ejecuta una persona.
        </p>
      </LegalSection>

      <LegalSection title="9. Auditorías">
        <p>
          El cliente puede pedirnos la información necesaria para demostrar el cumplimiento de este contrato y, una vez
          al año o cuando lo exija la autoridad de control, auditarlo con aviso previo razonable, sin interferir en el
          servicio y bajo confidencialidad. Si lo realiza un tercero, no podrá ser competidor nuestro.
        </p>
      </LegalSection>

      <LegalSection title="10. Devolución y supresión de los datos">
        <p>
          Al terminar el servicio dejamos de tratar los datos salvo para devolverlos o eliminarlos. El cliente puede
          pedirnos en los 30 días siguientes una copia de sus datos, o descargarla desde la plataforma; pasado ese
          plazo, los eliminamos definitivamente, incluidos los tokens de las integraciones, y lo confirmamos por correo
          si se pide. El borrado inmediato puede solicitarse en cualquier momento (
          <Link className="underline" href="/eliminacion-de-datos">
            eliminación de datos
          </Link>
          ).
        </p>
        <p>Podremos conservar bloqueados los datos que la ley nos obligue a guardar, solo durante ese plazo.</p>
      </LegalSection>

      <LegalSection title="11. Duración y responsabilidad">
        <p>
          Este contrato dura mientras tratemos datos del cliente, aunque el servicio haya terminado. La responsabilidad
          entre las partes se rige por las condiciones del servicio, sin perjuicio de los derechos de los interesados
          frente a cualquiera de ellas conforme al artículo 82 del RGPD.
        </p>
        <p>
          Podemos modificar este contrato para adaptarlo a cambios normativos o del servicio, avisando al cliente con
          antelación razonable; si el cambio reduce de forma sustancial sus garantías, requerirá su aceptación.
        </p>
      </LegalSection>

      <LegalSection title="12. Ley aplicable y contacto">
        <p>
          Este contrato se rige por la legislación española y por el RGPD. Para las controversias se aplica el fuero
          fijado en las condiciones del servicio. Para cualquier cuestión sobre protección de datos, escríbenos a{" "}
          <MailLink />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
