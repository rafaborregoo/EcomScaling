-- FASE 3 / D03 — Deteccion de etapa de madurez.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d03-requisitos-contrato-madurez.md
--          conocimiento/fase-03/04-policies-guardrails/d03-guardrails-madurez.md
--          conocimiento/fase-03/05-experience-learning/d03-aprendizaje-y-evolucion-madurez.md
--          conocimiento/fase-03/06-tenant-context/d03-contexto-madurez-ecommerce.md
--
-- D03 responde a "¿que es capaz de hacer este negocio?", que no es lo mismo que
-- "¿como le esta yendo?". Un ecommerce puede facturar mucho con capacidades
-- fragiles, y otro poco con un sistema solido y joven.
--
-- LOS 30 GUARDRAILS SON CASI TODOS LA MISMA FRASE: `X != MADUREZ`. Facturacion,
-- rendimiento, usar una herramienta, automatizar, tamano del equipo,
-- documentacion. Todos se mecanizan igual y en negativo: **no existe columna
-- donde escribir X**. Si no hay sitio para la facturacion ni para el numero de
-- personas, no pueden entrar en el calculo por descuido.
--
-- NO HAY PUNTUACION. El guardrail 11 prohibe una nota vanity sin interpretacion
-- diagnostica, asi que no hay `score`, `overall_score` ni `maturity_index` en
-- ninguna tabla. Un perfil de madurez es un nivel por capacidad, su nivel
-- requerido y el hallazgo que explica la diferencia. Reducirlo a un 72/100 es
-- justo lo que el documento no quiere.
--
-- ESTADO NO ES ETAPA (apartado 9, guardrail 7). Aqui no hay columna de salud ni
-- de incidencia: un problema de hoy no mueve la etapa estructural. La salud por
-- capacidad es D04 y vive en otro sitio a proposito.
--
-- LA JERARQUIA DE EVIDENCIA ES EL NUCLEO MECANIZABLE. El apartado 10 la ordena:
-- comportamiento observado > dato del sistema > proceso documentado > lo que
-- dice el cliente. De ahi salen los guardrails 15, 16 y 23, y de ahi sale la
-- regla dura de este bloque: **a partir de DEFINED hace falta evidencia por
-- encima de la autopercepcion**. Se anade `tool_presence` como tipo propio
-- porque los guardrails 3 y 14 avisan exactamente de eso -- tener Klaviyo, un
-- ERP o un dashboard no es tener la capacidad.
--
-- LAS DIMENSIONES NO SON DECORACION. El apartado 5 lista diez (existencia,
-- consistencia, repetibilidad, medicion, ownership, automatizacion,
-- predictibilidad, optimizacion, resiliencia, aprendizaje) y varias sostienen
-- un nivel concreto: sin medicion no se puede estar en MEASURED (guardrails 20
-- y 21), sin ownership no se llega a OPTIMIZED (guardrail 29), y sin
-- aprendizaje no se es ADAPTIVE (guardrail 30). Son check constraints, no
-- casillas informativas.
--
-- E0..E12 NO SE REDEFINEN AQUI. El apartado 2 es explicito: "D3 consume estos
-- stages; no los redefine". La columna guarda el codigo y su significado
-- pertenece a la fase 2.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- PERFIL — la foto estructural del negocio, con historia (apartados 1, 2, 16)
-- ---------------------------------------------------------------------------

create table if not exists public.maturity_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  -- Apartado 2 -- stage gate de la fase 2. Aqui solo se referencia.
  business_stage varchar(3),

  -- Apartado 16 / experience apartado 1 -- por que cambia este perfil respecto
  -- al anterior. El ejemplo del documento es exacto: pasar de "Finance E3-E5
  -- con confianza baja" a "Finance E4 con confianza alta" NO es una mejora del
  -- negocio, es una mejora de la observacion. Si no se distinguen, el sistema
  -- celebra progresos que no existieron (guardrail 28).
  change_type varchar(24),
  supersedes_id uuid references public.maturity_profiles (id) on delete set null,
  change_summary text,

  confidence varchar(20) not null default 'low',

  assessed_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint maturity_profiles_stage check (
    business_stage is null or business_stage in (
      'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6',
      'e7', 'e8', 'e9', 'e10', 'e11', 'e12'
    )
  ),
  constraint maturity_profiles_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint maturity_profiles_tipo_de_cambio check (
    change_type is null or change_type in (
      'initial', 'real_change', 'uncertainty_reduction', 'confidence_increase'
    )
  ),
  -- Un perfil que sustituye a otro tiene que decir en que sentido cambia. Sin
  -- esto, "subio Finance" y "ahora vemos mejor Finance" son indistinguibles.
  constraint maturity_profiles_sustitucion_declarada check (
    supersedes_id is null or change_type is not null
  ),
  constraint maturity_profiles_vigencia check (
    superseded_at is null or superseded_at >= assessed_at
  )
);

comment on table public.maturity_profiles is
  'F3/D03. Que es capaz de hacer un negocio, no como le va. Sin puntuacion global: el guardrail 11 prohibe la nota vanity sin interpretacion.';

comment on column public.maturity_profiles.change_type is
  'Por que cambia respecto al perfil anterior. `confidence_increase` y `uncertainty_reduction` NO son mejoras del negocio (guardrail 28): son mejoras de la observacion.';

comment on column public.maturity_profiles.business_stage is
  'Stage E0..E12 definido en la fase 2. D03 lo consume y no lo redefine (contrato apartado 2).';

create index if not exists maturity_profiles_org_idx
  on public.maturity_profiles (organization_id, assessed_at desc);

-- Un solo perfil vigente por tienda: si hubiera dos, ningun motor sabria cual
-- describe al negocio hoy.
create unique index if not exists maturity_profiles_vigente_idx
  on public.maturity_profiles (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where superseded_at is null;

drop trigger if exists set_maturity_profiles_updated_at on public.maturity_profiles;
create trigger set_maturity_profiles_updated_at
before update on public.maturity_profiles
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- CAPACIDAD — nivel actual, nivel requerido y la diferencia
-- (apartados 1, 3, 4, 5, 7, 8)
-- ---------------------------------------------------------------------------

create table if not exists public.capability_maturity (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.maturity_profiles (id) on delete cascade,

  -- Apartado 3. Son las capacidades de la fase 1, las mismas que el
  -- `affected_capabilities` de un caso diagnostico de D00.
  capability varchar(24) not null,

  -- Apartado 4 -- la escalera. Cerrada.
  current_level varchar(16) not null,
  -- Apartado 6 -- lo que ESTE negocio necesita, derivado de su complejidad
  -- (volumen, SKUs, mercados, canales...), no de un estandar universal. El
  -- guardrail 25 prohibe exigir capacidades enterprise a quien no las necesita
  -- y el 12 prohibe comparar empresas entre si en vez de capacidad actual
  -- contra capacidad requerida.
  required_level varchar(16),
  -- Apartado 7 -- en que banda cae lo requerido.
  expectation_band varchar(16),

  -- Apartado 8 -- que significa la diferencia. Esto es la "interpretacion
  -- diagnostica" que el guardrail 11 exige a cambio de no dar una nota.
  finding varchar(32),
  gap_interpretation text,

  -- Apartado 5 -- las diez dimensiones. No son informativas: tres de ellas
  -- sostienen un nivel por check constraint (ver mas abajo).
  has_existence boolean not null default false,
  has_consistency boolean not null default false,
  has_repeatability boolean not null default false,
  has_measurement boolean not null default false,
  has_ownership boolean not null default false,
  has_automation boolean not null default false,
  has_predictability boolean not null default false,
  has_optimization boolean not null default false,
  has_resilience boolean not null default false,
  has_learning boolean not null default false,

  -- Guardrail 20 -- una capacidad que existe pero no se usa, no se mide o no
  -- cambia decisiones no es una capacidad madura. Medir y que la medida sirva
  -- para algo son cosas distintas y hacen falta las dos.
  influences_decisions boolean not null default false,

  -- Apartado 17 -- ownership y dependencia de personas.
  owner_role varchar(60),
  key_person_dependency boolean not null default false,

  confidence varchar(20) not null default 'low',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capability_maturity_capacidad check (
    capability in (
      'market', 'product', 'offer', 'unit_economics', 'acquisition',
      'creative', 'conversion', 'retention', 'inventory', 'operations',
      'finance', 'data', 'technology', 'team', 'strategy'
    )
  ),
  constraint capability_maturity_nivel check (
    current_level in (
      'absent', 'ad_hoc', 'repeatable', 'defined', 'measured',
      'optimized', 'adaptive'
    )
  ),
  constraint capability_maturity_requerido check (
    required_level is null or required_level in (
      'absent', 'ad_hoc', 'repeatable', 'defined', 'measured',
      'optimized', 'adaptive'
    )
  ),
  constraint capability_maturity_banda check (
    expectation_band is null or expectation_band in (
      'minimum_viable', 'minimum', 'expected', 'advanced'
    )
  ),
  constraint capability_maturity_hallazgo check (
    finding is null or finding in (
      'capability_not_yet_developed', 'structural_weakness',
      'growth_system_gap', 'overengineering', 'structural_debt',
      'fragile_growth', 'sustainable_growth', 'maturity_bottleneck',
      'maturity_regression', 'latent_structural_risk',
      'structural_imbalance', 'complexity_theater', 'premature_scaling',
      'appropriate', 'critically_behind'
    )
  ),
  constraint capability_maturity_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  -- Lo que no existe no tiene nivel, y lo que tiene nivel existe. La
  -- existencia es el suelo de la escalera, no una dimension mas.
  constraint capability_maturity_existencia_es_el_suelo check (
    (current_level = 'absent') = (has_existence = false)
  ),
  -- Guardrails 20 y 21 -- no se es MEASURED sin medir, y medir sin que cambie
  -- ninguna decision es un panel que nadie mira. El 21 lo dice del forecasting:
  -- no es maduro si no se mide su acierto ni se analizan los errores.
  constraint capability_maturity_medido_exige_medicion check (
    current_level not in ('measured', 'optimized', 'adaptive')
    or (has_measurement and influences_decisions)
  ),
  -- Guardrail 29 -- sin ownership suficiente no hay capacidad madura.
  constraint capability_maturity_optimizado_exige_ownership check (
    current_level not in ('optimized', 'adaptive') or has_ownership
  ),
  -- Guardrail 30 -- adaptive exige capacidad real de detectar, aprender y
  -- ajustar. Es el nivel mas alto y el que mas se regala.
  constraint capability_maturity_adaptativo_exige_aprendizaje check (
    current_level <> 'adaptive' or (has_learning and has_resilience)
  ),
  -- Guardrail 11 -- la nota se cambia por interpretacion. Un hallazgo sin
  -- explicacion vuelve a ser una etiqueta vacia.
  constraint capability_maturity_hallazgo_explicado check (
    finding is null or gap_interpretation is not null
  )
);

comment on table public.capability_maturity is
  'F3/D03. Nivel de una capacidad, el que este negocio necesita y que significa la diferencia. Sin columnas de facturacion, equipo ni herramientas: los guardrails 1 a 6 dicen que nada de eso es madurez.';

comment on column public.capability_maturity.required_level is
  'Lo que ESTE negocio necesita por su complejidad, no un estandar. El guardrail 25 prohibe exigir capacidades enterprise a quien no las necesita.';

comment on column public.capability_maturity.influences_decisions is
  'Guardrail 20: una capacidad que existe pero no cambia ninguna decision no esta madura. Medir y que la medida sirva no son lo mismo.';

create unique index if not exists capability_maturity_unico_idx
  on public.capability_maturity (profile_id, capability);

create index if not exists capability_maturity_hallazgo_idx
  on public.capability_maturity (finding)
  where finding is not null;

drop trigger if exists set_capability_maturity_updated_at on public.capability_maturity;
create trigger set_capability_maturity_updated_at
before update on public.capability_maturity
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- EVIDENCIA — por que se afirma ese nivel (apartados 10, 11, 12)
-- ---------------------------------------------------------------------------

create table if not exists public.maturity_evidence (
  id uuid primary key default gen_random_uuid(),
  capability_maturity_id uuid not null
    references public.capability_maturity (id) on delete cascade,

  -- Apartado 10, en su orden de fuerza. `tool_presence` no esta en la lista
  -- original: se anade porque los guardrails 3 y 14 avisan de el
  -- explicitamente, y sin tipo propio se colaria disfrazado de dato del
  -- sistema. Tener Klaviyo no es saber hacer email marketing.
  evidence_type varchar(24) not null,
  description text not null,
  source varchar(60),
  observed_at timestamptz,

  -- Apartado 11 frente a 12: no es lo mismo justificar un ascenso que una
  -- regresion, y la regresion exige mas.
  supports varchar(20) not null default 'current_level',
  -- Apartado 12 / guardrails 13 y 26 -- lo persistente distingue una regresion
  -- estructural de una averia de esta semana.
  persistent boolean not null default false,

  created_at timestamptz not null default now(),

  constraint maturity_evidence_tipo check (
    evidence_type in (
      'observed_behavior', 'system_data', 'documented_process',
      'tool_presence', 'user_claim'
    )
  ),
  constraint maturity_evidence_sostiene check (
    supports in ('current_level', 'advancement', 'regression')
  ),
  -- Guardrails 13 y 26 -- una incidencia puntual no baja la madurez. Si la
  -- evidencia sostiene una regresion, tiene que ser persistente y estar
  -- fechada; de lo contrario es un mal dia.
  constraint maturity_evidence_regresion_persistente check (
    supports <> 'regression' or (persistent and observed_at is not null)
  )
);

comment on table public.maturity_evidence is
  'F3/D03. Por que se afirma un nivel. `evidence_type` esta ordenado por fuerza (apartado 10): comportamiento observado > dato del sistema > proceso documentado > herramienta presente > lo que dice el cliente.';

comment on column public.maturity_evidence.evidence_type is
  'tool_presence se anade a la lista del artefacto porque los guardrails 3 y 14 avisan de el: usar una herramienta no es tener la capacidad.';

create index if not exists maturity_evidence_capacidad_idx
  on public.maturity_evidence (capability_maturity_id);

-- ---------------------------------------------------------------------------
-- DEPENDENCIAS ENTRE CAPACIDADES (apartados 13 y 14)
-- ---------------------------------------------------------------------------
--
-- Que una capacidad necesite a otra, o le ponga techo. El ejemplo del
-- artefacto: escalar adquisicion pagada necesita inventario, finanzas,
-- creatividad, conversion, operaciones y datos; y la capacidad de producir
-- creatividades pone techo a cuanto se puede escalar en paid.
--
-- LA TABLA SE CREA VACIA, A PROPOSITO. El grafo concreto es conocimiento de
-- ecommerce, y el artefacto solo da un ejemplo. Inventarme el resto seria
-- exactamente lo que el plan maestro prohibe: convertir criterio en codigo. Se
-- llena cuando alguien lo escriba con el prompt maestro, o desde el panel.

create table if not exists public.capability_dependencies (
  id uuid primary key default gen_random_uuid(),
  -- Sin organizacion: es como funciona el ecommerce, no como funciona una
  -- tienda. Si algun dia un tenant necesita una excepcion, se anade entonces.
  capability varchar(24) not null,
  depends_on varchar(24) not null,
  relation varchar(16) not null default 'requires',
  rationale text not null,

  created_at timestamptz not null default now(),

  constraint capability_dependencies_capacidad check (
    capability in (
      'market', 'product', 'offer', 'unit_economics', 'acquisition',
      'creative', 'conversion', 'retention', 'inventory', 'operations',
      'finance', 'data', 'technology', 'team', 'strategy'
    )
  ),
  constraint capability_dependencies_dependencia check (
    depends_on in (
      'market', 'product', 'offer', 'unit_economics', 'acquisition',
      'creative', 'conversion', 'retention', 'inventory', 'operations',
      'finance', 'data', 'technology', 'team', 'strategy'
    )
  ),
  constraint capability_dependencies_relacion check (
    relation in ('requires', 'ceiling')
  ),
  constraint capability_dependencies_no_circular check (capability <> depends_on)
);

comment on table public.capability_dependencies is
  'F3/D03. Que capacidad necesita a cual, o le pone techo (apartados 13 y 14). Se crea vacia: el grafo es conocimiento de ecommerce y no se inventa desde una migracion.';

create unique index if not exists capability_dependencies_unico_idx
  on public.capability_dependencies (capability, depends_on, relation);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Staff para el perfil y sus hijas, igual que el resto de F3. La madurez es
-- material de conversacion del consultor: decirle a un cliente "tu capacidad
-- de retencion es AD_HOC" sin contexto ni acompanamiento es un juicio, no una
-- ayuda. Cuando haya pantalla y redaccion para ensenarselo bien, se revisa.
--
-- `capability_dependencies` es la excepcion: no tiene organizacion porque no es
-- de nadie, asi que la lee cualquier usuario autenticado. Saber que escalar
-- adquisicion necesita inventario no revela nada de ningun cliente.

alter table public.maturity_profiles enable row level security;
alter table public.capability_maturity enable row level security;
alter table public.maturity_evidence enable row level security;
alter table public.capability_dependencies enable row level security;

drop policy if exists "maturity_profiles_select_staff" on public.maturity_profiles;
create policy "maturity_profiles_select_staff" on public.maturity_profiles
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "capability_maturity_select_staff" on public.capability_maturity;
create policy "capability_maturity_select_staff" on public.capability_maturity
  for select to authenticated
  using (
    exists (select 1 from public.maturity_profiles p where p.id = profile_id)
  );

drop policy if exists "maturity_evidence_select_staff" on public.maturity_evidence;
create policy "maturity_evidence_select_staff" on public.maturity_evidence
  for select to authenticated
  using (
    exists (
      select 1 from public.capability_maturity c where c.id = capability_maturity_id
    )
  );

drop policy if exists "capability_dependencies_select_all" on public.capability_dependencies;
create policy "capability_dependencies_select_all" on public.capability_dependencies
  for select to authenticated
  using (true);
