import type { Metadata } from "next";
import { Link } from "@/components/ui";
import { LegalPage, LegalSection, LegalTable, MailLink } from "@/components/legal-page";
import { LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad — E-NORA IA",
  description:
    "Política de privacidad de E-NORA IA: qué datos tratamos, con qué base legal y finalidad, cuánto tiempo los conservamos y cómo ejercer tus derechos.",
};

const PURPOSES = [
  {
    id: "service",
    purpose: "Crear y gestionar tu cuenta y prestarte el servicio contratado",
    basis: "Ejecución del contrato (art. 6.1.b RGPD)",
    retention: "Mientras la cuenta esté activa y 30 días después de la baja",
  },
  {
    id: "ai",
    purpose: "Mostrar métricas de tu tienda y generar diagnósticos, recomendaciones y tareas con inteligencia artificial",
    basis: "Ejecución del contrato (art. 6.1.b RGPD)",
    retention: "Mientras la cuenta esté activa y 30 días después de la baja",
  },
  {
    id: "billing",
    purpose: "Cobrar la suscripción, emitir facturas y cumplir obligaciones fiscales y contables",
    basis: "Ejecución del contrato y obligación legal (art. 6.1.b y 6.1.c RGPD)",
    retention: "Los plazos que fije la normativa fiscal y mercantil",
  },
  {
    id: "support",
    purpose: "Atender consultas, enviar avisos del servicio y notificar cambios relevantes",
    basis: "Ejecución del contrato e interés legítimo (art. 6.1.b y 6.1.f RGPD)",
    retention: "Mientras sea necesario para atender la consulta",
  },
  {
    id: "security",
    purpose: "Garantizar la seguridad, detectar accesos indebidos y prevenir abusos",
    basis: "Interés legítimo en proteger el servicio (art. 6.1.f RGPD)",
    retention: "El tiempo necesario para esa finalidad",
  },
  {
    id: "referral",
    purpose: "Permitir que un consultor asociado a un código de referido contacte contigo, si lo has marcado al registrarte",
    basis: "Consentimiento (art. 6.1.a RGPD), que puedes retirar cuando quieras",
    retention: "Hasta que retires el consentimiento",
  },
  {
    id: "improvement",
    purpose: "Mejorar el servicio con estadísticas de uso agregadas, sin identificarte",
    basis: "Interés legítimo (art. 6.1.f RGPD)",
    retention: "Los datos agregados no permiten identificarte",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      current="/politica-privacidad"
      intro="Aquí te explicamos, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD), qué hacemos con tus datos personales."
    >
      <LegalSection title="Responsable del tratamiento">
        <p>
          {LEGAL_ENTITY.brand} es una marca comercial de {LEGAL_ENTITY.name} (NIF {LEGAL_ENTITY.taxId}), con domicilio
          en {LEGAL_ENTITY.address}. Puedes escribirnos a <MailLink />.
        </p>
        <p>No hemos designado un delegado de protección de datos porque la normativa no lo exige en nuestro caso.</p>
      </LegalSection>

      <LegalSection title="Dos papeles distintos">
        <p>
          E-NORA IA es una plataforma de consultoría para tiendas de e-commerce que centraliza métricas y automatiza
          tareas operativas, integrando datos de Shopify, Meta Ads y Klaviyo. Según el dato, actuamos de una forma u otra:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Responsables</strong> de los datos de las personas que usan la plataforma (cuenta, facturación,
            comunicaciones). A ellos se dirige esta política.
          </li>
          <li>
            <strong>Encargados del tratamiento</strong> de los datos de la tienda que el cliente conecta, incluidos los
            de sus clientes finales. El responsable de esos datos es la tienda; los tratamos solo por su cuenta y
            siguiendo sus instrucciones, según el{" "}
            <Link className="underline" href="/dpa">
              contrato de encargado del tratamiento
            </Link>
            . Si eres cliente de una tienda y quieres ejercer tus derechos, dirígete primero a ella.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Qué datos tratamos y de dónde vienen">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Datos de la cuenta</strong>, que nos das tú o el equipo de consultoría al crearla: nombre, correo
            electrónico, rol en la organización y contraseña (que guardamos cifrada, nunca en claro).
          </li>
          <li>
            <strong>Datos de facturación</strong>: razón social o nombre, dirección fiscal, NIF y los datos de pago, que
            recoge directamente Stripe; nosotros no vemos el número de tu tarjeta.
          </li>
          <li>
            <strong>Datos de negocio conectados por el cliente</strong>: métricas y datos de campañas de Meta Ads,
            pedidos, productos y costes de Shopify, y métricas de campañas y flujos de Klaviyo, cuando se conectan esas
            integraciones.
          </li>
          <li>
            <strong>Contenido que se genera al usar el producto</strong>: notas, tareas, mensajes con el consultor,
            resúmenes y transcripciones de llamadas de consultoría y documentos que se suben a la plataforma.
          </li>
          <li>
            <strong>Datos técnicos</strong>: dirección IP, tipo de navegador y registros de actividad, que usamos para
            la seguridad del servicio.
          </li>
        </ul>
        <p>
          De los <strong>clientes finales</strong> de la tienda tratamos únicamente un identificador de referencia con
          hash, su número de pedidos, el importe gastado, la moneda, el estado y las etiquetas, y sus estados de
          consentimiento de marketing (email y SMS). No tratamos su nombre, correo electrónico, teléfono, dirección
          postal ni ubicación, y los pedidos y checkouts que almacenamos tampoco incluyen email ni dirección de envío.
        </p>
        <p>
          No pedimos ni tratamos categorías especiales de datos (salud, ideología, origen u otras del artículo 9 RGPD).
          Si las incluyes en un texto libre, te pedimos que no lo hagas.
        </p>
      </LegalSection>

      <LegalSection title="Para qué los usamos, con qué base legal y cuánto tiempo">
        <LegalTable
          ariaLabel="Finalidades, base legal y conservación"
          columns={[
            { key: "purpose", label: "Finalidad" },
            { key: "basis", label: "Base legal" },
            { key: "retention", label: "Conservación" },
          ]}
          rows={PURPOSES}
        />
        <p>
          No vendemos datos personales ni los compartimos con terceros con fines publicitarios, y no usamos tus datos
          ni los de tu tienda para entrenar modelos de inteligencia artificial.
        </p>
      </LegalSection>

      <LegalSection title="Inteligencia artificial">
        <p>
          Los diagnósticos, recomendaciones y borradores se generan con modelos de lenguaje de terceros (ver
          subencargados). Les enviamos métricas agregadas del negocio y los textos de trabajo necesarios, nunca
          listados de clientes finales ni su identificador de referencia, y con contratos que les impiden usarlos para
          entrenar sus modelos.
        </p>
        <p>
          La plataforma no toma decisiones que produzcan efectos jurídicos sobre ti ni te afecten de modo similar
          (art. 22 RGPD). Lo que genera la IA es apoyo a la decisión: una persona lo revisa y decide antes de que se
          ejecute cualquier cambio en una tienda o en una cuenta publicitaria.
        </p>
      </LegalSection>

      <LegalSection title="Con quién compartimos los datos">
        <p>
          Nos apoyamos en proveedores que tratan datos por cuenta nuestra (alojamiento, base de datos, modelos de
          lenguaje, cobros y envío de correo). Los tienes, con su función y ubicación, en{" "}
          <Link className="underline" href="/subencargados">
            subencargados del tratamiento
          </Link>
          .
        </p>
        <p>
          Los datos de cada organización solo los ven su propio equipo y los consultores asignados a su cuenta. Podemos
          comunicar datos a las administraciones y a los jueces y tribunales cuando una ley nos obligue.
        </p>
      </LegalSection>

      <LegalSection title="Transferencias fuera del Espacio Económico Europeo">
        <p>
          La base de datos y los servidores están en la Unión Europea. Algunos proveedores de modelos de lenguaje y de
          cobros operan en Estados Unidos: en esos casos la transferencia se ampara en las cláusulas contractuales tipo
          de la Comisión Europea o en el Marco de Privacidad de Datos UE-EE. UU., según el proveedor. Puedes pedirnos
          una copia de las garantías aplicables escribiendo a <MailLink />.
        </p>
      </LegalSection>

      <LegalSection title="Conservación y eliminación">
        <p>
          Conservamos los datos mientras la cuenta esté activa. Al desconectar una tienda o dar de baja una cuenta, los
          datos quedan marcados para borrado y se eliminan definitivamente a los <strong>30 días</strong>. Ese plazo es
          un periodo de gracia para poder deshacer una desconexión accidental; si prefieres el borrado inmediato,
          pídelo y lo hacemos. Las copias de seguridad se renuevan de forma periódica, de modo que los datos
          desaparecen también de ellas en el ciclo siguiente.
        </p>
        <p>
          Lo que la ley nos obliga a guardar, como las facturas, se conserva bloqueado durante los plazos legales y se
          elimina después. Más detalle en{" "}
          <Link className="underline" href="/eliminacion-de-datos">
            eliminación de datos
          </Link>
          .
        </p>
        <p>
          Si desconectas la integración con Meta desde el panel de integraciones, retiramos el permiso en Meta (salvo que
          el mismo usuario de Facebook lo use en otra conexión tuya) y dejamos de sincronizar datos nuevos de esa cuenta
          publicitaria.
        </p>
      </LegalSection>

      <LegalSection title="Tus derechos">
        <p>
          Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y
          portabilidad, y retirar tu consentimiento en cualquier momento (sin que eso afecte a lo hecho antes),
          escribiendo a <MailLink />. Para identificarte, podemos pedirte que lo hagas desde el correo de tu cuenta.
          Respondemos en un mes como máximo.
        </p>
        <p>
          Si eres titular de una cuenta, también puedes descargar tus datos desde Configuración. Si crees que no hemos
          tratado tus datos conforme a la ley, puedes presentar una reclamación ante la Agencia Española de Protección
          de Datos (
          <Link className="underline" href="https://www.aepd.es" target="_blank" rel="noreferrer">
            www.aepd.es
          </Link>
          ), aunque te agradeceremos que nos des antes la oportunidad de resolverlo.
        </p>
      </LegalSection>

      <LegalSection title="Seguridad">
        <p>
          El acceso a los datos de cada organización está restringido por control de acceso multi-tenant: solo el propio
          cliente y los consultores asignados a su cuenta pueden verlos. Los datos se almacenan en una base de datos con
          controles de acceso a nivel de fila (Row Level Security), cifrado en tránsito y seudonimización de los
          identificadores de clientes finales.
        </p>
        <p>
          Si se produjera una brecha de seguridad que afecte a tus datos, la notificaremos a la autoridad de control y a
          las personas afectadas en los casos y plazos que exige el RGPD.
        </p>
      </LegalSection>

      <LegalSection title="Menores">
        <p>El servicio está dirigido a empresas y profesionales y no se ofrece a menores de 18 años.</p>
      </LegalSection>

      <LegalSection title="Cookies y almacenamiento en tu navegador">
        <p>
          No usamos cookies de analítica ni de publicidad. Lo que guardamos en tu navegador está explicado en la{" "}
          <Link className="underline" href="/cookies">
            política de cookies
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cambios en esta política y contacto">
        <p>
          Si cambiamos esta política de forma relevante, lo comunicaremos por correo o dentro de la plataforma con
          antelación razonable. Para cualquier duda sobre ella o sobre el tratamiento de tus datos, escríbenos a{" "}
          <MailLink />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
