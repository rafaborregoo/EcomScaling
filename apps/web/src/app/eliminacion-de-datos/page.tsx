import type { Metadata } from "next";
import { Link, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { LegalPage } from "@/components/legal-page";

// URL publica que Meta exige al registrar la app ("Eliminación de datos de
// usuario": o una callback o unas instrucciones). Esta es la pagina de
// instrucciones. Como /politica-privacidad y /condiciones, no cuelga de ningun
// menu: existe para ser enlazada desde fuera.

export const metadata: Metadata = {
  title: "Eliminación de datos — E-NORA IA",
  description:
    "Cómo solicitar la eliminación de tus datos en E-NORA IA: qué se borra, en cuánto tiempo y cómo pedirlo.",
};

const CONTACT_EMAIL = "rafael@noraapp.es";

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Eliminación de datos"
      current="/eliminacion-de-datos"
      updated="14 de septiembre de 2026"
    >

      <Card>
        <CardHeader>
          <CardTitle>Qué puedes pedir</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Puedes pedir en cualquier momento que eliminemos los datos asociados a
            tu cuenta de E-NORA IA y a las plataformas que hayas conectado
            (Shopify, Meta Ads y Klaviyo). No hace falta justificar el motivo y no
            tiene coste.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo pedirlo</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Hay dos formas, y puedes usar cualquiera de ellas:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Desde la plataforma.</strong> Entra en la sección{" "}
              <span className="font-medium">Integraciones</span>, abre la tienda y
              desconecta o elimina la integración que quieras. En Meta y Klaviyo
              retiramos además el permiso en su plataforma cuando es posible, y
              en todas dejamos de sincronizar datos nuevos de esa cuenta. En
              Shopify, la app sigue instalada en tu tienda hasta que la
              desinstales desde el panel de Shopify. Para eliminar la cuenta
              entera, ve a Configuración › Privacidad.
            </li>
            <li>
              <strong>Por correo.</strong> Escribe a{" "}
              <Link className="underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </Link>{" "}
              con el asunto <strong>«Eliminación de datos»</strong> e indica el
              correo electrónico con el que accedes y, si procede, el dominio de
              la tienda o la cuenta publicitaria afectada. Confirmamos la
              recepción y te avisamos por correo cuando el borrado esté hecho.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué se elimina</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Los tokens y credenciales de acceso a Shopify, Meta Ads y Klaviyo
              guardados en E-NORA. En Meta y Klaviyo también retiramos el
              permiso en su plataforma, salvo que no sea posible (por ejemplo,
              una clave privada de Klaviyo, que se borra desde Klaviyo, o un
              usuario de Facebook que usas en otra conexión). En Shopify,
              desinstala la app desde tu panel de Shopify para retirar el
              permiso allí.
            </li>
            <li>
              Los datos importados de esas plataformas: pedidos, productos,
              inventario, campañas, anuncios, métricas y listas.
            </li>
            <li>
              El contenido generado dentro del producto para esa cuenta: notas,
              tareas, diagnósticos, resúmenes de llamadas y documentos subidos.
            </li>
            <li>Los datos de la propia cuenta de usuario y su pertenencia a la organización.</li>
          </ul>
          <p>
            De los clientes finales de la tienda solo guardamos un identificador de
            referencia con hash y métricas asociadas —nunca nombre, correo,
            teléfono ni dirección—, y se eliminan junto con la tienda. El detalle
            está en la{" "}
            <Link className="underline" href="/politica-privacidad">
              política de privacidad
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>En cuánto tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Al desconectar una tienda o dar de baja una cuenta, los datos quedan
            marcados para borrado y se eliminan definitivamente a los{" "}
            <strong>30 días</strong>. Ese plazo es un periodo de gracia para poder
            deshacer una desconexión accidental.
          </p>
          <p>
            Si prefieres el <strong>borrado inmediato</strong>, usa «Eliminar ya» en
            la plataforma o dilo en el correo, y lo hacemos sin esperar esos 30
            días.
          </p>
          <p>
            Podemos conservar durante más tiempo lo que la ley nos obliga a
            guardar, como los registros de facturación. Eso no incluye datos de tu
            tienda ni de tus campañas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revocar el acceso desde Facebook</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Si conectaste Meta Ads, también puedes retirarle el acceso a la
            aplicación directamente desde tu cuenta de Facebook, en{" "}
            <span className="font-medium">
              Configuración y privacidad → Configuración → Aplicaciones y sitios
              web
            </span>
            , eliminando «E-NORA IA». A partir de ese momento dejamos de
            poder leer datos de tu cuenta publicitaria.
          </p>
          <p>
            Eso corta el acceso, pero no borra por sí solo lo ya importado: para
            eso, pídenos la eliminación por correo como se explica arriba.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Para cualquier duda sobre este proceso, escríbenos a{" "}
            <Link className="underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </LegalPage>
  );
}
