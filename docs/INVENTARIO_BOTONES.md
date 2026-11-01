# Inventario de botones (apps/web)

Fecha: 2026-10-25. Sacado con el AST de TypeScript sobre los 383 `.tsx` de `apps/web/src` (no con grep:
las etiquetas que ocupan varias líneas se cuentan bien). Objetivo: migrar todo a un único `Button`
con la API de shadcn (`variant` × `size`) y la paleta de E-NORA.

## Cuántos hay

| Qué | Cuántos | Ficheros |
|---|--:|--:|
| `<Button>` (wrapper de HeroUI, `components/ui/button.tsx`) | 616 | 128 |
| `<ButtonLink>` (enlace con aspecto de botón, `components/ui/link.tsx`) | 72 | 37 |
| `<UploadButton>` | 4 | — |
| `<button>` escrito a mano | 518 | 96 |
| `Link`/`<a>` con clases de botón | 33 | ~25 |
| **Total de elementos con forma de botón** | **1.243** | **195** |

Además, fuera del componente botón: 49 `<summary>` (desplegables, se quedan), 7 `role="button"` (5 son
`div`/`g` que deberían ser `<button>`), y en `apps/mobile` 152 `<Pressable>` (React Native, migración aparte).

### `<Button>` (616)

| variant | n | | size | n |
|---|--:|---|---|--:|
| ghost | 195 | | sm | 356 |
| secondary | 189 | | md (por defecto) | 258 |
| primary (por defecto) | 188 | | dinámico | 2 |
| danger | 18 | | | |
| condicional (`sel ? "primary" : "secondary"`) | 26 | | | |

39 son solo icono (`aria-label`), 48 llevan `className` propio. Los 26 con variant condicional son en
realidad **interruptores/segmentados** disfrazados de botón.

### `<ButtonLink>` (72)

secondary 33 · ghost 21 · primary 14 · condicional 4. Tamaño: sm 36 · md 36.

### `<button>` a mano (518), por lo que son en realidad

| Tipo real | n | Destino |
|---|--:|---|
| Interruptor / pestaña / opción (`aria-pressed`, `aria-selected`, `role="tab"`) | 140 | `ToggleGroup` / `Tabs`, **no** `Button` |
| Botón con clases de un CSS module (`.btn`, `.ghost`, `.acc`, `.sm`, `.primary`…) | 142 | `Button` |
| Botón solo icono con esas clases (`.iconBtn`, `.ibtn`, `.tbtn`) | 26 | `Button size="icon-*"` |
| Icono suelto (con `aria-label`, otras clases) | 54 | `Button size="icon-*"` (revisar uno a uno) |
| Botón de texto / enlace (`.textAction`, `.linkBtn`, `underline`, `.pAction`) | 34 | `Button variant="link"` o `ghost` |
| Chip / contador / píldora | 8 | componente `Chip`/`Badge` pulsable |
| Fila o tarjeta pulsable (lista, plantilla, tile) | 80 | se queda `<button>`; no es un `Button` |
| Sin clase (estilo puesto desde el padre, p. ej. `.zone-note-meta button`) | 34 | revisar uno a uno |

(Clasificación por heurística de clases: ±10 % entre categorías.)

## Cuántos "sistemas de botón" conviven hoy

1. **`Button` de HeroUI** (`components/ui/button.tsx`): 4 variantes (`primary`, `secondary`, `ghost`, `danger`) × 2 tamaños (`sm`, `md`).
2. **`ButtonLink`** (`components/ui/link.tsx`): su propia copia de los estilos en Tailwind, 3 variantes.
3. **8 CSS modules con su propio `.btn`**: `client-pulse`, `camino-map`, `camino-routes`, `llamadas`, `campanas`, `flow-builder`, `studio`, `panel`.
4. **10 CSS modules con botones de icono/texto propios** (`iconBtn`, `ibtn`, `tbtn`, `textAction`, `linkBtn`, `aiAction`, `pAction`, `segBtn`, `scopeBtn`): `client-pulse`, `consultant-portfolio`, `camino-consultant`, `campanas`, `flow-builder`, `guia`, `imagenes`, `marketing-views`, `studio`, `panel`.
5. **~51 botones con Tailwind en línea** (sobre todo en `admin/*`).
6. **Reglas globales en `globals.css`**: `.hover-sweep`, `.zone-note-*`, overrides de `[data-slot="button"]` y `.button--secondary` en diálogos, radios por canal (Klaviyo 4 px, analítica 8 px).

Clases de CSS module más usadas en botones: `s.btn` 84, `s.ghost` 42, `s.sm` 41, `pulse.btn` 32,
`pulse.sm` 23, `pulse.ghost` 21, `s.acc` 11, `p.btn` 11, `s.opt` 11, `s.tbtn` 10, `s.ibtn` 10.

## Correspondencia con shadcn

