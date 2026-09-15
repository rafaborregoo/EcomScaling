-- FASE 3 / D13 — Diagnostico temporal y regresion.
--
-- Fuente: conocimiento/fase-03/02-contratos-IA/D13-contrato-de-diagnostico-temporal-y-regresion.md
--         (35 apartados, 22 tests nombrados con sus fixtures)
--
-- Igual que D12, **una sola capa de fuente**: solo el contrato. Lo que va aqui
-- sale de sus 35 apartados y de la lista de invariantes del 34.
--
-- LA PELICULA, NO LA FOTO. D05 a D12 describen un momento; D13 describe la
-- evolucion: cuando empezo, como se movio, si vuelve, si se recupera y si la
-- secuencia encaja con la cadena causal. Sin priorizar ni recomendar (apartado
-- 34, ultima linea).
--
-- EL INVARIANTE CENTRAL ES `STATE != TRAJECTORY` (apartado 1), y la garantia es
-- **la ausencia de un check**. `current_state` y `trajectory` son dos columnas
-- que nada obliga a coincidir, porque BAD + IMPROVING y HEALTHY + DETERIORATING
-- son las dos combinaciones que mas importa poder escribir. Hay tests que
-- comprueban que las dos caben, para que nadie "arregle" la aparente
-- incoherencia mas adelante.
--
-- Lo mismo con tres cosas mas que el contrato separa a proposito y que aqui **no
-- tienen ninguna restriccion que las ate**:
--   * los tres horizontes (corto, medio y largo): el apartado 19 dice que los
--     conflictos son validos y deben preservarse;
--   * las tres recuperaciones (causa, sistema e impacto de negocio): el
--     apartado 28 dice RESOLUTION != RECOVERY, y la causa puede estar resuelta
--     con el impacto acumulado todavia vivo;
--   * la trayectoria cruda y la ajustada por contexto (apartado 23), que se
--     guardan las dos para que la correccion de D12 sea auditable.
--
-- NO SE INVENTA UNA HORA EXACTA CON DATOS DIARIOS (apartado 4). `onset_precision`
-- no puede ser mas fina que `source_granularity`, por check. Es el tipo de
-- mentira que nadie detecta leyendo un informe.
--
-- UNA REGRESION EXIGE UN ESTADO MEJOR ANTERIOR **Y ESTABLE** (apartado 8). Si
-- nunca hubo algo mejor, lo que hay es una debilidad cronica, no una regresion,
-- y el vocabulario tiene las dos palabras. Declarar `regressed` obliga a
-- escribir el estado previo y el periodo estable en el que existio.
--
-- UNA CAIDA DE KPI NO ES UNA REGRESION DE MADUREZ (apartados 8 y 18). Exige
-- perdida estructural persistente de capacidad, declarada y razonada.
--
-- EL BASELINE NO SE ADAPTA A UN SISTEMA ROTO (apartado 7 e invariante 34). Un
-- problema persistente no se aprende como nueva normalidad: promover un regimen
-- exige las cinco condiciones del apartado 7 a la vez, y jubilar un baseline
-- exige que no haya incidente abierto y que la validacion este escrita.
--
-- LA CAUSA PRECEDE AL EFECTO, Y EL TIEMPO ES EL DEL EVENTO (apartado 10). Si el
-- tiempo de ingesta y el del evento difieren, hay que trabajar con el del
-- evento: el check no deja declarar lo contrario.
--
-- LOS EVENTOS TEMPORALES NO SE REPITEN (apartado 25). "Sigue deteriorandose" en
-- cada evaluacion no es informacion. La deduplicacion es un indice unico sobre
-- la transicion, no una convencion.
--
-- NO HAY VENTANA UNIVERSAL (apartado 5 e invariante 34). `capability_time_profiles`
-- existe para que cada capacidad traiga la suya: un fallo de pagos se juzga en
-- minutos y la retencion en meses.

-- ---------------------------------------------------------------------------
-- 1. El perfil temporal de cada capacidad (apartado 5)
-- ---------------------------------------------------------------------------

create table if not exists public.capability_time_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  capability varchar(24) not null,

  evaluation_window_hours numeric not null,
  minimum_observation_window_hours numeric not null,
  expected_lag_hours numeric,
  settlement_delay_hours numeric,
  baseline_horizon_days numeric,
  recurrence_horizon_days numeric,
  rationale text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capability_time_profiles_capacidad check (capability in (
    'market', 'product', 'offer', 'unit_economics', 'acquisition', 'creative',
    'conversion', 'retention', 'inventory', 'operations', 'finance', 'data',
    'technology', 'team', 'strategy'
  )),
  constraint capability_time_profiles_ventanas_positivas check (
    evaluation_window_hours > 0
    and minimum_observation_window_hours > 0
    and (expected_lag_hours is null or expected_lag_hours >= 0)
    and (settlement_delay_hours is null or settlement_delay_hours >= 0)
    and (baseline_horizon_days is null or baseline_horizon_days > 0)
    and (recurrence_horizon_days is null or recurrence_horizon_days > 0)
  ),
  -- No se puede juzgar una tendencia en menos tiempo del que hace falta para
  -- observarla.
  constraint capability_time_profiles_ventana_cubre_el_minimo check (
    evaluation_window_hours >= minimum_observation_window_hours
  ),
  constraint capability_time_profiles_unico unique (organization_id, capability)
);

comment on table public.capability_time_profiles is
  'F3/D13 apartado 5. **No existe una escala temporal universal**: un fallo de pagos se juzga en '
  'minutos y la retencion en meses. El invariante 34 prohibe usar la misma ventana para todas '
  'las capacidades, y esta tabla es lo que hace que no haya una por defecto escondida en el '
  'codigo.';

create index if not exists capability_time_profiles_org_idx
  on public.capability_time_profiles (organization_id);

drop trigger if exists set_capability_time_profiles_updated_at on public.capability_time_profiles;
create trigger set_capability_time_profiles_updated_at
before update on public.capability_time_profiles
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. El diagnostico temporal (apartados 3, 4, 6 a 9, 12, 18, 19, 21, 29 y 30)
-- ---------------------------------------------------------------------------

create table if not exists public.temporal_diagnoses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,

  assessment_status varchar(16) not null default 'current',
  target varchar(80) not null,
  temporal_scope varchar(16) not null default 'global',
  scope_detail jsonb not null default '{}'::jsonb,

  -- Apartado 1: el invariante central. Dos columnas que nada obliga a coincidir.
  current_state varchar(24) not null default 'unknown',
  trajectory varchar(24) not null default 'unknown',

  -- Apartado 19: los tres horizontes, y sus conflictos se conservan.
  short_term_trajectory varchar(24) not null default 'unknown',
  medium_term_trajectory varchar(24) not null default 'unknown',
  long_term_trajectory varchar(24) not null default 'unknown',

  -- Apartado 23: la cruda se guarda para poder auditar el ajuste de D12.
  raw_trajectory varchar(24),
  context_adjusted_trajectory varchar(24),

  -- Apartado 4.
  onset_estimated_at timestamptz,
  onset_range_start timestamptz,
  onset_range_end timestamptz,
  onset_precision varchar(12) not null default 'unknown',
  source_granularity varchar(12) not null default 'unknown',
  onset_detection_method text,
  first_observed_at timestamptz,
  pre_existing_status varchar(20) not null default 'unknown',

  -- Apartado 5.
  change_type varchar(16),
  change_point_at timestamptz,
  velocity varchar(12) not null default 'unknown',
  acceleration varchar(16) not null default 'unknown',

  -- Apartado 6.
  temporal_sufficiency varchar(12) not null default 'insufficient',
  persistence varchar(12) not null default 'transient',
  duration_hours numeric,

  -- Apartado 16.
  noise_classification varchar(20) not null default 'noise',
  trend_confidence varchar(16) not null default 'insufficient',

  -- Apartado 24.
  peak_at timestamptz,
  peak_worst_state varchar(24),
  peak_note text,

  -- Apartado 12.
  recurrence_status varchar(20) not null default 'first_occurrence',
  recurrence_kind varchar(24),
  shared_root_cause boolean,

  -- Apartado 8.
  regression_status varchar(20) not null default 'none',
  regression_type varchar(28),
  previous_state varchar(24),
  previous_stable_period_start timestamptz,
  previous_stable_period_end timestamptz,
  regression_trigger_event text,

  -- Apartado 9: tres capas independientes.
  cause_recovery varchar(20) not null default 'not_recovering',
  system_recovery varchar(20) not null default 'not_recovering',
  business_impact_recovery varchar(20) not null default 'not_recovering',
  recovery_persistence_met boolean not null default false,
  recovery_confirmed_at timestamptz,

  -- Apartado 17.
  root_cause_lifecycle varchar(16),
  constraint_lifecycle varchar(16),
  constraint_shifted_to text,

  -- Apartado 18.
  maturity_trajectory varchar(16) not null default 'unknown',
  maturity_structural_loss boolean not null default false,
  maturity_note text,

  -- Apartado 7.
  baseline_status varchar(16) not null default 'active',
  regime_status varchar(24) not null default 'stable',
  has_unresolved_incident boolean not null default false,
  regime_sufficient_duration boolean not null default false,
  regime_stable_behavior boolean not null default false,
  regime_change_understood boolean not null default false,
  regime_data_quality_high boolean not null default false,
  regime_validation_note text,

  -- Apartado 19.
  comparison_type varchar(24),
  trend_robustness varchar(12) not null default 'low',

  -- Apartado 29.
  temporal_completeness varchar(16) not null default 'unknown',
  history_coverage varchar(12) not null default 'short',
  history_quality varchar(12) not null default 'low',
  temporal_gaps text,

  -- Apartado 21: cinco confianzas, no una.
  onset_confidence varchar(12) not null default 'unknown',
  trajectory_confidence varchar(12) not null default 'unknown',
  regression_confidence varchar(12) not null default 'unknown',
  recovery_confidence varchar(12) not null default 'unknown',
  lag_confidence varchar(12) not null default 'unknown',

  -- Apartado 14: el onset y la deteccion no son lo mismo.
  detected_at timestamptz,
  diagnosed_at timestamptz,
  resolved_at timestamptz,
  recovered_at timestamptz,

  limitations text,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint temporal_diagnoses_estado_evaluacion check (
    assessment_status in ('current', 'superseded')
  ),
  constraint temporal_diagnoses_scope check (temporal_scope in (
    'global', 'channel', 'market', 'product', 'device', 'cohort', 'segment'
  )),
  constraint temporal_diagnoses_estado_actual check (current_state in (
    'elite', 'healthy', 'fragile', 'bad', 'critical', 'disaster', 'unknown'
  )),
  -- Apartado 2: los once estados temporales.
  constraint temporal_diagnoses_trayectoria check (trajectory in (
    'improving', 'stable', 'deteriorating', 'rapidly_deteriorating', 'recovering',
    'volatile', 'regressed', 'recurrent', 'new_regime', 'mixed', 'unknown'
  )),
  constraint temporal_diagnoses_corto check (short_term_trajectory in (
    'improving', 'stable', 'deteriorating', 'rapidly_deteriorating', 'recovering',
    'volatile', 'regressed', 'recurrent', 'new_regime', 'mixed', 'unknown'
  )),
  constraint temporal_diagnoses_medio check (medium_term_trajectory in (
    'improving', 'stable', 'deteriorating', 'rapidly_deteriorating', 'recovering',
    'volatile', 'regressed', 'recurrent', 'new_regime', 'mixed', 'unknown'
  )),
  constraint temporal_diagnoses_largo check (long_term_trajectory in (
    'improving', 'stable', 'deteriorating', 'rapidly_deteriorating', 'recovering',
    'volatile', 'regressed', 'recurrent', 'new_regime', 'mixed', 'unknown'
  )),
  constraint temporal_diagnoses_cruda check (raw_trajectory is null or raw_trajectory in (
    'improving', 'stable', 'deteriorating', 'rapidly_deteriorating', 'recovering',
    'volatile', 'regressed', 'recurrent', 'new_regime', 'mixed', 'unknown'
  )),
  constraint temporal_diagnoses_ajustada check (
    context_adjusted_trajectory is null or context_adjusted_trajectory in (
      'improving', 'stable', 'deteriorating', 'rapidly_deteriorating', 'recovering',
      'volatile', 'regressed', 'recurrent', 'new_regime', 'mixed', 'unknown'
    )
  ),
  constraint temporal_diagnoses_precision check (
    onset_precision in ('minute', 'hour', 'day', 'week', 'month', 'unknown')
  ),
  constraint temporal_diagnoses_granularidad check (
    source_granularity in ('minute', 'hour', 'day', 'week', 'month', 'unknown')
  ),
  constraint temporal_diagnoses_preexistente check (
    pre_existing_status in ('pre_existing', 'likely_pre_existing', 'new', 'unknown')
  ),
  constraint temporal_diagnoses_tipo_cambio check (change_type is null or change_type in (
    'abrupt', 'gradual', 'accelerating', 'decelerating', 'cyclical', 'intermittent', 'step_change'
  )),
  constraint temporal_diagnoses_velocidad check (
    velocity in ('very_slow', 'slow', 'moderate', 'fast', 'extreme', 'unknown')
  ),
  constraint temporal_diagnoses_aceleracion check (
    acceleration in ('accelerating', 'steady', 'decelerating', 'unknown')
  ),
  constraint temporal_diagnoses_suficiencia check (
    temporal_sufficiency in ('sufficient', 'partial', 'insufficient')
  ),
  constraint temporal_diagnoses_persistencia check (
    persistence in ('transient', 'emerging', 'persistent', 'chronic')
  ),
  constraint temporal_diagnoses_ruido check (
    noise_classification in ('noise', 'short_lived_spike', 'material_episode', 'structural_trend')
  ),
  constraint temporal_diagnoses_confianza_tendencia check (
    trend_confidence in ('high', 'medium', 'low', 'insufficient')
  ),
  constraint temporal_diagnoses_recurrencia check (
    recurrence_status in ('first_occurrence', 'second_occurrence', 'recurring', 'systematic')
  ),
  constraint temporal_diagnoses_tipo_recurrencia check (
    recurrence_kind is null
    or recurrence_kind in ('expected_recurrence', 'pathological_recurrence')
  ),
  -- Apartado 8 y el fixture "Not Regression": las dos palabras existen.
  constraint temporal_diagnoses_regresion check (
    regression_status in ('none', 'regressed', 'chronic_weakness', 'unknown')
  ),
  constraint temporal_diagnoses_tipo_regresion check (regression_type is null or regression_type in (
    'performance_regression', 'technical_regression', 'process_regression',
    'operational_regression', 'data_regression', 'maturity_regression',
    'behavioral_regression'
  )),
  constraint temporal_diagnoses_recuperacion_causa check (cause_recovery in (
    'not_recovering', 'early_recovery', 'partial_recovery', 'near_baseline',
    'recovered', 'relapsed'
  )),
  constraint temporal_diagnoses_recuperacion_sistema check (system_recovery in (
    'not_recovering', 'early_recovery', 'partial_recovery', 'near_baseline',
    'recovered', 'relapsed'
  )),
  constraint temporal_diagnoses_recuperacion_negocio check (business_impact_recovery in (
    'not_recovering', 'early_recovery', 'partial_recovery', 'near_baseline',
    'recovered', 'relapsed'
  )),
  constraint temporal_diagnoses_ciclo_causa check (
    root_cause_lifecycle is null
    or root_cause_lifecycle in ('emerged', 'active', 'peaked', 'mitigated', 'resolved', 'recurrent')
  ),
  constraint temporal_diagnoses_ciclo_constraint check (
    constraint_lifecycle is null
    or constraint_lifecycle in ('latent', 'emerging', 'binding', 'easing', 'removed', 'shifted')
  ),
  constraint temporal_diagnoses_madurez check (
    maturity_trajectory in ('advancing', 'stable', 'stagnating', 'regressing', 'unknown')
  ),
  constraint temporal_diagnoses_baseline check (
    baseline_status in ('active', 'under_review', 'frozen', 'superseded')
  ),
  constraint temporal_diagnoses_regimen check (
    regime_status in ('stable', 'new_regime_candidate', 'new_regime_supported', 'unknown')
  ),
  constraint temporal_diagnoses_comparacion check (comparison_type is null or comparison_type in (
    'previous_period', 'rolling', 'yoy', 'pre_event', 'post_event',
    'historical_normal', 'regime_baseline'
  )),
  constraint temporal_diagnoses_robustez check (trend_robustness in ('high', 'medium', 'low')),
  constraint temporal_diagnoses_completitud check (
    temporal_completeness in ('full_history', 'partial_history', 'recent_only', 'unknown')
  ),
  constraint temporal_diagnoses_cobertura check (history_coverage in ('short', 'moderate', 'deep')),
  constraint temporal_diagnoses_calidad_historia check (history_quality in ('high', 'medium', 'low')),
  constraint temporal_diagnoses_confianza_onset check (
    onset_confidence in ('high', 'medium', 'low', 'unknown')
  ),
  constraint temporal_diagnoses_confianza_trayectoria check (
    trajectory_confidence in ('high', 'medium', 'low', 'unknown')
  ),
  constraint temporal_diagnoses_confianza_regresion check (
    regression_confidence in ('high', 'medium', 'low', 'unknown')
  ),
  constraint temporal_diagnoses_confianza_recuperacion check (
    recovery_confidence in ('high', 'medium', 'low', 'unknown')
  ),
  constraint temporal_diagnoses_confianza_lag check (
    lag_confidence in ('high', 'medium', 'low', 'unknown')
  ),

  -- Apartado 4: **no se inventa una hora exacta con datos diarios.** La
  -- precision del onset no puede ser mas fina que la de la fuente.
  constraint temporal_diagnoses_precision_no_supera_la_fuente check (
    (case onset_precision
       when 'minute' then 1 when 'hour' then 2 when 'day' then 3
       when 'week' then 4 when 'month' then 5 else 9 end)
    >= (case source_granularity
       when 'minute' then 1 when 'hour' then 2 when 'day' then 3
       when 'week' then 4 when 'month' then 5 else 9 end)
  ),
  -- Un onset estimado sin rango ni precision es un numero sin sentido.
  constraint temporal_diagnoses_onset_tiene_rango check (
    onset_estimated_at is null
    or onset_precision <> 'unknown'
    or (onset_range_start is not null and onset_range_end is not null)
  ),
  constraint temporal_diagnoses_rango_ordenado check (
    onset_range_end is null or onset_range_start is null or onset_range_end >= onset_range_start
  ),

  -- Invariante 34: no asumir que el primer dia observado es el onset real. Con
  -- poca historia, declarar algo "nuevo" solo cabe con confianza baja.
  constraint temporal_diagnoses_primer_visto_no_es_el_inicio check (
    pre_existing_status <> 'new'
    or history_coverage <> 'short'
    or onset_confidence in ('low', 'unknown')
  ),

  -- Apartado 6: sin historia suficiente no se inventa una trayectoria.
  constraint temporal_diagnoses_sin_historia_no_hay_tendencia check (
    temporal_sufficiency <> 'insufficient'
    or trajectory = 'unknown'
    or trajectory_confidence in ('low', 'unknown')
  ),

  -- Apartado 16: una variacion aislada no es una tendencia estructural.
  constraint temporal_diagnoses_ruido_no_es_tendencia check (
    noise_classification <> 'structural_trend'
    or (trend_confidence in ('high', 'medium') and temporal_sufficiency = 'sufficient')
  ),

  -- Apartado 8: **una regresion exige un estado mejor anterior y estable.**
  constraint temporal_diagnoses_regresion_exige_pasado_mejor check (
    regression_status <> 'regressed'
    or (previous_state is not null
        and previous_stable_period_start is not null
        and previous_stable_period_end is not null
        and regression_type is not null)
  ),
  constraint temporal_diagnoses_periodo_estable_ordenado check (
    previous_stable_period_end is null
    or previous_stable_period_start is null
    or previous_stable_period_end >= previous_stable_period_start
  ),

  -- Apartados 8 y 18: una caida de KPI no es una regresion de madurez.
  constraint temporal_diagnoses_madurez_exige_perdida_estructural check (
    maturity_trajectory <> 'regressing'
    or (maturity_structural_loss and maturity_note is not null)
  ),

  -- Apartado 9: no se marca RECOVERED por un rebote breve.
  constraint temporal_diagnoses_recuperado_persiste check (
    business_impact_recovery <> 'recovered'
    or (recovery_persistence_met and recovery_confirmed_at is not null)
  ),

  -- Apartado 7: promover un regimen exige las cinco condiciones a la vez.
  constraint temporal_diagnoses_regimen_no_es_automatico check (
    regime_status not in ('new_regime_candidate', 'new_regime_supported')
    or (regime_sufficient_duration and regime_stable_behavior
        and regime_change_understood and regime_data_quality_high
        and not has_unresolved_incident)
  ),
  -- Invariante 34: el baseline no se adapta a un sistema roto.
  constraint temporal_diagnoses_baseline_no_normaliza_lo_roto check (
    baseline_status <> 'superseded'
    or (not has_unresolved_incident
        and regime_status = 'new_regime_supported'
        and regime_validation_note is not null)
  ),
  -- Mientras haya un incidente abierto, el baseline no sigue tan campante.
  constraint temporal_diagnoses_incidente_congela_baseline check (
    not has_unresolved_incident or baseline_status in ('frozen', 'under_review')
  ),

  -- Apartado 17: un constraint que se desplaza dice a donde.
  constraint temporal_diagnoses_desplazamiento_dice_a_donde check (
    constraint_lifecycle is distinct from 'shifted' or constraint_shifted_to is not null
  ),

  -- Apartado 19: una trayectoria localizada no se generaliza en silencio.
  constraint temporal_diagnoses_localizada check (
    temporal_scope = 'global' or scope_detail <> '{}'::jsonb
  ),

  -- Apartado 14: el onset no es la deteccion, y el orden va en un sentido.
  constraint temporal_diagnoses_linea_operativa check (
    (detected_at is null or onset_estimated_at is null or detected_at >= onset_estimated_at)
    and (diagnosed_at is null or detected_at is null or diagnosed_at >= detected_at)
    and (resolved_at is null or diagnosed_at is null or resolved_at >= diagnosed_at)
  ),

  constraint temporal_diagnoses_duracion check (duration_hours is null or duration_hours >= 0)
);

comment on table public.temporal_diagnoses is
  'F3/D13 apartado 30. El invariante central del bloque es `STATE != TRAJECTORY` (apartado 1), y '
  'la garantia es **la ausencia de un check**: nada obliga a `current_state` y `trajectory` a '
  'coincidir, porque BAD + IMPROVING y HEALTHY + DETERIORATING son las dos combinaciones que mas '
  'importa poder escribir. Lo mismo con los tres horizontes y con las tres recuperaciones.';

comment on column public.temporal_diagnoses.onset_precision is
  'Apartado 4. **No se inventa una hora exacta cuando la fuente es diaria**: el check impide que '
  'la precision declarada sea mas fina que `source_granularity`. Es el tipo de mentira que nadie '
  'detecta leyendo un informe.';

comment on column public.temporal_diagnoses.regression_status is
  'Apartado 8. `chronic_weakness` existe porque una debilidad que siempre estuvo ahi no es una '
  'regresion: para que algo regrese tuvo que haber sido mejor antes, y establemente.';

comment on column public.temporal_diagnoses.business_impact_recovery is
  'Apartado 9 y 28: RESOLUTION != RECOVERY. Las tres recuperaciones (causa, sistema e impacto) '
  'son independientes y nada las ata: la causa puede estar resuelta con el dano acumulado '
  'todavia vivo.';

comment on column public.temporal_diagnoses.raw_trajectory is
  'Apartado 23. La trayectoria ajustada por los confusores de D12 dirige el diagnostico, pero la '
  'cruda se conserva para que el ajuste sea auditable.';

create index if not exists temporal_diagnoses_caso_idx
  on public.temporal_diagnoses (case_id, assessed_at desc);
create index if not exists temporal_diagnoses_org_idx
  on public.temporal_diagnoses (organization_id, trajectory, regression_status);

create unique index if not exists temporal_diagnoses_vigente_idx
  on public.temporal_diagnoses (case_id)
  where assessment_status = 'current';

drop trigger if exists set_temporal_diagnoses_updated_at on public.temporal_diagnoses;
create trigger set_temporal_diagnoses_updated_at before update on public.temporal_diagnoses
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. El encaje temporal de la cadena causal (apartados 10 y 11)
-- ---------------------------------------------------------------------------

create table if not exists public.temporal_lag_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  diagnosis_id uuid not null references public.temporal_diagnoses (id) on delete cascade,
  edge_id uuid references public.causal_edges (id) on delete set null,

  cause_label varchar(120) not null,
  effect_label varchar(120) not null,
  cause_time timestamptz,
  effect_time timestamptz,
  observed_lag_hours numeric,
  expected_lag_min_hours numeric,
  expected_lag_max_hours numeric,
  lag_fit varchar(16) not null default 'unknown',

  -- Apartado 10: el tiempo del evento manda sobre el de ingesta.
  time_basis varchar(16) not null default 'event_time',
  ingestion_differs boolean not null default false,
  note text,

  created_at timestamptz not null default now(),

  constraint temporal_lag_checks_encaje check (
    lag_fit in ('strong', 'acceptable', 'weak', 'incompatible', 'unknown')
  ),
  constraint temporal_lag_checks_base_temporal check (
    time_basis in ('event_time', 'ingestion_time')
  ),
  constraint temporal_lag_checks_rango_esperado check (
    expected_lag_max_hours is null
    or expected_lag_min_hours is null
    or expected_lag_max_hours >= expected_lag_min_hours
  ),
  -- Apartado 10: la causa precede al efecto. Si no, el encaje es incompatible y
  -- se dice, en vez de dejarlo pasar.
  constraint temporal_lag_checks_causa_precede check (
    cause_time is null or effect_time is null
    or cause_time <= effect_time
    or lag_fit = 'incompatible'
  ),
  -- Invariante 34: no usar el tiempo de ingesta como tiempo del evento cuando
  -- no son equivalentes.
  constraint temporal_lag_checks_ingesta_no_manda check (
    not ingestion_differs or time_basis = 'event_time'
  ),
  -- Un encaje incompatible sin explicacion no sirve para invalidar nada.
  constraint temporal_lag_checks_incompatible_se_explica check (
    lag_fit <> 'incompatible' or note is not null
  )
);

comment on table public.temporal_lag_checks is
  'F3/D13 apartado 10. La causa precede al efecto o el encaje es `incompatible`: el check no deja '
  'una tercera opcion. Y cuando el tiempo de ingesta difiere del tiempo del evento, manda el del '
  'evento (invariante 34) -- porque los datos que llegan tarde no pueden reordenar la causalidad '
  'en silencio.';

create index if not exists temporal_lag_checks_diagnostico_idx
  on public.temporal_lag_checks (diagnosis_id, lag_fit);

-- ---------------------------------------------------------------------------
-- 4. Los episodios historicos (apartados 12 y 13)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_episodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid references public.diagnostic_cases (id) on delete set null,

  episode_code varchar(24) not null,
  diagnosis_type varchar(40) not null,
  scope varchar(16) not null default 'global',

  started_at timestamptz not null,
  peaked_at timestamptz,
  ended_at timestamptz,

  root_cause_id uuid references public.root_causes (id) on delete set null,
  -- Apartado 12: el mismo sintoma recurrente no implica la misma causa. Por eso
  -- esto es una comprobacion declarada, no una deduccion.
  same_root_cause_as_previous boolean,
  same_root_cause_evidence text,

  severity varchar(20),
  recovery_time_hours numeric,
  outcome varchar(24) not null default 'unknown',
  common_trigger text,

  created_at timestamptz not null default now(),

  constraint diagnostic_episodes_scope check (scope in (
    'global', 'channel', 'market', 'product', 'device', 'cohort', 'segment'
  )),
  constraint diagnostic_episodes_severidad check (severity is null or severity in (
    'info', 'low', 'moderate', 'high', 'critical', 'business_threat'
  )),
  constraint diagnostic_episodes_desenlace check (
    outcome in ('resolved', 'recovered', 'abandoned', 'ongoing', 'relapsed', 'unknown')
  ),
  constraint diagnostic_episodes_orden check (
    (peaked_at is null or peaked_at >= started_at)
    and (ended_at is null or ended_at >= started_at)
  ),
  constraint diagnostic_episodes_recuperacion check (
    recovery_time_hours is null or recovery_time_hours >= 0
  ),
  constraint diagnostic_episodes_en_curso_no_ha_terminado check (
    outcome <> 'ongoing' or ended_at is null
  ),
  -- Apartado 12: afirmar que es la misma causa que la vez anterior cuesta
  -- evidencia. Sin ella, lo que se repite es el sintoma.
  constraint diagnostic_episodes_misma_causa_se_prueba check (
    same_root_cause_as_previous is distinct from true
    or same_root_cause_evidence is not null
  ),
  constraint diagnostic_episodes_unico unique (organization_id, episode_code)
);

comment on table public.diagnostic_episodes is
  'F3/D13 apartados 12 y 13. **El mismo sintoma recurrente no implica la misma causa raiz**: '
  '`same_root_cause_as_previous` es una afirmacion que exige evidencia escrita, no algo que se '
  'deduzca de que el episodio se parezca. El historial permite comparar recurrencias sin que la '
  'similitud se convierta por si sola en prueba causal.';

create index if not exists diagnostic_episodes_org_idx
  on public.diagnostic_episodes (organization_id, diagnosis_type, started_at desc);

-- ---------------------------------------------------------------------------
-- 5. Los eventos temporales, sin repetirse (apartado 25)
-- ---------------------------------------------------------------------------

create table if not exists public.temporal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  diagnosis_id uuid not null references public.temporal_diagnoses (id) on delete cascade,

  event_type varchar(24) not null,
  from_state varchar(24),
  to_state varchar(24),
  occurred_at timestamptz not null default now(),
  note text,

  created_at timestamptz not null default now(),

  constraint temporal_events_tipo check (event_type in (
    'new_deterioration', 'acceleration', 'regression', 'recurrence',
    'recovery_started', 'recovered', 'relapse', 'regime_shift', 'constraint_shift'
  )),
  -- Una transicion es un cambio: de algo a otra cosa.
  constraint temporal_events_hay_transicion check (
    from_state is null or to_state is null or from_state <> to_state
  ),
  -- Apartado 25: **la deduplicacion es un indice, no una convencion.** Emitir
  -- "sigue deteriorandose" en cada evaluacion no es informacion.
  constraint temporal_events_sin_repetir unique (diagnosis_id, event_type, from_state, to_state)
);

comment on table public.temporal_events is
  'F3/D13 apartado 25. D13 emite la transicion temporal; avisar a alguien es de otra capa. La '
  'restriccion unica es lo que impide el ruido que el apartado prohibe: la misma transicion no '
  'se puede emitir dos veces sobre el mismo diagnostico.';

create index if not exists temporal_events_diagnostico_idx
  on public.temporal_events (diagnosis_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 6. Las revisiones: la historia no se reescribe (apartado 22)
-- ---------------------------------------------------------------------------

create table if not exists public.temporal_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  diagnosis_id uuid not null references public.temporal_diagnoses (id) on delete cascade,

  as_of timestamptz not null,
  previous_trajectory varchar(24),
  new_trajectory varchar(24) not null,
  previous_onset_at timestamptz,
  new_onset_at timestamptz,
  revision_reason varchar(28) not null,
  -- Apartado 22: el audit trail conserva por que cambio.
  explanation text not null,
  baseline_version varchar(40),
  data_snapshot varchar(80),

  created_at timestamptz not null default now(),

  constraint temporal_revisions_motivo check (revision_reason in (
    'late_data', 'baseline_correction', 'event_discovery',
    'metric_definition_correction', 'context_adjustment', 'other'
  )),
  constraint temporal_revisions_trayectoria_nueva check (new_trajectory in (
    'improving', 'stable', 'deteriorating', 'rapidly_deteriorating', 'recovering',
    'volatile', 'regressed', 'recurrent', 'new_regime', 'mixed', 'unknown'
  )),
  constraint temporal_revisions_explicacion check (length(btrim(explanation)) >= 20),
  -- Una revision que no revisa nada no es una revision.
  constraint temporal_revisions_algo_cambio check (
    previous_trajectory is distinct from new_trajectory
    or previous_onset_at is distinct from new_onset_at
  ),
  -- Si el motivo es "other", hay que decir cual.
  constraint temporal_revisions_otro_se_nombra check (
    revision_reason <> 'other' or length(btrim(explanation)) >= 40
  )
);

comment on table public.temporal_revisions is
  'F3/D13 apartado 22. Una reevaluacion se registra, **no reescribe la historia en silencio**. '
  'Cuando llegan datos tardios o se corrige un baseline, tiene que poder reconstruirse por que en '
  'su momento el sistema clasifico la trayectoria como lo hizo.';

create index if not exists temporal_revisions_diagnostico_idx
  on public.temporal_revisions (diagnosis_id, as_of desc);

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------

alter table public.capability_time_profiles enable row level security;
alter table public.temporal_diagnoses enable row level security;
alter table public.temporal_lag_checks enable row level security;
alter table public.diagnostic_episodes enable row level security;
alter table public.temporal_events enable row level security;
alter table public.temporal_revisions enable row level security;

drop policy if exists "capability_time_profiles_select_staff" on public.capability_time_profiles;
create policy "capability_time_profiles_select_staff" on public.capability_time_profiles
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "temporal_diagnoses_select_staff" on public.temporal_diagnoses;
create policy "temporal_diagnoses_select_staff" on public.temporal_diagnoses
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "temporal_lag_checks_select_staff" on public.temporal_lag_checks;
create policy "temporal_lag_checks_select_staff" on public.temporal_lag_checks
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_episodes_select_staff" on public.diagnostic_episodes;
create policy "diagnostic_episodes_select_staff" on public.diagnostic_episodes
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "temporal_events_select_staff" on public.temporal_events;
create policy "temporal_events_select_staff" on public.temporal_events
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "temporal_revisions_select_staff" on public.temporal_revisions;
create policy "temporal_revisions_select_staff" on public.temporal_revisions
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
