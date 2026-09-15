-- FASE 3 / D00 — Contrato de diagnostico.
--
-- Fuente: conocimiento/fase-03/02-contratos-IA/D00-contrato-de-diagnostico.md
--
-- D00 no diagnostica nada: define que ES un diagnostico y que estructura debe
-- respetar cualquier motor de la fase 3 (D01..D14) al producirlo. Esta
-- migracion es su capa de contrato: las tablas donde vive un DIAGNOSTIC_CASE.
--
-- DECISION CENTRAL -- por que N tablas y no una con un jsonb.
-- El apartado 2 del contrato impone separar capas (dato / contexto / senal /
-- sintoma / hipotesis / evidencia / causa / constraint / severidad /
-- confianza / diagnostico) precisamente para evitar razonamiento circular:
-- que el motor tome un sintoma por una causa, o una correlacion por una
-- explicacion. Guardar todo en un unico documento jsonb dejaria esa
-- separacion en manos de quien escriba el JSON, es decir, en manos del
-- modelo. Con una tabla por capa la separacion la sostiene el esquema:
-- una hipotesis no puede existir sin caso, una evidencia apoya o contradice
-- de forma explicita, y una hipotesis descartada sigue estando ahi.
--
-- COLUMNA O JSONB. Columna para lo que se consulta, se filtra o se restringe
-- (estado, severidad, confianza, scope, fechas): son las que un guardrail
-- tendra que comprobar y las que sostienen los indices. jsonb para los
-- contextos que se leen enteros y cuya forma pertenece a otros bloques
-- (business_context es F1, maturity_context es F2, data_quality es D01):
-- fijarlos aqui en columnas seria decidir por ellos antes de tiempo.
--
-- SNAPSHOT, NO FK VIVA. business_context, maturity_context y data_quality se
-- copian dentro del caso en vez de referenciar la fila viva. El apartado 61
-- exige poder reconstruir despues que datos habia CUANDO se diagnostico; si
-- apuntaramos a la configuracion actual, releer un caso de hace tres meses
-- lo mostraria con el contexto de hoy y la traza seria mentira.
--
-- FRONTERA. El contrato termina en diagnostico. Prioridad (F4) y accion
-- (F5+) no tienen columna aqui a proposito: el apartado 40 prohibe que el
-- motor diagnostico recomiende, y no darle sitio donde escribirlo es mas
-- barato que prohibirselo por prompt.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- DIAGNOSTIC_CASE (apartados 3, 15, 16, 17, 25, 26, 27, 28, 29, 30, 38, 45)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Nullable: un caso puede ser de toda la cuenta o de una tienda concreta.
  store_id uuid references public.shopify_stores (id) on delete cascade,

  -- Apartado 17 -- TARGET: el fenomeno que se intenta explicar. Sin esto
  -- existen investigaciones sin objetivo.
  target_metric varchar(80) not null,
  target_question text not null,
  -- Apartado 51 -- se conservan los dos: confundir puntos porcentuales con
  -- porcentaje relativo produce analisis erroneos.
  target_change_relative numeric,
  target_change_absolute numeric,

  -- Apartados 15 y 16 -- que se investiga y a que profundidad. Evita que un
  -- problema de Meta Espana Mobile se convierta en "tu adquisicion esta rota".
  scope varchar(40) not null,
  granularity varchar(2) not null default 'L0',
  -- channel / campaign / device / market / product...
  scope_detail jsonb not null default '{}'::jsonb,

  -- Apartado 6 -- anclaje temporal. Comparar periodos incorrectos genera
  -- diagnosticos completamente falsos.
  analysis_period_start timestamptz not null,
  analysis_period_end timestamptz not null,
  comparison_period_start timestamptz,
  comparison_period_end timestamptz,
  -- Apartado 49 -- contra que se compara. Sin baseline explicito no es
  -- evidencia fuerte.
  baseline_type varchar(30),

  -- Apartado 25 -- un diagnostico evoluciona, no es una respuesta estatica.
  status varchar(24) not null default 'open',

  -- Apartado 45 -- diagnosticar no es solo encontrar fallos: el motor tiene
  -- que poder concluir que algo esta sano, o que hay una oportunidad.
  finding varchar(20),
  -- Apartado 44 -- familia del diagnostico.
  diagnosis_type varchar(20),

  -- Apartado 38 -- la conclusion. Nula mientras el caso no concluya.
  primary_issue text,
  root_cause text,
  -- Apartado 20 -- el constraint no es la root cause: la causa explica por
  -- que pasa, el constraint que parte del sistema limita hoy el rendimiento.
  -- ("constraint" a secas es palabra reservada en SQL.)
  limiting_constraint varchar(60),
  -- Apartado 22 -- capacidades de F1 afectadas.
  affected_capabilities text[] not null default '{}',

  severity varchar(20),
  -- Apartado 29 -- MODERATE + RAPIDLY_DETERIORATING puede ser mas peligroso
  -- que HIGH + RECOVERING, asi que la trayectoria no es decoracion.
  trajectory varchar(24),
  confidence varchar(20),

  -- Apartado 28 -- que parte del negocio afecta. Evita alarmismo.
  impact_scope jsonb not null default '{}'::jsonb,
  revenue_share_affected numeric,

  -- Apartado 30 -- cuando empezo. El tiempo es una herramienta causal.
  onset_at timestamptz,
  onset_confidence varchar(20),

  -- Apartado 39 -- explicacion humana, sin recomendacion.
  summary text,
  -- Apartado 35 -- que no se ha podido mirar.
  limitations text[] not null default '{}',

  -- Apartado 37 -- D12 desarrolla los confusores; D00 solo exige que quepan.
  confounders_checked jsonb not null default '{}'::jsonb,

  -- Snapshots: ver cabecera.
  business_context jsonb not null default '{}'::jsonb,
  maturity_context jsonb not null default '{}'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diagnostic_cases_scope check (
    scope in (
      'business_global', 'acquisition', 'meta_ads', 'google_ads', 'creative',
      'conversion', 'product', 'offer', 'retention', 'email', 'inventory',
      'operations', 'finance', 'data', 'technology', 'team', 'strategy'
    )
  ),
  constraint diagnostic_cases_granularity check (
    granularity in ('L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6')
  ),
  constraint diagnostic_cases_status check (
    status in (
      'open', 'investigating', 'partially_confirmed', 'confirmed',
      'inconclusive', 'insufficient_data', 'invalidated'
    )
  ),
  constraint diagnostic_cases_finding check (
    finding is null or finding in (
      'strength', 'healthy', 'watch', 'weakness', 'problem',
      'critical_problem', 'risk', 'opportunity'
    )
  ),
  constraint diagnostic_cases_type check (
    diagnosis_type is null or diagnosis_type in (
      'performance', 'structural', 'constraint', 'risk', 'anomaly',
      'regression', 'dependency', 'data', 'operational', 'financial',
      'strategic', 'opportunity'
    )
  ),
  constraint diagnostic_cases_severity check (
    severity is null or severity in (
      'info', 'low', 'moderate', 'high', 'critical', 'business_threat'
    )
  ),
  constraint diagnostic_cases_trajectory check (
    trajectory is null or trajectory in (
      'improving', 'stable', 'deteriorating', 'rapidly_deteriorating',
      'recovering', 'volatile', 'unknown'
    )
  ),
  constraint diagnostic_cases_confidence check (
    confidence is null or confidence in (
      'high', 'medium', 'low', 'insufficient_data'
    )
  ),
  constraint diagnostic_cases_onset_confidence check (
    onset_confidence is null or onset_confidence in ('high', 'medium', 'low')
  ),
  constraint diagnostic_cases_baseline check (
    baseline_type is null or baseline_type in (
      'previous_period', 'year_over_year', 'rolling_average', 'business_target',
      'historical_normal', 'pre_event', 'control_group', 'peer_group', 'benchmark'
    )
  ),
  constraint diagnostic_cases_periodo check (
    analysis_period_end > analysis_period_start
  ),
  -- Apartado 46 -- no se puede afirmar una causa sin decir cuanta confianza
  -- hay. Un caso concluido sin confianza seria exactamente el lenguaje
  -- categorico sobre evidencia debil que el apartado 47 prohibe.
  constraint diagnostic_cases_concluido_con_confianza check (
    status not in ('confirmed', 'partially_confirmed')
    or (confidence is not null and severity is not null)
  )
);

comment on table public.diagnostic_cases is
  'F3/D00. Una investigacion diagnostica. Termina en diagnostico: la prioridad es F4 y la accion F5+, y no tienen columna aqui a proposito.';

comment on column public.diagnostic_cases.limiting_constraint is
  'Que limita hoy el rendimiento (apartado 20). No es la root cause: un negocio puede tener muchos problemas y pocos constraints reales.';

comment on column public.diagnostic_cases.business_context is
  'Copia del contexto de negocio (F1) tal como estaba al diagnosticar, no referencia viva: releer el caso debe mostrar lo que se sabia entonces.';

comment on column public.diagnostic_cases.maturity_context is
  'Copia de la madurez detectada (F2). Una misma observacion se interpreta distinto segun la etapa (apartado 24).';

create index if not exists diagnostic_cases_org_idx
  on public.diagnostic_cases (organization_id, created_at desc);

create index if not exists diagnostic_cases_store_idx
  on public.diagnostic_cases (store_id, created_at desc)
  where store_id is not null;

-- Los casos vivos se consultan mucho mas que los cerrados.
create index if not exists diagnostic_cases_abiertos_idx
  on public.diagnostic_cases (organization_id, status, severity)
  where status in ('open', 'investigating', 'partially_confirmed');

drop trigger if exists set_diagnostic_cases_updated_at on public.diagnostic_cases;
create trigger set_diagnostic_cases_updated_at
before update on public.diagnostic_cases
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- OBSERVATION (apartados 8, 13, 49, 51) -- un hecho medido, todavia no senal
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_observations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,

  metric varchar(80) not null,
  value numeric,
  previous_value numeric,
  change_absolute numeric,
  change_relative numeric,

  period_start timestamptz,
  period_end timestamptz,
  -- Apartado 50 -- device / market / browser / customer_type...
  segment jsonb not null default '{}'::jsonb,

  -- Apartado 7 -- la procedencia del dato forma parte de la evidencia.
  source varchar(40) not null,
  -- Apartado 13 -- UNKNOWN es informacion diagnostica, no un error. Por eso
  -- una observacion puede existir con value nulo: "no lo se" se registra.
  knowledge_state varchar(20) not null default 'known',
  reliability varchar(10),
  baseline_type varchar(30),

  created_at timestamptz not null default now(),

  constraint diagnostic_observations_knowledge_state check (
    knowledge_state in ('known', 'unknown', 'unavailable', 'unreliable', 'not_applicable')
  ),
  constraint diagnostic_observations_reliability check (
    reliability is null or reliability in ('high', 'medium', 'low')
  ),
  -- Si se afirma conocerla, tiene que haber valor. Y al reves: un valor
  -- guardado como "unknown" seria un dato fantasma que luego alguien citaria.
  constraint diagnostic_observations_known_con_valor check (
    (knowledge_state = 'known') = (value is not null)
  )
);

comment on table public.diagnostic_observations is
  'F3/D00 apartado 8. Hecho medido. Una observacion no es una senal ni un diagnostico. knowledge_state distinto de known es informacion valida: el motor debe poder decir que no sabe.';

create index if not exists diagnostic_observations_case_idx
  on public.diagnostic_observations (case_id, metric);

-- ---------------------------------------------------------------------------
-- SIGNAL (apartados 9, 52) -- observacion que adquiere relevancia
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_signals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  -- Una senal nace de una observacion concreta: si no se puede senalar cual,
  -- no es una senal, es una impresion.
  observation_id uuid not null references public.diagnostic_observations (id) on delete cascade,

  signal_type varchar(60) not null,
  direction varchar(6) not null,
  magnitude numeric,
  -- Apartado 52 -- magnitud y persistencia son dimensiones distintas: -11%
  -- durante 28 dias importa mas que -40% durante una hora.
  persistence_days integer,

  statistical_relevance varchar(10),
  business_relevance varchar(10),

  created_at timestamptz not null default now(),

  constraint diagnostic_signals_direction check (direction in ('up', 'down', 'flat')),
  constraint diagnostic_signals_statistical check (
    statistical_relevance is null or statistical_relevance in ('high', 'medium', 'low')
  ),
  constraint diagnostic_signals_business check (
    business_relevance is null or business_relevance in ('high', 'medium', 'low')
  ),
  constraint diagnostic_signals_persistencia check (
    persistence_days is null or persistence_days >= 0
  )
);

comment on table public.diagnostic_signals is
  'F3/D00 apartado 9. Observacion con relevancia empresarial. No toda variacion es una senal: esa distincion la desarrolla D05.';

create index if not exists diagnostic_signals_case_idx
  on public.diagnostic_signals (case_id, signal_type);

-- ---------------------------------------------------------------------------
-- SYMPTOM (apartado 10) -- patron formado por varias senales
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_symptoms (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  symptom_type varchar(80) not null,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.diagnostic_symptoms is
  'F3/D00 apartado 10. Interpretacion empresarial de varias senales. Describe que patron parece ocurrir; todavia no afirma causa.';

create index if not exists diagnostic_symptoms_case_idx
  on public.diagnostic_symptoms (case_id);

-- Un sintoma se apoya en varias senales (CTR abajo + CPC arriba + CPM plano);
-- la relacion es N:M y es lo que permite reconstruir por que se interpreto asi.
create table if not exists public.diagnostic_symptom_signals (
  symptom_id uuid not null references public.diagnostic_symptoms (id) on delete cascade,
  signal_id uuid not null references public.diagnostic_signals (id) on delete cascade,
  primary key (symptom_id, signal_id)
);

-- ---------------------------------------------------------------------------
-- HYPOTHESIS (apartados 11, 34) -- incluidas las descartadas
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_hypotheses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  -- H1, H2... dentro del caso. Es como las nombra el contrato y como se citan
  -- entre si las evidencias y los data gaps.
  code varchar(8) not null,
  statement text not null,

  -- Apartado 34 -- guardar solo la conclusion final destruiria la
  -- trazabilidad: las rechazadas se quedan, con su motivo.
  status varchar(24) not null default 'possible',
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diagnostic_hypotheses_status check (
    status in ('possible', 'supported', 'strongly_supported', 'rejected', 'unsupported', 'untestable')
  ),
  -- Rechazar sin decir por que es exactamente perder la trazabilidad que el
  -- apartado 34 quiere conservar.
  constraint diagnostic_hypotheses_rechazo_motivado check (
    status <> 'rejected' or rejection_reason is not null
  ),
  constraint diagnostic_hypotheses_code_unico unique (case_id, code)
);

comment on table public.diagnostic_hypotheses is
  'F3/D00 apartado 11. Explicaciones posibles de un sintoma. Nunca sintoma -> explicacion unica automatica; el motor reduce el espacio de hipotesis, no lo salta.';

create index if not exists diagnostic_hypotheses_case_idx
  on public.diagnostic_hypotheses (case_id, status);

drop trigger if exists set_diagnostic_hypotheses_updated_at on public.diagnostic_hypotheses;
create trigger set_diagnostic_hypotheses_updated_at
before update on public.diagnostic_hypotheses
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- EVIDENCE LEDGER (apartados 12, 32, 33)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  -- EV-001... dentro del caso, como en el apartado 33.
  code varchar(8) not null,

  source varchar(40) not null,
  metric varchar(80),
  period_start timestamptz,
  period_end timestamptz,
  segment jsonb not null default '{}'::jsonb,
  observation text not null,
  reliability varchar(10),

  created_at timestamptz not null default now(),

  constraint diagnostic_evidence_reliability check (
    reliability is null or reliability in ('high', 'medium', 'low')
  ),
  constraint diagnostic_evidence_code_unico unique (case_id, code)
);

comment on table public.diagnostic_evidence is
  'F3/D00 apartados 32 y 33. Registro completo de evidencias del caso, para auditoria posterior desde el panel administrativo.';

create index if not exists diagnostic_evidence_case_idx
  on public.diagnostic_evidence (case_id);

-- Apartado 12 -- una evidencia apoya o contradice, y eso se guarda explicito.
-- Es lo que evita el sesgo de confirmacion: sin la columna `relation` nadie
-- distingue "lo tuve en cuenta y iba en contra" de "no lo mire".
create table if not exists public.diagnostic_hypothesis_evidence (
  hypothesis_id uuid not null references public.diagnostic_hypotheses (id) on delete cascade,
  evidence_id uuid not null references public.diagnostic_evidence (id) on delete cascade,
  relation varchar(12) not null,
  primary key (hypothesis_id, evidence_id),
  constraint diagnostic_hypothesis_evidence_relation check (
    relation in ('supports', 'contradicts')
  )
);

comment on table public.diagnostic_hypothesis_evidence is
  'F3/D00 apartado 12. Evidencia a favor y en contra de cada hipotesis. Guardar solo lo que apoya es sesgo de confirmacion.';

-- ---------------------------------------------------------------------------
-- DATA_GAP (apartado 14) -- lo que falta para poder concluir
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_data_gaps (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  -- Nullable: puede faltar un dato para el caso entero, no solo para una
  -- hipotesis concreta.
  hypothesis_id uuid references public.diagnostic_hypotheses (id) on delete cascade,

  required_data text not null,
  reason text not null,
  impact_on_diagnosis varchar(10) not null default 'medium',

  created_at timestamptz not null default now(),

  constraint diagnostic_data_gaps_impact check (
    impact_on_diagnosis in ('high', 'medium', 'low')
  )
);

comment on table public.diagnostic_data_gaps is
  'F3/D00 apartado 14. Lo que haria falta para distinguir entre hipotesis. Decir que falta es mas valioso que inventar la explicacion.';

