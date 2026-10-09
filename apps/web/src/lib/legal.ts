// Datos y listados compartidos por las paginas legales publicas (/legal y las
// que cuelgan de ella). Un solo sitio para el titular, la fecha y las tablas
// que cambian con el producto: al anadir un proveedor o un almacenamiento
// local nuevo se toca aqui y se actualizan /privacidad, /subencargados, /dpa
// y /cookies a la vez.

export const LEGAL_ENTITY = {
  brand: "E-NORA",
  name: "Rafael Manuel Borrego Reyes",
  taxId: "49832956Y",
  address: "Calle Argentea, 8, 29010 Málaga, España",
  email: "rafael@noraapp.es",
  site: "ecom.noraapp.es",
} as const;

// Subir al cambiar el texto de cualquier documento legal.
export const LEGAL_UPDATED = "7 de octubre de 2026";

export type LegalDoc = { href: string; title: string; description: string };

export const LEGAL_DOCS: LegalDoc[] = [
  {
    href: "/aviso-legal",
    title: "Aviso legal",
    description: "Quién es el titular del servicio y cómo contactarle.",
  },
  {
    href: "/politica-privacidad",
    title: "Política de privacidad",
    description: "Qué datos personales tratamos, para qué y cómo ejercer tus derechos.",
  },
  {
    href: "/condiciones",
    title: "Condiciones del servicio",
    description: "Qué incluye la plataforma, precios, cancelación y responsabilidades.",
  },
  {
    href: "/dpa",
    title: "Contrato de encargado del tratamiento",
    description: "Cómo tratamos los datos de tu tienda y de tus clientes finales por tu cuenta.",
  },
  {
    href: "/subencargados",
    title: "Subencargados del tratamiento",
    description: "Proveedores que intervienen en el tratamiento, con su función y ubicación.",
  },
  {
    href: "/cookies",
    title: "Política de cookies",
    description: "Qué almacenamos en tu navegador y por qué.",
  },
  {
    href: "/eliminacion-de-datos",
    title: "Eliminación de datos",
    description: "Cómo pedir el borrado de tu cuenta y de los datos conectados.",
  },
];

export type Subprocessor = {
  id: string;
  name: string;
  purpose: string;
  data: string;
  location: string;
  safeguard: string;
};

export const SUBPROCESSORS: Subprocessor[] = [
  {
    id: "supabase",
    name: "Supabase",
    purpose: "Base de datos, autenticación, almacenamiento de archivos y copias de seguridad",
    data: "Todos los datos de la cuenta y de las tiendas conectadas",
    location: "Unión Europea",
    safeguard: "Tratamiento dentro del EEE",
  },
  {
    id: "ionos",
    name: "IONOS",
    purpose: "Servidores en los que se ejecutan la aplicación, la API y los procesos en segundo plano",
    data: "Los necesarios para ejecutar el servicio (en tránsito y en memoria)",
    location: "Unión Europea",
    safeguard: "Tratamiento dentro del EEE",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    purpose: "Modelo de lenguaje que genera diagnósticos, recomendaciones y borradores",
    data: "Métricas agregadas del negocio y textos de trabajo; nunca listados de clientes finales ni su identificador",
    location: "Estados Unidos",
    safeguard: "Cláusulas contractuales tipo de la Comisión Europea; sin uso de los datos para entrenar modelos",
  },
  {
    id: "openai",
    name: "OpenAI",
    purpose: "Modelo de lenguaje alternativo para los mismos fines",
    data: "Las mismas que en el caso anterior",
    location: "Estados Unidos",
    safeguard: "Cláusulas contractuales tipo de la Comisión Europea; sin uso de los datos para entrenar modelos",
  },
  {
    id: "stripe",
    name: "Stripe",
    purpose: "Cobro de las suscripciones y emisión de facturas",
    data: "Datos de facturación y de pago del titular de la cuenta (los de la tarjeta los recoge Stripe directamente)",
    location: "Unión Europea y Estados Unidos",
    safeguard: "Cláusulas contractuales tipo / Marco de Privacidad de Datos UE-EE. UU.",
  },
  {
    id: "brevo",
    name: "Brevo",
    purpose: "Envío de correos transaccionales: invitaciones, recuperación de contraseña y facturas",
    data: "Nombre y correo electrónico del destinatario y el contenido del correo",
    location: "Unión Europea",
    safeguard: "Tratamiento dentro del EEE",
  },
];

export type StorageItem = {
  id: string;
  name: string;
  kind: string;
  purpose: string;
  duration: string;
};

// Lo que la aplicacion guarda en el navegador. No hay cookies de analitica,
// publicidad ni de terceros: todo es tecnico o de preferencias pedidas por el
// propio usuario (art. 22.2 LSSI), asi que no requiere banner de consentimiento.
export const STORAGE_ITEMS: StorageItem[] = [
  {
    id: "auth",
    name: "sb-…-auth-token",
    kind: "Almacenamiento local · propia (Supabase)",
    purpose: "Mantener tu sesión iniciada",
    duration: "Hasta que cierres sesión o caduque la sesión",
  },
  {
    id: "org",
    name: "ecomscaling.activeOrganizationId",
    kind: "Almacenamiento local · propia",
    purpose: "Recordar la organización con la que estás trabajando",
    duration: "Hasta que lo borres",
  },
  {
    id: "connection",
    name: "ecomscaling.activeConnectionByOrg",
    kind: "Almacenamiento local · propia",
    purpose: "Recordar la tienda activa de cada organización",
    duration: "Hasta que lo borres",
  },
  {
    id: "nav",
    name: "ecomscaling:primary-nav-mode",
    kind: "Almacenamiento local · propia",
    purpose: "Recordar el modo de menú que prefieres",
    duration: "Hasta que lo borres",
  },
  {
    id: "camino",
    name: "camino-map-style",
    kind: "Almacenamiento local · propia",
    purpose: "Recordar el estilo del mapa de Mi camino",
    duration: "Hasta que lo borres",
  },
  {
    id: "drafts",
    name: "e-nora:weekly-mailing-sequence:…",
    kind: "Almacenamiento local · propia",
    purpose: "Conservar un borrador de la secuencia semanal de emails que no has enviado",
    duration: "Hasta que lo borres",
  },
  {
    id: "session",
    name: "Estado temporal de pantallas",
    kind: "Almacenamiento de sesión · propia",
    purpose: "Conservar borradores y vistas previas mientras navegas",
    duration: "Hasta que cierres la pestaña",
  },
];
