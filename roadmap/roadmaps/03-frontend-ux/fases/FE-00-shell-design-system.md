# FE-00 - Shell y design system

## Estado

- **Estado real:** `current` — **reescrito 2026-07-22** para describir el sistema v2 real en vez de la
  version historica v1. El design system original de esta fase fue reemplazado por el rediseno "Libro
  Mayor" v2 (ver `CHANGELOG-UX.md` para el historial cronologico de esa transicion); este documento ya no
  lo mantiene como si describiera un sistema vigente.
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** ninguna
- **Bloqueador:** ninguno
- **Evidencia:** `apps/web/src/components/portal-shell.tsx` (shell actual, con mini barra de contexto,
  navegacion por rol, cache de bootstrap en memoria anadida esta semana); `packages/ui/src/index.tsx`
  (Button, Card, Badge, Banner, Field/Input/Select/Textarea, LoadingBlock/ErrorBlock/EmptyState,
  SyncStateBadge, Tabs, Pagination, Combobox) — todo esto es el sistema **v2**, no el descrito aqui.
  `PortalShell` ahora encapsula su árbol dependiente de URL en `Suspense`, validado con `npm run
  build:local -w web` el 2026-07-22 para que el prerender de producción no falle por `useSearchParams`.
- **Auditoria real 2026-07-22 (primera vez que se revisa el codigo entero, no solo el catalogo de componentes):**
  - **Inconsistencia real encontrada y corregida en 11 paginas + 3 componentes**: 28 usos de
    `rounded-md`/`rounded-sm` en botones, chips y contenedores ad-hoc contradecian la filosofia "esquinas
    rectas" que el propio `packages/ui/src/index.tsx` declara y respeta (sus componentes nunca redondean
    salvo `rounded-full` en puntos/circulos, que si es intencional). Se quitaron todas; donde el markup
    ad-hoc duplicaba un componente real (`Button`, `Input`, `Select`, `Textarea`, `Field`) se reemplazo por
    el componente en vez de solo quitar la clase, para que futuros cambios de estilo no vuelvan a
    divergir.
  - **Accesibilidad real corregida**: `Combobox` (selector de cliente/tienda activos, el mas usado de toda
    la app) solo se podia abrir/cerrar y hacer click -- sin poder recorrer las opciones con flechas de
    teclado, contra el patron ARIA `listbox` que su propio `role` declara. Ya soporta ArrowUp/ArrowDown/
    Home/End para moverse entre opciones y devuelve el foco al trigger al cerrar con Escape o al
    seleccionar.
  - **"Accesibilidad base validada" seguia sin evidencia real mas alla del `Combobox`** -- no hay auditoria
    formal con axe/lector de pantalla todavia, solo esta correccion puntual.
  - Comentario interno de `packages/ui/src/index.tsx` corregido: decia "font-display serif para titulares",
    pero `globals.css` usa Inter para todo (`--font-display: var(--font-inter)...`) -- nunca hubo una
    fuente serif real, el comentario estaba desactualizado desde el rediseno v2.
  - Sin Storybook ni pagina `/ui` de referencia visual.
  - Sin definicion de tokens canonicos mas alla de color.
- **Resuelto 2026-07-23 (ADR-0013)**, peticion directa de Rafa -- componentes separados por archivo, cero
  sombras, paginacion con memoria de posicion, disciplina de carga de datos:
  - `packages/ui/src/index.tsx` (antes 604 lineas, todo junto) se dividio en `packages/ui/src/components/`,
    un archivo por componente (`button.tsx`, `card.tsx`, `stat.tsx`, `badge.tsx`, `banner.tsx`,
    `field.tsx`/`input.tsx`/`select.tsx`/`textarea.tsx`, `loading-block.tsx`/`error-block.tsx`/
    `empty-state.tsx`, `sync-state-badge.tsx`, `tabs.tsx`, `pagination.tsx`, `combobox.tsx`, `cn.ts`,
    `tone.ts`). `index.tsx` es ahora un barrel que reexporta todo -- **el import publico
    `@ecomscaling/ui` no cambio**, verificado con `npm run typecheck` en todo el monorepo (10 workspaces)
    sin ningun cambio en los consumidores.
  - **Dos violaciones reales de la filosofia ya declarada, cerradas**: `Combobox` tenia una sombra dura
    (`shadow-[4px_4px_0_0_rgba(0,0,0,1)]`) en el panel desplegado, sobrevivio a la auditoria de 28 usos de
    2026-07-22 porque no era `rounded-md`/`rounded-sm` sino una sombra -- eliminada, la separacion la da el
    borde + blanco solido. `Pagination` tenia `rounded-sm` en los numeros de pagina activos -- corregido a
    esquina recta.
  - **Regla nueva explicita**: titulos de pagina discretos (mono, mayusculas pequeñas, mismo lenguaje que
    el `kicker` de `Card`), nunca un titular grande que repita el nombre de la seccion que la navegacion ya
    comunica.
  - **Paginacion con memoria de posicion**: `usePaginated` (estado en memoria, se pierde al navegar fuera)
    tiene ahora un hermano, `usePaginatedUrl` (`apps/web/src/hooks/use-paginated-url.ts`), que guarda la
    pagina actual en la URL (`?page=`) con el mismo patron de ADR-0010 (cliente/tienda activos). Migradas
    `tareas/page.tsx` y `shopify/diagnostico/page.tsx` (esta ultima con 3 listas independientes,
    `page_productos`/`page_pedidos`/`page_inventario`). **Verificado en navegador real con Playwright**:
    25 tareas sembradas, pagina 2 confirmada visualmente, navegacion fuera de la pantalla (a `/dashboard`)
    y vuelta a la misma URL sigue mostrando pagina 2 -- la posicion persiste de verdad, no solo en teoria.
    Cero errores de consola nuevos (el unico 404 encontrado, `logos/klaviyo.svg`, es preexistente y no
    relacionado).
  - **Disciplina de carga de datos**: documentada como regla de diseño en ADR-0013 (no pedir lo que la
    vista no muestra, lo secundario no bloquea lo primario, preferir datos ya presentes en una respuesta
    existente antes que un fetch nuevo) -- no es una migracion de codigo, es la regla que aplica a
    pantallas nuevas y refactors futuros.
  - Sin catalogo exacto de componentes mantenido aqui todavia mas alla del listado de archivos de arriba.
