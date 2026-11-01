# Inventario de plegables: dónde usar `Collapsible` (apps/web)

Fecha: 2026-10-26. Objetivo: un único `Collapsible` con la API de shadcn (`Collapsible` >
`CollapsibleTrigger` + `CollapsibleContent`, `open`/`defaultOpen`/`onOpenChange`), nativo como
`Accordion`, `Button` y `ButtonGroup`, para todo lo que **abre y cierra un solo bloque**. Lo que abre uno
de varios en una lista sigue siendo `Accordion`; lo que flota encima es `Popover`/`Sheet`/`Dialog`.

## Estado (2026-10-27): hecho

- `components/ui/collapsible.tsx` (+ `CollapsibleMore` para "Ver N más"), catálogo en `/componentes`,
  `CollapsibleSection` encima, `?focus=` y `#anclas` abren plegables.
- Cero `<details>` en `apps/web/src`; la guarda `lib/one-collapsible.test.ts` lo vigila sin lista de
  pendientes.
- "Ver N más" con `CollapsibleMore`: Pulso (2), escritorio, cartera, `/consultor`, Hoy de `/marketing`.
- Uno de varios: meses del objetivo (`camino-consultant`) → `Accordion`; organizaciones de
  infraestructura, semanas del plan, fuentes de onboarding y tareas propuestas → `Collapsible`
  (controlado cuando solo va uno abierto: las filas están en tablas o rejillas, no en una lista simple).
- **Se quedan como están, a propósito:**
  - Fases e hitos de `camino/page.tsx`: árbol con arrastrar y soltar donde el disparador es hermano del
    asa, el menú y el botón de editar; ya es un disclosure accesible (`aria-expanded` + `aria-controls`).
    Pasarlo a `Accordion` obliga a rehacer el árbol sortable.
  - `PhaseScopeNote` de `/tareas`: no pliega nada, cambia el filtro (`aria-pressed`). Es un filtro sí/no.
  - "Leer análisis completo", transcripción y diagnóstico de Mi Camino: recortan texto, no pliegan bloques.

## Cuántos hay

| Qué | Sitios | Ficheros | Destino |
|---|--:|--:|---|
| `<details>/<summary>` sueltos | 43 | 31 | `Collapsible` (39) · `Accordion` (4) |
| `CollapsibleSection` (`<details>` envuelto) | 8 | 5 | Rehacer sobre `Collapsible` sin cambiar su API |
| Bloque con `useState` + botón "Ver/Ocultar" | 13 | 9 | `Collapsible` controlado |
| Lista recortada "Ver N más / Ver menos" | 8 | 7 | `Collapsible` (cabeza visible + resto dentro) |
| Uno abierto de varios, a mano | 6 | 5 | `Accordion`, no `Collapsible` |
| Parecen plegables pero no lo son | ~20 | — | Se quedan o van a otro componente |
| **Total a migrar a `Collapsible`** | **~68** | **~45** | |

## Por qué merece la pena

1. **Trece aspectos distintos.** El mismo gesto (abrir un bloque) se pinta con 13 hojas CSS distintas
   que estilan `summary`/`[open]` a su manera (`client-pulse`, `today-view`, `camino-consultant`,
   `analytics`, `camino-routes`, `flow-builder`, `consultant-portfolio`, `camino-create-panel`,
   `shopify-trust`, `promociones`, `camino-map`, `cuestionario`, `.admin-settings-disclosure` en
   globals.css), más ~15 `<details>` con clases Tailwind sueltas y 4 con `style={{ cursor: "pointer" }}`.
   Unos llevan flecha, otros el triángulo del navegador, otros nada.
2. **Los enlaces `?focus=` y los `#anclas` no abren un `<details>`.** `FocusTarget` solo llama a
   `revealInAccordions`; si el destino está dentro de un `<details>` cerrado, el destello cae en un
   bloque invisible. `Collapsible` debe escuchar el mismo evento de revelado que `Accordion`.
3. **Toggles a mano sin contrato.** Ninguno de los 13 bloques con `useState` lleva `aria-controls`,
   4 tampoco llevan `aria-expanded` y cada uno inventa su texto ("Ocultar", "Ver menos", "Mostrar menos",
   "Ocultar transcripción"…).
4. **Sin animación ni montaje coherente.** `<details>` desmonta visualmente de golpe; los `useState`
   desmontan el contenido (lo que carga datos al abrir vuelve a cargar cada vez).

## El componente (propuesta)

`components/ui/collapsible.tsx`, estilos `.ui-collapsible` en globals.css (`@layer components`):

- **API de shadcn:** `Collapsible` (`open`, `defaultOpen`, `onOpenChange`, `disabled`, `className`),
  `CollapsibleTrigger` (con `render` para usar un `Button` como disparador, como en la doc de shadcn) y
  `CollapsibleContent`. `data-state="open|closed"` en los tres para girar flechas
  (`group-data-[state=open]:rotate-180`).
- **Misma mecánica que `Accordion`:** disparador `<button>` con `aria-expanded` + `aria-controls`;
  lo cerrado sigue montado, a 0 de alto e `inert`; altura animada con `grid-template-rows` y sin
  animación con `prefers-reduced-motion`. Escucha el evento de `revealInAccordions` (conviene
  renombrarlo a `revealHidden` y que lo use también `FocusTarget` con `#anclas`).
- **`CollapsibleSection`** se reescribe encima (título + flecha + borde) y conserva su API: sus 8 usos
  no cambian.
- **Catálogo** en `/componentes` con los tres ejemplos de la doc: pedido con detalles, ajustes extra,
  árbol anidado.
- **Guarda** `lib/one-collapsible.test.ts`: ningún `<details>` nuevo fuera de `components/ui`, con
  lista de pendientes que solo puede encoger (como `one-button.test.ts`).

## Dónde va `Collapsible`

### A. `<details>` sueltos (39 → `Collapsible`)

**"Sobre estos datos"**: el mismo bloque copiado 4 veces con `style={{ cursor: "pointer" }}`.

| Sitio | Texto |
|---|---|
| [klaviyo/emails/[emailId]/page.tsx:157](../apps/web/src/app/klaviyo/emails/[emailId]/page.tsx#L157) | Sobre estos datos |
| [meta/campanas/[campaignId]/page.tsx:179](../apps/web/src/app/meta/campanas/[campaignId]/page.tsx#L179) | Sobre estos datos |
| [shopify/productos/[productId]/page.tsx:370](../apps/web/src/app/shopify/productos/[productId]/page.tsx#L370) | Sobre estos datos |
| [shopify/promociones/[discountId]/page.tsx:226](../apps/web/src/app/shopify/promociones/[discountId]/page.tsx#L226) | Sobre estos datos |
| [components/ai-insight.tsx:156](../apps/web/src/components/ai-insight.tsx#L156) | Límites de los datos |
| [shopify/trust-strip.tsx:167](../apps/web/src/app/shopify/trust-strip.tsx#L167) | ✓ Cifras fiables… |

**Detalle técnico** (texto pequeño, para el consultor):

| Sitio | Texto |
|---|---|
| [integraciones/hub.tsx:699](../apps/web/src/app/integraciones/hub.tsx#L699) | Detalle técnico |
| [shopify/page.tsx:437](../apps/web/src/app/shopify/page.tsx#L437) | Detalle técnico |
| [integraciones/tienda/[connectionId]/page.tsx:131](../apps/web/src/app/integraciones/tienda/[connectionId]/page.tsx#L131) | (detalle de la conexión) |
| [integraciones/store-scope-card.tsx:340](../apps/web/src/app/integraciones/store-scope-card.tsx#L340) | (alcance de la tienda) |
| [components/ai-diagnostic-section.tsx:269](../apps/web/src/components/ai-diagnostic-section.tsx#L269) | Registro de la simulación |
| [admin/laboratorio-mailing/page.tsx:285](../apps/web/src/app/admin/laboratorio-mailing/page.tsx#L285) | Contexto que recibiría A27 (JSON) |

**Mi Camino**: el que más tiene (12) y con 4 estilos distintos entre `c.how`, `c.more`,
`s.phaseDetails` y Tailwind.

| Sitio | Texto |
|---|---|
| [camino/camino-consultant.tsx:1191](../apps/web/src/app/camino/camino-consultant.tsx#L1191) | Cómo hacerlo |
| [camino/camino-map.tsx:739](../apps/web/src/app/camino/camino-map.tsx#L739) | Cómo hacerlo |
| [camino/camino-consultant.tsx:1299](../apps/web/src/app/camino/camino-consultant.tsx#L1299) | Ver las N rutinas de crecimiento |
| [camino/camino-consultant.tsx:1401](../apps/web/src/app/camino/camino-consultant.tsx#L1401) | Supuestos de la meta (N) |
| [camino/camino-consultant.tsx:1411](../apps/web/src/app/camino/camino-consultant.tsx#L1411) | Decisiones que dependen de los datos (N) |
| [camino/camino-create-panel.tsx:574](../apps/web/src/app/camino/camino-create-panel.tsx#L574) | Diagnóstico de ejecución (`style={{ marginTop: 8 }}`) |
| [camino/camino-create-panel.tsx:732](../apps/web/src/app/camino/camino-create-panel.tsx#L732) | Decisiones antes de invertir o lanzar |
| [camino/camino-create-panel.tsx:789](../apps/web/src/app/camino/camino-create-panel.tsx#L789) | Ver contexto y evidencias por fase |
| [camino/camino-create-panel.tsx:836](../apps/web/src/app/camino/camino-create-panel.tsx#L836) | Por qué esta meta |
| [camino/camino-create-panel.tsx:844](../apps/web/src/app/camino/camino-create-panel.tsx#L844) | Ver N fuentes y límites de la propuesta |
| [camino/page.tsx:2870](../apps/web/src/app/camino/page.tsx#L2870) | Decisiones condicionadas por datos |
| [camino/monthly-route.tsx:88](../apps/web/src/app/camino/monthly-route.tsx#L88) | Ver estrategia del mes |
| [camino/growth-cycle.tsx:47](../apps/web/src/app/camino/growth-cycle.tsx#L47) | (ciclo de crecimiento) |

**Pulso, escritorio y contexto de la IA**:

| Sitio | Texto |
|---|---|
| [dashboard/client-pulse.tsx:913](../apps/web/src/app/dashboard/client-pulse.tsx#L913) | {tarea} (N pasos) |
| [dashboard/client-pulse.tsx:1477](../apps/web/src/app/dashboard/client-pulse.tsx#L1477) | Hechas esta semana (N) |
| [dashboard/consultant-desk.tsx:288](../apps/web/src/app/dashboard/consultant-desk.tsx#L288) | Ver contexto y evidencia |
| [dashboard/client-meta.tsx:445](../apps/web/src/app/dashboard/client-meta.tsx#L445) | Diagnóstico de operativa Meta (panel) |
| [dashboard/client-shopify.tsx:419](../apps/web/src/app/dashboard/client-shopify.tsx#L419) | (panel de diagnóstico) |
| [components/ai-diagnostic-section.tsx:1371](../apps/web/src/components/ai-diagnostic-section.tsx#L1371) | Leer el contexto completo |
| [planificacion/calendario/page.tsx:75](../apps/web/src/app/planificacion/calendario/page.tsx#L75) | Ver propuesta completa |
| [marketing/page.tsx:1543](../apps/web/src/app/marketing/page.tsx#L1543) | Detalles |
| [conocimiento/store-questionnaire.tsx:366](../apps/web/src/app/conocimiento/store-questionnaire.tsx#L366) | Ver un ejemplo de buena respuesta |

**Ajustes opcionales dentro de un formulario** (el ejemplo "Settings Panel" de shadcn):

| Sitio | Texto |
|---|---|
| [components/campaign-plan-proposal.tsx:731](../apps/web/src/components/campaign-plan-proposal.tsx#L731) | Ajustes opcionales |
| [components/campaign-plan-proposal.tsx:796](../apps/web/src/components/campaign-plan-proposal.tsx#L796) | Ver distribución por semanas |
| [admin/onboarding/page.tsx:1176](../apps/web/src/app/admin/onboarding/page.tsx#L1176) | Moneda y zona horaria |
| [admin/agentes/judge-dataset-panel.tsx:208](../apps/web/src/app/admin/agentes/judge-dataset-panel.tsx#L208) | Añadir caso |
| [admin/facturacion/page.tsx:1038](../apps/web/src/app/admin/facturacion/page.tsx#L1038) | Configuración fiscal y acciones de facturación |
| [marketing/template-builder.tsx:552](../apps/web/src/app/marketing/template-builder.tsx#L552) | (bloque del constructor) |

### B. `CollapsibleSection` (8, sin tocar los sitios)

[consultor/workbench.tsx](../apps/web/src/app/consultor/workbench.tsx) (3),
[tareas/page.tsx](../apps/web/src/app/tareas/page.tsx) (2),
[marketing/page.tsx](../apps/web/src/app/marketing/page.tsx),
[components/onboarding-checklist.tsx](../apps/web/src/components/onboarding-checklist.tsx),
[components/ui/integration-activation-checklist.tsx](../apps/web/src/components/ui/integration-activation-checklist.tsx).
Se rehace por dentro sobre `Collapsible` y estos sitios ganan la animación y el `?focus=`.

### C. Bloques con `useState` (13 → `Collapsible` controlado)

Ninguno lleva `aria-controls`; la última columna marca lo que falta además.

| Sitio | Qué abre | Falta además |
|---|---|---|
| [components/ai-diagnostic-section.tsx:316](../apps/web/src/components/ai-diagnostic-section.tsx#L316) | Notas del equipo | — |
| [components/ai-diagnostic-section.tsx:1489](../apps/web/src/components/ai-diagnostic-section.tsx#L1489) | Respuesta completa | `aria-expanded` |
| [components/ai-diagnostic-section.tsx:1668](../apps/web/src/components/ai-diagnostic-section.tsx#L1668) | Avisos | — |
| [camino/camino-create-panel.tsx:824](../apps/web/src/app/camino/camino-create-panel.tsx#L824) | Diagnóstico ("Mostrar menos") | — |
| [llamadas/calls-client.tsx:1323](../apps/web/src/app/llamadas/calls-client.tsx#L1323) | Transcripción completa | usa `btn.ghostSm` de un CSS module, no `Button` |
| [components/copilot-panel.tsx:1744](../apps/web/src/components/copilot-panel.tsx#L1744) | Traza de herramientas por mensaje | — |
| [components/copilot-panel.tsx:2172](../apps/web/src/components/copilot-panel.tsx#L2172) | Fuentes por mensaje | — |
| [integraciones/shopify/page.tsx:222](../apps/web/src/app/integraciones/shopify/page.tsx#L222) | Formulario de conexión | — |
| [marketing/imagenes/page.tsx:774](../apps/web/src/app/marketing/imagenes/page.tsx#L774) | Panel de importar | — |
| [marketing/imagenes/[overlayId]/page.tsx:844](../apps/web/src/app/marketing/imagenes/[overlayId]/page.tsx#L844) | Selector de imagen | `aria-expanded` |
| [camino/page.tsx:3657](../apps/web/src/app/camino/page.tsx#L3657) | Editor del camino | `aria-expanded` |
| [marketing/klaviyo-import-panel.tsx:193](../apps/web/src/app/marketing/klaviyo-import-panel.tsx#L193) | Vista previa de plantilla ("Ver/Ocultar") | `aria-expanded` |
| [admin/tools/page.tsx:172](../apps/web/src/app/admin/tools/page.tsx#L172) | Casos de la solicitud | — (subrayado a mano) |

### D. Listas recortadas "Ver N más" (8 → `Collapsible`)

Patrón del ejemplo "Order #4189" de shadcn: los primeros N quedan fuera del contenido plegable, el
resto dentro, y un disparador único con el mismo texto en toda la app ("Ver N más" / "Ver menos").

| Sitio | Lista |
|---|---|
| [dashboard/client-pulse.tsx:888](../apps/web/src/app/dashboard/client-pulse.tsx#L888) | Hallazgos |
| [dashboard/client-pulse.tsx:1471](../apps/web/src/app/dashboard/client-pulse.tsx#L1471) | Tareas de la semana |
| [dashboard/consultant-desk.tsx:348](../apps/web/src/app/dashboard/consultant-desk.tsx#L348) | Asuntos |
| [dashboard/consultant-portfolio.tsx:108](../apps/web/src/app/dashboard/consultant-portfolio.tsx#L108) | Clientes |
| [consultor/workbench.tsx:455](../apps/web/src/app/consultor/workbench.tsx#L455) | Filas de la cartera |
| [marketing/today-view.tsx:236](../apps/web/src/app/marketing/today-view.tsx#L236) | Pendientes de revisión |
| [tareas/page.tsx:1682](../apps/web/src/app/tareas/page.tsx#L1682) y [:2487](../apps/web/src/app/tareas/page.tsx#L2487) | Fases ocultas (`PhaseScopeNote`) |

## No es `Collapsible`: va a `Accordion` (6)

Uno abierto de varios en una lista, con estado `id | null` a mano.

| Sitio | Lista |
|---|---|
| [camino/page.tsx:608](../apps/web/src/app/camino/page.tsx#L608) y [:775](../apps/web/src/app/camino/page.tsx#L775) | Fases e hitos (disclosure propio, documentado en la línea 483) |
| [admin/onboarding/page.tsx:1278](../apps/web/src/app/admin/onboarding/page.tsx#L1278) | Fuentes de importación |
| [components/ai-proposed-tasks.tsx:163](../apps/web/src/components/ai-proposed-tasks.tsx#L163) | Tareas propuestas (detalle) |
| [admin/infraestructura/page.tsx:719](../apps/web/src/app/admin/infraestructura/page.tsx#L719) | Organizaciones afectadas (`<details>` en bucle) |
| [camino/camino-consultant.tsx:1469](../apps/web/src/app/camino/camino-consultant.tsx#L1469) | Meses del objetivo (`<details>` en bucle) |
| [components/campaign-plan-proposal.tsx:834](../apps/web/src/components/campaign-plan-proposal.tsx#L834) | Semanas del plan (`<details>` en bucle) |

`client-pulse` también abre pasos y notas por tarea (`openSteps`/`openComments`, uno a la vez), pero
están en la fila de la tarea con más controles: se decide al migrar la fila, no aquí.

## Parecen plegables y no lo son

| Qué | Sitios | Destino |
|---|---|---|
| Navegación y paneles laterales | `portal-shell` (menú móvil, copiloto), `platform-admin-shell` | Se quedan (`Sheet` si se rehacen) |
| Menús flotantes | `portal-feedback`, `flow-builder` (+ añadir paso), historial y bandeja de escalados del copiloto, email de informe del copiloto | `Popover` / `DropdownMenu` |
| Maestro-detalle | KPI del Pulso y del escritorio (`useKpiDisclosure`), `observabilidad` (`expandedRunId`), borradores de `/marketing` (`expandedDraftId`), banco de imágenes (`AttachmentTrigger`), tarjeta seleccionable de `/marketing` | Se quedan: el detalle no está debajo del disparador |
| Filtros sí/no | "Solo por revisar" en `/shopify`, `/meta`, `/klaviyo`; "Solo pendientes" en `/llamadas`; hitos en la agenda | `Switch` / `ToggleGroup` |
| Formularios de alta | `/tiendas` (`isAdding`), `/admin/clientes` y `/admin/consultores` (`creating`), `/tareas` (`isCreatingTask`) | `Dialog`/`Sheet` (clientes ya lo usa) |
| Cargar más | `team-security-section` "Ver más" pide la página siguiente | Se queda: es paginación |
| Mostrar contraseña | `password-input` | Se queda |
| Ayuda en modal | `InfoModalButton` ("Ver pasos y permisos", "Ver requisitos", "Ver detalle técnico"…) en `/integraciones` | **Decisión de producto:** son textos de ayuda; como `Collapsible` en línea se leen sin tapar la página. Se quedan en modal salvo que se decida lo contrario |

## Orden propuesto

1. **Componente:** `collapsible.tsx` + estilos + catálogo + `CollapsibleSection` encima + guarda +
   evento de revelado compartido con `Accordion`/`FocusTarget`. Arregla de paso el `?focus=` en los 8
   `CollapsibleSection`.
2. **Lo que ve el cliente:** Pulso (`client-pulse`, `client-meta`, `client-shopify`), "Sobre estos
   datos" (4) y `ai-insight`.
3. **Mi Camino** (13 `<details>` + editor): de paso se borran 4 estilos de `summary` en sus CSS modules.
4. **Consultor:** escritorio, cartera, `/consultor`, `/marketing`, copiloto, diagnóstico IA, llamadas.
5. **Admin e integraciones:** detalle técnico, onboarding, facturación, laboratorio, herramientas.
6. **Accordion pendientes** (6 de arriba).

Cada fase quita sus ficheros de la lista de pendientes de la guarda y los estilos de
`summary`/`[open]` que se queden huérfanos en los CSS modules.
