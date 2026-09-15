-- FASE 3 / D04 — Diagnostico de salud por capacidad.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d04-requisitos-contrato-health.md
--          conocimiento/fase-03/04-policies-guardrails/d04-guardrails-health.md
--          conocimiento/fase-03/05-experience-learning/d04-health-memory-y-aprendizaje.md
--          conocimiento/fase-03/06-tenant-context/d04-contexto-health-ecommerce.md
--
-- D03 dijo de que es capaz el negocio. D04 dice como esta **hoy**. Son la misma
-- distincion que el guardrail 7 de D03 (STATE != STAGE) vista desde el otro
-- lado, y por eso viven en tablas distintas: una capacidad puede ser madura y
-- estar rota esta semana, o ser joven y funcionar perfectamente.
--
-- DIEZ GUARDRAILS SON `X != SALUD`: madurez, un KPI suelto, las ventas, la
-- causa, la prioridad, la severidad, la disposicion a escalar, lo no optimo, la
-- ausencia de datos y un heatmap. Se cumplen como en D03 -- **no hay donde
-- escribir X**:
--   * sin `priority` ni `rank` (guardrails 5, 35, 36, 37): que atacar antes es F4;
--   * sin `root_cause` (guardrails 4, 30): la causa es D07-D09, aqui solo cabe
--     una sospecha de si el problema es de origen o arrastrado, y la columna se
--     llama `issue_role` con valores que dicen "suspected" en voz alta;
--   * sin `severity` en la capacidad (guardrail 6, apartado 13): la severidad es
--     el dano de un hallazgo concreto y vive en `health_findings`;
--   * sin `scaling_readiness` (guardrail 7);
--   * sin `score` ni `health_index` (guardrails 10 y 21): un heatmap no es
--     razonamiento y una nota opaca no es un diagnostico.
--
-- LA AUSENCIA DE DATOS NO ES SALUD. Es el guardrail 9 y el apartado 21, y es el
-- error mas facil de cometer: si no vemos anomalias, asumimos que todo va bien.
-- Aqui no se puede: con `confidence = insufficient_data` el estado tiene que ser
-- `not_assessable` o `unknown`, nunca `healthy`. Y `not_assessable` exige decir
-- **que** falta.
--
-- SALUD Y RIESGO SON INDEPENDIENTES A PROPOSITO. Los guardrails 22 y 23 dicen
-- que HEALTHY puede convivir con riesgo alto. Por eso no hay ninguna constraint
-- que obligue a `health_state` y `structural_risk` a coincidir: forzar que
-- cuadren destruiria justo la informacion que hace util al bloque. La unica
-- regla es la del guardrail 25: un riesgo a corto plazo alto exige indicadores
-- adelantados, porque si solo miras los rezagados el aviso llega tarde.
--
-- JERARQUIA DE SCOPE, NO AGREGACION AUTOMATICA. El apartado 4 exige que un
-- padre HEALTHY pueda convivir con una subcapacidad CRITICAL. Se modela con
-- `parent_id` y **sin formula de agregacion**: el apartado 23 dice que la
-- politica exacta de agregacion no esta definida, y el guardrail 17 (no
-- esconder un desastre local) y el 18 (no degradar el todo por un subsegmento
-- pequeno) tiran en direcciones opuestas. Lo que hace la base es guardar los
-- dos niveles; lo que comprueba `checkHealthInvariants` es que la relacion
-- entre ellos se haya declarado.
--
-- `suspected_downstream_of` EN VEZ DE UNA TABLA DE PROPAGACION. El apartado 10
-- pide poder expresar que capacidades podrian verse afectadas desde un origen.
-- Una auto-referencia lo resuelve en la direccion que necesitan los guardrails
-- 33 y 34 -- no contar dos efectos arrastrados como dos problemas
-- independientes -- y evita una tabla que hoy nadie llenaria.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- TENANT — que significa cada capacidad para ESTE negocio
-- (tenant apartados 5, 7, 8; guardrails 42, 43, 44)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_capability_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  capability varchar(24) not null,

  -- Guardrail 43 -- no se impone el mismo registro critico a un DTC, a una
  -- suscripcion y a un marketplace. Billing es critico en suscripcion y casi
  -- irrelevante en un DTC de compra unica.
  business_critical boolean not null default false,
  criticality_rationale text,

  -- Guardrail 19 -- la exposicion cambia la interpretacion. Que falle algo que
  -- sostiene el 70% del negocio no es lo mismo que falle algo que sostiene el 3%.
  business_exposure varchar(20),
  revenue_share numeric,

  -- Tenant apartado 8 -- limites de capacidad conocidos (almacen, equipo,
  -- proveedor). No es un umbral universal: es lo que aguanta esta tienda.
  capacity_limit_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_capability_config_capacidad check (
    capability in (
      'market', 'product', 'offer', 'unit_economics', 'acquisition',
      'creative', 'conversion', 'retention', 'inventory', 'operations',
      'finance', 'data', 'technology', 'team', 'strategy'
    )
  ),
  constraint tenant_capability_config_exposicion check (
    business_exposure is null
    or business_exposure in ('minimal', 'low', 'moderate', 'high', 'existential')
  ),
  constraint tenant_capability_config_cuota check (
    revenue_share is null or (revenue_share >= 0 and revenue_share <= 1)
  ),
  -- Guardrail 44 -- declarar algo critico sin decir por que convierte una
  -- decision del negocio en una opinion heredada de un framework.
  constraint tenant_capability_config_criticidad_motivada check (
    not business_critical or criticality_rationale is not null
  )
);

comment on table public.tenant_capability_config is
  'F3/D04 tenant-context. Que es critico y cuanto pesa cada capacidad en ESTE negocio (guardrail 43: el registro critico de un DTC no es el de una suscripcion).';

create unique index if not exists tenant_capability_config_unico_idx
  on public.tenant_capability_config (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    capability
  );

drop trigger if exists set_tenant_capability_config_updated_at on public.tenant_capability_config;
create trigger set_tenant_capability_config_updated_at
before update on public.tenant_capability_config
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- TENANT — contra que se juzga (apartado 6; tenant apartados 2, 3, 4)
-- ---------------------------------------------------------------------------
--
-- El guardrail 11 prohibe clasificar CAC, CVR o refund rate por umbral
-- universal, y el 13 prohibe depender de benchmarks externos. Lo que manda es
-- lo de esta tabla: el baseline del propio negocio, su objetivo y su guardrail
-- economico. Un CAC alto puede ser sano si cabe en la economia del producto
-- (guardrail 39) y uno bajo puede ser critico si destruye contribucion (40).

create table if not exists public.health_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  capability varchar(24),
  metric varchar(80) not null,
  scope varchar(40) not null default 'global',

  reference_type varchar(24) not null,
  value numeric,
  value_text text,
  unit varchar(16),
  -- Cuando la referencia acota por arriba o por abajo: un CAC sostenible es un
  -- techo, una cobertura de stock es un suelo.
  direction varchar(10),

  source text,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint health_references_tipo check (
    reference_type in (
      'self_baseline', 'adjusted_baseline', 'business_target',
      'economic_guardrail', 'external_benchmark'
    )
  ),
  constraint health_references_direccion check (
    direction is null or direction in ('max', 'min', 'range')
  ),
  constraint health_references_capacidad check (
    capability is null or capability in (
      'market', 'product', 'offer', 'unit_economics', 'acquisition',
      'creative', 'conversion', 'retention', 'inventory', 'operations',
      'finance', 'data', 'technology', 'team', 'strategy'
    )
  ),
  constraint health_references_valor check (
    value is not null or value_text is not null
  ),
  constraint health_references_vigencia check (
    effective_to is null or effective_to > effective_from
  ),
  -- Guardrail 13 -- un benchmark externo no es verdad del tenant, asi que al
  -- menos tiene que decir de donde sale para poder discutirlo.
  constraint health_references_benchmark_con_fuente check (
    reference_type <> 'external_benchmark' or source is not null
  )
);

comment on table public.health_references is
  'F3/D04 tenant-context. Contra que se juzga una metrica en ESTA tienda: su propio baseline, su objetivo, su guardrail economico. El guardrail 11 prohibe el umbral universal.';

comment on column public.health_references.reference_type is
  'Apartado 6. D4 debe poder funcionar sin `external_benchmark`: el guardrail 13 prohibe depender de el.';

create index if not exists health_references_org_idx
  on public.health_references (organization_id, metric)
  where effective_to is null;