| Hoy | shadcn | Ojo |
|---|---|---|
| `Button` primary | `variant="default"` | grafito `#3d3b3a` (color oficial) |
| `Button` secondary | `variant="secondary"` (relleno suave) u `outline` | en diálogos hoy se pinta como outline (`globals.css`) |
| `Button` ghost | `variant="ghost"` | |
| `Button` danger | `variant="destructive"` | |
| `ButtonLink` | `<Link className={buttonVariants({...})}>` | shadcn pide no usar `render={<a/>}` para enlaces |
| CSS `.btn` | `default` | |
| CSS `.btn.ghost` | **`outline`** | el `.ghost` de los CSS modules lleva borde: no es el ghost de shadcn |
| CSS `.btn.acc` / `.aiAction` (ámbar, 32) | **sin equivalente** | decidir: variante extra `ai` o `default` |
| CSS `.sm` | `size="sm"` | |
| `.iconBtn` / `.ibtn` / `.tbtn` | `size="icon-sm"` / `icon-xs` | |
| `.textAction` / `.linkBtn` / `underline` | `variant="link"` | |
| md | `size="default"` | 36 px; táctil 44 px (`pointer-coarse`) |
| "Guardando…" en 52 ficheros | `<Spinner data-icon="inline-start" />` + `disabled` | hoy solo cambia el texto |

## Estado (2026-10-25)

- Hecho 1: `Button` (`<button>` nativo, API de shadcn, sin HeroUI), `buttonVariants`, `ButtonLink`
  sobre `next/link`. Estilos `.ui-btn` en `globals.css` (`@layer components`). Variante extra `ai`.
  Colores: primario = morado `#6256c9`, secundario = morado suave `#f0eefc` (tokens `--btn-primary*`, `--btn-secondary*`, iguales en toda la app).
- Hecho 2: codemod de los 692 usos del wrapper (90 cambios en 50 ficheros; `primary` era el
  valor por defecto y no hubo que tocarlo).
- Hecho 6: guarda `apps/web/src/lib/one-button.test.ts` (lista de CSS modules con `.btn` que solo
  puede encoger).
- Catálogo vivo: `/componentes`.
- Hecho 4 en el dashboard (client-pulse, client-shopify/meta/klaviyo, consultant-desk, consultant-portfolio): 55 botones a `buttonVariants`; quitada la variante `ai` (la IA usa secondary + icono Sparkles).
- Hecho 4 y 5 en toda la app (2026-10-25): ~140 botones más de CSS modules, Tailwind y HeroBlock (`heroPrimary`/`heroSecondary`) a `buttonVariants`; ButtonLink `outline` -> `secondary`. Ningún `.tsx` usa ya `.btn/.tbtn/.ibtn` de un módulo (lo vigila `one-button.test.ts`).
- Hecho: secundario transparente con borde morado; navs y pestañas con texto activo y subrayado en `--nav-active` (morado), sin tocar fondos.
- Pendiente: 3 (interruptores/pestañas -> `ToggleGroup`) y borrar las reglas `.btn` muertas de los 8 CSS modules.
  Ojo en 4: `client-pulse.module.css` redefine `--accent` (ámbar) dentro de `.root` y tiene ~40
  reglas contextuales sobre `.btn` por rol/canal; hay que portarlas a `.ui-btn` en el mismo paso.

## Plan de migración

1. **Componente.** `components/ui/button.tsx` con la API de shadcn (`variant`, `size`, `buttonVariants`,
   `data-icon`, `ButtonGroup`, `Spinner`) y los colores como variables CSS, para que el tema por rol
   (`data-role`, `trabajo-theme`, `data-channel`) siga funcionando sin tocar cada botón.
2. **Codemod de los 692 que ya pasan por el wrapper** (`Button`, `ButtonLink`, `UploadButton`): es un
   renombrado de props (`primary→default`, `danger→destructive`, `md→default`, `ButtonLink→buttonVariants`).
   Es la parte mecánica: un script y una revisión visual.
3. **Los 26 `Button` con variant condicional y los 140 interruptores a mano → `ToggleGroup`.** Un
   componente nuevo; no son botones.
4. **CSS modules, fichero a fichero (~200).** Empezar por los que más tienen: `flow-builder` 35,
   `content-studio` 29, `studio-panels` 29, `client-pulse` 28, `calls-client` 23, `copilot-panel` 21. Al
   acabar cada módulo se borran sus `.btn/.ghost/.acc/.sm`.
5. **Iconos sueltos, enlaces con forma de botón y `role="button"`** (~95), uno a uno.
6. **Guarda** como `no-side-stripe.test.ts`: un test que falle si aparece un `<button className=...btn>`
   nuevo o una clase `.btn` nueva en un CSS module.

Fuera de alcance: las 80 filas/tarjetas pulsables y los 49 `<summary>` (no son botones) y `apps/mobile`.

## Por fichero

Ordenado por total. "toggles" y "solo icono" son subconjuntos de las columnas anteriores.

| Fichero | Total | `<Button>` | `<ButtonLink>` | `<button>` a mano | toggles/pestañas | solo icono | Link/`<a>` con aspecto de botón |
|---|--:|--:|--:|--:|--:|--:|--:|
| [camino/page.tsx](../apps/web/src/app/camino/page.tsx) | 38 | 31 | 2 | 5 | 2 | 3 |  |
| [marketing/flows/flow-builder.tsx](../apps/web/src/app/marketing/flows/flow-builder.tsx) | 38 | 2 | 1 | 35 | 11 | 11 |  |
| [components/copilot-panel.tsx](../apps/web/src/components/copilot-panel.tsx) | 37 | 12 | 3 | 22 | 3 | 11 |  |
| [tareas/page.tsx](../apps/web/src/app/tareas/page.tsx) | 35 | 20 |  | 15 | 3 | 4 |  |
| [integraciones/hub.tsx](../apps/web/src/app/integraciones/hub.tsx) | 31 | 15 | 9 | 7 | 7 | 1 |  |
| [marketing/page.tsx](../apps/web/src/app/marketing/page.tsx) | 31 | 27 | 2 | 2 | 1 |  |  |
| [dashboard/client-pulse.tsx](../apps/web/src/app/dashboard/client-pulse.tsx) | 30 |  |  | 28 | 2 | 9 | 2 |
| [marketing/studio/content-studio.tsx](../apps/web/src/app/marketing/studio/content-studio.tsx) | 30 |  |  | 30 | 12 | 3 |  |
| [marketing/studio/studio-panels.tsx](../apps/web/src/app/marketing/studio/studio-panels.tsx) | 30 |  |  | 29 | 7 | 7 | 1 |
| [camino/camino-consultant.tsx](../apps/web/src/app/camino/camino-consultant.tsx) | 29 | 15 | 1 | 13 | 6 | 1 |  |
| [llamadas/calls-client.tsx](../apps/web/src/app/llamadas/calls-client.tsx) | 28 |  |  | 23 | 3 |  | 5 |
| [marketing/imagenes/page.tsx](../apps/web/src/app/marketing/imagenes/page.tsx) | 25 | 19 |  | 6 | 3 | 3 |  |
| [consultor/workbench.tsx](../apps/web/src/app/consultor/workbench.tsx) | 24 | 12 | 11 | 1 | 3 |  |  |
| [marketing/today-view.tsx](../apps/web/src/app/marketing/today-view.tsx) | 24 | 20 | 1 | 3 | 1 | 1 |  |
| [admin/onboarding/page.tsx](../apps/web/src/app/admin/onboarding/page.tsx) | 19 | 16 |  | 3 | 1 | 2 |  |
| [dashboard/consultant-desk.tsx](../apps/web/src/app/dashboard/consultant-desk.tsx) | 17 |  |  | 16 | 1 |  | 1 |
| [marketing/imagenes/[overlayId]/page.tsx](../apps/web/src/app/marketing/imagenes/[overlayId]/page.tsx) | 17 | 12 | 1 | 4 | 2 | 2 |  |
| [planificacion/calendario/page.tsx](../apps/web/src/app/planificacion/calendario/page.tsx) | 17 | 12 | 3 | 2 |  |  |  |
| [marketing/campaign-drawer.tsx](../apps/web/src/app/marketing/campaign-drawer.tsx) | 16 | 14 | 2 |  |  |  |  |
| [consultor/gestion.tsx](../apps/web/src/app/consultor/gestion.tsx) | 15 | 14 | 1 |  |  |  |  |
| [camino/camino-create-panel.tsx](../apps/web/src/app/camino/camino-create-panel.tsx) | 14 | 7 | 1 | 6 | 1 | 2 |  |
| [components/portal-shell.tsx](../apps/web/src/components/portal-shell.tsx) | 14 | 3 |  | 6 | 2 | 3 | 5 |
| [informes/page.tsx](../apps/web/src/app/informes/page.tsx) | 13 | 12 |  | 1 |  |  |  |
| [conocimiento/client-rules.tsx](../apps/web/src/app/conocimiento/client-rules.tsx) | 12 |  |  | 12 | 5 |  |  |
| [dashboard/consultant-portfolio.tsx](../apps/web/src/app/dashboard/consultant-portfolio.tsx) | 12 |  |  | 12 | 2 |  |  |
| [marketing/content-view.tsx](../apps/web/src/app/marketing/content-view.tsx) | 12 | 3 |  | 9 | 3 |  |  |
| [marketing/guia/guia-fields.tsx](../apps/web/src/app/marketing/guia/guia-fields.tsx) | 12 | 9 |  | 3 |  | 1 |  |
| [marketing/weekly-mailing-planner.tsx](../apps/web/src/app/marketing/weekly-mailing-planner.tsx) | 12 | 11 |  | 1 | 3 |  |  |
| [tiendas/page.tsx](../apps/web/src/app/tiendas/page.tsx) | 11 | 10 |  | 1 | 1 |  |  |
| [admin/agentes/judge-dataset-panel.tsx](../apps/web/src/app/admin/agentes/judge-dataset-panel.tsx) | 10 | 9 |  | 1 |  |  |  |
| [camino/camino-map.tsx](../apps/web/src/app/camino/camino-map.tsx) | 9 |  |  | 8 | 4 | 1 | 1 |
| [marketing/flows-view.tsx](../apps/web/src/app/marketing/flows-view.tsx) | 9 | 5 | 2 | 2 | 1 |  |  |
| [components/ai-diagnostic-section.tsx](../apps/web/src/components/ai-diagnostic-section.tsx) | 9 | 9 |  |  |  |  |  |
| [camino/camino-intake-wizard.tsx](../apps/web/src/app/camino/camino-intake-wizard.tsx) | 8 | 4 |  | 4 | 1 |  |  |
| [configuracion/consultora-section.tsx](../apps/web/src/app/configuracion/consultora-section.tsx) | 8 | 8 |  |  |  |  |  |
| [configuracion/page.tsx](../apps/web/src/app/configuracion/page.tsx) | 8 | 8 |  |  |  |  |  |
| [conocimiento/store-questionnaire.tsx](../apps/web/src/app/conocimiento/store-questionnaire.tsx) | 8 |  |  | 8 | 2 |  |  |
| [dashboard/client-shopify.tsx](../apps/web/src/app/dashboard/client-shopify.tsx) | 8 |  |  | 5 | 1 |  | 3 |
| [marketing/campanas/quick-actions-manager.tsx](../apps/web/src/app/marketing/campanas/quick-actions-manager.tsx) | 8 |  |  | 8 | 5 | 3 |  |
| [marketing/campanas/store-campaigns.tsx](../apps/web/src/app/marketing/campanas/store-campaigns.tsx) | 8 |  |  | 7 |  |  | 1 |
| [meta/campanas/page.tsx](../apps/web/src/app/meta/campanas/page.tsx) | 8 |  |  | 8 | 5 |  |  |
| [panel/portfolio-level.tsx](../apps/web/src/app/panel/portfolio-level.tsx) | 8 |  |  | 8 |  |  |  |
| [reuniones/meeting-detail.tsx](../apps/web/src/app/reuniones/meeting-detail.tsx) | 8 | 5 | 3 |  |  |  |  |
| [reuniones/staff-settings.tsx](../apps/web/src/app/reuniones/staff-settings.tsx) | 8 | 7 |  | 1 |  |  |  |
| [shopify/productos/[productId]/page.tsx](../apps/web/src/app/shopify/productos/[productId]/page.tsx) | 8 |  |  | 8 | 2 | 1 |  |
| [shopify/promociones/page.tsx](../apps/web/src/app/shopify/promociones/page.tsx) | 8 |  |  | 8 | 4 | 2 |  |
| [components/zone-notes.tsx](../apps/web/src/components/zone-notes.tsx) | 8 |  |  | 8 |  | 3 |  |
| [admin/laboratorio-mailing/page.tsx](../apps/web/src/app/admin/laboratorio-mailing/page.tsx) | 7 | 7 |  |  |  |  |  |
| [consultor/objective-types.tsx](../apps/web/src/app/consultor/objective-types.tsx) | 7 | 7 |  |  |  |  |  |
| [dashboard/client-meta.tsx](../apps/web/src/app/dashboard/client-meta.tsx) | 7 |  |  | 5 | 2 |  | 2 |
| [integraciones/tienda/[connectionId]/page.tsx](../apps/web/src/app/integraciones/tienda/[connectionId]/page.tsx) | 7 | 5 | 2 |  |  |  |  |
| [marketing/campanas/client-campaigns.tsx](../apps/web/src/app/marketing/campanas/client-campaigns.tsx) | 7 |  |  | 7 |  |  |  |
| [mensajes/page.tsx](../apps/web/src/app/mensajes/page.tsx) | 7 | 1 |  | 6 | 5 |  |  |
| [panel/client-level.tsx](../apps/web/src/app/panel/client-level.tsx) | 7 |  |  | 7 |  |  |  |
| [shopify/productos/page.tsx](../apps/web/src/app/shopify/productos/page.tsx) | 7 |  |  | 7 | 4 | 2 |  |
| [shopify/promociones/[discountId]/page.tsx](../apps/web/src/app/shopify/promociones/[discountId]/page.tsx) | 7 |  |  | 7 | 1 |  |  |
| [components/admin-client-detail.tsx](../apps/web/src/components/admin-client-detail.tsx) | 7 | 7 |  |  |  |  |  |
| [components/campaign-plan-proposal.tsx](../apps/web/src/components/campaign-plan-proposal.tsx) | 7 | 7 |  |  | 1 |  |  |
| [components/consultant-messages.tsx](../apps/web/src/components/consultant-messages.tsx) | 7 | 2 |  | 4 |  | 1 | 1 |
| [components/notifications-bell.tsx](../apps/web/src/components/notifications-bell.tsx) | 7 | 4 |  | 2 | 1 | 1 | 1 |
| [admin/consultores/page.tsx](../apps/web/src/app/admin/consultores/page.tsx) | 6 | 5 | 1 |  |  |  |  |
| [admin/facturacion/page.tsx](../apps/web/src/app/admin/facturacion/page.tsx) | 6 | 6 |  |  |  |  |  |
| [camino/proposal-decision.tsx](../apps/web/src/app/camino/proposal-decision.tsx) | 6 | 6 |  |  |  |  |  |
| [configuracion/security-section.tsx](../apps/web/src/app/configuracion/security-section.tsx) | 6 | 6 |  |  |  |  |  |
| [klaviyo/emails/page.tsx](../apps/web/src/app/klaviyo/emails/page.tsx) | 6 |  |  | 6 | 4 |  |  |
| [marketing/guia/page.tsx](../apps/web/src/app/marketing/guia/page.tsx) | 6 | 3 |  | 3 | 2 |  |  |
| [marketing/mailing-campaign-panel.tsx](../apps/web/src/app/marketing/mailing-campaign-panel.tsx) | 6 | 6 |  |  |  |  |  |
| [marketing/templates-view.tsx](../apps/web/src/app/marketing/templates-view.tsx) | 6 | 4 | 1 | 1 | 1 |  |  |
| [panel/store-level.tsx](../apps/web/src/app/panel/store-level.tsx) | 6 |  |  | 5 |  |  | 1 |
| [acceso/page.tsx](../apps/web/src/app/acceso/page.tsx) | 5 | 5 |  |  |  |  |  |
| [admin/agentes/page.tsx](../apps/web/src/app/admin/agentes/page.tsx) | 5 | 4 |  | 1 |  | 1 |  |
| [admin/consultores/[consultantId]/page.tsx](../apps/web/src/app/admin/consultores/[consultantId]/page.tsx) | 5 | 3 | 2 |  |  |  |  |
| [agentes/page.tsx](../apps/web/src/app/agentes/page.tsx) | 5 | 5 |  |  |  |  |  |
| [camino/nuevo/page.tsx](../apps/web/src/app/camino/nuevo/page.tsx) | 5 | 3 | 2 |  |  |  |  |
| [configuracion/client-access-section.tsx](../apps/web/src/app/configuracion/client-access-section.tsx) | 5 | 5 |  |  |  |  |  |
| [conocimiento/page.tsx](../apps/web/src/app/conocimiento/page.tsx) | 5 | 5 |  |  | 2 |  |  |
| [consultor/captacion.tsx](../apps/web/src/app/consultor/captacion.tsx) | 5 | 5 |  |  |  |  |  |
| [dashboard/client-klaviyo.tsx](../apps/web/src/app/dashboard/client-klaviyo.tsx) | 5 |  |  | 3 | 1 |  | 2 |
| [integraciones/shopify/page.tsx](../apps/web/src/app/integraciones/shopify/page.tsx) | 5 | 5 |  |  | 2 |  |  |
| [marketing/campanas/portfolio-campaigns.tsx](../apps/web/src/app/marketing/campanas/portfolio-campaigns.tsx) | 5 |  |  | 4 |  |  | 1 |
| [marketing/studio/studio-canvas.tsx](../apps/web/src/app/marketing/studio/studio-canvas.tsx) | 5 |  |  | 5 |  | 5 |  |
| [mi-trabajo/page.tsx](../apps/web/src/app/mi-trabajo/page.tsx) | 5 | 5 |  |  |  |  |  |
| [notificaciones/page.tsx](../apps/web/src/app/notificaciones/page.tsx) | 5 | 5 |  |  | 1 |  |  |
| [components/consultant-agenda.tsx](../apps/web/src/components/consultant-agenda.tsx) | 5 | 3 |  | 2 | 2 |  |  |
| [components/copilot-saldo.tsx](../apps/web/src/components/copilot-saldo.tsx) | 5 | 1 |  | 3 | 1 | 2 | 1 |
| [admin/clientes/page.tsx](../apps/web/src/app/admin/clientes/page.tsx) | 4 | 3 | 1 |  |  |  |  |
| [admin/conocimiento/page.tsx](../apps/web/src/app/admin/conocimiento/page.tsx) | 4 | 4 |  |  |  |  |  |
| [admin/costes-ia/page.tsx](../apps/web/src/app/admin/costes-ia/page.tsx) | 4 | 4 |  |  |  |  |  |
| [admin/finanzas/page.tsx](../apps/web/src/app/admin/finanzas/page.tsx) | 4 | 4 |  |  |  |  |  |
| [admin/tools/page.tsx](../apps/web/src/app/admin/tools/page.tsx) | 4 | 3 |  | 1 |  |  |  |
| [configuracion/business-context-section.tsx](../apps/web/src/app/configuracion/business-context-section.tsx) | 4 | 4 |  |  |  |  |  |
| [configuracion/work-split-section.tsx](../apps/web/src/app/configuracion/work-split-section.tsx) | 4 | 4 |  |  |  |  |  |
| [integraciones/shared.tsx](../apps/web/src/app/integraciones/shared.tsx) | 4 | 3 |  |  | 1 |  | 1 |
| [klaviyo/klaviyo-analytics.tsx](../apps/web/src/app/klaviyo/klaviyo-analytics.tsx) | 4 |  |  | 3 | 3 |  | 1 |
| [marketing/mailing-delivery-panel.tsx](../apps/web/src/app/marketing/mailing-delivery-panel.tsx) | 4 | 4 |  |  |  |  |  |
| [marketing/template-library.tsx](../apps/web/src/app/marketing/template-library.tsx) | 4 | 3 |  | 1 | 1 |  |  |
| [shopify/page.tsx](../apps/web/src/app/shopify/page.tsx) | 4 | 3 |  | 1 | 1 |  |  |
| [components/ai-proposed-tasks.tsx](../apps/web/src/components/ai-proposed-tasks.tsx) | 4 |  |  | 4 |  | 2 |  |
| [components/ui/dialog.tsx](../apps/web/src/components/ui/dialog.tsx) | 4 | 4 |  |  | 1 |  |  |
| [admin/infraestructura/page.tsx](../apps/web/src/app/admin/infraestructura/page.tsx) | 3 |  |  | 3 |  |  |  |
| [admin/programa-consultores/[consultantUserId]/page.tsx](../apps/web/src/app/admin/programa-consultores/[consultantUserId]/page.tsx) | 3 | 1 | 2 |  |  |  |  |
| [configuracion/consultant-settings.tsx](../apps/web/src/app/configuracion/consultant-settings.tsx) | 3 | 2 | 1 |  |  |  |  |
| [configuracion/notifications-section.tsx](../apps/web/src/app/configuracion/notifications-section.tsx) | 3 | 1 | 1 | 1 |  | 1 |  |
| [configuracion/summary-section.tsx](../apps/web/src/app/configuracion/summary-section.tsx) | 3 | 2 |  | 1 |  |  |  |
| [conocimiento/mailing-section.tsx](../apps/web/src/app/conocimiento/mailing-section.tsx) | 3 | 3 |  |  |  |  |  |
| [integraciones/page.tsx](../apps/web/src/app/integraciones/page.tsx) | 3 | 2 | 1 |  | 2 |  |  |
| [integraciones/store-scope-card.tsx](../apps/web/src/app/integraciones/store-scope-card.tsx) | 3 | 3 |  |  | 1 |  |  |
| [marketing/campanas/campanas-parts.tsx](../apps/web/src/app/marketing/campanas/campanas-parts.tsx) | 3 |  |  | 3 | 1 |  |  |
| [marketing/campanas/client-view.tsx](../apps/web/src/app/marketing/campanas/client-view.tsx) | 3 |  |  | 3 | 1 |  |  |
| [marketing/klaviyo-import-panel.tsx](../apps/web/src/app/marketing/klaviyo-import-panel.tsx) | 3 | 3 |  |  |  |  |  |
| [meta/creativos/page.tsx](../apps/web/src/app/meta/creativos/page.tsx) | 3 |  |  | 3 |  |  |  |
| [onboarding/page.tsx](../apps/web/src/app/onboarding/page.tsx) | 3 | 3 |  |  |  |  |  |
| [reuniones/booking-dialog.tsx](../apps/web/src/app/reuniones/booking-dialog.tsx) | 3 |  |  | 3 | 3 |  |  |
| [shopify/inventario/[grupo]/page.tsx](../apps/web/src/app/shopify/inventario/[grupo]/page.tsx) | 3 |  |  | 3 |  |  |  |
| [components/a26-content-reviews.tsx](../apps/web/src/components/a26-content-reviews.tsx) | 3 | 3 |  |  |  |  |  |
| [components/admin-consultant-detail.tsx](../apps/web/src/components/admin-consultant-detail.tsx) | 3 | 3 |  |  |  |  |  |
| [components/portal-feedback.tsx](../apps/web/src/components/portal-feedback.tsx) | 3 |  |  | 3 |  | 2 |  |
| [components/ui/metric-insights.tsx](../apps/web/src/components/ui/metric-insights.tsx) | 3 | 2 |  | 1 |  | 1 |  |
| [admin/agentes/release-eval-fixtures-panel.tsx](../apps/web/src/app/admin/agentes/release-eval-fixtures-panel.tsx) | 2 | 2 |  |  |  |  |  |
| [admin/agentes/release-gate-panel.tsx](../apps/web/src/app/admin/agentes/release-gate-panel.tsx) | 2 | 2 |  |  |  |  |  |
| [admin/clientes/[clientId]/page.tsx](../apps/web/src/app/admin/clientes/[clientId]/page.tsx) | 2 |  | 2 |  |  |  |  |
| [admin/observabilidad/run-trace.tsx](../apps/web/src/app/admin/observabilidad/run-trace.tsx) | 2 | 2 |  |  |  |  |  |
| [camino/camino-routes-view.tsx](../apps/web/src/app/camino/camino-routes-view.tsx) | 2 |  |  | 2 |  |  |  |
| [configuracion/alert-rules-section.tsx](../apps/web/src/app/configuracion/alert-rules-section.tsx) | 2 | 2 |  |  |  |  |  |
| [configuracion/billing-section.tsx](../apps/web/src/app/configuracion/billing-section.tsx) | 2 | 1 |  |  |  |  | 1 |
| [configuracion/consultant-partners-section.tsx](../apps/web/src/app/configuracion/consultant-partners-section.tsx) | 2 | 2 |  |  |  |  |  |
| [configuracion/privacy-section.tsx](../apps/web/src/app/configuracion/privacy-section.tsx) | 2 | 2 |  |  |  |  |  |
| [configuracion/profile-section.tsx](../apps/web/src/app/configuracion/profile-section.tsx) | 2 | 2 |  |  |  |  |  |
| [integraciones/klaviyo/page.tsx](../apps/web/src/app/integraciones/klaviyo/page.tsx) | 2 | 2 |  |  |  |  |  |
| [integraciones/meta/page.tsx](../apps/web/src/app/integraciones/meta/page.tsx) | 2 | 2 |  |  |  |  |  |
| [klaviyo/emails/[emailId]/page.tsx](../apps/web/src/app/klaviyo/emails/[emailId]/page.tsx) | 2 |  |  | 2 | 1 |  |  |
| [marketing/campanas/campaign-workspace.tsx](../apps/web/src/app/marketing/campanas/campaign-workspace.tsx) | 2 |  |  |  |  |  | 2 |
| [marketing/campanas/quick-actions.tsx](../apps/web/src/app/marketing/campanas/quick-actions.tsx) | 2 |  |  | 2 |  |  |  |
| [marketing/draft-campaign-link.tsx](../apps/web/src/app/marketing/draft-campaign-link.tsx) | 2 | 2 |  |  |  |  |  |
| [marketing/plantillas/page.tsx](../apps/web/src/app/marketing/plantillas/page.tsx) | 2 |  | 2 |  |  |  |  |
| [marketing/template-builder.tsx](../apps/web/src/app/marketing/template-builder.tsx) | 2 | 2 |  |  |  |  |  |
| [meta/campanas/[campaignId]/page.tsx](../apps/web/src/app/meta/campanas/[campaignId]/page.tsx) | 2 |  |  | 2 | 1 |  |  |
| [nueva-contrasena/page.tsx](../apps/web/src/app/nueva-contrasena/page.tsx) | 2 | 2 |  |  |  |  |  |
| [panel/client-extras.tsx](../apps/web/src/app/panel/client-extras.tsx) | 2 |  |  | 2 |  | 1 |  |
| [panel/panel-parts.tsx](../apps/web/src/app/panel/panel-parts.tsx) | 2 |  |  | 2 | 2 |  |  |
| [panel/store-simulator.tsx](../apps/web/src/app/panel/store-simulator.tsx) | 2 |  |  | 2 |  |  |  |
| [planificacion/portfolio-view.tsx](../apps/web/src/app/planificacion/portfolio-view.tsx) | 2 | 2 |  |  |  |  |  |
| [planificacion/tracking/page.tsx](../apps/web/src/app/planificacion/tracking/page.tsx) | 2 | 2 |  |  |  |  |  |
| [propuestas/[outputId]/page.tsx](../apps/web/src/app/propuestas/[outputId]/page.tsx) | 2 |  | 2 |  |  |  |  |
| [reuniones/page.tsx](../apps/web/src/app/reuniones/page.tsx) | 2 | 1 |  | 1 |  |  |  |
| [shopify/diagnostico/adversarial.tsx](../apps/web/src/app/shopify/diagnostico/adversarial.tsx) | 2 | 2 |  |  |  |  |  |
| [shopify/diagnostico/health-references.tsx](../apps/web/src/app/shopify/diagnostico/health-references.tsx) | 2 | 2 |  |  |  |  |  |
| [shopify/diagnostico/severity-thresholds-panel.tsx](../apps/web/src/app/shopify/diagnostico/severity-thresholds-panel.tsx) | 2 | 2 |  |  |  |  |  |
| [shopify/product-cost-import.tsx](../apps/web/src/app/shopify/product-cost-import.tsx) | 2 | 2 |  |  | 1 |  |  |
| [components/avatar-picker.tsx](../apps/web/src/components/avatar-picker.tsx) | 2 | 1 |  | 1 |  | 1 |  |
| [components/camino-proposal.tsx](../apps/web/src/components/camino-proposal.tsx) | 2 | 2 |  |  | 1 |  |  |
| [components/platform-admin-shell.tsx](../apps/web/src/components/platform-admin-shell.tsx) | 2 |  |  | 2 |  | 2 |  |
| [components/strategic-plan-import.tsx](../apps/web/src/components/strategic-plan-import.tsx) | 2 | 1 | 1 |  |  |  |  |
| [components/ui/chart.tsx](../apps/web/src/components/ui/chart.tsx) | 2 | 2 |  |  |  |  |  |
| [admin/informes/page.tsx](../apps/web/src/app/admin/informes/page.tsx) | 1 |  |  | 1 |  |  |  |
| [admin/logs/auditoria/page.tsx](../apps/web/src/app/admin/logs/auditoria/page.tsx) | 1 | 1 |  |  |  |  |  |
| [admin/logs/errores-sync/page.tsx](../apps/web/src/app/admin/logs/errores-sync/page.tsx) | 1 | 1 |  |  |  |  |  |
| [admin/observabilidad/ai-usage.tsx](../apps/web/src/app/admin/observabilidad/ai-usage.tsx) | 1 | 1 |  |  | 1 |  |  |
| [admin/observabilidad/model-prices.tsx](../apps/web/src/app/admin/observabilidad/model-prices.tsx) | 1 | 1 |  |  |  |  |  |
| [admin/observabilidad/page.tsx](../apps/web/src/app/admin/observabilidad/page.tsx) | 1 | 1 |  |  |  |  |  |
| [admin/programa-consultores/page.tsx](../apps/web/src/app/admin/programa-consultores/page.tsx) | 1 |  | 1 |  |  |  |  |
| [agenda/page.tsx](../apps/web/src/app/agenda/page.tsx) | 1 |  | 1 |  |  |  |  |
| [camino/draft-notice.tsx](../apps/web/src/app/camino/draft-notice.tsx) | 1 | 1 |  |  |  |  |  |
| [configuracion/consultant-permissions.tsx](../apps/web/src/app/configuracion/consultant-permissions.tsx) | 1 |  | 1 |  |  |  |  |
| [configuracion/consultant-section.tsx](../apps/web/src/app/configuracion/consultant-section.tsx) | 1 |  | 1 |  |  |  |  |
| [configuracion/copilot-ai-section.tsx](../apps/web/src/app/configuracion/copilot-ai-section.tsx) | 1 |  | 1 |  |  |  |  |
| [configuracion/organization-identity.tsx](../apps/web/src/app/configuracion/organization-identity.tsx) | 1 | 1 |  |  |  |  |  |
| [configuracion/team-security-section.tsx](../apps/web/src/app/configuracion/team-security-section.tsx) | 1 | 1 |  |  |  |  |  |
| [consultor/page.tsx](../apps/web/src/app/consultor/page.tsx) | 1 |  |  | 1 |  |  |  |
| [integraciones/shopify-account-assignment-modal.tsx](../apps/web/src/app/integraciones/shopify-account-assignment-modal.tsx) | 1 | 1 |  |  |  |  |  |
| [klaviyo/page.tsx](../apps/web/src/app/klaviyo/page.tsx) | 1 | 1 |  |  | 1 |  |  |
| [login/page.tsx](../apps/web/src/app/login/page.tsx) | 1 | 1 |  |  |  |  |  |
| [marketing/audiences-view.tsx](../apps/web/src/app/marketing/audiences-view.tsx) | 1 |  | 1 |  |  |  |  |
| [marketing/campaigns-view.tsx](../apps/web/src/app/marketing/campaigns-view.tsx) | 1 | 1 |  |  |  |  |  |
| [marketing/campanas/piece-editor.tsx](../apps/web/src/app/marketing/campanas/piece-editor.tsx) | 1 |  |  | 1 |  |  |  |
| [marketing/klaviyo-performance.tsx](../apps/web/src/app/marketing/klaviyo-performance.tsx) | 1 |  | 1 |  |  |  |  |
| [marketing/meta-ad-plan-block.tsx](../apps/web/src/app/marketing/meta-ad-plan-block.tsx) | 1 | 1 |  |  |  |  |  |
| [meta/page.tsx](../apps/web/src/app/meta/page.tsx) | 1 | 1 |  |  | 1 |  |  |
| [planes/page.tsx](../apps/web/src/app/planes/page.tsx) | 1 | 1 |  |  |  |  |  |
| [recuperar/page.tsx](../apps/web/src/app/recuperar/page.tsx) | 1 | 1 |  |  |  |  |  |
| [registro/page.tsx](../apps/web/src/app/registro/page.tsx) | 1 | 1 |  |  |  |  |  |
| [shopify/diagnostico/causal-paths.tsx](../apps/web/src/app/shopify/diagnostico/causal-paths.tsx) | 1 | 1 |  |  |  |  |  |
| [shopify/diagnostico/intervention-effects-panel.tsx](../apps/web/src/app/shopify/diagnostico/intervention-effects-panel.tsx) | 1 | 1 |  |  |  |  |  |
| [shopify/diagnostico/maturity-panel.tsx](../apps/web/src/app/shopify/diagnostico/maturity-panel.tsx) | 1 | 1 |  |  |  |  |  |
| [shopify/inventario/page.tsx](../apps/web/src/app/shopify/inventario/page.tsx) | 1 |  |  | 1 |  |  |  |
| [shopify/promociones/discount-proposal-workspace.tsx](../apps/web/src/app/shopify/promociones/discount-proposal-workspace.tsx) | 1 |  |  | 1 |  |  |  |
| [shopify/task-button.tsx](../apps/web/src/app/shopify/task-button.tsx) | 1 |  |  | 1 |  |  |  |
| [shopify/trust-strip.tsx](../apps/web/src/app/shopify/trust-strip.tsx) | 1 | 1 |  |  |  |  |  |
| [components/concesion-de-plan.tsx](../apps/web/src/components/concesion-de-plan.tsx) | 1 | 1 |  |  |  |  |  |
| [components/insights-menu.tsx](../apps/web/src/components/insights-menu.tsx) | 1 |  |  | 1 |  | 1 |  |
| [components/metric-verdict.tsx](../apps/web/src/components/metric-verdict.tsx) | 1 |  |  | 1 |  | 1 |  |
| [components/onboarding-checklist.tsx](../apps/web/src/components/onboarding-checklist.tsx) | 1 |  | 1 |  |  |  |  |
| [components/password-input.tsx](../apps/web/src/components/password-input.tsx) | 1 |  |  | 1 | 1 | 1 |  |
| [components/ui/upload-button.tsx](../apps/web/src/components/ui/upload-button.tsx) | 1 | 1 |  |  |  |  |  |
| [components/ver-como-button.tsx](../apps/web/src/components/ver-como-button.tsx) | 1 | 1 |  |  |  |  |  |