create index if not exists diagnostic_data_gaps_case_idx
  on public.diagnostic_data_gaps (case_id);

-- ---------------------------------------------------------------------------
-- CASOS RELACIONADOS (apartados 42, 43)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_case_links (
  from_case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  to_case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  relation varchar(20) not null,
  created_at timestamptz not null default now(),
  primary key (from_case_id, to_case_id, relation),
  constraint diagnostic_case_links_relation check (
    relation in ('causes', 'consequence', 'secondary', 'associated_risk')
  ),
  constraint diagnostic_case_links_no_reflexivo check (from_case_id <> to_case_id)
);

comment on table public.diagnostic_case_links is
  'F3/D00 apartados 42 y 43. Un ecommerce tiene varios problemas a la vez y encadenados. Sin esto, la ineficiencia publicitaria parece el problema principal cuando el trafico llega a productos sin stock.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Lectura de staff, no del cliente final. Un caso abierto contiene hipotesis
-- a medio contrastar y evidencia todavia sin pesar: ensenarlo antes de que el
-- consultor lo revise es ensenar sospechas como si fueran conclusiones, justo
-- lo que el apartado 47 prohibe. Abrirlo al cliente mas adelante (por ejemplo
-- solo casos `confirmed`) es una policy nueva; cerrarlo despues de haberlo
-- filtrado no tiene vuelta atras.
--
-- Escritura solo por service role, sin policy de insert, como el resto del
-- runtime de IA.

alter table public.diagnostic_cases enable row level security;
alter table public.diagnostic_observations enable row level security;
alter table public.diagnostic_signals enable row level security;
alter table public.diagnostic_symptoms enable row level security;
alter table public.diagnostic_symptom_signals enable row level security;
alter table public.diagnostic_hypotheses enable row level security;
alter table public.diagnostic_evidence enable row level security;
alter table public.diagnostic_hypothesis_evidence enable row level security;
alter table public.diagnostic_data_gaps enable row level security;
alter table public.diagnostic_case_links enable row level security;

drop policy if exists "diagnostic_cases_select_staff" on public.diagnostic_cases;
create policy "diagnostic_cases_select_staff" on public.diagnostic_cases
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

-- Las tablas hijas heredan el permiso de su caso: quien puede ver el caso ve
-- su trazabilidad, y quien no, no. Repetir aqui la condicion de organizacion
-- la duplicaria en diez sitios y dejaria diez sitios donde equivocarse.
drop policy if exists "diagnostic_observations_select_staff" on public.diagnostic_observations;
create policy "diagnostic_observations_select_staff" on public.diagnostic_observations
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));

drop policy if exists "diagnostic_signals_select_staff" on public.diagnostic_signals;
create policy "diagnostic_signals_select_staff" on public.diagnostic_signals
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));

drop policy if exists "diagnostic_symptoms_select_staff" on public.diagnostic_symptoms;
create policy "diagnostic_symptoms_select_staff" on public.diagnostic_symptoms
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));

drop policy if exists "diagnostic_symptom_signals_select_staff" on public.diagnostic_symptom_signals;
create policy "diagnostic_symptom_signals_select_staff" on public.diagnostic_symptom_signals
  for select to authenticated
  using (
    exists (select 1 from public.diagnostic_symptoms s where s.id = symptom_id)
  );

drop policy if exists "diagnostic_hypotheses_select_staff" on public.diagnostic_hypotheses;
create policy "diagnostic_hypotheses_select_staff" on public.diagnostic_hypotheses
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));

drop policy if exists "diagnostic_evidence_select_staff" on public.diagnostic_evidence;
create policy "diagnostic_evidence_select_staff" on public.diagnostic_evidence
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));

drop policy if exists "diagnostic_hypothesis_evidence_select_staff" on public.diagnostic_hypothesis_evidence;
create policy "diagnostic_hypothesis_evidence_select_staff" on public.diagnostic_hypothesis_evidence
  for select to authenticated
  using (
    exists (select 1 from public.diagnostic_hypotheses h where h.id = hypothesis_id)
  );

drop policy if exists "diagnostic_data_gaps_select_staff" on public.diagnostic_data_gaps;
create policy "diagnostic_data_gaps_select_staff" on public.diagnostic_data_gaps
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));

drop policy if exists "diagnostic_case_links_select_staff" on public.diagnostic_case_links;
create policy "diagnostic_case_links_select_staff" on public.diagnostic_case_links
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = from_case_id));
