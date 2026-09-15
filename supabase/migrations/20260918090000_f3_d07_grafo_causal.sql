-- FASE 3 / D07 — Grafo causal del ecommerce.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d07-requisitos-contrato-grafo-causal.md
--          conocimiento/fase-03/04-policies-guardrails/d07-guardrails-causalidad.md
--          conocimiento/fase-03/03-runtime/d07-flujo-razonamiento-causal.md
--          conocimiento/fase-03/05-experience-learning/d07-aprendizaje-causal-tenant.md
--
-- El primer bloque que puede hablar de causas. D06 dejo las relaciones
-- candidatas (`may_precede`, `often_cooccurs`) escritas y sin recorrer; aqui se
-- recorren. Pero D07 **no decide la causa raiz** (guardrail 46), no prescribe
-- (47) y no prioriza (48): produce rutas plausibles con su soporte, sus
-- contradicciones y lo que falta por comprobar. Decidir es D08-D09.
--
-- LOS SEIS PRINCIPIOS DE LA CABECERA SON EL BLOQUE ENTERO:
--   PLAUSIBLE != PROBADO. CORRELACION != CAUSALIDAD. PRIOR DEL EDGE !=
--   CONFIANZA DEL CASO. LINAJE != GRAFO CAUSAL. CENTRALIDAD != PRIORIDAD.
--   COINCIDIR CON UN EVENTO != CAUSADO POR EL EVENTO.
--
-- SIN MECANISMO NO HAY ARISTA CAUSAL (guardrail 7). Es el check central del
-- bloque: `causal_edges.mechanism` es obligatorio cuando `edge_kind` es
-- `causal`. Una correlacion sin mecanismo tambien cabe aqui, pero como
-- `unvalidated_relation` (apartado 22) y con el techo puesto: no puede declarar
-- evidencia por encima de `speculative` ni fuerza por encima de `weak`. Guardar
-- una correlacion como si fuera una causa es exactamente lo que el guardrail 8
-- prohibe, y aqui cuesta una migracion.
--
-- EL PRIOR GLOBAL Y LA CONFIANZA DEL CASO SON DOS TABLAS DISTINTAS (guardrail 3
-- y apartado 11). `causal_edges.strength` dice lo fuerte que es la relacion **en
-- general**; `causal_path_steps.case_support` dice que pasa **en este caso**.
-- Mezclarlas es como se acaba afirmando que una tienda tiene un problema porque
-- el libro dice que suele pasar.
--
-- LINAJE NO ES CAUSALIDAD (guardrail 4). Que `revenue = sesiones x CVR x AOV`
-- es aritmetica: descompone, no explica. Por eso `relation_type` distingue
-- `mathematical` del resto, y hay una regla de contrato que impide que una ruta
-- hecha solo de aristas matematicas se presente como explicacion.
--
-- LA CAUSA PRECEDE AL EFECTO, Y CUANDO NO, SE DICE (guardrails 19 y 20). Si el
-- efecto empezo antes que la causa candidata, esa causa no explica el arranque:
-- el check obliga a que ese paso quede marcado como `contradicted`. Pero el
-- guardrail 22 pide lo contrario del celo: no exigir efecto inmediato cuando el
-- mecanismo tiene retardo, y por eso `expected_lag_days` vive en la arista.
--
-- NO SE FUERZA UNA CAUSA UNICA (guardrails 28, 29, 30 y 31). `cause_role`
-- admite `contributory`, varias rutas pueden estar soportadas a la vez, y las
-- aristas que solo actuan juntas comparten `interaction_group` en lugar de
-- fingir que cada una basta por su cuenta.
--
-- MEDIR NO ES QUE PASE (guardrails 37, 38 y 39). Un fallo de tracking cambia las
-- compras observadas sin cambiar las compras. `causal_nodes.measurement_layer`
-- separa la variable real del sistema de medida y de la metrica observada, y una
-- ruta que pasa por una metrica observada sin validar la medicion no puede
-- declararse de confianza alta.
--
-- LO QUE NO ESTA AQUI, A PROPOSITO: no hay `root_cause`, ni `priority`, ni
-- `action`, ni `recommendation`, ni metricas de centralidad. El guardrail 5 dice
-- que la centralidad en el grafo no es prioridad de negocio, y la forma mas
-- segura de que nadie ordene por `betweenness` es no guardarlo.

-- ---------------------------------------------------------------------------
-- 1. Los nodos: el vocabulario del grafo
-- ---------------------------------------------------------------------------

create table if not exists public.causal_nodes (
  id uuid primary key default gen_random_uuid(),
  -- Nulo = nodo del grafo global. Con valor = nodo propio del tenant.
  organization_id uuid references public.organizations (id) on delete cascade,

  code varchar(80) not null,
  label text not null,
  node_type varchar(16) not null,
  capability varchar(24),

  -- Apartado 2. Guardrails 17 y 18: lo latente y lo externo exigen mas cautela.
  observability varchar(20) not null default 'derived',
  -- Apartado 31 y guardrails 37-39.
  measurement_layer varchar(20) not null default 'real_world',
  business_layer varchar(24),

  -- Apartado 29: el grafo se instancia por scope (`CVR[Spain][Mobile]`).
  scope varchar(16) not null default 'business',
  scope_detail jsonb not null default '{}'::jsonb,

  -- Apartado 1: de donde sale este nodo.
  provenance varchar(20) not null default 'system_logic',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint causal_nodes_tipo check (
    node_type in ('metric','state','event','contextual','structural','outcome')
  ),
  constraint causal_nodes_observabilidad check (
    observability in ('directly_observed','derived','latent','external')
  ),
  constraint causal_nodes_capa_medida check (
    measurement_layer in ('real_world','measurement_system','observed_metric')
  ),
  constraint causal_nodes_scope check (
    scope in ('business','capability','subcapability','channel','market','product','segment')
  ),
  constraint causal_nodes_procedencia check (
    provenance in ('system_logic','internal_evidence','external_knowledge','expert_heuristic','tenant_learned')
  ),
  constraint causal_nodes_capacidad check (capability is null or capability in (
    'market','product','offer','unit_economics','acquisition','creative',
    'conversion','retention','inventory','operations','finance','data',
    'technology','team','strategy'
  )),

  -- Guardrails 12 y 14: nada de "Bad Marketing" ni "Great Brand". Un nodo tiene
  -- que ser algo que se pueda observar o derivar; si es latente o externo, la
  -- nota que explica como se sabe algo de el es obligatoria.
  constraint causal_nodes_latente_se_explica check (
    observability not in ('latent','external') or notes is not null
  ),
  -- Guardrail 13: una recomendacion no es un nodo causal.
  constraint causal_nodes_no_es_recomendacion check (
    code !~* '^(do_|should_|increase_|reduce_|launch_|fix_|optimize_)'
  ),
  constraint causal_nodes_localizado check (
    scope = 'business' or scope_detail <> '{}'::jsonb
  ),
  constraint causal_nodes_unico unique nulls not distinct (organization_id, code, scope, scope_detail)
);

comment on table public.causal_nodes is
  'F3/D07 apartado 1. Vocabulario del grafo causal. `organization_id` nulo = nodo global; '
  'con valor = nodo aprendido para un tenant (apartado 33). Sin metricas de centralidad a '
  'proposito: el guardrail 5 dice que centralidad no es prioridad, y no guardarla es la '
  'forma mas segura de que nadie ordene por ella.';

comment on column public.causal_nodes.measurement_layer is
  'Guardrails 37-39. Separa la variable real del sistema de medida y de la metrica '
  'observada: un fallo de tracking cambia las compras observadas sin cambiar las compras.';

create index if not exists causal_nodes_code_idx on public.causal_nodes (code);
create index if not exists causal_nodes_org_idx on public.causal_nodes (organization_id);

drop trigger if exists set_causal_nodes_updated_at on public.causal_nodes;
create trigger set_causal_nodes_updated_at before update on public.causal_nodes
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Las aristas: el prior global, nunca la conclusion del caso
-- ---------------------------------------------------------------------------

create table if not exists public.causal_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,

  from_node_id uuid not null references public.causal_nodes (id) on delete cascade,
  to_node_id uuid not null references public.causal_nodes (id) on delete cascade,

  -- Apartado 22: una correlacion sin mecanismo cabe, pero no como causa.
  edge_kind varchar(24) not null default 'causal',
  relation_type varchar(16) not null,
  expected_sign varchar(20) not null default 'context_dependent',

  -- Guardrail 7. El corazon del bloque.
  mechanism text,
  diagnostic_rationale text,

  -- Apartado 6: condiciones bajo las que la relacion se sostiene.
  conditions text,
  expected_lag_days integer,
  strength varchar(20) not null default 'context_dependent',
  evidence_level varchar(24) not null default 'plausible',
  knowledge_source varchar(24) not null default 'system_logic',

  -- Apartado 19: A + B -> C. Las aristas que solo actuan juntas comparten grupo
  -- en vez de fingir que cada una basta sola.
  interaction_group varchar(60),
  non_linear boolean not null default false,
  threshold_note text,

  scope_constraint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint causal_edges_clase check (edge_kind in ('causal','unvalidated_relation')),
  constraint causal_edges_relacion check (relation_type in (
    'mathematical','mechanistic','behavioral','economic','operational',
    'technical','structural','temporal','contextual','limits','requires','interaction'
  )),
  constraint causal_edges_signo check (
    expected_sign in ('positive','negative','non_monotonic','context_dependent')
  ),
  constraint causal_edges_fuerza check (
    strength in ('strong','moderate','weak','context_dependent')
  ),
  constraint causal_edges_nivel_evidencia check (evidence_level in (
    'deterministic','strongly_established','common_mechanism','plausible','speculative'
  )),
  constraint causal_edges_fuente check (knowledge_source in (
    'system_logic','internal_evidence','external_knowledge','expert_heuristic','tenant_learned'
  )),
  constraint causal_edges_no_reflexiva check (from_node_id <> to_node_id),

  -- Guardrail 7: sin mecanismo no hay arista causal. Y el 9: un eslogan de
  -- experto no es un mecanismo, asi que tiene que decir algo.
  constraint causal_edges_mecanismo_obligatorio check (
    edge_kind <> 'causal'
    or (mechanism is not null and length(btrim(mechanism)) >= 20)
  ),
  -- Guardrail 8: una correlacion guardada como relacion no puede disfrazarse de
  -- conocimiento establecido.
  constraint causal_edges_correlacion_tiene_techo check (
    edge_kind <> 'unvalidated_relation'
    or (evidence_level = 'speculative' and strength in ('weak','context_dependent'))
  ),
  -- Guardrail 10: toda arista tiene que servir para diagnosticar algo.
  constraint causal_edges_utilidad_declarada check (
    edge_kind <> 'causal' or diagnostic_rationale is not null
  ),
  -- Guardrail 45: una heuristica de experto no llega a conocimiento establecido.
  constraint causal_edges_heuristica_no_manda check (
    knowledge_source <> 'expert_heuristic'
    or evidence_level in ('plausible','speculative','common_mechanism')
  ),
  -- Guardrail 44: lo aprendido para un tenant no se convierte en arista global.
  constraint causal_edges_aprendido_es_del_tenant check (
    knowledge_source <> 'tenant_learned' or organization_id is not null
  ),
  constraint causal_edges_unica unique nulls not distinct (organization_id, from_node_id, to_node_id, relation_type)
);

comment on table public.causal_edges is
  'F3/D07 apartado 3. El prior GLOBAL de una relacion, nunca la conclusion de un caso '
  '(guardrail 3): lo del caso vive en causal_path_steps. Sin mecanismo no hay arista '
  'causal (guardrail 7); una correlacion cabe como `unvalidated_relation` con techo.';

comment on column public.causal_edges.interaction_group is
  'Apartado 19. Aristas con el mismo grupo hacia el mismo destino son conjuntamente '
  'necesarias (A + B -> C): ninguna basta por su cuenta.';

create index if not exists causal_edges_from_idx on public.causal_edges (from_node_id);
create index if not exists causal_edges_to_idx on public.causal_edges (to_node_id);
create index if not exists causal_edges_grupo_idx on public.causal_edges (interaction_group)
  where interaction_group is not null;

drop trigger if exists set_causal_edges_updated_at on public.causal_edges;
create trigger set_causal_edges_updated_at before update on public.causal_edges
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Las rutas: el razonamiento de un caso concreto
-- ---------------------------------------------------------------------------

create table if not exists public.causal_paths (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid references public.diagnostic_cases (id) on delete cascade,
  -- El sintoma de D06 del que se parte, cuando lo hay.
  symptom_id uuid references public.symptoms (id) on delete set null,

  target_node_id uuid not null references public.causal_nodes (id) on delete cascade,
  target_scope_detail jsonb not null default '{}'::jsonb,

  -- Apartado 12. `partial` y `untested` son estados de primera clase: el
  -- guardrail 50 obliga a exponer lo que falta, no a esconderlo.
  status varchar(16) not null default 'untested',
  path_confidence varchar(20) not null default 'low',

  -- Guardrail 50: lo que falta por comprobar se escribe.
  missing_evidence text[] not null default '{}',
  -- Guardrail 11: confusores revisados, o se dice que no.
  confounders_reviewed boolean not null default false,
  -- Guardrail 39: medir no es que pase.
  measurement_validated boolean not null default false,
  -- Apartado 19 del runtime: que dato discriminaria entre rutas rivales.
  next_evidence text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint causal_paths_estado check (
    status in ('supported','contradicted','untested','partial')
  ),
  constraint causal_paths_confianza check (
    path_confidence in ('insufficient_data','low','medium','high')
  ),
  -- Guardrail 11 y 39: una ruta no llega a confianza alta sin haber mirado los
  -- confusores ni validado que la medicion no esta rota.
  constraint causal_paths_alta_exige_deberes check (
    path_confidence <> 'high' or (confounders_reviewed and measurement_validated)
  ),
  -- Guardrail 50: una ruta con huecos declarados no es una ruta soportada.
  constraint causal_paths_soportada_sin_huecos check (
    status <> 'supported' or cardinality(missing_evidence) = 0
  ),
  -- Guardrail 49: si esta contradicha, no puede a la vez afirmarse.
  constraint causal_paths_contradicha_no_confia check (
    status <> 'contradicted' or path_confidence in ('insufficient_data','low')
  )
);

comment on table public.causal_paths is
  'F3/D07 apartado 12. Una ruta plausible hacia un target, con su soporte, sus '
  'contradicciones y lo que falta. No hay columna `root_cause` ni `priority`: el '
  'guardrail 46 dice que D07 no decide la causa y el 48 que no prioriza.';

create index if not exists causal_paths_caso_idx on public.causal_paths (case_id);
create index if not exists causal_paths_org_idx on public.causal_paths (organization_id, status);

drop trigger if exists set_causal_paths_updated_at on public.causal_paths;
create trigger set_causal_paths_updated_at before update on public.causal_paths
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Los pasos: donde se evalua el encaje, caso a caso
-- ---------------------------------------------------------------------------

create table if not exists public.causal_path_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  path_id uuid not null references public.causal_paths (id) on delete cascade,
  edge_id uuid not null references public.causal_edges (id) on delete cascade,
  step_order integer not null,

  -- Apartado 11: la confianza del CASO, separada del prior de la arista.
  case_support varchar(16) not null default 'untested',

  -- Apartado 13 y guardrails 19-22.
  cause_onset timestamptz,
  effect_onset timestamptz,
  observed_lag_days integer,
  temporal_fit varchar(16) not null default 'untested',

  -- Apartado 14 y guardrails 23-25.
  scope_fit varchar(16) not null default 'untested',
  -- Apartado 15 y guardrails 26-27.
  magnitude_fit varchar(16) not null default 'untested',

  -- Apartados 16 y 17.
  cause_role varchar(16),
  contribution_note text,

  -- Apartado 20: los mediadores de la ruta.
  is_mediator boolean not null default false,
  -- Guardrail 33: el confusor candidato que podria explicar el parecido, de D02.
  confounder_id uuid references public.context_confounders (id) on delete set null,

  created_at timestamptz not null default now(),

  constraint causal_path_steps_soporte check (
    case_support in ('supported','contradicted','untested','partial')
  ),
  constraint causal_path_steps_temporal check (
    temporal_fit in ('fits','contradicted','untested','unknown')
  ),
  constraint causal_path_steps_scope check (
    scope_fit in ('compatible','incompatible','untested','partial')
  ),
  constraint causal_path_steps_magnitud check (
    magnitude_fit in ('sufficient','insufficient','untested','partial')
  ),
  constraint causal_path_steps_rol check (
    cause_role is null or cause_role in ('necessary','sufficient','contributory')
  ),
  constraint causal_path_steps_orden unique (path_id, step_order),

  -- Guardrails 19 y 20: si el efecto empezo antes que la causa candidata, esa
  -- causa no explica el arranque. No se prohibe registrarlo: se prohibe
  -- registrarlo como si encajara.
  constraint causal_path_steps_causa_precede check (
    cause_onset is null
    or effect_onset is null
    or cause_onset <= effect_onset
    or temporal_fit = 'contradicted'
  ),
  -- Guardrail 23: scope incompatible no puede sostener el paso.
  constraint causal_path_steps_scope_manda check (
    scope_fit <> 'incompatible' or case_support <> 'supported'
  ),
  -- Guardrail 27: lo que solo llega a una parte no explica el todo por su
  -- cuenta, pero si puede ser causa contributoria (guardrail 28).
  constraint causal_path_steps_magnitud_limita_rol check (
    magnitude_fit <> 'insufficient'
    or cause_role is null
    or cause_role = 'contributory'
  ),
  -- Un paso soportado exige haber mirado las tres cosas.
  constraint causal_path_steps_soportado_exige_encaje check (
    case_support <> 'supported'
    or (temporal_fit = 'fits' and scope_fit = 'compatible'
        and magnitude_fit in ('sufficient','partial'))
  )
);

comment on table public.causal_path_steps is
  'F3/D07 apartados 13, 14 y 15. Aqui se evalua la arista CONTRA EL CASO: encaje '
  'temporal, de scope y de magnitud. El prior global vive en causal_edges; mezclarlos '
  'es como se acaba afirmando que una tienda tiene un problema porque el libro dice que suele pasar.';

create index if not exists causal_path_steps_ruta_idx on public.causal_path_steps (path_id, step_order);

-- ---------------------------------------------------------------------------
-- 5. La evidencia del caso, con su jerarquia (apartados 23 y 24)
-- ---------------------------------------------------------------------------

create table if not exists public.causal_case_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  path_id uuid not null references public.causal_paths (id) on delete cascade,
  step_id uuid references public.causal_path_steps (id) on delete cascade,

  -- Apartado 24, de mas fuerte a mas debil.
  evidence_level varchar(32) not null,
  stance varchar(16) not null default 'supporting',
  observation text not null,

  -- Apartado 23: de donde sale el contrafactual.
  counterfactual_source varchar(32),
  -- Guardrails 41 y 42: los supuestos se explicitan y los controles se comparan.
  assumptions text,
  control_comparable boolean,

  created_at timestamptz not null default now(),

  constraint causal_case_evidence_nivel check (evidence_level in (
    'randomized_experiment','natural_experiment','before_after_with_control',
    'temporal_and_mechanistic','multi_source_corroboration','correlation_only'
  )),
  constraint causal_case_evidence_postura check (
    stance in ('supporting','contradicting','inconclusive')
  ),
  constraint causal_case_evidence_contrafactual check (
    counterfactual_source is null or counterfactual_source in (
      'unaffected_segment','control_market','other_device','previous_period',
      'natural_experiment','randomized_experiment'
    )
  ),
  -- Guardrails 40, 41 y 42: un proxy contrafactual no es un experimento. Si se
  -- usa uno, hay que decir bajo que supuestos y si el control es comparable.
  constraint causal_case_evidence_proxy_declara_supuestos check (
    counterfactual_source is null
    or counterfactual_source in ('natural_experiment','randomized_experiment')
    or (assumptions is not null and control_comparable is not null)
  )
);

comment on table public.causal_case_evidence is
  'F3/D07 apartados 23 y 24. La evidencia del caso con su nivel en la jerarquia. '
  '`correlation_only` esta en el catalogo porque existe, no porque valga: el guardrail 16 '
  'impide que sostenga confianza alta, y eso lo comprueba checkCausalInvariants.';

create index if not exists causal_case_evidence_ruta_idx on public.causal_case_evidence (path_id, stance);

-- ---------------------------------------------------------------------------
-- 6. Puente con D00
-- ---------------------------------------------------------------------------

alter table public.diagnostic_hypotheses
  add column if not exists source_path_id uuid references public.causal_paths (id) on delete set null;

comment on column public.diagnostic_hypotheses.source_path_id is
  'F3/D07. La ruta causal de la que nacio esta hipotesis (paso 20 del runtime).';

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------

alter table public.causal_nodes enable row level security;
alter table public.causal_edges enable row level security;
alter table public.causal_paths enable row level security;
alter table public.causal_path_steps enable row level security;
alter table public.causal_case_evidence enable row level security;

-- Nodos y aristas globales son conocimiento de ecommerce, no datos de nadie:
-- cualquier miembro del staff puede leerlos. Lo del tenant, solo su consultor.
drop policy if exists "causal_nodes_select" on public.causal_nodes;
create policy "causal_nodes_select" on public.causal_nodes
  for select to authenticated
  using (
    organization_id is null
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "causal_edges_select" on public.causal_edges;
create policy "causal_edges_select" on public.causal_edges
  for select to authenticated
  using (
    organization_id is null
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "causal_paths_select_staff" on public.causal_paths;
create policy "causal_paths_select_staff" on public.causal_paths
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "causal_path_steps_select_staff" on public.causal_path_steps;
create policy "causal_path_steps_select_staff" on public.causal_path_steps
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "causal_case_evidence_select_staff" on public.causal_case_evidence;
create policy "causal_case_evidence_select_staff" on public.causal_case_evidence
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );
