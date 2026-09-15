-- FASE 3 / D02 — Contextualizacion.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d02-requisitos-contrato-contextualizacion.md
--          conocimiento/fase-03/04-policies-guardrails/d02-guardrails-contextualizacion.md
--          conocimiento/fase-03/06-tenant-context/d02-contexto-configurable-ecommerce.md
--          conocimiento/fase-03/05-experience-learning/d02-experiencia-historica-y-aprendizaje-contextual.md
--
-- D01 pregunta si el dato es fiable. D02 pregunta otra cosa: **si lo es, que
-- significa aqui**. La misma caida de CVR es un fallo en una tienda y un
-- trade-off deliberado en otra que acaba de retirar un descuento para
-- recuperar margen.
--
-- LA FRONTERA, OTRA VEZ ESTRUCTURAL. El limite funcional del artefacto es
-- explicito: "D2 no debe cerrar causalidad". Su trabajo es eliminar
-- comparaciones invalidas, elegir baseline, localizar cambios y acotar
-- hipotesis. Por eso aqui no hay ninguna columna `root_cause`, `causes` ni
-- `explains`: un cambio se relaciona con una senal por su posicion en el
-- tiempo (`temporal_relation`) y nada mas. El guardrail 20 dice que la
-- proximidad temporal no es causalidad, y la forma mas barata de cumplirlo es
-- no darle sitio donde escribirla.
--
-- POR QUE `tenant_context_facts` ES UNA TABLA ESTRECHA Y NO 200 COLUMNAS. El
-- tenant context de D02 enumera 23 familias de contexto (modelo de negocio,
-- mix de producto, canales, mercados, objetivos, restricciones...) y avisa dos
-- veces de que "la taxonomia no debe asumirse cerrada". Una columna por
-- concepto seria una migracion por cada matiz nuevo de un cliente. Una fila
-- por (dimension, valor, origen) aguanta el catalogo abierto y ademas resuelve
-- el apartado 22, que es el verdaderamente dificil: contexto **declarado** por
-- el cliente y contexto **observado** por los sistemas conviven como dos filas
-- distintas. Una contradiccion entre ambos no se resuelve sola ni se pisa
-- (guardrail 28): se ve, que es justo lo que el documento llama "informacion
-- util".
--
-- MIX ANTES QUE RENDIMIENTO. `context_mix_segments` guarda peso ANTES y peso
-- DESPUES, los dos obligatorios. Sin las dos cifras no se puede distinguir un
-- PERFORMANCE_CHANGE de un MIX_SHIFT (guardrail 6), y el agregado se atribuye
-- a rendimiento interno por defecto, que es el error que el apartado 3 intenta
-- evitar. Con las dos, la paradoja de Simpson deja de ser una advertencia de
-- manual y pasa a ser calculable.
--
-- RUPTURAS DE COMPARABILIDAD, UNA TABLA PARA DOS COSAS. REGIME_CHANGE
-- (apartado 9) y MEASUREMENT_DISCONTINUITY (apartado 11) llegan por caminos
-- distintos -- uno es el negocio, otro la medicion -- pero hacen exactamente
-- lo mismo: a partir de una fecha, el historico anterior deja de ser un
-- baseline limpio (guardrails 18 y 19). Separarlas en dos tablas duplicaria la
-- unica consulta que importa: "¿hay alguna ruptura entre mi baseline y mi
-- periodo?".
--
-- EL SNAPSHOT NO SE REESCRIBE, Y LO IMPIDE UN TRIGGER. El guardrail 38 prohibe
-- sobrescribir retrospectivamente un snapshot historico con la configuracion
-- actual del tenant. Es la clase de regla que se incumple sin mala intencion,
-- en un `update` que parecia inocente, asi que no depende de que nadie se
-- acuerde: la base lo rechaza.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- TENANT CONTEXT — declarado y observado, conviviendo (tenant apartados 1-23)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_context_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  -- Catalogo abierto a proposito: el artefacto repite que la taxonomia no es
  -- cerrada. Los valores que se usan hoy estan en packages/contracts.
  dimension varchar(60) not null,
  value text not null,
  value_detail jsonb not null default '{}'::jsonb,

  -- Apartado 22 -- el eje del bloque. Lo que el cliente dice de si mismo y lo
  -- que sus datos dicen de el son dos afirmaciones, no una con correcciones.
  source varchar(20) not null,
  -- De donde salio la observacion: shopify, meta_ads, onboarding, consultor...
  origin varchar(40),

  effective_from timestamptz not null default now(),
  effective_to timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_context_facts_origen check (
    source in ('declared', 'observed')
  ),
  constraint tenant_context_facts_vigencia check (
    effective_to is null or effective_to > effective_from
  )
);

comment on table public.tenant_context_facts is
  'F3/D02 tenant-context. Contexto del ecommerce como pares (dimension, valor) con origen declarado u observado. Una contradiccion entre ambos es informacion, no un error a corregir (tenant apartado 22).';

comment on column public.tenant_context_facts.source is
  'declared = lo dice el cliente; observed = lo dicen sus datos. Guardrail 28: una contradiccion no se resuelve en silencio, se conserva como dos filas.';

create unique index if not exists tenant_context_facts_unico_idx
  on public.tenant_context_facts (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    dimension,
    source,
    effective_from
  );

-- Un solo valor vigente por (dimension, origen). Declarado y observado siguen
-- siendo dos filas vivas: eso es lo que permite ver la contradiccion.
create unique index if not exists tenant_context_facts_vigente_idx
  on public.tenant_context_facts (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    dimension,
    source
  )
  where effective_to is null;

drop trigger if exists set_tenant_context_facts_updated_at on public.tenant_context_facts;
create trigger set_tenant_context_facts_updated_at
before update on public.tenant_context_facts
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- CHANGE EVENTS — que paso y cuando (contrato apartado 4, tenant apartado 19)
-- ---------------------------------------------------------------------------

create table if not exists public.context_change_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  event_type varchar(40) not null,
  description text not null,
  area varchar(40),
  scope varchar(40) not null default 'global',

  occurred_at timestamptz not null,
  -- Un evento puede durar (una promocion, una rotura de stock).
  ended_at timestamptz,

  source varchar(20) not null default 'declared',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint context_change_events_tipo check (
    event_type in (
      -- Tecnicos (tenant apartado 19)
      'deployment', 'checkout_change', 'tracking_change', 'theme_change',
      'platform_change',
      -- Comerciales (tenant apartados 16 y 19)
      'promotion', 'sale_event', 'price_change', 'free_shipping',
      'bundle_change', 'launch', 'discount_policy_change',
      -- Marketing
      'campaign_change', 'creative_change', 'agency_change',
      'email_flow_change', 'influencer_activation', 'budget_change',
      -- Operaciones y catalogo
      'product_mix_change', 'inventory_event', 'warehouse_change',
      'shipping_change', 'supplier_change',
      -- Expansion
      'market_launch', 'channel_launch',
      -- Externo (guardrail 24: candidato, no explicacion)
      'external_event'
    )
  ),
  constraint context_change_events_origen check (
    source in ('declared', 'observed', 'detected')
  ),
  constraint context_change_events_duracion check (
    ended_at is null or ended_at >= occurred_at
  )
);

comment on table public.context_change_events is
  'F3/D02. Un cambio conocido con su fecha. No dice que causo nada: la relacion con una senal concreta vive en context_assessment_change_events (guardrail 20).';

create index if not exists context_change_events_org_idx
  on public.context_change_events (organization_id, occurred_at desc);

create index if not exists context_change_events_tipo_idx
  on public.context_change_events (organization_id, event_type, occurred_at desc);

drop trigger if exists set_context_change_events_updated_at on public.context_change_events;
create trigger set_context_change_events_updated_at
before update on public.context_change_events
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RUPTURAS DE COMPARABILIDAD (contrato apartados 9 y 11)
-- ---------------------------------------------------------------------------

create table if not exists public.context_comparability_breaks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  -- El negocio cambio (regime_change) o cambio como se mide
  -- (measurement_discontinuity). Distinto origen, mismo efecto sobre el
  -- baseline.
  break_type varchar(30) not null,
  subtype varchar(40),
  description text not null,
  scope varchar(40) not null default 'global',

  effective_from timestamptz not null,
  -- Casi siempre true: se guarda explicito porque una ruptura puede afectar a
  -- una metrica y no a otras, y darlo por supuesto invalidaria historico bueno.
  invalidates_history_before boolean not null default true,
  affected_metrics text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint context_comparability_breaks_tipo check (
    break_type in ('regime_change', 'measurement_discontinuity')
  ),
  constraint context_comparability_breaks_subtipo check (
    subtype is null or subtype in (
      -- regime_change (contrato apartado 9, tenant apartado 21)
      'international_expansion', 'subscription_launch', 'marketplace_entry',
      'price_repositioning', 'warehouse_model_change', 'category_expansion',
      'business_model_change',
      -- measurement_discontinuity (contrato apartado 11)
      'attribution_window_change', 'consent_rate_change',
      'pixel_implementation_change', 'event_definition_change',
      'reporting_logic_change', 'currency_logic_change'
    )
  )
);

comment on table public.context_comparability_breaks is
  'F3/D02. Fecha a partir de la cual el historico anterior deja de ser baseline limpio, venga del negocio (REGIME_CHANGE) o de la medicion (MEASUREMENT_DISCONTINUITY). Guardrails 18 y 19.';

create index if not exists context_comparability_breaks_org_idx
  on public.context_comparability_breaks (organization_id, effective_from desc);

drop trigger if exists set_context_comparability_breaks_updated_at on public.context_comparability_breaks;
create trigger set_context_comparability_breaks_updated_at
before update on public.context_comparability_breaks
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- LA SALIDA DE D02 (contrato apartados 13, 16, 17)
-- ---------------------------------------------------------------------------

create table if not exists public.context_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,

  scope varchar(40) not null default 'global',
  scope_detail jsonb not null default '{}'::jsonb,

  -- Apartado 10 -- contra que se compara y por que. El guardrail 3 prohibe
  -- comparar periodos solo por proximidad temporal.
  baseline_type varchar(30),
  baseline_period_start timestamptz,
  baseline_period_end timestamptz,
  baseline_rationale text,

  -- Apartado 17 -- el veredicto de comparabilidad, que es lo que D02 aporta
  -- aguas abajo.
  comparability varchar(20) not null default 'limited',
  comparability_reasons text[] not null default '{}',

  -- Apartado 3 -- ¿cambio el rendimiento o cambio la composicion? Empieza en
  -- `undetermined` a proposito: afirmarlo sin descomponer el mix es el
  -- guardrail 6.
  aggregate_interpretation varchar(24) not null default 'undetermined',

  -- Apartado 13 -- completitud contextual. El guardrail 27 dice que la
  -- profundidad se adapta a la pregunta: no todo diagnostico exige el mismo
  -- contexto.
  context_depth varchar(20) not null default 'standard',
  context_sufficient boolean not null default false,
  missing_context text[] not null default '{}',
  critical_unknowns text[] not null default '{}',

  -- Apartado 17 -- factores contextuales plausibles. "Plausible" es la palabra:
  -- no son causas (guardrail 21) y no hay columna que permita ascenderlos.
  primary_factors text[] not null default '{}',
  -- Apartado 12 -- contradicciones declarado/observado que afectan a esta
  -- lectura. Guardrail 28: se declaran, no se resuelven en silencio.
  declared_contradictions text[] not null default '{}',
  uncertainty_notes text,

  -- Apartado 16 -- el contexto vigente ENTONCES. No se reescribe nunca: ver el
  -- trigger de mas abajo (guardrail 38).
  context_snapshot jsonb not null default '{}'::jsonb,

  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint context_assessments_comparabilidad check (
    comparability in ('comparable', 'limited', 'not_comparable')
  ),
  constraint context_assessments_interpretacion check (
    aggregate_interpretation in (
      'performance_change', 'mix_shift', 'mixed', 'undetermined'
    )
  ),
  constraint context_assessments_profundidad check (
    context_depth in ('shallow', 'standard', 'deep')
  ),
  constraint context_assessments_baseline check (
    baseline_type is null or baseline_type in (
      'previous_period', 'year_over_year', 'rolling_average', 'business_target',
      'historical_normal', 'pre_event', 'control_group', 'peer_group', 'benchmark'
    )
  ),
  constraint context_assessments_baseline_periodo check (
    baseline_period_start is null
    or baseline_period_end is null
    or baseline_period_end > baseline_period_start
  ),
  -- Guardrail 3 -- un baseline sin motivo escrito es una comparacion elegida
  -- por cercania, que es exactamente lo que el guardrail prohibe.
  constraint context_assessments_baseline_motivado check (
    baseline_type is null or baseline_rationale is not null
  ),
  -- Degradar la comparabilidad sin decir por que no sirve aguas abajo: D05 no
  -- puede decidir si el motivo le afecta.
  constraint context_assessments_degradacion_motivada check (
    comparability = 'comparable' or cardinality(comparability_reasons) > 0
  ),
  -- Guardrails 25 y 26 -- el contexto que falta no se rellena con supuestos;
  -- se conserva como incertidumbre explicita. Declarar el contexto
  -- insuficiente sin decir que falta es lo mismo que no declararlo.
  constraint context_assessments_falta_declarada check (
    context_sufficient or cardinality(missing_context) > 0
  ),
  -- Guardrail 26 -- si hay variables criticas desconocidas, la comparacion no
  -- puede declararse limpia.
  constraint context_assessments_incognita_critica check (
    cardinality(critical_unknowns) = 0 or comparability <> 'comparable'
  )
);

comment on table public.context_assessments is
  'F3/D02. La lectura contextual de un caso: baseline, comparabilidad y factores plausibles. No cierra causalidad -- no hay columna donde escribirla (limite funcional del artefacto).';

comment on column public.context_assessments.aggregate_interpretation is
  'PERFORMANCE_CHANGE frente a MIX_SHIFT (apartado 3). Empieza en undetermined: afirmarlo sin descomponer el mix es el guardrail 6.';

comment on column public.context_assessments.context_snapshot is
  'Contexto vigente al evaluar (apartado 16). Inmutable una vez escrito: el guardrail 38 prohibe reescribirlo con la configuracion actual del tenant.';

create index if not exists context_assessments_case_idx
  on public.context_assessments (case_id, assessed_at desc);

drop trigger if exists set_context_assessments_updated_at on public.context_assessments;
create trigger set_context_assessments_updated_at
before update on public.context_assessments
for each row execute function private.set_updated_at();

-- Guardrail 38 -- el snapshot historico no se reescribe con el estado actual.
-- Va en trigger y no en revision humana porque es la clase de regla que se
-- rompe sin querer, en un update que parecia rutinario.
create or replace function private.prevent_context_snapshot_overwrite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.context_snapshot <> '{}'::jsonb
     and new.context_snapshot is distinct from old.context_snapshot then
    raise exception
      'El snapshot contextual es inmutable (F3/D02 guardrail 38): reescribirlo con el contexto actual falsea la traza del diagnostico.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_context_assessments_snapshot_overwrite on public.context_assessments;
create trigger prevent_context_assessments_snapshot_overwrite
before update on public.context_assessments
for each row execute function private.prevent_context_snapshot_overwrite();

-- ---------------------------------------------------------------------------
-- MIX — la descomposicion que separa rendimiento de composicion (apartado 3)
-- ---------------------------------------------------------------------------

create table if not exists public.context_mix_segments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.context_assessments (id) on delete cascade,

  -- channel, market, device, product, cohort...
  dimension varchar(40) not null,
  segment varchar(80) not null,

  -- Los dos pesos son obligatorios: con uno solo no se puede distinguir un
  -- cambio de rendimiento de un cambio de composicion (guardrail 6).
  weight_before numeric not null,
  weight_after numeric not null,

  -- El rendimiento dentro del segmento. Nullable porque hay dimensiones donde
  -- solo interesa el peso.
  performance_before numeric,
  performance_after numeric,

  created_at timestamptz not null default now(),

  constraint context_mix_segments_pesos check (
    weight_before >= 0 and weight_before <= 1
    and weight_after >= 0 and weight_after <= 1
  ),
  -- Un rendimiento a medias no compara nada.
  constraint context_mix_segments_rendimiento_par check (
    (performance_before is null) = (performance_after is null)
  )
);

comment on table public.context_mix_segments is
  'F3/D02. Peso y rendimiento de cada segmento, antes y despues. Es lo que permite calcular la paradoja de Simpson en vez de advertir de ella (guardrail 8).';

create unique index if not exists context_mix_segments_unico_idx
  on public.context_mix_segments (assessment_id, dimension, segment);

-- ---------------------------------------------------------------------------
-- CAMBIOS CONSIDERADOS EN ESTE CASO (contrato apartado 4, guardrail 20)
-- ---------------------------------------------------------------------------
--
-- Aqui esta la decision mas importante del bloque, y es una ausencia: no hay
-- columna `causes`. Un cambio se relaciona con la senal por su posicion en el
-- tiempo y por si se descarto o no. Convertir eso en causa es trabajo de D07 a
-- D09, con evidencia.

