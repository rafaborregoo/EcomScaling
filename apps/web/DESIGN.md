---
name: "E-NORA — escritorio de revisión"
description: "Sistema implementado de Dashboard/Inicio, Informes, Rentabilidad, Trabajo, Marketing, Comunicación y Analítica."
colors:
  primary: "#3d3b3a"
  primary-hover: "#292827"
  primary-soft: "#f0edeb"
  shopify-accent: "#3d3b3a"
  shopify-paper: "#f5f4f2"
  meta-accent: "#0866ff"
  meta-paper: "#e6effc"
  klaviyo-accent: "#232426"
  klaviyo-paper: "#efefef"
  graphite: "#3d3b3a"
  text-secondary: "#57534f"
  text-muted: "#6b6662"
  neutral-bg: "#f5f4f2"
  surface: "#ffffff"
  surface-secondary: "#f8f7f5"
  surface-sunken: "#efeeec"
  border: "#e2dfdc"
  divider: "#ebe8e4"
  chart-previous: "#a39f9a"
  success: "#3d3b3a"
  success-soft: "#f0edeb"
  warning: "#8b4c0d"
  warning-soft: "#fcf0df"
  danger: "#a72d43"
  danger-soft: "#fbe7ec"
  panel-success: "#3d3b3a"
  panel-success-soft: "#f0edeb"
  panel-success-bar: "#6b6662"
  panel-warning: "#8f4c07"
  panel-warning-soft: "#f9e6d3"
  panel-warning-bar: "#e0a030"
  panel-danger: "#b62a45"
  panel-danger-soft: "#f7dde1"
  panel-danger-bar: "#d9475f"
typography:
  headline:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  metric:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
rounded:
  compact: "6px"
  control: "8px"
  inset: "10px"
  panel: "12px"
  workspace: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  control: "12px"
  md: "16px"
  lg: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-graphite:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  navigation-link:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.compact}"
    padding: "6px 12px"
  navigation-link-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
  chip-neutral:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  card-operational:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.panel}"
    padding: "22px"
  field-operational:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.inset}"
    padding: "9px 11px"
---

# Design System: E-NORA — escritorio de revisión

## Overview

**Creative North Star: "Libro de revisión operativa"**

Una mesa sobria de lectura y decisión. La identidad del logo aparece en títulos, cifras relevantes y la serie principal; las superficies claras separan el resultado, el trabajo pendiente y la evidencia. El grafito concentra la selección y las acciones.

Este documento captura el sistema implementado en Dashboard/Inicio, Informes y Rentabilidad. Sus reglas se aplican a esas superficies y no declaran una migración de todo el SaaS. Inicio usa un wrapper de ruta; las extensiones autorizadas aplican la identidad mediante sus propios ámbitos. Informes reutiliza el catálogo HeroUI existente; los estilos de ese catálogo siguen siendo su fuente de verdad.

La extensión autorizada a Trabajo aplica la misma identidad a Mi camino (`/camino`), Mi negocio (`/contexto`), Agenda (`/planificacion/calendario`) y Tareas (`/tareas`). No introduce una nueva dirección visual. El wrapper `.trabajo-theme` adapta los tokens del catálogo en esas rutas para cliente y consultor; los overlays abiertos desde Trabajo heredan grafito y blanco mediante variables `--ov-*` en el body. Se conservan los permisos, los estados de negocio y las secciones propias de cada rol.

Marketing extiende esta identidad a sus once entradas: Hoy, Campañas, Flows, Plantillas, Audiencias, Rendimiento, Crear contenido, Revisión de piezas, Biblioteca de plantillas, Banco de imágenes y Guía de marca. Incluye los editores de campañas, flows y piezas del banco. La identidad de la interfaz permanece separada de la marca de cada tienda y del contenido creado.

Comunicación extiende la identidad existente a Chats, Llamadas y detalle, y Agenda del consultor. Analítica la extiende a Shopify, Productos y ficha, Promociones y ficha, Meta Ads, Campañas y ficha, Klaviyo, Emails y ficha. Conserva los tokens, IBM Plex Sans y el catálogo compartido; los logos identifican la fuente y los productos, anuncios y emails conservan su identidad de contenido.

**Key Characteristics:**

- Lectura ejecutiva con cifras comparables y alcance visible.
- IBM Plex Sans alojada en la aplicación y cifras tabulares.
- Fondos fríos, superficies blancas y bordes discretos.
- Estados escritos, controles nativos y evidencia junto al dato.

## Colors

La paleta separa identidad, interacción y estado; los valores normativos están en el frontmatter.

Las rampas OKLCH del sidecar son muestras interpoladas para el panel de documentación; no son tokens de producción ni sustituyen los valores hex extraídos.

### Primary

- **Grafito operativo** (`primary`): acciones destacadas, selección de segmentos, control de gráficos y foco. Su variante oscura (`primary-hover`) responde al hover; la suave (`primary-soft`) acompaña notas y selecciones.

### Secondary

Analítica conserva la identidad de cada aplicación: Shopify y Meta mantienen sus colores de proveedor, y Klaviyo mantiene el negro. Sus variantes locales `--ch-hover`, `--ch-soft` y `--ch-ink` sostienen hover, selección y lectura. Esta excepción incluye filtros, foco y serie principal; no altera IBM Plex Sans, el grafito de títulos y cifras, ni la geometría compartida. Comunicación mantiene el grafito operativo.

**The Identidad de canal Rule.** En Analítica, conservar la identificación de cada proveedor; las acciones comunes de producto usan grafito.

### Neutral

- **Grafito E-NORA** (`graphite`): títulos, cifras principales y serie de ventas. Corresponde al color del logo solicitado por el usuario.
- **Gris de lectura** (`text-secondary`) y **gris de contexto** (`text-muted`): detalle, procedencia, etiquetas y metadatos.
- **Papel frío** (`neutral-bg`): marco del espacio de trabajo. **Blanco** (`surface`): tarjetas y lectura principal. **Superficie secundaria** y **hundida**: grupos internos y pistas de escala.
- **Borde** y **divisor**: delimitación de paneles y filas. **Serie anterior**: comparación diferenciada también mediante trazo discontinuo.

Los tokens `success`, `warning` y `danger` representan los estados de Inicio, acompañados de texto. Rentabilidad conserva sus variantes `panel-*`, incluidas las barras de estado: no se sustituyen por la paleta de Inicio al extraer este sistema. Los colores de proveedor y las series auxiliares existentes siguen siendo contextuales, no un segundo acento de acción.

Trabajo reutiliza los colores de identidad del frontmatter mediante `--tw-*`: papel frío, panel blanco y grafito en títulos, cifras, acciones, selección y foco. Los estados positivos también usan grafito y texto explícito, sin verde de producto. La metadata sobre ilustraciones del modo Aventura de Camino lleva fondo blanco opaco para mantener la lectura del gris de contexto.

Marketing hereda esos tokens mediante el mismo wrapper y sus variables locales. Los colores de canal y las series de flows y campañas siguen siendo contextuales. Los colores de emails, imágenes y vistas previas de marca pertenecen al contenido: los títulos de esas vistas no reciben una imposición global de grafito.

**The Estado explícito Rule.** El color acompaña el estado escrito; un dato ausente nunca se presenta como un estado saludable.

## Typography

**Display Font:** IBM Plex Sans, con system-ui y sans-serif de respaldo.
**Body Font:** IBM Plex Sans. La carga self-hosted ya existe en el layout.

La misma familia sostiene títulos, explicación, IA y cifras. Se utiliza `font-variant-numeric: tabular-nums` para comparar importes sin introducir una segunda familia.

### Hierarchy

- **Headline:** cabeceras de Inicio e Informes. En Inicio móvil pasa a 24px; Rentabilidad usa el mismo tamaño de escritorio con interlineado propio de 1.16.
- **Title:** secciones operativas de Inicio y Rentabilidad; Inicio móvil pasa a 20px.
- **Body:** lectura general. El detalle explicativo puede usar interlineado de 1.6 y límites de 60–70ch según componente.
- **Label:** navegación y controles; los metadatos y tablas usan también 12px.
- **Metric:** KPI de Inicio; en móvil pasa a 23px. Rentabilidad conserva peso 500 para su KPI de 26px. Los contadores de Informes usan 22px y peso 600.

Trabajo usa `WorkPageHeader` con título de 28px y peso 600, reducido a 26px bajo 600px; su explicación usa 14px, interlineado 1.6 y máximo de 70ch. `HeroBlock` lleva título de 20px y `StatusStrip` cifras tabulares de 26px; sus valores textuales usan 14px y las pistas, 12px.

Marketing reutiliza esa cabecera en las vistas operativas; los editores conservan títulos locales más compactos. Los importes de la franja de Rendimiento usan 26px y pasan a 20px en móvil, sin partir la cifra ni el identificador de moneda. Las tipografías de emails, simulaciones de redes y fragmentos de código son propias de su contexto; no sustituyen a IBM Plex Sans en los controles.

## Layout

El contenido tiene un máximo de 96rem. Inicio se presenta sobre un marco con padding de 20px y separación de 32px; bajo 640px usa 10px y separación de 24px. Informes usa 24px, reducidos a 12px. Rentabilidad usa 18px y un marco independiente.

Las composiciones de dos columnas equilibran resultado y contexto con una relación 7:5. Las consultas de contenedor de Inicio reorganizan cabecera y paneles a 960px; a 680px compactan espacios y apilan acciones. Rentabilidad utiliza consultas propias a 960px y 680px, además de sus media queries existentes a 1180px y 640px. No se deduce el ancho útil únicamente del viewport: el portal tiene navegación lateral.

La navegación local de Inicio es sticky a 56px y puede desplazarse horizontalmente. Las tablas densas se desplazan dentro de regiones nombradas; no deben provocar desbordamiento de la página. La tabla de cartera de Rentabilidad conserva un mínimo de 1180px y cabecera de fila visible al desplazar.

En Trabajo, `StatusStrip` distribuye el estado en columnas de mínimo 150px; bajo 600px usa dos columnas y la última celda impar ocupa la fila completa. Mi negocio organiza rasgos en columnas adaptables de mínimo 300px, limitado al ancho disponible; bajo 640px apila fecha y pares de datos. Agenda conserva siete columnas con mínimo de 770px dentro de una región con desplazamiento horizontal y foco visible. Los títulos de sus eventos pueden ocupar varias líneas. Tareas permite que los filtros salten de línea y mantiene las filas dentro del ancho de página.

Marketing adapta filtros y tarjetas al ancho útil del portal. El calendario de Hoy desplaza dentro de una región nombrada y enfocable; el lienzo del constructor de flows conserva su desplazamiento propio. Los editores móviles alternan paneles sin comprimir todas las herramientas en una sola columna. El Banco de imágenes ocupa el ancho disponible cuando no hay ficha abierta y reserva su columna de detalle solo al seleccionarla.

## Elevation & Depth

La profundidad principal proviene de superficies y bordes, con paneles planos y selección por fondo. El catálogo compartido conserva sus tratamientos existentes. El tooltip del gráfico tiene una sombra contextual (`0 12px 32px -16px rgba(61, 59, 58, 0.4)`); no se promueve a sombra general de tarjetas.

Los botones de Inicio cambian color sin elevación por transform. Sus transiciones de fondo y borde duran 160ms con easing `ease`; las animaciones heredadas se desactivan dentro del wrapper de Inicio.

Las tarjetas de Trabajo son blancas, con borde y sin sombra; sus selecciones se distinguen por fondo gris suave y borde. El calendario marca el día actual con borde interior grafito. Estos tratamientos locales no redefinen la elevación del catálogo compartido.

## Shapes

Los paneles operativos usan esquinas de 12px; el marco exterior, 16px. Los controles principales usan 8px, los bloques internos y navegación, 10px, y los enlaces de navegación, 6px. Las chips conservan silueta de píldora. Informes conserva en sus componentes compartidos el radio del catálogo; estos radios locales no lo reemplazan.

Trabajo aplica el radio existente de 16px a sus tarjetas del catálogo, `HeroBlock` y `StatusStrip`. Agenda y filas de tareas usan 12px; los rasgos de Mi negocio conservan su radio local de 14px. Son aplicaciones locales, no una sustitución de la escala normativa.

## Components

### Buttons

Acciones claras con estado explícito. El botón grafito destaca una acción; el ghost aporta una alternativa con borde. En Inicio el mínimo general es 40px, con compactos de 36px; los botones generales y segmentos del contenedor móvil de 680px pasan a 44px. Los compactos conservan su regla específica y la navegación local conserva 36px. Rentabilidad usa botones de 40px y segmentos de 36px; Informes mantiene un mínimo local de 36px. No se afirma una altura universal de 44px.

El foco local usa outline de 3px con offset de 3px; los enlaces locales usan 2px hacia dentro. Los controles deshabilitados reducen opacidad y muestran cursor de indisponibilidad.

### Chips

Píldoras de 22px, con etiqueta breve y color semántico. Las selecciones de filtros son botones reales con `aria-pressed`; una chip de estado no sustituye a un control.

### Cards / Containers

Superficie blanca y borde fino con padding operativo de 22px, reducido a 18px en Inicio estrecho. Informes utiliza `Card` sobre HeroUI, con `headingLevel={2}` cuando es hijo del h1 de página; el valor por defecto del catálogo sigue siendo h3.

### Inputs / Fields

Campos del catálogo existente con etiqueta visible en Informes. El gráfico diario usa `input type="range"`, nombre accesible y salida textual de día e importe. No se sustituye por un control SVG exclusivamente de puntero.

### Navigation

Accesos locales contextuales a secciones existentes: tareas, resultado y evidencia. Enlaces con hover gris suave, foco visible y destino válido. El menú general del portal conserva su implementación compartida.

### Lectura de evidencia

En el cliente, el gráfico diario vive en un `details` nativo para que la primera lectura priorice resultado y siguiente acción. Las tablas incluyen cabeceras explícitas; la matriz de rentabilidad usa tabla nativa y cabeceras de fila. Los gráficos muestran moneda, escala, periodo y valores reales disponibles; la ausencia de datos permanece visible.

### Trabajo

`WorkPageHeader`, `StatusStrip` y `HeroBlock` componen la cabecera, estado y siguiente acción sin crear otro catálogo de controles. El bloque destacado usa padding de 24px, reducido a 18px bajo 600px; sus acciones usan grafito o blanco con borde, altura mínima de 40px y 44px en móvil, con foco visible de 2px y offset de 3px. Los filtros de Mi negocio y Tareas expresan selección con `aria-pressed`, fondo gris suave y borde grafito; su mínimo también pasa de 40px a 44px bajo 600px.

- **Mi camino:** conserva los modos IA, manual y plantilla y la distinción entre camino propuesto y activo; cambiar de modo no guarda datos. Formularios, paneles y mapa reutilizan la identidad común sin ocultar estados o avisos.
- **Mi negocio:** progreso grafito sobre superficie hundida; rasgos vacíos con borde discontinuo, discrepancias con aviso escrito y trayectoria con fechas y procedencia.
- **Agenda:** cabecera con fechas y acciones; región del calendario accesible por teclado, eventos con títulos completos y foco explícito. Los eventos tienen mínimo de 44px; añadir pasa de 36px a 44px bajo 600px.
- **Tareas:** siguiente acción, filtros seleccionables y filas con estados escritos; las vencidas conservan un matiz semántico suave y las completadas, superficie secundaria.

### Marketing

Las cabeceras de campaña, estudio, flows, banco y guía usan superficie blanca y borde; el espacio de trabajo conserva el papel frío. Los filtros operativos pasan de un mínimo de 40px a 44px en móvil. Los selectores móviles de panel del estudio y los controles compactos del constructor de flows tienen un mínimo de 44px; estas reglas locales no cambian las alturas del catálogo completo.

Rendimiento muestra moneda, periodo y atribución junto al dato. El porcentaje sobre Shopify se calcula únicamente cuando las monedas conocidas coinciden; Meta declara la ausencia de moneda en su respuesta. En la condición monetaria del constructor de flows se muestra «Moneda del evento»: el contrato del editor no informa su código y no permite asumir EUR. La biblioteca distingue carga, resultados y vacío; las previews de plantillas, piezas y marca conservan sus colores y fuentes de contenido.

### Comunicación y Analítica

`portal-shell.tsx` aplica `.communication-theme` junto a `.trabajo-theme` a Comunicación en ambos roles. Analítica usa `.analytics-theme` y `data-channel` para Shopify, Meta y Klaviyo y sus subrutas, sin `.trabajo-theme`: su herencia presenta un bloqueo conocido en Klaviyo. `globals.css` conserva en Analítica el papel y acento propios de cada canal mediante `--ch-*`, con grafito compartido en títulos y cifras, tarjetas blancas con borde y radio de 16px, sin sombra, y botones de 8px. Las cabeceras tienen borde neutro uniforme y no llevan franja superior de color ni sombra; selección, foco y serie principal usan el acento del canal. `dashboard/client-pulse.module.css` adapta el panel compartido dentro de Comunicación y Analítica; los componentes UI existentes siguen siendo la fuente de verdad para controles, tablas y estados. Bajo 640px se reorganizan las cabeceras de Analítica y los controles del panel pasan a 44px. El resumen compartido de Productos y Promociones usa una columna bajo 420px para mantener legibles importes y moneda.

La evidencia está en `.impeccable/review/comunicacion-analitica/`: capturas de cliente en escritorio y móvil de Chats, Llamadas y detalle, Shopify, Productos y ficha, Promociones, Meta, Campañas, Klaviyo y Emails; detalle de email en móvil. Agenda del consultor y detalles de campaña y promoción se revisaron solo por código. No se acredita aprobación visual de todos los roles, estados ni interacciones. La verificación comunicada incluye 43 pruebas unitarias, TypeScript y ESLint dirigido sin errores (ocho avisos preexistentes). No se ejecutaron build de producción, despliegue, envío de mensajes, sincronización, importación ni escrituras de agentes.

## Do's and Don'ts

### Do:

- **Do** usar grafito para identidad, cifras, selección y acción; reservar el color para los estados y marcas que aportan información propia.
- **Do** conservar etiquetas, unidades, atribución, frescura y estados incompletos junto a los datos.
- **Do** reutilizar el catálogo UI existente y aplicar este sistema dentro de las rutas documentadas.
- **Do** mantener foco visible, controles nativos y scroll de tablas dentro de regiones nombradas.
- **Do** extender la identidad de Inicio a las cuatro rutas autorizadas de Trabajo y sus overlays mediante los wrappers locales.
- **Do** aplicar la identidad común a las once entradas de Marketing y sus editores, conservando la marca y las fuentes de las vistas previas de contenido.

### Don't:

- **Don't** extender los wrappers fuera de las rutas autorizadas ni aplicar `.trabajo-theme` a Analítica.
- **Don't** declarar éxito o buena salud cuando la consulta o la tasa no están disponibles.
- **Don't** decorar la cifra con una unidad, escala o atribución distinta de su contrato real.
- **Don't** presentar las capturas de revisión como assets que se sirven al usuario.
