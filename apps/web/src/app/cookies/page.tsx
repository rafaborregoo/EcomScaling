import type { Metadata } from "next";
import { Link } from "@/components/ui";
import { LegalPage, LegalSection, LegalTable, MailLink } from "@/components/legal-page";
import { STORAGE_ITEMS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de cookies — E-NORA IA",
  description:
    "Política de cookies de E-NORA IA: qué guardamos en tu navegador, para qué sirve y cómo borrarlo. No usamos cookies de analítica ni de publicidad.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Política de cookies"
      current="/cookies"
      intro="Información sobre el uso de cookies y tecnologías similares, conforme al artículo 22.2 de la Ley 34/2002 (LSSI-CE) y a la guía de la Agencia Española de Protección de Datos."
    >
      <LegalSection title="Qué son">
        <p>
          Las cookies son pequeños archivos que un sitio web guarda en tu navegador. El almacenamiento local y de sesión
          del navegador cumple una función parecida y se trata igual a efectos de esta política. Sirven para recordar
          quién eres, qué estabas haciendo o qué prefieres.
        </p>
      </LegalSection>

      <LegalSection title="Lo que usamos nosotros">
        <p>
          E-NORA IA solo usa almacenamiento <strong>técnico y de preferencias</strong>, y es nuestro: no instalamos
          cookies de analítica, de publicidad ni de redes sociales, y no hay terceros que lo coloquen. Por eso no
          mostramos un banner de consentimiento: el artículo 22.2 de la LSSI exime del consentimiento al
          almacenamiento imprescindible para prestar el servicio que has pedido.
        </p>
        <LegalTable
          ariaLabel="Almacenamiento que usa E-NORA IA en tu navegador"
          columns={[
            { key: "name", label: "Nombre" },
            { key: "kind", label: "Tipo" },
            { key: "purpose", label: "Para qué" },
            { key: "duration", label: "Duración" },
          ]}
          rows={STORAGE_ITEMS}
        />
      </LegalSection>

      <LegalSection title="La tienda de nuestros clientes es otra cosa">
        <p>
          En las tiendas Shopify de nuestros clientes que tienen activado el píxel de E-NORA se registra qué productos se
          visitan, con un identificador del visitante convertido en hash. Eso ocurre en la tienda, no en este sitio:
          el responsable es la tienda, que debe informar a sus visitantes en su propia política de cookies y recabar su
          consentimiento cuando corresponda. Nosotros solo tratamos esos datos como encargados, según nuestro{" "}
          <Link className="underline" href="/dpa">
            contrato de encargado del tratamiento
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cómo borrar o bloquear lo que guardamos">
        <p>
          Puedes borrarlo en cualquier momento desde los ajustes de tu navegador (en Chrome, Firefox, Safari y Edge, en
          la sección de privacidad, «Borrar datos de navegación» o «Datos de sitios»). Si lo bloqueas, la plataforma no
          podrá mantener tu sesión iniciada y tendrás que volver a identificarte en cada visita.
        </p>
      </LegalSection>

      <LegalSection title="Cambios y contacto">
        <p>
          Si en el futuro incorporáramos cookies que requieran consentimiento, actualizaremos esta política y te
          pediremos tu elección antes de instalarlas. Para cualquier duda, escríbenos a <MailLink />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
