import type { Metadata } from "next";
import { Link } from "@/components/ui";
import { LegalPage, LegalSection, LegalTable, MailLink } from "@/components/legal-page";
import { SUBPROCESSORS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Subencargados del tratamiento — E-NORA IA",
  description:
    "Proveedores que tratan datos personales por cuenta de E-NORA IA: qué hacen, qué datos reciben, dónde y con qué garantías.",
};

export default function SubprocessorsPage() {
  return (
    <LegalPage
      title="Subencargados del tratamiento"
      current="/subencargados"
      intro="Lista de proveedores a los que E-NORA encarga parte del tratamiento, a la que remite el contrato de encargado del tratamiento."
    >
      <LegalSection title="Proveedores actuales">
        <LegalTable
          ariaLabel="Subencargados del tratamiento"
          columns={[
            { key: "name", label: "Proveedor" },
            { key: "purpose", label: "Función" },
            { key: "data", label: "Datos" },
            { key: "location", label: "Ubicación" },
            { key: "safeguard", label: "Garantía" },
          ]}
          rows={SUBPROCESSORS}
        />
        <p>
          Todos tratan los datos bajo un contrato escrito con obligaciones de protección equivalentes a las del{" "}
          <Link className="underline" href="/dpa">
            contrato de encargado del tratamiento
          </Link>
          . Los proveedores de modelos de lenguaje tienen prohibido usar los datos para entrenar sus modelos.
        </p>
      </LegalSection>

      <LegalSection title="Lo que no son subencargados">
        <p>
          Shopify, Meta y Klaviyo no tratan datos por cuenta nuestra: son las plataformas de las que el cliente nos
          autoriza a leer sus datos y cada una es responsable de los suyos con arreglo a sus propias condiciones.
        </p>
      </LegalSection>

      <LegalSection title="Cambios en la lista">
        <p>
          Si incorporamos o sustituimos un proveedor, actualizaremos esta página y lo notificaremos por correo al
          contacto de la cuenta. Puedes oponerte a un cambio por motivos razonables de protección de datos en los 15
          días siguientes a la notificación escribiendo a <MailLink />; si no hay una solución, podrás cancelar el
          servicio.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
