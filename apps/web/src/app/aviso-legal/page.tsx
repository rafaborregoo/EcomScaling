import type { Metadata } from "next";
import { Link } from "@/components/ui";
import { LegalPage, LegalSection, MailLink } from "@/components/legal-page";
import { LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Aviso legal — E-NORA IA",
  description: "Aviso legal de E-NORA IA: titular del servicio, datos de contacto y condiciones de uso del sitio web.",
};

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Aviso legal"
      current="/aviso-legal"
      intro="Información general exigida por el artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE)."
    >
      <LegalSection title="Titular del sitio web">
        <ul className="space-y-1">
          <li>
            <strong>Titular:</strong> {LEGAL_ENTITY.name}, que opera bajo la marca comercial {LEGAL_ENTITY.brand}.
          </li>
          <li>
            <strong>NIF:</strong> {LEGAL_ENTITY.taxId}
          </li>
          <li>
            <strong>Domicilio:</strong> {LEGAL_ENTITY.address}
          </li>
          <li>
            <strong>Correo electrónico:</strong> <MailLink />
          </li>
          <li>
            <strong>Sitio web:</strong> {LEGAL_ENTITY.site}
          </li>
        </ul>
        <p>
          El titular actúa como empresario individual (autónomo) y presta el servicio a empresas y profesionales.
        </p>
      </LegalSection>

      <LegalSection title="Objeto">
        <p>
          Este sitio web y la plataforma E-NORA IA ofrecen consultoría para tiendas de e-commerce: centralizan los
          datos de las plataformas que el cliente conecta y generan métricas, diagnósticos y tareas de seguimiento.
          El acceso a la plataforma requiere una cuenta y se rige por las{" "}
          <Link className="underline" href="/condiciones">
            condiciones del servicio
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Condiciones de uso del sitio web">
        <p>
          Acceder a las páginas públicas del sitio es libre y gratuito. Quien lo utilice se compromete a hacerlo
          conforme a la ley, a la buena fe y a este aviso, y a no emplearlo para actividades ilícitas, para dañar o
          sobrecargar el servicio ni para intentar acceder a datos de otras organizaciones.
        </p>
        <p>
          El titular puede modificar, suspender o retirar contenidos del sitio en cualquier momento y sin previo aviso
          cuando haya una razón técnica, de seguridad o legal.
        </p>
      </LegalSection>

      <LegalSection title="Propiedad intelectual e industrial">
        <p>
          El software, el diseño, los textos, los logotipos y la marca E-NORA son propiedad del titular o se usan con
          licencia. No se autoriza su reproducción, distribución ni transformación sin permiso previo por escrito,
          salvo lo necesario para usar el servicio contratado.
        </p>
        <p>
          Las marcas de terceros que aparecen en el sitio (Shopify, Meta, Klaviyo y otras) pertenecen a sus titulares y
          se citan solo para describir las integraciones disponibles; no implican patrocinio ni relación más allá de
          la integración técnica.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilidad">
        <p>
          El titular se esfuerza por mantener la información del sitio actualizada, pero no garantiza que esté libre
          de errores ni que el servicio sea ininterrumpido. No responde de los daños derivados de interrupciones
          ajenas a su control, ni del contenido de sitios de terceros enlazados desde aquí.
        </p>
        <p>
          La responsabilidad por el uso de la plataforma, incluidos los diagnósticos generados con inteligencia
          artificial, se regula en las condiciones del servicio.
        </p>
      </LegalSection>

      <LegalSection title="Protección de datos y cookies">
        <p>
          El tratamiento de datos personales se describe en la{" "}
          <Link className="underline" href="/politica-privacidad">
            política de privacidad
          </Link>{" "}
          y el uso de almacenamiento en tu navegador, en la{" "}
          <Link className="underline" href="/cookies">
            política de cookies
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Legislación aplicable y jurisdicción">
        <p>
          Este aviso se rige por la legislación española. Para cualquier controversia, las partes se someten a los
          juzgados y tribunales de Málaga, salvo que la normativa de consumidores y usuarios establezca otro fuero.
        </p>
        <p>
          Si eres consumidor, puedes acudir también a la plataforma europea de resolución de litigios en línea:{" "}
          <Link className="underline" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
            ec.europa.eu/consumers/odr
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
