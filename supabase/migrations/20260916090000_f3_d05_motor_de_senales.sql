-- FASE 3 / D05 — Motor de senales y anomalias.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d05-requisitos-contrato-senales.md
--          conocimiento/fase-03/04-policies-guardrails/d05-guardrails-senales.md
--          conocimiento/fase-03/03-runtime/d05-flujo-motor-senales.md
--          conocimiento/fase-03/06-tenant-context/d05-configuracion-motor-senales.md
--          conocimiento/fase-03/05-experience-learning/d05-pattern-memory-y-baseline-learning.md
--
-- El primer bloque de la fase que **escribe filas leyendo datos reales**. D00 a
-- D04 definieron que es un diagnostico, cuando el dato aguanta, que significa
-- aqui, de que es capaz el negocio y como esta hoy. D05 es el que mira las
-- cifras y dice "esto ha cambiado y merece que alguien lo investigue".
--
-- LAS SEIS PRIMERAS LINEAS DE LOS GUARDRAILS SON LA FRONTERA DEL BLOQUE: no
-- todo cambio es senal, no toda senal es problema, y senal no es anomalia, ni
-- sintoma, ni causa, ni recomendacion. El ejemplo del guardrail 49-50 lo deja
-- exacto: **D5 puede decir "el CTR se esta deteriorando"; no puede decir
-- "fatiga creativa confirmada"**. Por eso aqui no hay columna `symptom`,
-- `cause`, `action` ni `recommendation`: interpretar es D06, la causa D07-D09 y
-- la accion F5+.
--
-- LOS BASELINES Y GUARDRAILS NO SE DUPLICAN: YA EXISTEN. `health_references`
-- (D04) guarda por metrica el baseline propio, el objetivo del negocio y el
-- guardrail economico, que es exactamente lo que piden los apartados 1 y 2 del
-- tenant-context de D05. Crear aqui una segunda tabla de umbrales seria
-- garantizar que dentro de seis meses digan cosas distintas sobre el mismo CAC.
-- Una senal referencia la fila que uso.
--
-- MAGNITUD NO ES IMPACTO. Es el guardrail 8 y su ejemplo del 57: un +200% en
-- una campana minuscula puede ser irrelevante. Por eso `magnitude_relative` y
-- `business_relevance` son columnas distintas, y la relevancia alta exige
-- exposicion declarada. Sin eso, el motor grita mas fuerte cuanto menos importa
-- lo que mira.
--
-- SIGNIFICANCIA ESTADISTICA NO ES SIGNIFICANCIA DE NEGOCIO (guardrail 7), y con
-- pocos eventos ni siquiera es estadistica (21, 22). `sample_size`,
-- `low_sample` y `statistical_strength` se guardan aparte de la relevancia, y
-- una senal con muestra baja no puede ser critica.
--
-- UN COMPOSITE SIN SUS INPUTS ES UN SCORE OPACO (guardrails 40, 41, 42). Si
-- `is_composite`, la senal esta obligada a declarar sus componentes y la
-- contribucion de cada uno. Un numero normalizado no sustituye la explicacion.
--
-- AGRUPAR NO ES PERDER (guardrails 29, 30, 31). Los clusters existen para no
-- mandar cinco avisos del mismo fenomeno, pero las senales siguen enteras en su
-- tabla: el cluster es una relacion, no un resumen que sustituya a sus miembros.
--
-- LO POSITIVO SE DETECTA CON EL MISMO RIGOR (guardrails 43, 44, 45). Hay
-- `positive` como tipo de senal y como direccion, las positivas y negativas
-- conviven sin cancelarse, y declarar un `breakthrough` exige persistencia: un
-- periodo suelto no es una mejora estructural.
--
-- EVENT-LINKED NO ES EVENT-CAUSED (guardrail 35). Una senal puede apuntar al
-- evento de negocio con el que coincide en el tiempo, y esa columna se llama
-- `linked_event_id` con un `event_link_status`, nunca `caused_by`.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- GRAFO DE METRICAS — para no contar lo mismo dos veces
-- (apartados 16 y 21; guardrails 9, 25, 26)
-- ---------------------------------------------------------------------------
--
-- Dos metricas que comparten inputs no son dos evidencias independientes. CVR y
-- revenue por sesion se mueven juntas porque una esta dentro de la otra, y
-- tratarlas como corroboracion mutua infla la confianza de un solo hecho.

create table if not exists public.metric_dependencies (
  id uuid primary key default gen_random_uuid(),
  -- Sin organizacion cuando es aritmetica del ecommerce (revenue = pedidos x
  -- AOV). Con organizacion cuando es una metrica propia del tenant.
  organization_id uuid references public.organizations (id) on delete cascade,

  metric varchar(80) not null,
  depends_on varchar(80) not null,
  relation varchar(16) not null default 'component',
  rationale text not null,

  created_at timestamptz not null default now(),

  constraint metric_dependencies_relacion check (
    relation in ('component', 'derived_from', 'shares_input')
  ),
  constraint metric_dependencies_no_circular check (metric <> depends_on)
);

comment on table public.metric_dependencies is
  'F3/D05. Que metrica depende de cual. Sirve para el guardrail 25: dos metricas con inputs compartidos no son evidencia independiente.';

create unique index if not exists metric_dependencies_unico_idx
  on public.metric_dependencies (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric,
    depends_on,
    relation
  );

-- ---------------------------------------------------------------------------
-- PATRONES CONOCIDOS DEL TENANT (apartados 24, 25, 26; guardrails 46, 47, 48)
-- ---------------------------------------------------------------------------
--
-- Cada tienda tiene sus propios patrones: la caida de agosto, el pico de Black
-- Friday, la resaca de la semana siguiente. El guardrail 48 es explicito: estos
-- patrones **no** se promueven automaticamente a reglas globales, asi que la
-- tabla lleva organizacion obligatoria y no hay forma de que uno se escape al
-- RAG global.

create table if not exists public.tenant_signal_patterns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  label varchar(120) not null,
  description text not null,
  metric varchar(80),
  scope varchar(40) not null default 'global',

  -- Guardrail 47 -- un patron conocido solo reduce atencion si esta lo bastante
  -- explicado. `explanation` no es opcional cuando se suprime.
  explanation text,
  suppression varchar(16) not null default 'none',

  -- Apartado 25 -- que paso la ultima vez. Guardrail 46: que se repita el
  -- patron no confirma que se repita el desenlace.
  previous_outcome text,
  occurrences integer not null default 1,
  last_seen_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_signal_patterns_supresion check (
    suppression in ('none', 'reduce_attention', 'suppress')
  ),
  -- Guardrail 47 -- suprimir sin explicar es esconder.
  constraint tenant_signal_patterns_supresion_explicada check (
    suppression = 'none' or explanation is not null
  ),
  constraint tenant_signal_patterns_ocurrencias check (occurrences > 0)
);

comment on table public.tenant_signal_patterns is
  'F3/D05 experience. Patrones que esta tienda ya conoce. Guardrail 48: llevan organizacion obligatoria y nunca ascienden a regla global.';

comment on column public.tenant_signal_patterns.previous_outcome is
  'Que paso la ultima vez. Guardrail 46: que el patron se repita no confirma que el desenlace se repita.';

create index if not exists tenant_signal_patterns_org_idx
  on public.tenant_signal_patterns (organization_id, metric);

drop trigger if exists set_tenant_signal_patterns_updated_at on public.tenant_signal_patterns;
create trigger set_tenant_signal_patterns_updated_at
before update on public.tenant_signal_patterns
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- LA SENAL (apartados 1 a 12, 17 a 24, 27)
-- ---------------------------------------------------------------------------

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  -- Apartado 2 -- que clase de cambio es.
  signal_type varchar(24) not null,
  -- Apartado 3 -- y si ademas es una anomalia, de que clase. Nullable a
  -- proposito: el guardrail 3 dice que senal y anomalia no son lo mismo, y la
  -- mayoria de las senales no son anomalias.
  anomaly_type varchar(24),

  capability varchar(24),
  metric varchar(80) not null,
  scope varchar(40) not null default 'global',
  scope_detail jsonb not null default '{}'::jsonb,

  -- Apartado 1 -- forma del cambio.
  direction varchar(12) not null,
  observed_value numeric,
  baseline_value numeric,
  magnitude_absolute numeric,
  magnitude_relative numeric,
  expected_low numeric,
  expected_high numeric,

  onset_at timestamptz,
  detected_at timestamptz not null default now(),
  window_start timestamptz not null,
  window_end timestamptz not null,

  -- Apartado 4 -- cuanto lleva pasando. Guardrail 44: un periodo suelto no es
  -- un cambio estructural.
  persistence varchar(16) not null default 'transient',
  trajectory varchar(24),
  -- Apartado 6 -- si esto es el mundo nuevo o una desviacion del de siempre.
  regime varchar(16) not null default 'normal_regime',

  -- Apartado 7 -- contra que se comparo. Referencia a la tabla de D04: los
  -- baselines y guardrails no se duplican.
  reference_id uuid references public.health_references (id) on delete set null,
  baseline_kind varchar(24),
  -- Guardrail 12 -- si dos baselines dicen cosas distintas, se dice.
  baseline_conflict boolean not null default false,

  -- Apartado 9 -- guardrail de negocio. Guardrail 20: acercarse cuenta, no solo
  -- traspasar.
  guardrail_status varchar(16),
  distance_to_guardrail numeric,

  -- Apartados 11 y 12 -- lo estadistico y lo empresarial, separados
  -- (guardrail 7).
  sample_size bigint,
  event_count bigint,
  low_sample boolean not null default false,
  statistical_method varchar(40),
  statistical_strength varchar(16),

  -- Guardrail 8 y 57 -- la magnitud no es el impacto.
  business_relevance varchar(16) not null default 'low',
  business_exposure varchar(20),
  impact_estimate varchar(16),

  -- Apartado 10 -- tres confianzas distintas, porque se degradan por motivos
  -- distintos. La del dato viene de D01, la del contexto de D02.
  data_confidence varchar(20) not null default 'low',
  context_confidence varchar(20) not null default 'low',
  signal_confidence varchar(20) not null default 'low',

  -- Apartado 21 -- si es compuesta, tiene que explicarse (guardrails 40-42).
  is_composite boolean not null default false,
  composite_inputs jsonb not null default '[]'::jsonb,
  composite_explanation text,

  -- Apartado 24 -- ¿ya habiamos visto esto?
  novelty varchar(16),
  matched_pattern_id uuid references public.tenant_signal_patterns (id) on delete set null,
  suppression varchar(16) not null default 'none',

  -- Apartado 19 -- coincide en el tiempo con un cambio conocido. `linked`, no
  -- `caused`: guardrail 35.
  linked_event_id uuid references public.context_change_events (id) on delete set null,
  event_link_status varchar(20),
  expected_lag_days integer,

  -- Apartado 20 -- si adelanta algo que pasara aguas abajo.
  is_leading_indicator boolean not null default false,
  downstream_metric varchar(80),

  -- Apartado 18 -- por que este segmento merecia mirarse (guardrails 36-38).
  segment_eligibility varchar(24),

  -- El texto que lee un humano. Descriptivo, nunca interpretativo: "el CTR cae
  -- un 34% desde el 3 de septiembre", no "fatiga creativa".
  description text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint signals_tipo check (
    signal_type in (
      'level', 'trend', 'change', 'rate', 'volatility', 'concentration',
      'mix', 'ratio', 'capacity', 'dependency', 'regression', 'positive',
      'risk'
    )
  ),
  constraint signals_anomalia check (
    anomaly_type is null or anomaly_type in (
      'point', 'contextual', 'collective', 'sequence', 'periodic', 'localized'
    )
  ),
  constraint signals_direccion check (
    direction in ('up', 'down', 'flat', 'diverging', 'unstable')
  ),
  constraint signals_persistencia check (
    persistence in ('transient', 'emerging', 'persistent', 'chronic')
  ),
  constraint signals_regimen check (
    regime in ('normal_regime', 'anomaly', 'new_regime', 'regime_shift')
  ),
  constraint signals_trayectoria check (
    trajectory is null or trajectory in (
      'improving', 'stable', 'deteriorating', 'rapidly_deteriorating',
      'recovering', 'volatile'
    )
  ),
  constraint signals_guardrail check (
    guardrail_status is null or guardrail_status in (
      'within', 'approaching', 'breached', 'crossed'
    )
  ),
  constraint signals_fuerza check (
    statistical_strength is null or statistical_strength in (
      'none', 'weak', 'moderate', 'strong'
    )
  ),
  constraint signals_relevancia check (
    business_relevance in ('low', 'medium', 'high', 'critical')
  ),
  constraint signals_impacto check (
    impact_estimate is null or impact_estimate in ('low', 'medium', 'high', 'critical')
  ),
  constraint signals_exposicion check (
    business_exposure is null
    or business_exposure in ('minimal', 'low', 'moderate', 'high', 'existential')
  ),
  constraint signals_confianza_dato check (
    data_confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint signals_confianza_contexto check (
    context_confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint signals_confianza_senal check (
    signal_confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint signals_novedad check (
    novelty is null or novelty in ('first_ever', 'rare', 'common', 'recurring')
  ),
  constraint signals_supresion check (
    suppression in ('none', 'reduce_attention', 'suppress')
  ),
  constraint signals_evento check (
    event_link_status is null or event_link_status in (
      'within_window', 'outside_window', 'lagged', 'unclear'
    )
  ),
  constraint signals_elegibilidad check (
    segment_eligibility is null or segment_eligibility in (
      'meets_minimum', 'critical_segment', 'high_value', 'below_minimum'
    )
  ),
  constraint signals_ventana check (window_end > window_start),
  constraint signals_rango check (
    expected_low is null or expected_high is null or expected_high >= expected_low
  ),

  -- Guardrail 8 y 57 -- un +200% en una campana minuscula no es una senal
  -- relevante. La relevancia alta exige exposicion declarada y material.
  constraint signals_relevancia_exige_exposicion check (
    business_relevance not in ('high', 'critical')
    or business_exposure in ('moderate', 'high', 'existential')
  ),
  -- Guardrails 21 y 22 -- un porcentaje extremo con cuatro eventos no es una
  -- senal critica, es ruido con buena presentacion.
  constraint signals_muestra_baja_no_es_critica check (
    not low_sample or business_relevance <> 'critical'
  ),
  -- Guardrails 40, 41 y 42 -- un composite sin inputs es un score opaco.
  constraint signals_composite_explicado check (
    not is_composite
    or (jsonb_array_length(composite_inputs) > 0 and composite_explanation is not null)
  ),
  -- Guardrail 44 -- declarar un cambio de regimen o una mejora estructural
  -- desde un periodo aislado es exactamente lo que el guardrail prohibe.
  constraint signals_regimen_exige_persistencia check (
    regime not in ('new_regime', 'regime_shift')
    or persistence in ('persistent', 'chronic')
  ),
  -- Guardrail 47 -- reducir atencion sin patron identificado es silenciar a
  -- ciegas.
  constraint signals_supresion_con_patron check (
    suppression = 'none' or matched_pattern_id is not null
  ),
  -- Apartado 19 -- si se enlaza con un evento hay que decir en que relacion
  -- temporal, porque el enlace NO es la causa (guardrail 35).
  constraint signals_evento_con_relacion check (
    linked_event_id is null or event_link_status is not null
  ),
  -- Apartado 20 -- un indicador adelantado sin decir que adelanta no adelanta
  -- nada.
  constraint signals_leading_con_destino check (
    not is_leading_indicator or downstream_metric is not null
  ),
  -- Guardrail 28 -- si el dato no se sostiene, no se emite una senal de
  -- negocio. D01 manda sobre D05.
  constraint signals_sin_dato_no_hay_senal check (
    data_confidence <> 'insufficient_data' or business_relevance = 'low'
  )
);

comment on table public.signals is
  'F3/D05. Un cambio que merece investigarse. Descriptivo, nunca interpretativo: puede decir "el CTR cae un 34%", no "fatiga creativa" (guardrails 49 y 50).';

comment on column public.signals.business_relevance is
  'Guardrail 8 y 57: la magnitud no es el impacto. Un +200% en una campana minuscula es LOW, y por eso la relevancia alta exige exposicion material.';

comment on column public.signals.linked_event_id is
  'Coincidencia temporal con un cambio conocido. Se llama `linked` y no `caused` por el guardrail 35: event-linked no es event-caused.';

comment on column public.signals.description is
  'Texto descriptivo para un humano. La interpretacion es D06 y la causa D07-D09: aqui no cabe ni una ni la otra.';

create index if not exists signals_org_idx
  on public.signals (organization_id, detected_at desc);

create index if not exists signals_metrica_idx
  on public.signals (organization_id, metric, window_end desc);

-- Lo que se consulta al abrir un diagnostico: lo relevante y no suprimido.
create index if not exists signals_relevantes_idx
  on public.signals (organization_id, business_relevance, detected_at desc)
  where suppression = 'none' and business_relevance in ('high', 'critical');

drop trigger if exists set_signals_updated_at on public.signals;
create trigger set_signals_updated_at
before update on public.signals
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- EVIDENCIA Y CORROBORACION (apartados 15, 16; guardrails 9, 25, 26)
-- ---------------------------------------------------------------------------

create table if not exists public.signal_evidence (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signals (id) on delete cascade,

  source varchar(40) not null,
  metric varchar(80) not null,
  observation text not null,
  value numeric,

  -- Guardrail 26 -- la confianza solo sube con corroboracion **verdaderamente**
  -- independiente. Una metrica derivada de la misma fuente no corrobora nada:
  -- es el mismo hecho contado dos veces.
  independent boolean not null default false,
  independence_rationale text,

  created_at timestamptz not null default now(),

  -- Guardrail 25 -- declarar independencia exige justificarla, justo porque es
  -- lo que sube la confianza.
  constraint signal_evidence_independencia_justificada check (
    not independent or independence_rationale is not null
  )
);

comment on table public.signal_evidence is
  'F3/D05. De donde sale la senal. `independent` solo es true con justificacion: el guardrail 26 exige corroboracion de verdad independiente para subir la confianza.';

create index if not exists signal_evidence_senal_idx
  on public.signal_evidence (signal_id);

-- ---------------------------------------------------------------------------
-- CLUSTERS — agrupar sin perder (apartados 13; guardrails 29, 30, 31)
-- ---------------------------------------------------------------------------

create table if not exists public.signal_clusters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  label varchar(160) not null,
  shared_scope varchar(40),
  window_start timestamptz not null,
  window_end timestamptz not null,
  -- Por que estan juntas: coinciden en el tiempo, en el scope, o una metrica
  -- depende de otra.
  grouping_reason varchar(24) not null,
  confidence varchar(20) not null default 'low',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint signal_clusters_motivo check (
    grouping_reason in (
      'temporal_overlap', 'shared_scope', 'metric_dependency', 'mixed'
    )
  ),
  constraint signal_clusters_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint signal_clusters_ventana check (window_end > window_start)
);

comment on table public.signal_clusters is
  'F3/D05. Varias senales del mismo fenomeno, agrupadas para no mandar cinco avisos (guardrail 29). D06 convierte clusters en sintomas; aqui no se interpretan.';

create index if not exists signal_clusters_org_idx
  on public.signal_clusters (organization_id, window_end desc);

drop trigger if exists set_signal_clusters_updated_at on public.signal_clusters;
create trigger set_signal_clusters_updated_at
before update on public.signal_clusters
for each row execute function private.set_updated_at();

-- Guardrail 31 -- agrupar no puede perder la evidencia individual. Por eso el
-- cluster es una relacion y las senales siguen enteras en su propia tabla.
create table if not exists public.signal_cluster_members (
  cluster_id uuid not null references public.signal_clusters (id) on delete cascade,
  signal_id uuid not null references public.signals (id) on delete cascade,
  -- Cual de ellas se enseña primero. No es prioridad: es representatividad.
  is_representative boolean not null default false,
  created_at timestamptz not null default now(),

  primary key (cluster_id, signal_id)
);

comment on table public.signal_cluster_members is
  'F3/D05. Guardrail 31: agrupar no pierde evidencia. El cluster es una relacion, no un resumen que sustituya a sus miembros.';

create index if not exists signal_cluster_members_signal_idx
  on public.signal_cluster_members (signal_id);

-- ---------------------------------------------------------------------------
-- CONFLICTOS (apartado 14; guardrails 27, 28)
-- ---------------------------------------------------------------------------
--
-- Cuando dos senales dicen cosas incompatibles, el conflicto ES informacion. El
-- guardrail 27 obliga a conservarlo y el 28 a no forzar una lectura de negocio
-- cuando lo que sugiere la evidencia es un problema de datos.

create table if not exists public.signal_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  signal_a_id uuid not null references public.signals (id) on delete cascade,
  signal_b_id uuid not null references public.signals (id) on delete cascade,

  expected_relationship text not null,
  observed_disagreement text not null,
  -- Guardrail 28 -- la sospecha de que esto huele a problema de datos y no a
  -- cambio del negocio.
  suggests_data_issue boolean not null default false,
  degrades_confidence boolean not null default true,
  resolution text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint signal_conflicts_distintas check (signal_a_id <> signal_b_id)
);

comment on table public.signal_conflicts is
  'F3/D05. Dos senales que no encajan. El guardrail 27 obliga a conservar el conflicto en vez de elegir la version que gusta.';

create unique index if not exists signal_conflicts_unico_idx
  on public.signal_conflicts (least(signal_a_id, signal_b_id), greatest(signal_a_id, signal_b_id));

drop trigger if exists set_signal_conflicts_updated_at on public.signal_conflicts;
create trigger set_signal_conflicts_updated_at
before update on public.signal_conflicts
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- PUENTE CON D00 — una senal diagnostica puede venir de aqui
-- ---------------------------------------------------------------------------

alter table public.diagnostic_signals
  add column if not exists source_signal_id uuid
    references public.signals (id) on delete set null;

comment on column public.diagnostic_signals.source_signal_id is
  'F3/D05. La senal del motor que dio origen a esta. Nullable: un consultor puede anotar una senal a mano sin que el motor la haya detectado.';

create index if not exists diagnostic_signals_source_idx
  on public.diagnostic_signals (source_signal_id)
  where source_signal_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Staff, como el resto de la fase. Una senal sin interpretar es justo el
-- material que el guardrail 2 advierte que no es un problema todavia:
-- ensenarsela al cliente convertiria cada variacion en una alarma.
--
-- `metric_dependencies` sin organizacion es aritmetica del ecommerce y la lee
-- cualquiera autenticado; con organizacion, solo staff.

alter table public.metric_dependencies enable row level security;
alter table public.tenant_signal_patterns enable row level security;
alter table public.signals enable row level security;
alter table public.signal_evidence enable row level security;
alter table public.signal_clusters enable row level security;
alter table public.signal_cluster_members enable row level security;
alter table public.signal_conflicts enable row level security;

drop policy if exists "metric_dependencies_select" on public.metric_dependencies;
create policy "metric_dependencies_select" on public.metric_dependencies
  for select to authenticated
  using (
    organization_id is null
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "tenant_signal_patterns_select_staff" on public.tenant_signal_patterns;
create policy "tenant_signal_patterns_select_staff" on public.tenant_signal_patterns
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "signals_select_staff" on public.signals;
create policy "signals_select_staff" on public.signals
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "signal_evidence_select_staff" on public.signal_evidence;
create policy "signal_evidence_select_staff" on public.signal_evidence
  for select to authenticated
  using (exists (select 1 from public.signals s where s.id = signal_id));

drop policy if exists "signal_clusters_select_staff" on public.signal_clusters;
create policy "signal_clusters_select_staff" on public.signal_clusters
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "signal_cluster_members_select_staff" on public.signal_cluster_members;
create policy "signal_cluster_members_select_staff" on public.signal_cluster_members
  for select to authenticated
  using (exists (select 1 from public.signal_clusters c where c.id = cluster_id));

drop policy if exists "signal_conflicts_select_staff" on public.signal_conflicts;
create policy "signal_conflicts_select_staff" on public.signal_conflicts
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );
