# Agenda del consultor + Canal de mensajería consultor↔cliente

Estado: **Fase 1 (Agenda) implementada** · **Fase 2 (Mensajería) implementada y migración aplicada**
(2026-09-03; advisors de seguridad sin hallazgos nuevos) — typecheck api+web y lint OK. Falta prueba
manual con consultor + cliente reales.

Fase 2 — archivos tocados:
- `supabase/migrations/20260903120000_consultant_client_messages.sql` — tablas + RLS + bucket privado
  `consultant-messages`. **Sin aplicar**: correr por el flujo normal (`npm run db:push` / supabase).
- `apps/api/src/consultant-messages.ts` — `listClientMessageThreads`, `listThreadMessages`,
  `uploadThreadAttachment`, `postThreadMessage` (nuevo).
- `apps/api/src/server.ts` — 4 rutas + import.
- `apps/web/src/components/consultant-messages.tsx` — `MessageThread`, `MessageThreadsCard`, modal (nuevo).
- `apps/web/src/app/mensajes/page.tsx` — página dos paneles (nuevo).
- `apps/web/src/app/dashboard/page.tsx` — `<MessageThreadsCard />` en `GeneralOverview`.
- `apps/web/src/components/portal-shell.tsx` — nav "Mensajes" (solo consultor).

Notas de implementación:
- Adjuntos (imágenes **y archivos**: PDF, Office, texto, CSV, ZIP) en bucket **privado**; se guarda solo
  `storage_path` en `attachments jsonb`, y cada lectura devuelve `signed_url` de 1 h. Subida en dos pasos:
  `POST .../consultant-messages/attachments` (base64) → descriptor → se adjunta al `POST
  .../consultant-messages`.
- **Canal bidireccional**: lo usan consultor/admin y el cliente (owner/manager de su workspace). Nav
  "Chats" en ambos roles; `/mensajes` sin guard de consultor (la ruta se queda en `/mensajes`, solo cambia
  la etiqueta visible). `listClientMessageThreads` ya no exige
  rol consultor: siembra hilos desde `consultant_assignments` (lado consultor) o desde la membership real
  (lado cliente), y resuelve la contraparte al revés en cada caso (cliente ve a su consultor primario).
- `MessageThread` recibe `viewerIsClient` para alinear las burbujas (mías = `client` para el cliente,
  `consultant`/`platform` para el consultor).
- **Widgets en el dashboard**, siempre en una fila `lg:grid-cols-[65fr_35fr]` (agenda 65 % / chats 35 %):
  - Vista general del consultor (`GeneralOverview`): `<ConsultantAgenda embedded clients=… />` +
    `<MessageThreadsCard />` (lista de chats de la cartera).
  - Dashboard por tienda (`DashboardContent`, pestaña "Todo" — lo ven el cliente y el consultor con
    cliente activo): `<ConsultantAgenda embedded fixedScope={organization.id} />` + card "Chats" con
    `<MessageThread>` de esa organización. `fixedScope` oculta el selector de alcance y no pisa la
    preferencia de scope guardada.
  - `/v1/consultant/agenda` ya no exige rol consultor (las membresías del contexto + RLS limitan filas).
- Enviar mensaje: **Enter** envía, **Shift+Enter** salto de línea.
- **Numerito en el nav**: `PortalShellContent` suma `unread_count` de `/v1/consultant/message-threads` y lo
  pinta como pill en la entrada `/mensajes` (`navBadges` es ampliable a otros módulos). Refresca al navegar
  y cada 60 s. La ruta del endpoint sigue bajo `/v1/consultant/` aunque ya la use el cliente (sin renombrar
  para no tocar 3 sitios).
- `listClientMessageThreads` siembra un hilo por cada `consultant_assignments` activo del caller (tenga
  mensajes o no) para poder **empezar** la conversación; los que ya tienen mensajes van primero. Si no hay
  asignaciones, la lista sale vacía (no es un bug: hay que asignar cliente al consultor en /consultor).
- La lista de hilos y la cabecera muestran la **persona** contraparte (contacto del cliente:
  `organization_members` owner > manager → `profiles.full_name` + `avatar_url`), con el nombre de la
  tienda como línea secundaria. `listClientMessageThreads` resuelve `counterpart_name` /
  `counterpart_avatar_url` con service client. Si la org no tiene owner/manager, cae al nombre de la tienda.
- Sin realtime: `MessageThread` refresca al enviar y con `setInterval` de 30 s mientras está montado.
- ponytail: `listClientMessageThreads` lee hasta 2000 mensajes de la cartera sin filtro de org (RLS
  filtra). Paginar/acotar por org si crece.

Fase 1 — archivos tocados:
- `apps/api/src/consultant.ts` — `listConsultantAgenda(...)`.
- `apps/api/src/server.ts` — ruta `GET /v1/consultant/agenda` + import.
- `apps/web/src/lib/calendar-dates.ts` — helpers de fecha (nuevo).
- `apps/web/src/components/consultant-agenda.tsx` — widget (nuevo).
- `apps/web/src/app/agenda/page.tsx` — página standalone (nuevo).
- `apps/web/src/app/dashboard/page.tsx` — `<ConsultantAgenda embedded>` en `GeneralOverview`.
- `apps/web/src/components/portal-shell.tsx` — entrada de nav "Agenda" (solo consultor).

## Contexto

En el dashboard en *vista general* (consultor sin cliente activo, `GeneralOverview` en
[apps/web/src/app/dashboard/page.tsx](../apps/web/src/app/dashboard/page.tsx)) faltan dos piezas que el consultor
pide para el día a día:

1. **Agenda / calendario** con lo que toca hoy — tareas del consultor y de los clientes, hitos de Mi Camino
   y días de planificación de campañas — con vistas día / semana / mes y tres alcances (consultor, todas las
   tiendas, tienda a tienda).
2. **Canal de mensajería** consultor↔cliente (hilo por organización). Hoy solo existe el copiloto IA
   (`consultant-chat`, consultor↔IA) y los comentarios internos de tareas; no hay conversación humana
   consultor↔cliente. Encaja con el principio "SaaS como conversación".

Decisiones tomadas con el usuario:

- **Agenda propia del consultor** = unión de (a) tareas con `assigned_to = consultor` **o** `created_by =
  consultor` en toda la cartera y (b) tareas de las orgs donde el consultor es miembro real (`own_stores`).
- **Mi Camino → agenda**: sin columna ni flag nuevos. Las tareas de Mi Camino ya son filas de `tasks` con
  `due_at` y aparecen solas. La agenda añade un chip "Hitos de Mi Camino" que pinta
  `strategic_plan_milestones.target_date` como entradas de día completo. Preferencia en `localStorage`.
- **Mensajería**: card en el dashboard + módulo `/mensajes` (nav) + modal de hilo. Construir en Fase 2.
- **Orden**: Agenda primero; este documento deja la Fase 2 lista para ejecutar sin re-investigar.

Restricciones del repo confirmadas:

- Toda fila de `tasks` tiene `organization_id NOT NULL`. No hay tabla de tareas del consultor ni de
  preferencias por usuario (`profiles` no tiene columna de settings).
- Escrituras siempre vía API con `SUPABASE_SERVICE_ROLE_KEY` + chequeo de rol; RLS de las tablas solo
  `select` a `authenticated` (patrón `marketing_content_draft_notes`).
- El front **no** usa Supabase realtime en ningún sitio. Refresco = fetch/refetch.
- Helpers RLS existentes: `private.can_access_org(org)`, `private.is_assigned_consultant(org)`,
  `private.is_platform_admin()`, `private.current_member_role(org)`.

---

## FASE 1 — Agenda del consultor

### 1.1 Backend — `GET /v1/consultant/agenda`

**Handler nuevo** `listConsultantAgenda(env, authorization, context, { from, to, scope })` en
[apps/api/src/consultant.ts](../apps/api/src/consultant.ts) (junto a `getConsultantOverview` / `listConsultantOperations`).

Query params:

| param | forma | notas |
|---|---|---|
| `from` | ISO datetime | inicio de ventana (inclusive) |
| `to` | ISO datetime | fin de ventana (exclusive) |
| `scope` | `own` \| `all` \| `<organizationId>` | por defecto `all` |

Reglas:

- Rechazar `platform_role` ∉ `{platform_admin, consultant}` → 403 `consultant_access_required` (mismo patrón
  que `listConsultantOrganizations`, `consultant.ts:97-104`).
- Cap de ventana: `to - from ≤ 62 días` → 400 `agenda_range_too_large` (equivalente al cap de
  `listConsultantOrders`).
- IDs de cartera: reutilizar `listConsultantOrganizations(env, authorization, context)` para (a) el set de
  org ids accesibles y (b) el mapa `id → display_name`. Separar:
  - **own**: org ids con membership real (accessSource `"membership"` en `context.memberships`) ∪ resultado
    de la consulta de tareas filtrada por `assigned_to = context.user.id` **o** `created_by = ...` sobre
    todo el set accesible.
  - **all**: todas las org ids asignadas al consultor.
  - **`<organizationId>`**: validar que está en el set accesible (si no, 403); solo esa.
- Idiom `safeIds` (sentinela UUID cero) al construir los `.in("organization_id", ...)`.
- Cliente **user-scoped** (`createUserScopedClient(env, token)`) para que RLS haga el filtro final de acceso.
- Fan-out `Promise.all` de 3 fuentes (cada una con su try/catch → primer `error` corta con 500
  `agenda_load_failed`):

  1. `tasks` — `select("id, title, status, priority, due_at, organization_id, source, is_visible_to_client")`
     `.in("organization_id", safeIds).not("due_at","is",null).gte("due_at", from).lt("due_at", to)`.
     En `scope=own` además `.or("assigned_to.eq.<id>,created_by.eq.<id>")` sobre las orgs que **no** son
     own_stores (las own_stores entran enteras).
  2. `campaign_calendar_items` — `select("id, title, channel, item_type, starts_at, ends_at, status,
     organization_id, calendar_id, task_id, milestone_id")` `.in("organization_id", safeIds)
     .is("deleted_at", null).gte("starts_at", from).lt("starts_at", to)`.
  3. `strategic_plan_milestones` — `select("id, name, target_date, status, organization_id,
     strategic_plan_phases(name)")` `.in("organization_id", safeIds).not("target_date","is",null)
     .gte("target_date", <from date>).lte("target_date", <to date>)`. (Siempre se devuelve; el front decide
     si pinta los hitos según el chip.)

- Adjuntar `organization_name` desde el mapa de `listConsultantOrganizations`.
- Respuesta:

  ```jsonc
  {
    "from": "...", "to": "...", "scope": "all",
    "tasks":          [{ "id","title","status","priority","due_at","organization_id","organization_name","source","is_visible_to_client" }],
    "planning_items": [{ "id","title","channel","item_type","starts_at","ends_at","status","organization_id","organization_name" }],
    "milestones":     [{ "id","name","target_date","status","organization_id","organization_name","phase_name" }]
  }
  ```

**Ruta** en [apps/api/src/server.ts](../apps/api/src/server.ts) junto al resto de `/v1/consultant/*` (~L793-944):

```ts
app.get<{ Querystring: { from?: string; to?: string; scope?: string } }>(
  "/v1/consultant/agenda",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantAgenda(env, authorization, auth.context, {
      from: request.query.from, to: request.query.to, scope: request.query.scope || "all",
    });
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  },
);
```

### 1.2 Frontend

**Helpers de fecha compartidos** — nuevo `apps/web/src/lib/calendar-dates.ts` con
`startOfDay`, `addDays`, `addMonths`, `monthStart`, `monthEnd`, `mondayStart`, `dayKey`.
`planificacion/calendario/page.tsx` mantiene sus copias locales por ahora: su `dayKey` usa
`toISOString().slice(0,10)` (UTC) y migrarlo cambiaría el emparejamiento de ítems cerca de medianoche
UTC. El `dayKey` del lib nuevo es local-time (correcto para la rejilla) y solo lo usa la agenda.

**Componente** `apps/web/src/components/consultant-agenda.tsx`:

- Props: `{ embedded?: boolean; clients?: Array<{ organization_id: string; display_name: string }>; onSelectClient?: (id: string) => void }`.
  - `embedded` (dashboard): `clients` viene de `data.portfolio` de `/v1/consultant/overview`.
  - standalone (`/agenda`): si no hay `clients`, fetch `GET /v1/consultant/organizations`.
- Estado: `view` (`day|week|month`), `scope` (`own|all|<orgId>`), `cursor` (Date), `showMilestones` (bool).
  Persistir los tres en `localStorage`: `ecomscaling.agenda.view`, `.scope`, `.showMilestones`.
- Ventana `from`/`to` desde `view` + `cursor`:
  - `day` → `[startOfDay(cursor), +1d)`
  - `week` → `[mondayStart(cursor), +7d)`
  - `month` → `[mondayStart(monthStart(cursor)), +42d)` (rejilla 6×7, igual que el calendario existente).
- Fetch `GET /v1/consultant/agenda?from&to&scope` en cambios de `[view, scope, cursor]`.
- **Switcher de vista**: fila de chips `<button>` (día/semana/mes), convención `PeriodSelector`.
- **Switcher de alcance**: `Select` `bare` de `@/components/ui` (mismo look que el selector de cliente del
  header). Opciones: `Mi calendario` (`own`), `Todas las tiendas` (`all`) y sección "Clientes" con una
  opción por cliente (`scope = <organizationId>`).
- Navegación Anterior / Hoy / Siguiente (lógica `move()` del calendario existente, adaptada a day/week/month).
- Render por vista:
  - `day`: una columna, entradas ordenadas por hora.
  - `week`: 7 columnas.
  - `month`: rejilla `grid-cols-7`, 42 celdas, atenúa días de otro mes.
  - Entrada = tarea (color por prioridad/vencida + badge de org en `scope=all`), ítem de planificación
    (color por canal), hito (solo si `showMilestones`, día completo). Click: tarea → `/tareas`
    (`onSelectClient(org)` si aplica); planificación → `/planificacion/calendario`; hito → `/camino`.
- Chip `Hitos de Mi Camino` (toggle `showMilestones`). Sin subtexto de ayuda.
- Estados loading / error / vacío por vista (`LoadingBlock` / `ErrorBlock` / texto muted).
- Construir todo desde `@/components/ui` (HeroUI v3), blanco dominante, azul solo acento, espaciado 8pt.

**Wiring:**

- [apps/web/src/app/dashboard/page.tsx](../apps/web/src/app/dashboard/page.tsx) — en `GeneralOverview`,
  añadir `<ConsultantAgenda embedded clients={data.portfolio} onSelectClient={onSelectClient} />` como fila
  ancha, justo tras `<RecentOrdersWidget />`.
- Nueva página `apps/web/src/app/agenda/page.tsx` — `PortalShell` + `<ConsultantAgenda />` standalone.
  Guard consultor (copiar el de `planificacion/calendario/page.tsx:295-303`). Funciona en vista general
  (no añadir a `ORG_SCOPED_PREFIXES`).
- [apps/web/src/components/portal-shell.tsx](../apps/web/src/components/portal-shell.tsx) — añadir
  `{ href: "/agenda", label: "Agenda" }` a `consultantNavGroups` (tras `/tareas`). No añadir a
  `clientNavGroups`. Icono en `NAV_ICONS` (`CalendarIcon` de `@/components/ui/icons`).

### 1.3 Verificación Fase 1

- `npm run typecheck -w @ecomscaling/api` y `npm run typecheck -w web`.
- `npm run dev`; login como consultor; `/dashboard` en vista general → la agenda renderiza; cambiar
  vista (día/semana/mes) y alcance (consultor / todas / un cliente); toggle "Hitos de Mi Camino".
- `/agenda` carga standalone y respeta la preferencia guardada.
- `curl` al endpoint con bearer de consultor para `scope=own|all|<orgId>` y rangos válido / >62 días.
- Sin migración → no hace falta `get_advisors`.

---

## FASE 2 — Canal de mensajería consultor↔cliente  *(documentado, sin empezar)*

### 2.1 Migración — `supabase/migrations/<ts>_consultant_client_messages.sql`

```sql
create table public.consultant_client_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_kind text not null check (author_kind in ('consultant','client','platform','system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index consultant_client_messages_org_idx
  on public.consultant_client_messages (organization_id, created_at desc);

create table public.consultant_client_message_reads (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.consultant_client_messages enable row level security;
alter table public.consultant_client_message_reads enable row level security;

create policy "consultant_client_messages_select_workspace"
on public.consultant_client_messages for select to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
  or private.current_member_role(organization_id) in ('owner','manager')
);
create policy "consultant_client_message_reads_select_own"
on public.consultant_client_message_reads for select to authenticated
using (user_id = auth.uid());

grant select on public.consultant_client_messages to authenticated;
grant select on public.consultant_client_message_reads to authenticated;
```

Sin políticas de `insert/update/delete`: todo se escribe con service role desde la API (igual que
`marketing_content_draft_notes`). Líneas de sistema (p. ej. "el consultor cerró el plan") reusan la tabla
con `author_kind = 'system'`, `author_user_id = null`.

### 2.2 API — `apps/api/src/consultant-messages.ts` (módulo nuevo, esqueleto de `campaign-planning.ts`)

- `createServiceClient` / `createUserScopedClient` copiados del patrón (o importados de un util común si ya
  existe para entonces).
- `resolveThreadAuthorKind(context, organizationId)` — copia de `resolveDraftAuthorKind`
  ([consultant.ts:1376-1388](../apps/api/src/consultant.ts#L1376-L1388)): admin→`platform`, consultor→`consultant`,
  owner/manager→`client`, resto→`null` (403).
- **`listClientThreads(env, authorization, context)`** — para la card. Solo consultor/admin. Cliente
  user-scoped: leer `consultant_client_messages` de todas las orgs accesibles ordenado por `created_at desc`,
  quedarse con el último por org, + `consultant_client_message_reads` del `auth.uid()` para el `unread_count`
  (`created_at > last_read_at` y `author_user_id <> me`). Devuelve
  `{ threads: [{ organization_id, organization_name, last_message: { body, author_kind, created_at }, unread_count }] }`.
- **`listThreadMessages(env, authorization, context, organizationId, { before?, limit=50 })`** — chequeo
  `context.memberships.some(m => m.organization_id === organizationId)` (si no, 403
  `organization_access_denied`). Cliente user-scoped, `select("id, body, author_user_id, author_kind,
  created_at").eq("organization_id", organizationId).order("created_at", { ascending: true })`. Adjuntar
  `author_name` con un fetch service a `profiles` (copiar `listMarketingDraftNotes:1341-1358`). Efecto
  lateral: `upsert` en `consultant_client_message_reads` con `last_read_at = now()` para el caller (service).
- **`postThreadMessage(env, context, organizationId, { body })`** — `resolveThreadAuthorKind` o 403
  `consultant_thread_access_required`; `body.trim()` no vacío o 400 `message_body_required`; insert service
  `{ organization_id, author_user_id: context.user.id, author_kind, body: text.slice(0, 4000) }`; devolver
  `.select("id, body, author_user_id, author_kind, created_at").single()`; `recordAuditLog(...)`. 201.

Todas devuelven `{ ok: true, data }` / `{ ok: false, statusCode, error, detail? }`.

### 2.3 Rutas en `server.ts`

Patrón GET/POST de `marketing/drafts/:draftId/notes` ([server.ts:1009-1065](../apps/api/src/server.ts#L1009-L1065)) —
pasar `request.headers.authorization`, 401 si falta en el GET.

- `GET  /v1/consultant/message-threads`                          → `listClientThreads`
- `GET  /v1/organizations/:organizationId/consultant-messages`   → `listThreadMessages` (querystring `before?`, `limit?`)
- `POST /v1/organizations/:organizationId/consultant-messages`   → `postThreadMessage` → `reply.code(201)`

### 2.4 Frontend

- `apps/web/src/components/consultant-messages.tsx`:
  - **`<MessageThreadsCard clients onSelectClient />`** — card compacta (mitad de ancho, va en la fila
    `grid lg:grid-cols-2` de `GeneralOverview`). Lista de `GET /v1/consultant/message-threads`: por fila
    nombre de org + snippet del último mensaje + tiempo relativo + punto de no leído. Click → abre
    `<MessageThreadModal organizationId />`.
  - **`<MessageThreadModal>`** — `Modal` de `@/components/ui`. Fetch `GET
    /v1/organizations/:id/consultant-messages`; lista de burbujas (izq/der según
    `author_kind === 'consultant'`), `author_name` + hora; textarea + enviar (`POST`); refetch al enviar y
    cada 30 s mientras está abierto (no hay realtime en el front). Reutilizable como panel embebido en la
    página `/mensajes` (extraer el cuerpo del hilo del shell del modal).
- `apps/web/src/app/mensajes/page.tsx` — `PortalShell`; dos paneles: lista de hilos a la izquierda, hilo
  activo a la derecha (reutiliza el cuerpo del hilo). Guard consultor. Funciona en vista general.
- [apps/web/src/components/portal-shell.tsx](../apps/web/src/components/portal-shell.tsx) — añadir
  `{ href: "/mensajes", label: "Mensajes" }` a `consultantNavGroups`; icono en `NAV_ICONS`. No en
  `clientNavGroups` (o, si el cliente también debe tener acceso a su hilo, decidir aparte).
- [apps/web/src/app/dashboard/page.tsx](../apps/web/src/app/dashboard/page.tsx) — en `GeneralOverview`,
  meter `<MessageThreadsCard clients={data.portfolio} onSelectClient={onSelectClient} />` en la fila
  `grid gap-5 lg:grid-cols-2`.

### 2.5 Verificación Fase 2

- `mcp__supabase apply_migration` (rama o local) → `list_migrations` → `get_advisors` (security) confirma
  RLS sin fugas.
- `npm run typecheck` en api y web.
- Manual: consultor escribe; segundo login como owner del cliente ve el mensaje; el punto de no leído se
  limpia al abrir el hilo; `author_kind` correcto por rol.
- Test cross-tenant: un consultor no asignado a la org recibe 403 en GET y POST (añadir caso a
  `be-01-cross-tenant-*` si procede).

---

## Notas de diseño transversales

- UI: `@/components/ui` (HeroUI v3) obligatorio, una sola fuente, blanco dominante, azul (#1d4ed8) solo
  acento, sin subtextos salvo que eviten un error/restricción, escala 8pt / ADR-0020.
- No sumar atribución entre plataformas (no aplica aquí, pero la agenda no inventa métricas).
- Nada de `git commit` / `push`: dejar los cambios en el working tree.