drop trigger if exists set_health_references_updated_at on public.health_references;
create trigger set_health_references_updated_at
before update on public.health_references
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- LA TARJETA DE SALUD (apartados 1, 3, 4, 7, 9, 11, 12, 16, 17, 20, 21)
-- ---------------------------------------------------------------------------

create table if not exists public.capability_health (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  capability varchar(24) not null,
  -- Apartado 4 -- una evaluacion puede ser de la capacidad entera o de un
  -- canal, mercado, cohorte o SKU. `parent_id` sostiene la jerarquia sin
  -- imponer agregacion automatica.
  scope varchar(40) not null default 'global',
  scope_detail jsonb not null default '{}'::jsonb,
  parent_id uuid references public.capability_health (id) on delete cascade,

  health_state varchar(20) not null,
  -- Apartado 3 -- salud y trayectoria son campos separados: BAD mejorando y
  -- HEALTHY cayendo en picado son situaciones muy distintas.
  trajectory varchar(24),

  -- Apartado 7 -- ahora frente a lo que viene.
  near_term_risk varchar(20) not null default 'none',
  risk_horizon varchar(4),
  -- Guardrails 24 y 25 -- sin indicadores adelantados el aviso llega cuando ya
  -- hay dano.
  has_leading_signals boolean not null default false,

  -- Apartado 11 -- riesgo estructural convive con salud actual. Un HEALTHY con
  -- riesgo estructural alto es exactamente el caso que el guardrail 22
  -- describe, y no hay constraint que lo impida.
  structural_risk varchar(20) not null default 'none',

  -- Apartado 12 -- agudo frente a cronico. La fuente no define umbrales
  -- temporales y aqui tampoco se inventan: es una etiqueta, no un calculo.
  chronicity varchar(24),

  -- Apartado 9 -- origen sospechado o efecto arrastrado. Los valores dicen
  -- "suspected" a proposito: el guardrail 31 permite registrar la sospecha y
  -- el 30 prohibe afirmar la causa.
  issue_role varchar(24),
  suspected_downstream_of uuid references public.capability_health (id) on delete set null,

  -- Apartado 16 -- sobre que parte del negocio impacta.
  impact_vector text[] not null default '{}',
  current_failure text,

  -- Apartado 16 de D03 y guardrail 16 de aqui: la madurez se conserva JUNTO a
  -- la salud, nunca mezclada con ella. Referencia al perfil, no copia del nivel.
  maturity_profile_id uuid references public.maturity_profiles (id) on delete set null,

  confidence varchar(20) not null default 'low',
  -- Apartado 21 -- si no se puede evaluar, hay que decir que falta.
  assessment_blocker text,
  -- Guardrail 28 -- si hay senales que contradicen el estado, se resuelve la
  -- inconsistencia por escrito en vez de ignorarla.
  contradiction_resolution text,
  -- Guardrails 48, 49 y 50 -- los estados extremos no son un recurso retorico.
  state_justification text,

  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capability_health_capacidad check (
    capability in (
      'market', 'product', 'offer', 'unit_economics', 'acquisition',
      'creative', 'conversion', 'retention', 'inventory', 'operations',
      'finance', 'data', 'technology', 'team', 'strategy'
    )
  ),
  constraint capability_health_estado check (
    health_state in (
      'elite', 'healthy', 'fragile', 'bad', 'critical', 'disaster',
      'unknown', 'not_assessable'
    )
  ),
  constraint capability_health_trayectoria check (
    trajectory is null or trajectory in (
      'improving', 'stable', 'deteriorating', 'rapidly_deteriorating',
      'recovering', 'volatile'
    )
  ),
  constraint capability_health_riesgo_corto check (
    near_term_risk in ('none', 'low', 'moderate', 'high', 'critical')
  ),
  constraint capability_health_riesgo_estructural check (
    structural_risk in ('none', 'low', 'moderate', 'high', 'critical')
  ),
  constraint capability_health_horizonte check (
    risk_horizon is null or risk_horizon in ('now', '7d', '30d', '90d')
  ),
  constraint capability_health_cronicidad check (
    chronicity is null or chronicity in (
      'acute_failure', 'chronic_weakness', 'chronic_fragility', 'health_debt'
    )
  ),
  constraint capability_health_rol check (
    issue_role is null or issue_role in (
      'primary_suspected', 'downstream_suspected', 'unclear'
    )
  ),
  constraint capability_health_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  -- Guardrail 9 y apartado 21 -- ausencia de datos NO es salud. Es el error mas
  -- facil de cometer: no ver anomalias y concluir que todo va bien.
  constraint capability_health_sin_datos_no_es_sano check (
    confidence <> 'insufficient_data'
    or health_state in ('not_assessable', 'unknown')
  ),
  -- Apartado 21 -- y si no se puede evaluar, hay que decir que falta.
  constraint capability_health_no_evaluable_declarado check (
    health_state <> 'not_assessable' or assessment_blocker is not null
  ),
  -- Guardrail 25 -- un riesgo a corto plazo alto sin indicadores adelantados es
  -- una prediccion hecha mirando por el retrovisor.
  constraint capability_health_riesgo_con_senales check (
    near_term_risk not in ('high', 'critical') or has_leading_signals
  ),
  -- Guardrail 23 -- si hay riesgo a corto, hay que decir a que plazo; "pronto"
  -- no es accionable.
  constraint capability_health_riesgo_con_horizonte check (
    near_term_risk in ('none', 'low') or risk_horizon is not null
  ),
  -- Guardrails 48, 49 y 50 -- CRITICAL refleja dano grave, rapido o muy
  -- propagado, y DISASTER se reserva para lo excepcional. Exigir que se
  -- justifique y se diga sobre que impacta es lo que impide usarlos como
  -- adjetivo.
  constraint capability_health_extremos_justificados check (
    health_state not in ('critical', 'disaster')
    or (state_justification is not null and cardinality(impact_vector) > 0)
  ),
  -- Apartado 9 -- decir que algo es arrastrado exige decir de donde.
  constraint capability_health_downstream_con_origen check (
    issue_role <> 'downstream_suspected' or suspected_downstream_of is not null
  ),
  constraint capability_health_no_es_su_propio_origen check (
    suspected_downstream_of is null or suspected_downstream_of <> id
  )
);

comment on table public.capability_health is
  'F3/D04. Como esta hoy una capacidad. Sin severidad (eso es del hallazgo), sin prioridad (eso es F4), sin causa (eso es D07-D09) y sin nota global (guardrail 21).';

comment on column public.capability_health.issue_role is
  'Apartado 9. Los valores dicen "suspected" a proposito: el guardrail 31 permite registrar la sospecha y el 30 prohibe afirmar causalidad.';

comment on column public.capability_health.structural_risk is
  'Apartado 11. No hay constraint que lo obligue a coincidir con health_state: el guardrail 22 dice que HEALTHY y riesgo alto pueden convivir, y forzarlos a cuadrar destruiria esa informacion.';

comment on column public.capability_health.maturity_profile_id is
  'Guardrail 16: la madurez de D03 se conserva junto a la salud, nunca mezclada. Referencia al perfil, no copia del nivel.';

create index if not exists capability_health_org_idx
  on public.capability_health (organization_id, assessed_at desc);

create index if not exists capability_health_capacidad_idx
  on public.capability_health (organization_id, capability, assessed_at desc);

-- Apartado 20 -- lo que se consulta para monitorizar: lo que no esta sano.
create index if not exists capability_health_degradadas_idx
  on public.capability_health (organization_id, health_state, assessed_at desc)
  where health_state in ('fragile', 'bad', 'critical', 'disaster');

create index if not exists capability_health_padre_idx
  on public.capability_health (parent_id)
  where parent_id is not null;

drop trigger if exists set_capability_health_updated_at on public.capability_health;
create trigger set_capability_health_updated_at
before update on public.capability_health
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- HALLAZGOS — aqui si vive la severidad (apartados 13, 14; guardrails 6, 45-47)
-- ---------------------------------------------------------------------------

create table if not exists public.health_findings (
  id uuid primary key default gen_random_uuid(),
  capability_health_id uuid not null
    references public.capability_health (id) on delete cascade,

  -- Guardrails 45, 46 y 47 -- HEALTHY no significa optimizado, y una
  -- oportunidad de mejora no es una enfermedad. Separarlas por tipo es lo que
  -- impide que "se puede mejorar el asunto de los emails" acabe pintando la
  -- capacidad de rojo.
  kind varchar(16) not null default 'issue',
  description text not null,

  -- Apartado 13 -- la severidad es del hallazgo, no de la capacidad.
  severity varchar(20) not null,
  scope varchar(40) not null default 'global',
  impact text,
  trajectory varchar(24),
  confidence varchar(20) not null default 'low',

  created_at timestamptz not null default now(),

  constraint health_findings_tipo check (kind in ('issue', 'opportunity')),
  constraint health_findings_severidad check (
    severity in ('info', 'low', 'moderate', 'high', 'critical', 'business_threat')
  ),
  constraint health_findings_trayectoria check (
    trajectory is null or trajectory in (
      'improving', 'stable', 'deteriorating', 'rapidly_deteriorating',
      'recovering', 'volatile'
    )
  ),
  constraint health_findings_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  -- Guardrail 46 -- una oportunidad no se convierte en enfermedad subiendole la
  -- severidad. Si de verdad hace dano, es un `issue`.
  constraint health_findings_oportunidad_no_es_enfermedad check (
    kind <> 'opportunity' or severity in ('info', 'low')
  )
);

comment on table public.health_findings is
  'F3/D04. El dano concreto dentro de una capacidad. Aqui vive la severidad (apartado 13) y aqui se separa una oportunidad de una enfermedad (guardrail 46).';

create index if not exists health_findings_salud_idx
  on public.health_findings (capability_health_id);

-- ---------------------------------------------------------------------------
-- EVIDENCIA (apartado 5; guardrails 2, 26, 27, 28)
-- ---------------------------------------------------------------------------

create table if not exists public.health_evidence (
  id uuid primary key default gen_random_uuid(),
  capability_health_id uuid not null
    references public.capability_health (id) on delete cascade,

  -- Guardrails 26 y 27 -- la evidencia positiva cuenta, y la que contradice no
  -- se tira. Un diagnostico que solo recoge anomalias no es un diagnostico, es
  -- una lista de quejas.
  relation varchar(16) not null default 'supporting',

  metric varchar(80) not null,
  observation text not null,
  value numeric,
  -- Guardrail 25 -- distinguir el indicador que avisa del que confirma.
  indicator_type varchar(12) not null default 'lagging',

  -- Apartado 5 -- contra que se comparo y en que ventana.
  reference_id uuid references public.health_references (id) on delete set null,
  window_start timestamptz,
  window_end timestamptz,

  source varchar(40),
  confidence varchar(20) not null default 'low',

  created_at timestamptz not null default now(),

  constraint health_evidence_relacion check (
    relation in ('supporting', 'contradicting', 'positive')
  ),
  constraint health_evidence_indicador check (
    indicator_type in ('leading', 'lagging')
  ),
  constraint health_evidence_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint health_evidence_ventana check (
    window_start is null or window_end is null or window_end > window_start
  )
);

comment on table public.health_evidence is
  'F3/D04. Por que se afirma ese estado. `relation` conserva la evidencia positiva y la que contradice (guardrails 26 y 27): tirarlas deja un diagnostico que solo sabe quejarse.';

comment on column public.health_evidence.indicator_type is
  'Guardrail 25: un indicador rezagado confirma el dano cuando ya ocurrio. Sin adelantados no hay aviso temprano posible.';

create index if not exists health_evidence_salud_idx
  on public.health_evidence (capability_health_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Staff, como el resto de la fase. La salud por capacidad es la materia prima
-- de la conversacion del consultor con su cliente, y "tu operativa esta BAD"
-- sin acompanamiento es una etiqueta, no una ayuda.

alter table public.tenant_capability_config enable row level security;
alter table public.health_references enable row level security;
alter table public.capability_health enable row level security;
alter table public.health_findings enable row level security;
alter table public.health_evidence enable row level security;

drop policy if exists "tenant_capability_config_select_staff" on public.tenant_capability_config;
create policy "tenant_capability_config_select_staff" on public.tenant_capability_config
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "health_references_select_staff" on public.health_references;
create policy "health_references_select_staff" on public.health_references
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "capability_health_select_staff" on public.capability_health;
create policy "capability_health_select_staff" on public.capability_health
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "health_findings_select_staff" on public.health_findings;
create policy "health_findings_select_staff" on public.health_findings
  for select to authenticated
  using (
    exists (select 1 from public.capability_health h where h.id = capability_health_id)
  );

drop policy if exists "health_evidence_select_staff" on public.health_evidence;
create policy "health_evidence_select_staff" on public.health_evidence
  for select to authenticated
  using (
    exists (select 1 from public.capability_health h where h.id = capability_health_id)
  );
