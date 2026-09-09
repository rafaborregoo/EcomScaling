-- AI-30 fase 4: eventos de seguridad de las ejecuciones de IA.
--
-- El audit (docs/ai/AI_INFRASTRUCTURE_AUDIT.md, ficha 26) encontro que las
-- defensas ya existian y funcionaban, pero no dejaban rastro:
--
--   * `serializeUntrustedContextBlocks` contaba los patrones de inyeccion
--     neutralizados y `runAgentTurn` tiraba el numero
--     (packages/ai/src/index.ts). Un intento de inyeccion se limpiaba y
--     desaparecia: no habia forma de saber si nos atacan.
--   * Una herramienta pedida fuera del catalogo devolvia un error al modelo y
--     no quedaba constancia en ningun sitio.
--
-- Esta tabla NO detecta nada nuevo. Es el destino de lo que ya se detectaba.
--
-- Por que una tabla propia y no una fila mas en `agent_run_steps`: los pasos
-- son la narracion cronologica de un run y se consultan por run; los eventos de
-- seguridad se consultan al reves -- "dame todos los intentos de inyeccion de
-- la ultima semana, de cualquier organizacion" -- y necesitan severidad y sus
-- propios indices. Meterlos en `agent_run_steps` obligaria a filtrar por
-- step_type sobre una tabla mucho mas grande y sin indice util.
--
-- Contenido: METADATOS, nunca el texto que provoco el evento. El texto de un
-- intento de inyeccion es contenido no confiable y puede traer datos personales
-- del cliente; guardarlo en una tabla de auditoria mueve el problema en vez de
-- resolverlo.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

create table if not exists public.ai_security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Nullable: un evento puede detectarse fuera de un turno (por ejemplo al
  -- validar una peticion antes de crear el run).
  run_id uuid references public.agent_runs (id) on delete cascade,
  -- Correlacion con el resto de la operacion aunque el run se borre.
  trace_id text,
  event_type varchar(60) not null,
  severity varchar(20) not null,
  -- Donde se detecto: context_block, tool_result, tool_registry...
  source varchar(60) not null,
  -- Metadatos ya redactados. Nunca el contenido que provoco el evento.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_security_events_type check (
    event_type in (
      'prompt_injection_detected',
      'tool_poisoning_suspected',
      'unauthorized_tool_attempt',
      'permission_denied',
      'sensitive_data_access_attempt',
      'policy_violation'
    )
  ),
  constraint ai_security_events_severity check (
    severity in ('info', 'low', 'medium', 'high', 'critical')
  )
);

comment on table public.ai_security_events is
  'Eventos de seguridad de ejecuciones de IA. Solo metadatos: nunca el texto que provoco el evento, que es contenido no confiable y puede contener datos personales.';

comment on column public.ai_security_events.detail is
  'Metadatos ya pasados por sanitizeForTelemetry. Cuantos patrones, que herramienta, que bloques. Nunca el payload.';

-- Investigar un incidente empieza por "que ha pasado ultimamente y de que
-- gravedad", no por un run concreto.
create index if not exists ai_security_events_created_severity_idx
  on public.ai_security_events (created_at desc, severity);

create index if not exists ai_security_events_organization_idx
  on public.ai_security_events (organization_id, created_at desc);

create index if not exists ai_security_events_run_idx
  on public.ai_security_events (run_id)
  where run_id is not null;

create index if not exists ai_security_events_type_idx
  on public.ai_security_events (event_type, created_at desc);

alter table public.ai_security_events enable row level security;

-- Mismo criterio que agent_context_snapshots y agent_query_runs: un evento de
-- seguridad puede revelar como se ataca al sistema y que herramientas existen,
-- asi que no lo ve un cliente final aunque sea de su organizacion. Escritura
-- solo por service role (sin policy de insert), como el resto del runtime.
drop policy if exists "ai_security_events_select_staff" on public.ai_security_events;
create policy "ai_security_events_select_staff" on public.ai_security_events
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );
