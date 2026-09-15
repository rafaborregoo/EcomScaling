-- FASE 3 / D09 — Root cause & constraint engine.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d09-requisitos-contrato-root-cause-constraint.md
--          conocimiento/fase-03/04-policies-guardrails/d09-guardrails-root-cause-constraint.md
--          conocimiento/fase-03/03-runtime/d09-flujo-root-cause-constraint.md
--          conocimiento/fase-03/06-tenant-context/d09-contexto-root-cause-constraint.md
--          conocimiento/fase-03/05-experience-learning/d09-memoria-root-causes-y-constraints.md
--
-- **El unico bloque de la fase autorizado a cerrar una causa.** D08 dejo
-- candidatas con su condicion de falsacion; aqui se deciden. Y aun asi D09
-- sigue sin priorizar: el guardrail 25 y el 37 lo dicen -- severidad, prioridad,
-- playbook y ranking de impacto no salen de aqui. Eso es F4.
--
-- CAUSA RAIZ Y CONSTRAINT SON DOS COSAS DISTINTAS, Y POR ESO SON DOS TABLAS
-- (guardrail 4). El apartado 23 exige que las cuatro combinaciones puedan
-- existir: causa conocida con constraint desconocido, constraint conocido con
-- causa desconocida, causa resuelta con constraint activo y constraint resuelto
-- con driver estructural activo. **No hay ninguna clave ajena que las ate**, y
-- hay tests que comprueban que las cuatro caben. Atarlas seria convertir "por
-- que paso" y "que nos limita" en la misma pregunta, que es justo el error que
-- el bloque existe para evitar.
--
-- UN CONSTRAINT NO ES UNA DEBILIDAD (guardrail 5, 28 y 30). Una tienda puede
-- tener el email mal montado y que eso no limite nada si el cuello esta en el
-- stock. Por eso `target` es obligatorio -- el constraint siempre es respecto de
-- algo -- y declararlo vinculante exige haber pasado el test contrafactual:
-- `falsifier` y `counterfactual_result` son obligatorios para `binding`.
--
-- UNA CAPACIDAD ALTA NO ES UN CONSTRAINT (guardrail 29). `capacity` y
-- `demand_on_capacity` son columnas separadas: lo que hace cuello no es el nivel
-- absoluto de una, es la relacion entre las dos.
--
-- CONFIRMED ES EXCEPCIONAL (guardrail 12), Y `UNRESOLVED` ES UNA SALIDA VALIDA
-- (13). No forzar el cierre (14) es lo que separa un diagnostico de un informe
-- que habia que entregar. Confirmar exige confianza alta, cadena causal
-- soportada y limitaciones escritas.
--
-- MEDIR MAL NO ES IR MAL (guardrails 41 y 42). Una regresion de tracking puede
-- ser la causa raiz de un problema de observabilidad sin ser la causa de un
-- deterioro del negocio. `affects_observability_only` lo marca, y el check
-- impide que algo asi reclame cobertura explicativa del negocio.
--
-- NO SE CULPA A PERSONAS (guardrails 38, 39 y 40). La garantia es estructural y
-- es la misma jugada que en D06 con `direction`: **no existe ninguna columna
-- donde quepa una persona**. Ni `responsible`, ni `owner`, ni `blamed_by`. Se
-- describen procesos, capacidades y configuraciones, y el error humano se
-- expresa en terminos observables porque no hay otro sitio donde escribirlo.
--
-- LO QUE NO ESTA AQUI: `severity`, `priority`, `impact_rank`, `playbook`,
-- `action`. Guardrail 35: que un constraint sea vinculante no lo hace lo mas
-- urgente -- un outage critico puede ir antes que un cuello estructural, y esa
-- decision es de F4.

-- ---------------------------------------------------------------------------
-- 1. La causa raiz
-- ---------------------------------------------------------------------------

create table if not exists public.root_causes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid references public.diagnostic_cases (id) on delete cascade,
  -- De donde viene: la hipotesis de D08 que la sostiene, con su ledger de
  -- evidencia ya montado. No se duplica la evidencia aqui.
  hypothesis_id uuid references public.diagnostic_hypotheses (id) on delete set null,
  -- Guardrail 16: una causa raiz necesita cadena causal soportada.
  causal_path_id uuid references public.causal_paths (id) on delete set null,

  code varchar(12) not null,
  statement text not null,
  family varchar(24) not null,
  cause_type varchar(24) not null,
  role varchar(24) not null default 'primary',

  scope varchar(16) not null default 'business',
  scope_detail jsonb not null default '{}'::jsonb,

  status varchar(24) not null default 'unresolved',
  confidence varchar(20) not null default 'insufficient',

  -- Apartado 9: tres cosas distintas.
  explanatory_coverage varchar(20) not null default 'unknown',
  residual_material boolean not null default false,
  residual_note text,

  -- Apartados 19 y 20.
  controllability varchar(24) not null default 'unknown',
  reversibility varchar(24) not null default 'unknown',
  recurrence varchar(20) not null default 'unknown',

  -- Guardrails 41 y 42: medir mal no es ir mal.
  affects_observability_only boolean not null default false,

  downstream_capabilities text[] not null default '{}',
  assumptions text,
  limitations text,

  first_identified_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint root_causes_familia check (family in (
    'market','product','offer','economics','acquisition','creative','conversion',
    'retention','inventory','operations','finance','data','technology','team',
    'strategy','external'
  )),
  constraint root_causes_tipo check (cause_type in (
    'acute','chronic','structural','event_driven','process','capacity',
    'configuration','quality','planning','dependency','external','positive_driver'
  )),
  constraint root_causes_rol check (role in ('primary','secondary','contributing')),
  constraint root_causes_scope check (scope in (
    'business','capability','subcapability','channel','market','product','segment'
  )),
  constraint root_causes_estado check (status in (
    'probable','confirmed','partial_root_cause','unresolved','active','resolved','recurrent'
  )),
  constraint root_causes_confianza check (
    confidence in ('high','medium','low','insufficient')
  ),
  constraint root_causes_cobertura check (
    explanatory_coverage in ('full','partial','minimal','unknown')
  ),
  constraint root_causes_controlabilidad check (
    controllability in ('controllable','partially_controllable','external','unknown')
  ),
  constraint root_causes_reversibilidad check (
    reversibility in ('easily_reversible','reversible','difficult','unknown')
  ),
  constraint root_causes_recurrencia check (
    recurrence in ('first_time','recurrent','chronic','unknown')
  ),
  constraint root_causes_code_unico unique (organization_id, code),

  -- Guardrail 16: sin cadena causal soportada no se afirma una causa raiz.
  constraint root_causes_exige_cadena check (
    status not in ('probable','confirmed') or causal_path_id is not null
  ),

  -- Guardrail 12: confirmar es excepcional y caro. Y el 48: declarar
  -- limitaciones no es opcional cuando se afirma.
  constraint root_causes_confirmar_cuesta check (
    status <> 'confirmed'
    or (confidence = 'high' and hypothesis_id is not null and limitations is not null)
  ),

  -- Guardrails 19 y 46: un claim sistemico se afirma con mas, no con lo mismo.
  constraint root_causes_sistemico_exige_mas check (
    cause_type <> 'structural'
    or status <> 'confirmed'
    or explanatory_coverage in ('full','partial')
  ),

  -- Guardrail 24: no hay explicacion completa con residual material.
  constraint root_causes_cobertura_vs_residual check (
    explanatory_coverage <> 'full' or not residual_material
  ),

  -- Guardrail 42: una regresion de medicion no explica el negocio.
  constraint root_causes_medicion_no_es_negocio check (
    not affects_observability_only
    or explanatory_coverage in ('minimal','unknown')
  ),

  -- Guardrail 25: lo local no se generaliza.
  constraint root_causes_localizada check (
    scope = 'business' or scope_detail <> '{}'::jsonb
  ),

  constraint root_causes_resuelta_tiene_fecha check (
    status <> 'resolved' or resolved_at is not null
  )
);

comment on table public.root_causes is
  'F3/D09 apartado 1. **No existe ninguna columna donde quepa una persona** (ni responsible, '
  'ni owner, ni blamed_by): los guardrails 38 a 40 piden describir procesos, capacidades y '
  'configuraciones, y el error humano en terminos observables. La garantia es que no hay '
  'otro sitio donde escribirlo.';

comment on column public.root_causes.affects_observability_only is
  'Guardrails 41 y 42. Una regresion de tracking puede ser la causa raiz de un problema de '
  'observabilidad sin serlo de un deterioro del negocio. Con esto marcado, el check impide '
  'que reclame cobertura explicativa del negocio.';

create index if not exists root_causes_org_idx on public.root_causes (organization_id, status);
create index if not exists root_causes_caso_idx on public.root_causes (case_id);

drop trigger if exists set_root_causes_updated_at on public.root_causes;
create trigger set_root_causes_updated_at before update on public.root_causes
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. La cadena: de sintoma a driver estructural (apartado 6)
-- ---------------------------------------------------------------------------

create table if not exists public.root_cause_chain (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  root_cause_id uuid not null references public.root_causes (id) on delete cascade,

  step_order integer not null,
  chain_role varchar(24) not null,
  statement text not null,
  -- Cuando el eslabon es un sintoma de D06 o un nodo de D07, se referencia.
  symptom_id uuid references public.symptoms (id) on delete set null,
  node_id uuid references public.causal_nodes (id) on delete set null,
  supported boolean not null default false,

  created_at timestamptz not null default now(),

  constraint root_cause_chain_rol check (chain_role in (
    'structural_driver','root_cause','immediate_cause','intermediate_cause','symptom','outcome'
  )),
  constraint root_cause_chain_orden unique (root_cause_id, step_order)
);

comment on table public.root_cause_chain is
  'F3/D09 apartado 6. Los cuatro primeros guardrails viven aqui: sintoma, causa inmediata, '
  'causa raiz y driver estructural son eslabones distintos de la misma cadena, y confundirlos '
  'es el error que mas veces se comete. La cadena obliga a decir en cual se esta.';

create index if not exists root_cause_chain_causa_idx
  on public.root_cause_chain (root_cause_id, step_order);

-- ---------------------------------------------------------------------------
-- 3. El constraint: siempre respecto de un target
-- ---------------------------------------------------------------------------

create table if not exists public.business_constraints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid references public.diagnostic_cases (id) on delete cascade,

  code varchar(12) not null,
  statement text not null,
  constraint_type varchar(24) not null,

  -- Apartado 14 y guardrail 30: un constraint SIEMPRE lo es respecto de algo.
  target varchar(40) not null,
  scope varchar(16) not null default 'business',
  scope_detail jsonb not null default '{}'::jsonb,

  binding_status varchar(24) not null default 'latent',
  nature varchar(24) not null default 'soft',
  timing varchar(16) not null default 'structural',
  confidence varchar(20) not null default 'insufficient',

  -- Guardrail 29: el nivel absoluto no dice nada; la relacion entre las dos si.
  capacity text,
  demand_on_capacity text,

  -- Guardrail 31: el test contrafactual no es opcional para declararlo vinculante.
  falsifier text,
  counterfactual_question text,
  counterfactual_result text,
  -- Guardrail 28: una debilidad que no limita el target no es un constraint.
  limits_target boolean not null default false,

  blast_radius text,
  exposure varchar(20) not null default 'unknown',
  -- Apartado 18.
  arrangement varchar(12) not null default 'unknown',

  status varchar(16) not null default 'active',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_constraints_tipo check (constraint_type in (
    'demand','product','offer','acquisition','creative','conversion','retention',
    'inventory','operations','financial','data','technology','team','strategy'
  )),
  constraint business_constraints_binding check (
    binding_status in ('binding','secondary','latent','none')
  ),
  constraint business_constraints_naturaleza check (
    nature in ('hard','soft','structural_bottleneck','temporary')
  ),
  constraint business_constraints_momento check (timing in ('acute','structural')),
  constraint business_constraints_confianza check (
    confidence in ('high','medium','low','insufficient')
  ),
  constraint business_constraints_scope check (scope in (
    'business','capability','subcapability','channel','market','product','segment'
  )),
  constraint business_constraints_exposicion check (
    exposure in ('minimal','moderate','high','existential','unknown')
  ),
  constraint business_constraints_disposicion check (
    arrangement in ('serial','parallel','unknown')
  ),
  constraint business_constraints_estado check (status in ('active','resolved','superseded')),
  constraint business_constraints_code_unico unique (organization_id, code),

  -- Guardrails 28 y 30: si no limita el target, no es un constraint vinculante.
  constraint business_constraints_vinculante_limita check (
    binding_status <> 'binding' or limits_target
  ),

  -- Guardrail 31: declararlo vinculante exige haber pasado el contrafactual.
  constraint business_constraints_vinculante_se_prueba check (
    binding_status <> 'binding'
    or (falsifier is not null and counterfactual_result is not null)
  ),

  -- Guardrail 29: para decir que algo hace cuello hay que declarar las dos
  -- caras, no solo que la capacidad parece baja.
  constraint business_constraints_capacidad_y_demanda check (
    binding_status <> 'binding'
    or (capacity is not null and demand_on_capacity is not null)
  ),

  -- Guardrail 26: lo local no se generaliza.
  constraint business_constraints_localizado check (
    scope = 'business' or scope_detail <> '{}'::jsonb
  ),

  constraint business_constraints_resuelto_tiene_fecha check (
    status <> 'resolved' or resolved_at is not null
  )
);

comment on table public.business_constraints is
  'F3/D09 apartado 10. Un constraint SIEMPRE lo es respecto de un target (guardrail 30): por '
  'eso `target` es obligatorio. No hay `priority` ni `severity`: el guardrail 35 dice que '
  'vinculante no es lo mas urgente, y el 37 que D09 no decide F4.';

comment on column public.business_constraints.limits_target is
  'Guardrails 5 y 28: una debilidad no es un constraint si no limita el target. El email mal '
  'montado no limita nada si el cuello esta en el stock.';

create index if not exists business_constraints_org_idx
  on public.business_constraints (organization_id, binding_status, status);
create index if not exists business_constraints_caso_idx on public.business_constraints (case_id);

drop trigger if exists set_business_constraints_updated_at on public.business_constraints;
create trigger set_business_constraints_updated_at before update on public.business_constraints
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. El test del constraint (apartado 15)
-- ---------------------------------------------------------------------------

create table if not exists public.constraint_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  constraint_id uuid not null references public.business_constraints (id) on delete cascade,

  target varchar(40) not null,
  counterfactual_question text not null,
  expected_if_binding text not null,
  expected_if_not_binding text not null,
  result varchar(20) not null default 'pending',
  interpretation text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint constraint_tests_resultado check (
    result in ('pending','binding','not_binding','inconclusive')
  ),
  -- Un test resuelto sin interpretacion no ha resuelto nada.
  constraint constraint_tests_resuelto_se_interpreta check (
    result = 'pending' or interpretation is not null
  ),
  -- Las dos predicciones tienen que decir algo distinto.
  constraint constraint_tests_prediccion_util check (
    length(btrim(expected_if_binding)) >= 10
    and length(btrim(expected_if_not_binding)) >= 10
    and btrim(expected_if_binding) <> btrim(expected_if_not_binding)
  )
);

comment on table public.constraint_tests is
  'F3/D09 apartado 15 y guardrail 31. El contrafactual que separa un constraint de una '
  'debilidad: si se levantara esto, ¿se moveria el target? Sin las dos predicciones no hay test.';

create index if not exists constraint_tests_constraint_idx
  on public.constraint_tests (constraint_id, result);

drop trigger if exists set_constraint_tests_updated_at on public.constraint_tests;
create trigger set_constraint_tests_updated_at before update on public.constraint_tests
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. "Este caso no tiene constraint relevante" (apartado 22, guardrail 32)
-- ---------------------------------------------------------------------------

alter table public.diagnostic_cases
  add column if not exists no_business_constraint boolean not null default false,
  add column if not exists no_constraint_rationale text;

alter table public.diagnostic_cases
  drop constraint if exists diagnostic_cases_sin_constraint_razonado;
alter table public.diagnostic_cases
  add constraint diagnostic_cases_sin_constraint_razonado check (
    not no_business_constraint or no_constraint_rationale is not null
  );

comment on column public.diagnostic_cases.no_business_constraint is
  'Apartado 22 y guardrail 32: que no haya constraint relevante es una conclusion, no la '
  'ausencia de una. Se declara y se razona, para que no se confunda con no haber mirado.';

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.root_causes enable row level security;
alter table public.root_cause_chain enable row level security;
alter table public.business_constraints enable row level security;
alter table public.constraint_tests enable row level security;

drop policy if exists "root_causes_select_staff" on public.root_causes;
create policy "root_causes_select_staff" on public.root_causes
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "root_cause_chain_select_staff" on public.root_cause_chain;
create policy "root_cause_chain_select_staff" on public.root_cause_chain
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "business_constraints_select_staff" on public.business_constraints;
create policy "business_constraints_select_staff" on public.business_constraints
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "constraint_tests_select_staff" on public.constraint_tests;
create policy "constraint_tests_select_staff" on public.constraint_tests
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
