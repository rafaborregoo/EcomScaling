-- AI-30 fase 1: correlacion y fidelidad del registro de ejecuciones de IA.
--
-- El audit (docs/ai/AI_INFRASTRUCTURE_AUDIT.md) encontro que agent_runs ya es
-- una buena tabla de trazas -- tiene tenant, objetivo, tokens, coste, latencia,
-- estado y RLS -- pero le faltan los datos que hacen falta para investigar un
-- incidente de verdad. Esta migracion NO crea tablas nuevas: anade columnas a
-- la que ya existe, porque el modelo TRACE/SPAN ya esta cubierto por
-- agent_runs + agent_run_steps y duplicarlo seria peor.
--
-- Lo que se arregla, en orden de gravedad:
--
-- 1. provider/model. runAgentTurnWithFallbackCore puede caer de Anthropic a
--    OpenAI en silencio, y el modelo real solo quedaba como texto dentro del
--    payload de un paso ("Llamada al modelo X"). El panel mostraba
--    agent_versions.model, que es el CONFIGURADO, no el ejecutado: ante un
--    incidente podia mentir sobre quien respondio.
--
-- 2. estimated_cost_usd pasa a nullable. Antes era `not null default 0` y
--    estimateCostUsd devolvia 0 para un modelo sin precio conocido: coste cero
--    silencioso, presupuestos que dejan de morder y facturacion falsa. Ahora
--    null = "no lo sabemos" y cost_basis dice por que. Los agregados existentes
--    ya toleran null: sum() ignora nulls y todos los consumidores TS hacen
--    `Number(x ?? 0)` (apps/api/src/consultant.ts, ai-runtime.ts).
--
-- 3. cache_read_tokens pasa a nullable por el mismo motivo: "el proveedor no
--    informo" y "hubo cero hits" no son el mismo hecho y no pueden compartir 0.
--
-- 4. trace_id / parallel_group_id / parent_run_id / root_run_id. La API ya
--    genera x-request-id y el orquestador ya genera tick_id, pero ninguno
--    llegaba a agent_runs: no se podia unir una peticion del navegador con la
--    ejecucion que provoco, ni agrupar las N ejecuciones de una misma pasada.
--
-- Las columnas de jerarquia se anaden aunque hoy sean null en el 100% de las
-- filas (no hay subagentes todavia): son nullable + indice, cuestan casi nada,
-- y evitan una migracion con backfill sobre una tabla ya grande el dia que se
-- introduzca el primero.
--
-- Idempotente (ADR-0014 / CLAUDE.md): todo con `if not exists`, los checks se
-- borran antes de crearse y el backfill filtra por `is null`.

-- --------------------------------------------------------------------------
-- 1. Proveedor y modelo realmente usados
-- --------------------------------------------------------------------------

alter table public.agent_runs
  add column if not exists provider varchar(40);

alter table public.agent_runs
  add column if not exists model varchar(120);

comment on column public.agent_runs.provider is
  'Proveedor que atendio realmente el turno (anthropic/openai). Puede diferir del configurado en agent_versions cuando actua el fallback R-020. null = ejecuciones anteriores a AI-30.';

comment on column public.agent_runs.model is
  'Modelo que atendio realmente el turno. No usar agent_versions.model para auditar: ese es el configurado, no el ejecutado.';

-- --------------------------------------------------------------------------
-- 2. Coste honesto
-- --------------------------------------------------------------------------

alter table public.agent_runs
  alter column estimated_cost_usd drop not null;

alter table public.agent_runs
  alter column estimated_cost_usd drop default;

alter table public.agent_runs
  add column if not exists cost_basis varchar(20);

alter table public.agent_runs
  drop constraint if exists agent_runs_cost_basis;

alter table public.agent_runs
  add constraint agent_runs_cost_basis
  check (cost_basis is null or cost_basis in ('priced', 'unknown_model'));

alter table public.agent_runs
  add column if not exists pricing_version varchar(40);

comment on column public.agent_runs.estimated_cost_usd is
  'Coste estimado en USD. null = no se pudo calcular (modelo sin precio en MODEL_PRICING); ver cost_basis. NUNCA rellenar con 0 para representar desconocimiento.';

comment on column public.agent_runs.cost_basis is
  'priced = el coste sale de una tarifa conocida. unknown_model = el modelo no esta tarifado y el coste es null; el run debe aparecer como incidente en el panel, no como gratis.';

comment on column public.agent_runs.pricing_version is
  'Version de la tabla de precios aplicada (PRICING_VERSION en packages/ai/src/provider-capabilities.ts). Permite auditar un coste historico despues de cambiar una tarifa.';

-- --------------------------------------------------------------------------
-- 3. Uso reportado por el proveedor: null = no lo reporto
-- --------------------------------------------------------------------------

alter table public.agent_runs
  alter column cache_read_tokens drop not null;

alter table public.agent_runs
  alter column cache_read_tokens drop default;

alter table public.agent_runs
  add column if not exists cache_creation_tokens bigint;

alter table public.agent_runs
  add column if not exists reasoning_tokens bigint;

comment on column public.agent_runs.cache_read_tokens is
  'Tokens leidos de prompt cache segun el proveedor. null = no informo del campo en este turno (distinto de 0 = informo y fue cero).';

comment on column public.agent_runs.cache_creation_tokens is
  'Tokens de creacion de prompt cache. null = el proveedor no lo reporta (hoy: siempre en OpenAI).';

comment on column public.agent_runs.reasoning_tokens is
  'Tokens de razonamiento. null = el modelo/proveedor no los expone. No inventar 0.';

-- --------------------------------------------------------------------------
-- 4. Correlacion: traza, jerarquia y ejecucion en paralelo
-- --------------------------------------------------------------------------

alter table public.agent_runs
  add column if not exists trace_id text;

alter table public.agent_runs
  add column if not exists parent_run_id uuid references public.agent_runs (id) on delete set null;

alter table public.agent_runs
  add column if not exists root_run_id uuid references public.agent_runs (id) on delete set null;

alter table public.agent_runs
  add column if not exists parallel_group_id text;

alter table public.agent_runs
  add column if not exists deployment_version varchar(80);

comment on column public.agent_runs.trace_id is
  'Correlacion de la operacion completa. Origen: x-request-id de la API (apps/api/src/server.ts) o el tick_id del orquestador. Un run sin padre tiene trace_id propio. Es text, no uuid: el identificador puede venir de un cliente o de un sistema de tracing externo y no siempre es un uuid.';

comment on column public.agent_runs.parent_run_id is
  'Run que delego este (subagentes). null = ejecucion raiz. Hoy siempre null: no hay subagentes todavia.';

comment on column public.agent_runs.root_run_id is
  'Raiz del arbol de ejecucion, para poder pintarlo sin CTE recursiva en el caso comun. Igual a id en una ejecucion raiz.';

comment on column public.agent_runs.parallel_group_id is
  'Lote de ejecuciones lanzadas juntas. Hoy: el tick_id de runDiagnosticOrchestratorTick, que ya se registra en ai_diagnostic_gate_log pero no se podia unir con los runs.';

comment on column public.agent_runs.deployment_version is
  'Version de la aplicacion desplegada (GIT_SHA). Permite atar un comportamiento de produccion al commit exacto que lo produjo.';

-- --------------------------------------------------------------------------
-- 5. Como termino y cuanto trabajo costo
-- --------------------------------------------------------------------------

alter table public.agent_runs
  add column if not exists stop_reason varchar(60);

alter table public.agent_runs
  add column if not exists model_calls integer;

alter table public.agent_runs
  add column if not exists tool_call_count integer;

alter table public.agent_runs
  add column if not exists budget_max_cost_usd numeric(12, 6);

alter table public.agent_runs
  add column if not exists budget_max_tool_calls integer;

comment on column public.agent_runs.stop_reason is
  'stop_reason/finish_reason tal cual lo devuelve el proveedor. Se guarda sin normalizar: el valor crudo es lo que sirve para depurar contra su documentacion.';

comment on column public.agent_runs.budget_max_cost_usd is
  'Tope de coste realmente aplicado a este run (resolveAgentBudget lo calcula en memoria desde env vars). Sin esto, un run cortado por presupuesto no dice contra que limite murio.';

-- Estados nuevos: timeout y cancelled dejan de confundirse con failed.
alter table public.agent_runs
  drop constraint if exists agent_runs_status;

alter table public.agent_runs
  add constraint agent_runs_status
  check (
    status in (
      'running',
      'succeeded',
      'failed',
      'rejected_output',
      'budget_exceeded',
      'timeout',
      'cancelled'
    )
  );

-- --------------------------------------------------------------------------
-- 6. Indices
-- --------------------------------------------------------------------------

-- Buscar por traza es la accion numero uno al investigar un incidente ("me han
-- pasado este x-request-id"): debe ser inmediata sin filtrar antes por org.
create index if not exists agent_runs_trace_id_idx
  on public.agent_runs (trace_id)
  where trace_id is not null;

create index if not exists agent_runs_parallel_group_idx
  on public.agent_runs (parallel_group_id, started_at)
  where parallel_group_id is not null;

create index if not exists agent_runs_root_run_idx
  on public.agent_runs (root_run_id)
  where root_run_id is not null;

-- Coste por proveedor/modelo y por dia: la consulta del dashboard de costes.
create index if not exists agent_runs_provider_model_started_idx
  on public.agent_runs (provider, model, started_at);

-- Los runs sin coste calculable son un incidente que hay que poder listar.
create index if not exists agent_runs_cost_basis_unknown_idx
  on public.agent_runs (started_at)
  where cost_basis = 'unknown_model';

-- --------------------------------------------------------------------------
-- 7. Backfill
-- --------------------------------------------------------------------------

-- Las ejecuciones anteriores a AI-30 no saben su proveedor real, y no se puede
-- deducir: el fallback a OpenAI no dejaba rastro. Se dejan con provider/model
-- null (= desconocido, honesto) en vez de asignarles el modelo configurado, que
-- seria inventarse el dato justo en las filas donde mas podria enganar.
--
-- Lo que si se puede afirmar de ellas: su coste se calculo con la tabla de
-- precios de entonces y no fue null, asi que cost_basis 'priced' es cierto.
update public.agent_runs
set cost_basis = 'priced'
where cost_basis is null
  and estimated_cost_usd is not null;

-- Una ejecucion sin padre es su propia raiz. Deja el arbol coherente desde el
-- primer dia para que la consulta del panel no necesite un caso especial.
update public.agent_runs
set root_run_id = id
where root_run_id is null
  and parent_run_id is null;
