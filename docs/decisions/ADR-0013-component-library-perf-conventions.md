# ADR-0013: Componentes separados por archivo, sin sombras/adornos, paginación con memoria de posición, y disciplina de carga de datos

- **Fecha:** 2026-07-23
- **Estado:** Aprobada. **Parcialmente sustituida** el mismo día por
  [`ADR-0015-heroui-design-system.md`](ADR-0015-heroui-design-system.md): `packages/ui` (la sección 1,
  "un componente, un archivo") ya no existe, reemplazado por `apps/web/src/components/ui/` sobre HeroUI
  v3. Las secciones 3, 4 y 5 (títulos discretos, paginación con memoria de posición vía URL, disciplina
  de carga de datos) siguen vigentes sin cambios.
- **Relacionada:** [`FE-00-shell-design-system.md`](../../roadmap/roadmaps/03-frontend-ux/fases/FE-00-shell-design-system.md) (filosofía visual "Libro Mayor" v2, que esta decisión refuerza y corrige en dos puntos concretos), [`ADR-0010-global-client-store-context.md`](ADR-0010-global-client-store-context.md) (mismo patrón de URL-como-fuente-de-verdad que se reutiliza aquí para paginación)

## Contexto

Petición directa de Rafa: los componentes de `packages/ui` deben separarse en archivos individuales (hoy
viven todos en un único `index.tsx` de 600+ líneas), reforzar el lenguaje visual existente (blanco
dominante, sin sombras, sin colores fuera de la paleta, títulos discretos que no repitan lo obvio), que la
paginación recuerde dónde estaba el usuario al volver, y que el rendimiento percibido sea una prioridad
explícita — no traer datos que no aportan, o traerlos en segundo plano sin bloquear lo que sí importa.

Auditando el código antes de escribir esta decisión encontré que el sistema **ya cumple casi todo esto**
(ver `FE-00-shell-design-system.md`, auditoría 2026-07-22: esquinas rectas, una sola fuente, subtítulos
solo cuando evitan un error) — pero sobrevivieron dos violaciones puntuales de la propia filosofía
declarada, y la paginación existente (`usePaginated`, estado en memoria) pierde la posición del usuario en
cuanto navega fuera de la página, que es exactamente el problema que Rafa reporta.

## Decisiones

### 1. Un componente, un archivo

`packages/ui/src/index.tsx` se divide en `packages/ui/src/components/<nombre-kebab>.tsx`, uno por
componente exportado (`Button`, `Card`, `Stat`, `Badge`, `Banner`, `Field`/`Input`/`Select`/`Textarea`,
`LoadingBlock`/`ErrorBlock`/`EmptyState`, `SyncStateBadge`, `Tabs`, `Pagination`, `Combobox`), más
`cn.ts` para el helper de clases. `index.tsx` queda como barrel (`export * from "./components/..."`) —
**el import público no cambia** (`@e-nora/ui` sigue exponiendo lo mismo), así que no rompe ningún
consumidor existente. Objetivo: que cada componente se pueda leer, tocar y probar de forma aislada, sin
desplazarse por un archivo de 600 líneas para editar uno solo.

### 2. Cero sombras, cero color fuera de paleta — cerrar las dos excepciones reales encontradas

La filosofía "Libro Mayor" v2 ya prohíbe sombras y esquinas redondeadas salvo puntos de estado
(`rounded-full`). Sobrevivieron dos violaciones puntuales, corregidas en esta decisión:

- **`Combobox`**: el panel desplegado tenía `shadow-[4px_4px_0_0_rgba(0,0,0,1)]` (sombra dura tipo
  "offset", no una sombra difusa, pero sigue siendo una sombra) — eliminada. La separación visual del
  panel respecto al fondo la da el borde (`border border-ink`) y el fondo blanco sólido, no una sombra.
- **`Pagination`**: los números de página usaban `rounded-sm` en el estado activo — corregido a esquina
  recta, coherente con el resto del sistema (el 28-usos-corregidos de la auditoría 2026-07-22 no llegó a
  este componente).

No se introduce ningún color nuevo — la paleta sigue siendo blanco/negro/rojo de marca (`brand`) como
único acento, ya establecida.

### 3. Títulos discretos, no títulos de sección redundantes

Regla explícita (no solo implícita en "sin subtítulos decorativos"): **el título de una página no debe
repetir lo que la navegación ya deja claro**. Si el usuario está en `/tareas`, un `<h1>` grande que diga
"TAREAS" no aporta nada — el propio shell (nav activa, breadcrumb, URL) ya lo comunica. Donde haga falta
un título de página (por accesibilidad — un lector de pantalla necesita un `<h1>` para orientarse, y por
convención de que la pestaña/URL tenga contexto), debe ser **pequeño, mono, en mayúsculas discretas**
(mismo lenguaje que el `kicker` de `Card`: `font-mono text-[0.65rem] uppercase tracking-[0.14em]
text-muted`), nunca un titular grande tipo `font-display text-3xl`. Esa jerarquía tipográfica pesada se
reserva para contenido real (una cifra, un nombre de cliente, un título de documento) — no para redecir el
nombre de la sección.

Esto no crea un componente nuevo obligatorio — es una regla de uso de `Card`/`Badge`/texto plano que ya
existen, aplicada de forma consistente. Páginas que hoy tengan un `<h1 className="font-display text-3xl">`
con el nombre plano de la sección deben migrar a este patrón cuando se toquen por otro motivo — no se hace
una pasada masiva solo para esto en esta decisión (no es el foco, y tocar 20 páginas solo por esto no es
proporcional).

### 4. Paginación con memoria de posición: la URL es la fuente de verdad, igual que cliente/tienda activos

`usePaginated` (estado en memoria, `useState`) se sustituye por `usePaginatedUrl`
(`apps/web/src/hooks/use-paginated-url.ts`) para toda lista paginada nueva o tocada — mismo patrón ya
aprobado en ADR-0010 para cliente/tienda activos: la página actual vive en el query string
(`?page=3`, o `?page_productos=2&page_pedidos=1` cuando una misma pantalla tiene varias listas
independientes, ver `shopify/diagnostico`), se actualiza con `router.replace(..., { scroll: false })` para
no ensuciar el historial con una entrada por cada clic de paginación, y **se preserva al navegar fuera y
volver** porque la URL que el navegador recuerda ya la incluye. `page=1` nunca aparece en la URL (es el
default implícito), para no ensuciar enlaces compartidos con parámetros redundantes.

`usePaginated` (memoria) no se elimina — sigue siendo válido para listas que se pintan y descartan sin que
volver a ellas importe (p. ej. un resultado de búsqueda efímero dentro de un modal). La regla es: **si el
usuario puede navegar fuera de la lista y volver a ella esperando seguir donde estaba, usa
`usePaginatedUrl`; si no, `usePaginated` en memoria sigue siendo más simple y correcto.**

### 5. Disciplina de carga de datos: no traer lo que no se ve, y lo que no bloquea la vista no debe bloquear la carga

Regla explícita para nuevas pantallas y refactors de las existentes:

- **No pedir datos que la vista actual no va a mostrar.** Si una pestaña/tab no está activa, sus datos no
  se piden hasta que el usuario la abra (carga perezosa por pestaña), salvo que el coste de pedirla ya esté
  amortizado en la misma llamada que trae lo que sí se ve (no crear una llamada extra solo para separar
  artificialmente lo que ya viene junto).
- **Lo secundario no bloquea lo primario.** Si una sección de la pantalla es claramente secundaria respecto
  al contenido principal (un widget lateral, una métrica de contexto, no el dato que el usuario vino a
  buscar), su fetch no debe compartir el mismo estado de carga que bloquea el contenido principal — el
  contenido principal se pinta en cuanto está listo, lo secundario aparece cuando llega, con su propio
  `LoadingBlock` local si hace falta, nunca tapando toda la pantalla con un único spinner que depende del
  dato más lento.
- **Preferir lo que ya existe sobre pedir de más.** Antes de añadir un fetch nuevo, revisar si el dato ya
  viene en una respuesta existente de la misma pantalla (patrón ya establecido: `getShopifyConnections` se
  creó específicamente porque pedir el overview completo — ~20 queries de conteo — solo para poblar un
  selector de tienda era desproporcionado, ver `apps/api/src/shopify-overview.ts`). Esa misma pregunta
  ("¿hace falta todo esto para lo que se va a mostrar?") se aplica a cualquier pantalla nueva.

No se define aquí una métrica de presupuesto de rendimiento formal (p. ej. "TTI < Xms") — es una regla de
diseño de cada pantalla, no un gate automatizado todavía. Si en el futuro hace falta ese gate, es una
decisión aparte (candidata natural: Core Web Vitals reales en producción, cuando haya tráfico real que
medir).

## Consecuencias

- Los imports públicos de `@e-nora/ui` no cambian — este refactor es interno al paquete.
- Páginas que ya usan `usePaginated` (`tareas/page.tsx`, `shopify/diagnostico/page.tsx`) migran a
  `usePaginatedUrl` como parte de esta misma decisión (no queda como deuda pendiente).
- Páginas nuevas que necesiten paginación deben usar `usePaginatedUrl` por defecto; usar la variante en
  memoria es la excepción que hay que poder justificar (efímera, sin necesidad de volver a la posición).
- La regla de "títulos discretos" y "disciplina de carga de datos" son convenciones de diseño para
  aplicar en cada pantalla que se toque, no una migración masiva de todo el código existente en este mismo
  cambio.