create table if not exists public.context_assessment_change_events (
  assessment_id uuid not null references public.context_assessments (id) on delete cascade,
  change_event_id uuid not null references public.context_change_events (id) on delete cascade,

  temporal_relation varchar(20) not null,
  -- Guardrail 17 -- hay efectos que tardan. Solo tiene sentido si el cambio
  -- precede a la senal.
  lag_days integer,

  considered_as varchar(20) not null default 'candidate',
  -- Mismo principio que las hipotesis descartadas de D00: descartar sin motivo
  -- borra el razonamiento.
  rule_out_reason text,

  created_at timestamptz not null default now(),

  primary key (assessment_id, change_event_id),

  constraint context_assessment_change_events_relacion check (
    temporal_relation in ('before', 'concurrent', 'after', 'unknown')
  ),
  constraint context_assessment_change_events_consideracion check (
    considered_as in ('candidate', 'plausible_factor', 'ruled_out')
  ),
  constraint context_assessment_change_events_lag check (
    lag_days is null or (temporal_relation = 'before' and lag_days >= 0)
  ),
  constraint context_assessment_change_events_descarte_motivado check (
    considered_as <> 'ruled_out' or rule_out_reason is not null
  )
);

comment on table public.context_assessment_change_events is
  'F3/D02. Que cambios se miraron para este caso y en que relacion temporal estan con la senal. No hay columna de causa: guardrail 20, la proximidad temporal no es causalidad.';

create index if not exists context_assessment_change_events_evento_idx
  on public.context_assessment_change_events (change_event_id);

-- ---------------------------------------------------------------------------
-- CONFOUNDERS (contrato apartado 8, guardrails 22, 23, 24)
-- ---------------------------------------------------------------------------

create table if not exists public.context_confounders (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.context_assessments (id) on delete cascade,

  variable varchar(120) not null,
  scope varchar(40) not null default 'global',
  occurred_at timestamptz,

  -- Apartado 8 -- "grado de conocimiento". El documento no define scoring
  -- causal y aqui tampoco se inventa.
  knowledge_state varchar(20) not null default 'suspected',
  -- Guardrail 24 -- las variables externas son candidatas. La columna dice que
  -- relacion es POSIBLE, nunca cual es.
  possible_relation text,
  material boolean not null default false,
  coexists_with text[] not null default '{}',

  created_at timestamptz not null default now(),

  constraint context_confounders_conocimiento check (
    knowledge_state in ('known', 'suspected', 'unknown')
  ),
  -- Un confusor "conocido" sin fecha no se puede contrastar con la senal: o se
  -- sabe cuando paso, o es una sospecha.
  constraint context_confounders_conocido_con_fecha check (
    knowledge_state <> 'known' or occurred_at is not null
  )
);

comment on table public.context_confounders is
  'F3/D02. Variables que podrian explicar la senal ademas de la hipotesis en curso. Candidatas, no explicaciones (guardrail 24): no existe columna que las promueva.';

create index if not exists context_confounders_assessment_idx
  on public.context_confounders (assessment_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Igual que D00 y D01: staff. Las tablas colgadas de un caso heredan su
-- permiso; las de organizacion lo comprueban directamente.

alter table public.tenant_context_facts enable row level security;
alter table public.context_change_events enable row level security;
alter table public.context_comparability_breaks enable row level security;
alter table public.context_assessments enable row level security;
alter table public.context_mix_segments enable row level security;
alter table public.context_assessment_change_events enable row level security;
alter table public.context_confounders enable row level security;

drop policy if exists "tenant_context_facts_select_staff" on public.tenant_context_facts;
create policy "tenant_context_facts_select_staff" on public.tenant_context_facts
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "context_change_events_select_staff" on public.context_change_events;
create policy "context_change_events_select_staff" on public.context_change_events
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "context_comparability_breaks_select_staff" on public.context_comparability_breaks;
create policy "context_comparability_breaks_select_staff" on public.context_comparability_breaks
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "context_assessments_select_staff" on public.context_assessments;
create policy "context_assessments_select_staff" on public.context_assessments
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));

drop policy if exists "context_mix_segments_select_staff" on public.context_mix_segments;
create policy "context_mix_segments_select_staff" on public.context_mix_segments
  for select to authenticated
  using (
    exists (select 1 from public.context_assessments a where a.id = assessment_id)
  );

drop policy if exists "context_assessment_change_events_select_staff" on public.context_assessment_change_events;
create policy "context_assessment_change_events_select_staff" on public.context_assessment_change_events
  for select to authenticated
  using (
    exists (select 1 from public.context_assessments a where a.id = assessment_id)
  );

drop policy if exists "context_confounders_select_staff" on public.context_confounders;
create policy "context_confounders_select_staff" on public.context_confounders
  for select to authenticated
  using (
    exists (select 1 from public.context_assessments a where a.id = assessment_id)
  );
