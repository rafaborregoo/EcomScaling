# Campañas: el cliente crea, el consultor revisa, A05 edita

Estado: backend, pantalla y acciones rápidas hechos (2026-10-07). La pantalla vive en `apps/web/src/app/marketing/campanas/`
(cartera, cliente, tienda, campaña abierta y vista del cliente); `campaigns-view.tsx` decide cuál toca.
Verificada en navegador solo la vista del cliente; las del consultor, solo con typecheck y lint.

## Decisiones (Rafa, 2026-10-07)

1. **El cliente puede crear su propia campaña aunque tenga consultor.** Hasta ahora, con consultor la
   agenda la llevaba solo él (`agenda_managed_by_consultant`) y el cliente solo podía «sugerir». Sin
   consultor no cambia nada: el cliente se gobierna solo.
2. **El consultor recibe un aviso y la revisa**: anota, corrige a mano o con IA, pide cambios o la da por
   revisada. Las campañas del cliente con consultor no se programan en Klaviyo hasta estar revisadas.
3. **A05 edita desde dentro** el email, el creativo Meta y la fecha. La IA propone; una persona aplica.
4. **Programar y enviar desde NORA**: el consultor asignado también puede (antes solo owner/manager).
5. La navegación del módulo vive solo en el menú: sin pestañas duplicadas en la cabecera.
6. Las **acciones rápidas** (CRUD): hechas, ver su sección.

## Modelo de datos (migración `20261204100000`)

- `campaign_calendar_items`: `origin` (`staff` | `client` | `ai`), `review_status` (`pending` |
  `changes_requested` | `reviewed` | null), `review_requested_at`, `reviewed_by`, `reviewed_at`.
  Backfill: propuestas de A05 → `ai`; sugerencias de cliente sin aceptar → `client` + `pending`.
- `campaign_item_notes`: hilo por campaña. `kind` = `note` | `correction` | `ai_proposal` | `system`;
  `target` = apartado al que se refiere; `visible_to_client` (las notas internas del consultor no las ve
  el cliente: RLS + filtro de la API); `payload` con los cambios propuestos por la IA; `resolution`.
  El hilo de cada pieza (`marketing_content_draft_notes`) se lee junto con este.

## Quién puede qué

| Acción | Staff (consultor asignado / platform_admin) | Cliente con consultor | Cliente sin consultor |
|---|---|---|---|
| Crear campaña | sí (origen `staff`) | sí, **solo la suya** (origen `client`, entra en revisión) | sí (origen `staff`) |
| Editar / archivar | cualquiera | solo las suyas, sin tocar estado ni enlaces del proveedor; editar la devuelve a `pending` | cualquiera |
| Nota en el hilo | sí, visible o interna | sí, visible | sí |
| Corrección a un apartado | sí | no | — |
| Revisar / pedir cambios | sí | no (puede devolverla a revisión) | — |
| Editar con IA | cualquiera | solo las suyas | cualquiera |
| Programar / enviar / cancelar en Klaviyo | **sí** (nuevo) | sí, solo si está revisada | sí |

Programar exige pieza aprobada (como antes). Al programar el consultor, el cliente recibe un aviso y una
línea en el hilo. Un consultor nunca ve la credencial de Klaviyo: lo hace el servidor. El permiso nuevo
es `canOperateCampaigns` (klaviyo.ts): se usa **solo** en programar/cancelar campaña y en el push de
plantilla que programar necesita; cuentas, tokens y el resto de la integración siguen siendo del cliente.

## Endpoints

- `GET  /v1/consultant/campaigns/overview?organizationId=&storeId=` — cartera, cliente o tienda: lo que
  sale esta semana, lo que va tarde, lo creado por clientes (cola de revisión), resumen por tienda y la
  semana pasada (EUR atribuidos por Klaviyo; no se suman monedas distintas ni se mezclan con Meta). Incluye
  el titular determinista de cada nivel (`@e-nora/contracts/campaigns-overview`).
- `GET|POST /v1/organizations/:org/campaign-planning/items/:item/thread`
- `POST /v1/organizations/:org/campaign-planning/items/:item/thread/:note/resolve`
- `POST /v1/organizations/:org/campaign-planning/items/:item/review` — `{ status: reviewed | changes_requested, message? }` (staff)
- `POST /v1/organizations/:org/campaign-planning/items/:item/review/request` — el cliente devuelve la campaña a revisión
- `POST /v1/organizations/:org/campaign-planning/items/:item/ai-edit` — `{ instruction }` → propuesta de A05
- `POST /v1/organizations/:org/campaign-planning/items/:item/ai-edit/:note/apply` — `{ fields?, dismiss? }`
- Crear/editar/archivar una campaña sigue siendo `…/campaign-planning/items` (ahora admite al cliente con consultor).

## Avisos

Tipo `campaign_review` en `notifications` (categoría «other», silenciable). Cliente crea/edita/escribe →
consultores asignados. Consultor escribe en visible / pide cambios / revisa / programa → owner y manager
del cliente. Nunca se avisa a quien hace la acción.

## Edición con IA (A05)

`proposeCampaignEdit` → `runCampaignEditorAgent` (A05 con guía de edición en tiempo de ejecución: sin
versión nueva de prompt). Lee campaña, pieza, correcciones abiertas, hilo y marca. Devuelve cambios por
campo (`subject`, `preheader`, `body` = HTML del email, `headline`/`description`/`primary_text`/
`destination_url` de Meta, `starts_at`). El «antes» lo calcula el servidor. Aplicar pasa por las
herramientas de siempre (editar la pieza → versión nueva y vuelta a aprobación; mover la fecha → item del
calendario) y cierra las correcciones del hilo que resuelve. Si la pieza cambió desde que se propuso, se
rechaza (409) y se pide otra propuesta. Tope de 10 propuestas por campaña y día.

**Pendiente:** editar un flow con IA. Los flows son diseños propios (`marketing_flow_designs`) y no cuelgan
de ninguna campaña: antes hay que decidir qué ancla un flow a un hilo de revisión. El formato de la propuesta
(`payload.edits[].field`) admite añadir `flow` sin migración.

## Acciones rápidas

Campañas que el consultor repite, a un clic. Migración `20261206100000` (TEST y PROD): tabla
`campaign_quick_actions` con RLS activa y sin políticas (solo escribe la API, clasificada como service-only
en `scripts/assert-rls-coverage.mjs`).

- **Visibilidad**: `me` (solo su dueño, en todos sus clientes, `organization_id` null), `client` (el equipo, solo
  en esa organización) y `shared` (además el cliente la ve como atajo). La restricción `scope_valid` impide
  una acción `me` con organización o una de cliente sin ella.
- **Tipo**: `plan` crea la campaña en el calendario con canal, audiencia, fecha y brief; `ia` la crea igual y
  abre Crear para que la IA escriba la pieza (solo email; en Meta se queda como `plan`).
- **Fecha**: `off` = hoy + N días (0–120); `dow` = primer día de la semana pedido, desde mañana, sin otra
  campaña del mismo nombre ese día. A las 10:00.
- **API** (`apps/api/src/campaign-quick-actions.ts`): `GET|POST /v1/organizations/:org/campaign-quick-actions`,
  `PATCH|DELETE .../:actionId`, `PUT .../order`. Escribe solo el staff; el cliente solo lee las compartidas.
  Usarla no tiene endpoint: la pantalla llama a la creación de campañas de siempre, así que si la usa el cliente
  entra en revisión y el consultor recibe el aviso («te llega el encargo»).
- **Pantalla** (`campanas/quick-actions.tsx`, `quick-actions-manager.tsx`): barra con las 8 primeras en la tienda
  del consultor y en la vista del cliente (solo compartidas: «Pídele algo a tu consultor» / «Atajos para tu
  asistente»); gestor en `?section=campanas&acciones=1` con lista ordenable, filtro, vista previa y formulario.
- **Límites**: la barra no se muestra en la cartera ni en un cliente sin tienda; no hay contador de usos
  («Usada N veces» del diseño) porque no se registra de qué acción nace cada campaña.