- **Siguiente accion:** auditoria formal de accesibilidad (axe/lector de pantalla) mas alla de la
  correccion puntual del `Combobox`; definir tokens canonicos mas alla de color; aplicar la regla de
  "titulos discretos" a paginas existentes cuando se toquen por otro motivo (no en una pasada masiva).

## Objetivo

Un unico sistema visual y de shell compartido por los tres roles (cliente, consultor, `platform_admin`),
sin apps ni paletas separadas — la separacion es de capacidades (ver ADR-0009), no de diseno.

## Filosofia visual ("Libro Mayor" v2)

- **Una sola fuente**: Inter para todo, incluidos titulares (`--font-display: var(--font-inter)`). Nunca
  hubo una serif real pese a lo que decia un comentario obsoleto en el codigo (corregido 2026-07-22).
- **Blanco dominante**, negro y azul de marca (`brand`, cambiado de rojo 2026-07-23 -- `apps/web/src/app/globals.css`) solo como matices — no fondos de bloque grandes.
- **Esquinas rectas siempre**: ningun componente de `packages/ui` redondea salvo `rounded-full` en puntos/
  circulos de estado, intencional. 28 usos ad-hoc de `rounded-md`/`rounded-sm` que contradecian esto se
  corrigieron en 11 paginas + 3 componentes (2026-07-22).
- **Sin subtitulos decorativos ni que repitan el titulo.** Regla matizada 2026-07-22 (antes era absoluta):
  usar helper text solo cuando evite una decision erronea, explique una restriccion o comunique una
  consecuencia (ver [`FRONTEND_CONTRACT.md`](../FRONTEND_CONTRACT.md#reglas-de-contenido) para la lista de
  categorias donde si hace falta explicar: financiero, permisos, eliminacion/recuperacion, integraciones,
  atribucion, freshness, limitaciones de IA, acciones irreversibles, onboarding, campos con unidades,
  forecast, datos incompletos).

## Shell

`apps/web/src/components/portal-shell.tsx` — layout unico para los tres roles: mini barra de contexto
(cliente/tienda activos, con URL como fuente primaria, ver ADR-0010), navegacion condicionada por rol
(ADR-0009), banda superior de avisos (`AccountAction`, catalogo cerrado en `@ecomscaling/contracts`),
cache de bootstrap en memoria, panel del copiloto (A09) como boton flotante global.

## Catalogo de componentes (`packages/ui/src/components/`, un archivo por componente desde 2026-07-23)

`Button`, `Card` (alias `Section`), `Stat`, `Badge`, `Banner`, `Field`/`Input`/`Select`/`Textarea`,
`LoadingBlock`/`ErrorBlock`/`EmptyState`, `SyncStateBadge`, `Tabs`, `Pagination`, `Combobox` (con
navegacion por teclado ARIA `listbox` desde 2026-07-22, sin sombra desde 2026-07-23). `index.tsx` es un
barrel de reexport, no el catalogo en si. Sin Storybook ni pagina `/ui` de referencia visual todavia — este
listado es la unica fuente de verdad del catalogo real por ahora.

## Criterios de cierre

- La app permite navegar sin datos ficticios — cubierto.
- Estados vacios explican la siguiente accion (`EmptyState` con `hint`/`action`) — cubierto donde se usa el
  componente; no auditado en el 100% de las paginas.
- Accesibilidad base validada — parcial: `Combobox` corregido 2026-07-22, sin auditoria formal del resto.
