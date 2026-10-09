import type { Metadata } from "next";
import { Link } from "@/components/ui";
import { LegalPage, LegalSection, MailLink } from "@/components/legal-page";
import { LEGAL_DOCS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Centro legal — E-NORA IA",
  description:
    "Todos los documentos legales de E-NORA IA en un solo sitio: aviso legal, privacidad, condiciones, encargado del tratamiento, subencargados, cookies y eliminación de datos.",
};

export default function LegalCenterPage() {
  return (
    <LegalPage
      title="Centro legal"
      current="/legal"
      intro="Los documentos que regulan el uso de E-NORA IA y el tratamiento de tus datos, siempre en su última versión."
    >
      <LegalSection title="Documentos">
        <ul className="divide-y divide-edge">
          {LEGAL_DOCS.map((doc) => (
            <li key={doc.href} className="py-3 first:pt-0 last:pb-0">
              <Link className="font-medium underline" href={doc.href}>
                {doc.title}
              </Link>
              <p className="text-muted">{doc.description}</p>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="¿Algo que no encuentras?">
        <p>
          Si necesitas un documento que no está aquí, como un ejemplar firmado del contrato de encargado del tratamiento,
          escríbenos a <MailLink />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
