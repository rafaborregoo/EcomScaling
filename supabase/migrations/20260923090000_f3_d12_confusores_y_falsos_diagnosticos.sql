-- FASE 3 / D12 — Confusores y falsos diagnosticos.
--
-- Fuente: conocimiento/fase-03/02-contratos-IA/D12-contrato-de-confusores-y-falsos-diagnosticos.md
--         (22 apartados, 25 tipos de confusor, 18 tests nombrados con sus fixtures)
--
-- AVISO SOBRE LA FUENTE: a diferencia de D00 a D11, **D12 tiene una sola capa**.
-- No hay corpus maestro, ni guardrails, ni runtime, ni tenant-context, ni
-- experience-learning: solo el contrato. Lo que va aqui sale de sus 22
-- apartados y de la lista de invariantes del 21. Donde D11 tenia 60 guardrails
-- que citar, aqui se cita el apartado.
--
-- LA CAPA ADVERSARIAL. D12 no busca la mejor explicacion -- eso es D08 -- sino
-- **la mejor razon por la que la interpretacion completa podria ser enganosa**.
-- El principio de cierre del apartado 22 lo dice sin rodeos: D12 debe intentar
-- refutar la primera explicacion, no protegerla.
--
-- POR ESO LA GARANTIA CENTRAL DEL BLOQUE ES ESTA: **no se puede declarar que un
-- diagnostico sobrevive sin haber escrito antes por que podria estar mal.**
-- `survival_status = 'survives'` exige `red_team_counter_explanation` por check.
-- Un diagnostico que nadie ha intentado tumbar no ha sobrevivido a nada.
--
-- UN CONFUSOR SIN EVIDENCIA NO SIRVE PARA NADA, EN LAS DOS DIRECCIONES
-- (apartado 14). No puede sostenerse -- pasar de `plausible` a `supported` o
-- `material` exige evidencia escrita -- y tampoco puede destruir: un confusor
-- especulativo no puede declararse `strong` ni `decisive`, porque el apartado 14
-- prohibe que una hipotesis sin soporte tumbe un diagnostico fuerte.
--
-- NO SE PUEDE SALTAR UN CHECK OBLIGATORIO EN SILENCIO (apartados 7 y 19). Cada
-- familia diagnostica tiene sus comprobaciones minimas, y `saltado` o `no se
-- pudo` exigen motivo. El apartado 19 pide poder reconstruir que checks eran
-- obligatorios, cuales se ejecutaron y cuales no pudieron ejecutarse y por que;
-- sin el motivo obligatorio eso no se puede reconstruir.
--
-- COMPARABLE SIGNIFICA LAS CINCO COSAS (apartado 4). Misma definicion, mismo
-- alcance, misma logica temporal, misma moneda y mismo filtro de estado. El
-- check no deja declarar `comparable` si alguna de las cinco no es `yes`: es la
-- puerta determinista que el apartado 17 pide que no dependa del LLM.
--
-- UN RIESGO CRITICAL BLOQUEA EL CIERRE (apartado 2). Si la evidencia esta
-- sistematicamente distorsionada, el diagnostico no puede quedar en
-- `survives`: tiene que ir a revision o invalidarse.
--
-- RELACION CON `context_confounders` DE D02. Son cosas distintas y por eso son
-- dos tablas. La de D02 cuelga de una evaluacion de contexto, lista variables
-- que coexisten con una senal, y su guardrail 24 dice que son candidatas y que
-- **no existe columna que las promueva**. D12 es justamente el mecanismo de
-- promocion, y vive aparte porque promover exige evidencia, estado y prueba.
-- `source_confounder_id` conserva el linaje para que una candidata de D02 que
-- llega hasta aqui no se vuelva a teclear desde cero.
--
-- LO QUE NO ESTA AQUI: ninguna columna para forzar que un diagnostico
-- sobreviva. Ni `override`, ni `force_survive`, ni `accepted_anyway`. El
-- apartado 21 prohibe "forzar que el diagnostico sobreviva la revision
-- adversarial", y la garantia es que no hay donde escribirlo.

-- ---------------------------------------------------------------------------
-- 1. El resultado de la revision adversarial (apartados 2, 9, 10, 13, 15 y 16)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_robustness (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  root_cause_id uuid references public.root_causes (id) on delete set null,

  review_status varchar(16) not null default 'current',

  -- Apartado 2.
  false_diagnosis_risk varchar(12) not null default 'medium',
  -- Apartado 10.
  survival_status varchar(28) not null default 'weakened',
  -- Apartado 13.
  robustness varchar(12) not null default 'medium',
  diagnosis_stability varchar(20) not null default 'sensitive',

  -- Apartado 19: el panel tiene que poder ver el antes y el despues.
  confidence_before varchar(20),
  confidence_after varchar(20),
  confidence_adjustment text,

  -- Apartado 12. El red team no es opcional para decir que algo sobrevive.
  red_team_counter_explanation text,
  red_team_supporting_evidence text,
  red_team_required_evidence text,
  red_team_effect text,

  -- Apartado 11: la revision reabre D06 a D09, y tiene presupuesto.
  revision_triggered boolean not null default false,
  reopened_blocks text[] not null default '{}',
  revision_budget_used integer not null default 0,

  remaining_limitations text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diagnostic_robustness_estado check (review_status in ('current', 'superseded')),
  constraint diagnostic_robustness_riesgo check (
    false_diagnosis_risk in ('low', 'medium', 'high', 'critical')
  ),
  constraint diagnostic_robustness_supervivencia check (survival_status in (
    'survives', 'survives_with_limitations', 'weakened', 'requires_revision', 'invalidated'
  )),
  constraint diagnostic_robustness_robustez check (robustness in ('high', 'medium', 'low')),
  constraint diagnostic_robustness_estabilidad check (
    diagnosis_stability in ('stable_to_assumptions', 'sensitive', 'highly_sensitive')
  ),
  constraint diagnostic_robustness_confianza_antes check (
    confidence_before is null
    or confidence_before in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint diagnostic_robustness_confianza_despues check (
    confidence_after is null
    or confidence_after in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint diagnostic_robustness_presupuesto check (revision_budget_used >= 0),

  -- Apartados 12 y 22: **la garantia central del bloque**. Decir que algo
  -- sobrevive exige haber escrito la mejor razon por la que podria estar mal.
  constraint diagnostic_robustness_sobrevivir_exige_red_team check (
    survival_status not in ('survives', 'survives_with_limitations')
    or red_team_counter_explanation is not null
  ),

  -- Apartado 2: si la evidencia esta sistematicamente distorsionada, el
  -- diagnostico no se cierra.
  constraint diagnostic_robustness_critico_bloquea check (
    false_diagnosis_risk <> 'critical'
    or survival_status in ('requires_revision', 'invalidated')
  ),

  -- Apartado 10: sobrevivir con limitaciones exige decir cuales.
  constraint diagnostic_robustness_limitaciones_se_escriben check (
    survival_status <> 'survives_with_limitations' or remaining_limitations is not null
  ),

  -- Apartado 13: un diagnostico muy sensible a los supuestos no sale intacto, y
  -- ademas tiene que explicitar de que depende.
  constraint diagnostic_robustness_sensible_no_sale_intacto check (
    diagnosis_stability <> 'highly_sensitive'
    or (survival_status <> 'survives' and remaining_limitations is not null)
  ),

  -- Apartado 21: la confianza no queda intacta despues de una revision que
  -- debilita. Si el diagnostico pierde fuerza, la confianza baja.
  constraint diagnostic_robustness_debilitar_baja_la_confianza check (
    survival_status not in ('weakened', 'requires_revision')
    or confidence_before is null
    or confidence_after is null
    or (case confidence_after
          when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end)
       < (case confidence_before
          when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end)
  ),

  -- Apartado 11: revisar o invalidar significa reabrir algo, no solo anotarlo.
  constraint diagnostic_robustness_revision_reabre check (
    survival_status not in ('requires_revision', 'invalidated')
    or (revision_triggered and reopened_blocks <> '{}')
  ),

  -- Apartado 13: si es robusto del todo, no puede ser muy sensible.
  constraint diagnostic_robustness_robusto_no_es_fragil check (
    robustness <> 'high' or diagnosis_stability = 'stable_to_assumptions'
  )
);

comment on table public.diagnostic_robustness is
  'F3/D12 apartados 15 y 16. **No se puede declarar que un diagnostico sobrevive sin haber '
  'escrito por que podria estar mal** (apartados 12 y 22): el check exige la contraexplicacion '
  'del red team. Y no hay ninguna columna para forzar la supervivencia -- ni `override`, ni '
  '`force_survive`: el apartado 21 lo prohibe y la garantia es que no cabe.';

comment on column public.diagnostic_robustness.false_diagnosis_risk is
  'Apartado 2. Un riesgo CRITICAL bloquea el cierre: con la evidencia sistematicamente '
  'distorsionada el diagnostico solo puede ir a revision o invalidarse.';

comment on column public.diagnostic_robustness.red_team_counter_explanation is
  'Apartado 12. La mejor razon por la que la interpretacion completa podria ser enganosa. No es '
  'el challenger de D08 (que busca la mejor hipotesis causal rival): aqui se ataca la lectura '
  'entera, no la causa.';

create index if not exists diagnostic_robustness_caso_idx
  on public.diagnostic_robustness (case_id, reviewed_at desc);
create index if not exists diagnostic_robustness_org_idx
  on public.diagnostic_robustness (organization_id, survival_status, false_diagnosis_risk);

create unique index if not exists diagnostic_robustness_vigente_idx
  on public.diagnostic_robustness (case_id)
  where review_status = 'current';

drop trigger if exists set_diagnostic_robustness_updated_at on public.diagnostic_robustness;
create trigger set_diagnostic_robustness_updated_at before update on public.diagnostic_robustness
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. El confusor (apartados 3, 5 y 14)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_confounders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  robustness_id uuid references public.diagnostic_robustness (id) on delete cascade,
  -- Linaje: la candidata de D02 que llego hasta aqui. No se vuelve a teclear.
  source_confounder_id uuid references public.context_confounders (id) on delete set null,

  confounder_type varchar(28) not null,
  category varchar(16) not null,
  description text not null,

  affected_claims text[] not null default '{}',
  affected_metrics text[] not null default '{}',
  scope varchar(40) not null default 'global',
  window_start timestamptz,
  window_end timestamptz,

  evidence text,
  plausibility varchar(16) not null default 'speculative',
  strength varchar(12) not null default 'weak',
  materiality varchar(12) not null default 'low',
  status varchar(12) not null default 'candidate',
  resolution varchar(16) not null default 'unresolved',
  adjustment_note text,
  confidence_effect text,

  -- Apartado 8: los efectos de enmascaramiento son el lado del falso negativo.
  -- Un revenue plano con trafico +40% y CVR -28% no es un negocio sano.
  masking_effect boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Apartado 3: los 25 tipos que la fuente lista.
  constraint diagnostic_confounders_tipo check (confounder_type in (
    'seasonality', 'promotion', 'launch', 'traffic_mix', 'customer_mix', 'product_mix',
    'market_mix', 'device_mix', 'channel_mix', 'price_change', 'inventory_change',
    'attribution_change', 'tracking_change', 'metric_definition_change', 'partial_period',
    'day_of_week', 'holiday', 'sample_size', 'outlier', 'external_event',
    'operational_change', 'technology_change', 'currency_change', 'shipping_change',
    'payment_change'
  )),
  -- Apartado 3: las ocho categorias conceptuales.
  constraint diagnostic_confounders_categoria check (category in (
    'measurement', 'context', 'composition', 'temporal', 'selection',
    'external', 'behavioral', 'operational'
  )),
  constraint diagnostic_confounders_plausibilidad check (
    plausibility in ('speculative', 'plausible', 'supported')
  ),
  -- Apartado 14.
  constraint diagnostic_confounders_fuerza check (
    strength in ('weak', 'moderate', 'strong', 'decisive')
  ),
  constraint diagnostic_confounders_materialidad check (
    materiality in ('low', 'material', 'high')
  ),
  -- Apartado 5.
  constraint diagnostic_confounders_estado check (status in (
    'candidate', 'plausible', 'supported', 'material', 'rejected', 'resolved'
  )),
  constraint diagnostic_confounders_resolucion check (
    resolution in ('adjusted_for', 'segmented_out', 'rejected', 'unresolved')
  ),
  constraint diagnostic_confounders_ventana check (
    window_end is null or window_start is null or window_end >= window_start
  ),
  constraint diagnostic_confounders_descripcion check (length(btrim(description)) >= 20),

  -- Apartado 5: SUPPORTED es "existe evidencia de que el factor cambio", y
  -- MATERIAL va por encima. Sin evidencia escrita no se sube de PLAUSIBLE.
  constraint diagnostic_confounders_subir_exige_evidencia check (
    status not in ('supported', 'material', 'resolved') or evidence is not null
  ),
  -- Apartado 5: REJECTED es "la evidencia muestra que no puede explicarlo".
  -- Descartar tambien cuesta evidencia; si no, es descartar por comodidad.
  constraint diagnostic_confounders_descartar_exige_evidencia check (
    status <> 'rejected' or evidence is not null
  ),

  -- Apartado 14: **un confusor especulativo no puede destruir un diagnostico
  -- fuerte.** Sin soporte no se le deja llegar a `strong` ni a `decisive`.
  constraint diagnostic_confounders_especulativo_no_destruye check (
    plausibility <> 'speculative' or strength in ('weak', 'moderate')
  ),
  -- Y al reves: lo decisivo exige estar soportado, no solo ser plausible.
  constraint diagnostic_confounders_decisivo_esta_soportado check (
    strength <> 'decisive' or plausibility = 'supported'
  ),

  -- Apartado 5: RESOLVED es que su efecto ya se conto, aislo o controlo.
  constraint diagnostic_confounders_resuelto_tiene_resolucion check (
    status <> 'resolved' or resolution in ('adjusted_for', 'segmented_out', 'rejected')
  ),
  -- Apartado 14: si se ajusta, la salida tiene que decir que el diagnostico se
  -- expresa despues de controlar ese factor. Sin la nota no se sabria.
  constraint diagnostic_confounders_ajuste_se_declara check (
    resolution <> 'adjusted_for' or adjustment_note is not null
  ),
  -- Apartado 21: un confusor material no se deja sin efecto declarado.
  constraint diagnostic_confounders_material_declara_efecto check (
    status <> 'material' or confidence_effect is not null
  )
);

comment on table public.diagnostic_confounders is
  'F3/D12 apartados 3, 5 y 14. **Un confusor sin evidencia no sirve en ninguna direccion**: no '
  'puede subir a SUPPORTED ni a MATERIAL, y tampoco puede declararse decisivo para tumbar un '
  'diagnostico (apartado 14). No es la tabla de D02: alli son candidatas de contexto que nadie '
  'puede promover, y aqui esta el mecanismo de promocion, que cuesta evidencia y prueba. '
  '`source_confounder_id` conserva el linaje entre las dos.';

comment on column public.diagnostic_confounders.masking_effect is
  'Apartado 8. El lado del falso negativo: un revenue plano con trafico +40% y CVR -28% no es '
  'un negocio sano, es un deterioro tapado por volumen. D12 protege contra los dos errores.';

create index if not exists diagnostic_confounders_caso_idx
  on public.diagnostic_confounders (case_id, status);
create index if not exists diagnostic_confounders_robustez_idx
  on public.diagnostic_confounders (robustness_id);
create index if not exists diagnostic_confounders_origen_idx
  on public.diagnostic_confounders (source_confounder_id);

drop trigger if exists set_diagnostic_confounders_updated_at on public.diagnostic_confounders;
create trigger set_diagnostic_confounders_updated_at
before update on public.diagnostic_confounders
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. La prueba del confusor (apartado 6)
-- ---------------------------------------------------------------------------

create table if not exists public.confounder_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  confounder_id uuid not null references public.diagnostic_confounders (id) on delete cascade,

  required_data text not null,
  expected_pattern text not null,
  -- Apartado 6: el contrato prefiere controles naturales, tratados/no tratados,
  -- comparaciones within-segment y cohortes maduras. Decir cual se uso importa.
  control_kind varchar(24) not null default 'other',
  result varchar(16) not null default 'pending',
  effect_on_diagnosis text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint confounder_tests_control check (control_kind in (
    'natural_control', 'treated_untreated', 'within_segment', 'mature_cohort',
    'constant_currency', 'normalized_rate', 'other'
  )),
  constraint confounder_tests_resultado check (
    result in ('pending', 'confirmed', 'refuted', 'inconclusive')
  ),
  constraint confounder_tests_patron check (length(btrim(expected_pattern)) >= 15),
  -- Un test resuelto que no dice que le hace al diagnostico no ha resuelto nada.
  constraint confounder_tests_resuelto_dice_su_efecto check (
    result = 'pending' or effect_on_diagnosis is not null
  )
);

comment on table public.confounder_tests is
  'F3/D12 apartado 6. Cada confusor material deberia poder atarse a una prueba verificable. '
  '`control_kind` existe porque el apartado prefiere controles naturales y comparaciones '
  'within-segment a la opinion, y saber cual se uso es parte de poder auditar el resultado.';

create index if not exists confounder_tests_confusor_idx
  on public.confounder_tests (confounder_id, result);

drop trigger if exists set_confounder_tests_updated_at on public.confounder_tests;
create trigger set_confounder_tests_updated_at before update on public.confounder_tests
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. La puerta de comparabilidad (apartado 4)
-- ---------------------------------------------------------------------------

create table if not exists public.metric_comparability_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,

  metric varchar(80) not null,

  -- Las cinco preguntas del apartado 4. `unknown` es una respuesta real: no
  -- saber si la definicion es la misma no es lo mismo que saber que lo es.
  same_definition varchar(8) not null default 'unknown',
  same_scope varchar(8) not null default 'unknown',
  same_time_logic varchar(8) not null default 'unknown',
  same_currency varchar(8) not null default 'unknown',
  same_status_filter varchar(8) not null default 'unknown',

  comparability varchar(24) not null default 'unknown',
  note text,

  created_at timestamptz not null default now(),

  constraint metric_comparability_gates_definicion check (same_definition in ('yes','no','unknown')),
  constraint metric_comparability_gates_alcance check (same_scope in ('yes','no','unknown')),
  constraint metric_comparability_gates_tiempo check (same_time_logic in ('yes','no','unknown')),
  constraint metric_comparability_gates_moneda check (same_currency in ('yes','no','unknown')),
  constraint metric_comparability_gates_filtro check (same_status_filter in ('yes','no','unknown')),
  constraint metric_comparability_gates_estado check (
    comparability in ('comparable', 'partially_comparable', 'not_comparable', 'unknown')
  ),

  -- Apartado 4: **comparable significa las cinco cosas**, no una impresion.
  constraint metric_comparability_gates_comparable_son_cinco check (
    comparability <> 'comparable'
    or (same_definition = 'yes' and same_scope = 'yes' and same_time_logic = 'yes'
        and same_currency = 'yes' and same_status_filter = 'yes')
  ),
  -- Y si alguna de las cinco es que no, no es parcialmente comparable: es que no.
  constraint metric_comparability_gates_un_no_es_no check (
    comparability <> 'partially_comparable'
    or (same_definition <> 'no' and same_scope <> 'no' and same_time_logic <> 'no'
        and same_currency <> 'no' and same_status_filter <> 'no')
  ),
  constraint metric_comparability_gates_no_comparable_se_explica check (
    comparability <> 'not_comparable' or note is not null
  ),
  constraint metric_comparability_gates_unico unique (case_id, metric)
);

comment on table public.metric_comparability_gates is
  'F3/D12 apartado 4. La puerta determinista que el apartado 17 pide que no dependa del LLM: '
  'misma definicion, mismo alcance, misma logica temporal, misma moneda y mismo filtro de '
  'estado. **Declarar `comparable` exige que las cinco sean `yes`**, y basta un `no` para que '
  'deje de ser siquiera parcialmente comparable.';

create index if not exists metric_comparability_gates_caso_idx
  on public.metric_comparability_gates (case_id, comparability);

-- ---------------------------------------------------------------------------
-- 5. Los checks obligatorios por familia (apartados 7 y 19)
-- ---------------------------------------------------------------------------

create table if not exists public.mandatory_confounder_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,

  diagnostic_family varchar(16) not null,
  check_key varchar(40) not null,
  status varchar(16) not null default 'pending',
  outcome text,
  -- Apartado 19: saltarse un check obligatorio exige decir por que.
  reason text,

  executed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint mandatory_confounder_checks_familia check (diagnostic_family in (
    'revenue', 'cac', 'conversion', 'retention', 'finance', 'inventory', 'data', 'technology'
  )),
  constraint mandatory_confounder_checks_estado check (
    status in ('pending', 'executed', 'skipped', 'not_possible')
  ),
  -- **No se puede saltar un check obligatorio en silencio** (apartado 19).
  constraint mandatory_confounder_checks_saltar_exige_motivo check (
    status not in ('skipped', 'not_possible') or reason is not null
  ),
  constraint mandatory_confounder_checks_ejecutado_tiene_resultado check (
    status <> 'executed' or (outcome is not null and executed_at is not null)
  ),
  constraint mandatory_confounder_checks_unico unique (case_id, diagnostic_family, check_key)
);

comment on table public.mandatory_confounder_checks is
  'F3/D12 apartados 7 y 19. El apartado 19 pide poder reconstruir que checks eran obligatorios, '
  'cuales se ejecutaron y **cuales no pudieron ejecutarse y por que**. Por eso `skipped` y '
  '`not_possible` exigen motivo: sin el, esa reconstruccion no existe y saltarse un check sale '
  'gratis.';

create index if not exists mandatory_confounder_checks_caso_idx
  on public.mandatory_confounder_checks (case_id, status);

-- ---------------------------------------------------------------------------
-- 6. El analisis de sensibilidad (apartado 13)
-- ---------------------------------------------------------------------------

create table if not exists public.sensitivity_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  robustness_id uuid not null references public.diagnostic_robustness (id) on delete cascade,

  assumption text not null,
  low_case text,
  base_case text,
  high_case text,
  diagnosis_changes boolean not null default false,
  note text,

  created_at timestamptz not null default now(),

  constraint sensitivity_analyses_supuesto check (length(btrim(assumption)) >= 15),
  -- Un escenario que cambia el diagnostico y no dice como no informa de nada.
  constraint sensitivity_analyses_cambio_se_explica check (
    not diagnosis_changes or note is not null
  ),
  -- Probar la sensibilidad sin mover nada no es probarla.
  constraint sensitivity_analyses_hay_escenarios check (
    low_case is not null or high_case is not null
  )
);

comment on table public.sensitivity_analyses is
  'F3/D12 apartado 13. Si el diagnostico cambia al mover un supuesto razonable, eso es parte '
  'del resultado y no una nota al pie: `note` es obligatoria cuando cambia.';

create index if not exists sensitivity_analyses_robustez_idx
  on public.sensitivity_analyses (robustness_id);

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------

alter table public.diagnostic_robustness enable row level security;
alter table public.diagnostic_confounders enable row level security;
alter table public.confounder_tests enable row level security;
alter table public.metric_comparability_gates enable row level security;
alter table public.mandatory_confounder_checks enable row level security;
alter table public.sensitivity_analyses enable row level security;

drop policy if exists "diagnostic_robustness_select_staff" on public.diagnostic_robustness;
create policy "diagnostic_robustness_select_staff" on public.diagnostic_robustness
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_confounders_select_staff" on public.diagnostic_confounders;
create policy "diagnostic_confounders_select_staff" on public.diagnostic_confounders
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "confounder_tests_select_staff" on public.confounder_tests;
create policy "confounder_tests_select_staff" on public.confounder_tests
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "metric_comparability_gates_select_staff" on public.metric_comparability_gates;
create policy "metric_comparability_gates_select_staff" on public.metric_comparability_gates
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "mandatory_confounder_checks_select_staff" on public.mandatory_confounder_checks;
create policy "mandatory_confounder_checks_select_staff" on public.mandatory_confounder_checks
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "sensitivity_analyses_select_staff" on public.sensitivity_analyses;
create policy "sensitivity_analyses_select_staff" on public.sensitivity_analyses
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
