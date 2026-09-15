-- FASE 3 / D14 — Salida diagnostica, trazabilidad y validacion.
--
-- Fuente: conocimiento/fase-03/02-contratos-IA/D14-contrato-de-salida-diagnostica-trazabilidad-y-validacion.md
--         (41 apartados)
--
-- Igual que D12 y D13, **una sola capa de fuente**: solo el contrato.
--
-- EL ULTIMO BLOQUE DE LA FASE. D14 no diagnostica: valida, empaqueta, versiona
-- y entrega lo que hicieron D00 a D13. Y sigue sin decidir nada -- el apartado
-- 13 lo repite: severidad es diagnostico, prioridad es F4.
--
-- AQUI SE PAGA LA DEUDA DEL LENGUAJE. Durante D09, D10 y D11 el lenguaje
-- calibrado se vigilaba con expresiones regulares en castellano, y quedo
-- documentado que eso era un lint y no una garantia. **La garantia es esta**: la
-- frase que ve el cliente no es texto libre, se compone desde el nivel de
-- confianza. Los guardrails 43 a 46 de D11 dan la formula exacta de cada nivel,
-- y el check `diagnostic_outputs_lenguaje_calibrado` comprueba que el resumen
-- empieza por la que le toca:
--
--   insufficient_data -> "No puede determinarse ..."
--   low               -> "Es compatible con ..."
--   medium            -> "La explicación más probable es ..."
--   high              -> "La evidencia sostiene que ..."
--
-- Escribir "está claro que" con confianza baja deja de ser algo que se detecta:
-- **no se puede guardar**. Y `confidence_language` no es una eleccion editorial
-- aparte: un check la ata al nivel de confianza del diagnostico, porque el
-- apartado 25 dice que la interfaz puede simplificar pero no alterar el
-- significado.
--
-- EL GATE DE FINALIZACION SON DOCE CONDICIONES, Y SE COMPRUEBAN LAS DOCE
-- (apartado 38). `finalized_valid` exige las doce a la vez. No hay forma de
-- marcar algo como final saltandose la validacion, que es el invariante que
-- abre la lista del apartado 41.
--
-- LA HISTORIA NO SE MUTA (apartados 4, 6 y 20). Cada revision material crea una
-- version nueva con su motivo; las anteriores se marcan `superseded_by` y se
-- quedan. Un unico indice parcial garantiza que solo haya una version vigente
-- por caso, y el numero de version es unico dentro del caso.
--
-- CONOCIMIENTO NO ES EVIDENCIA (apartado 26). No se crea una tabla paralela:
-- **se amplia la de D11** (`knowledge_applicability`), que ya separa la
-- confianza de recuperacion de la del diagnostico. Dos registros distintos de
-- lo mismo acabarian discrepando.
--
-- RESOLVER NO ES CERRAR (apartado 18). Cerrar un caso exige verificacion del
-- resultado empresarial, o declarar por escrito que es un cierre administrativo.
--
-- UN FALLO TECNICO NO ES UN DIAGNOSTICO (apartados 33 y 35). La taxonomia de
-- error existe para que un timeout no se presente como una conclusion parcial,
-- y el check impide que algo con fallo se marque como finalizado y valido.
--
-- LO QUE NO ESTA AQUI: `priority`, `recommended_action`, `strategy`,
-- `allocation`. El apartado 13 y el 41 lo prohiben tres veces entre los dos.

-- ---------------------------------------------------------------------------
-- 1. El objeto diagnostico canonico y versionado (apartados 2 a 6, 15 y 39)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete set null,

  -- Apartado 4: la version identifica la evaluacion; el caso agrupa versiones.
  version integer not null default 1,
  is_current boolean not null default true,
  supersedes uuid references public.diagnostic_outputs (id) on delete set null,
  superseded_by uuid references public.diagnostic_outputs (id) on delete set null,
  supersession_reason text,

  -- Apartado 5.
  status varchar(24) not null default 'open',
  -- Apartado 15.
  completeness_status varchar(28) not null default 'incomplete',
  missing_components text[] not null default '{}',
  blocking_components text[] not null default '{}',

  -- Apartado 38: el gate, las doce condiciones.
  data_gate_valid boolean not null default false,
  context_valid boolean not null default false,
  stage_valid boolean not null default false,
  hypothesis_review_completed boolean not null default false,
  root_cause_condition_satisfied boolean not null default false,
  confounder_review_completed boolean not null default false,
  severity_computed boolean not null default false,
  confidence_calibrated boolean not null default false,
  temporal_review_completed boolean not null default false,
  traceability_complete boolean not null default false,
  validation_passed boolean not null default false,
  phase_boundary_respected boolean not null default false,
  finalization_status varchar(20) not null default 'invalid_output',

  -- Referencias a lo que produjeron los bloques anteriores. No se copian sus
  -- conclusiones: se apuntan, para que no haya dos verdades sobre lo mismo.
  root_cause_id uuid references public.root_causes (id) on delete set null,
  constraint_id uuid references public.business_constraints (id) on delete set null,
  severity_assessment_id uuid references public.severity_assessments (id) on delete set null,
  robustness_id uuid references public.diagnostic_robustness (id) on delete set null,
  temporal_diagnosis_id uuid references public.temporal_diagnoses (id) on delete set null,
  snapshot_id uuid,

  -- Apartado 12: los resumenes obligatorios.
  diagnostic_summary text,
  limitation_summary text,
  confidence_summary text,
  data_gap_summary text,

  -- Apartado 25: la salida de usuario.
  confidence varchar(20) not null default 'insufficient_data',
  confidence_language varchar(20) not null default 'insufficient_data',
  user_summary text,
  what_we_know text,
  what_we_dont_know text,
  visibility varchar(16) not null default 'internal',

  -- Apartados 33 y 35.
  failure_kind varchar(24),
  failure_detail text,
  degraded boolean not null default false,

  -- Apartado 10.
  contract_version varchar(24),
  rules_version varchar(24),
  model_version varchar(40),
  prompt_version varchar(40),
  trace_id varchar(64),

  -- Apartado 27.
  manual_review_required boolean not null default false,
  manual_review_reason text,

  -- Apartado 14.
  handoff_ready boolean not null default false,

  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diagnostic_outputs_version_positiva check (version >= 1),
  constraint diagnostic_outputs_estado check (status in (
    'open', 'investigating', 'partially_confirmed', 'confirmed', 'recovering',
    'closed', 'closed_pending_outcome', 'inconclusive', 'insufficient_data',
    'invalidated', 'reopened'
  )),
  constraint diagnostic_outputs_completitud check (completeness_status in (
    'complete', 'complete_with_limitations', 'incomplete', 'blocked'
  )),
  constraint diagnostic_outputs_finalizacion check (
    finalization_status in ('finalized_valid', 'invalid_output')
  ),
  constraint diagnostic_outputs_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint diagnostic_outputs_lenguaje check (
    confidence_language in ('high', 'medium', 'low', 'insufficient_data')
  ),
  constraint diagnostic_outputs_visibilidad check (
    visibility in ('internal', 'admin', 'user_visible')
  ),
  constraint diagnostic_outputs_tipo_fallo check (failure_kind is null or failure_kind in (
    'data_error', 'system_error', 'reasoning_failure', 'validation_failure', 'timeout'
  )),

  -- Apartado 38: **las doce condiciones del gate, o no es final.**
  constraint diagnostic_outputs_gate_completo check (
    finalization_status <> 'finalized_valid'
    or (data_gate_valid and context_valid and stage_valid
        and hypothesis_review_completed and root_cause_condition_satisfied
        and confounder_review_completed and severity_computed
        and confidence_calibrated and temporal_review_completed
        and traceability_complete and validation_passed
        and phase_boundary_respected)
  ),

  -- Apartado 25 y guardrails 43 a 46 de D11: **el lenguaje de usuario se
  -- compone desde la confianza, no se escribe a mano.** El check lee el
  -- principio del resumen y no deja otra entradilla.
  constraint diagnostic_outputs_lenguaje_calibrado check (
    user_summary is null
    or (confidence_language = 'insufficient_data'
        and user_summary like 'No puede determinarse%')
    or (confidence_language = 'low'
        and user_summary like 'Es compatible con%')
    or (confidence_language = 'medium'
        and user_summary like 'La explicación más probable es%')
    or (confidence_language = 'high'
        and user_summary like 'La evidencia sostiene que%')
  ),
  -- Apartado 25: la interfaz simplifica, no cambia el significado. La banda de
  -- lenguaje **es** el nivel de confianza, no una eleccion editorial aparte.
  constraint diagnostic_outputs_lenguaje_es_la_confianza check (
    confidence_language = confidence
  ),

  -- Apartado 17: CONFIRMED exige causa soportada y confianza compatible.
  constraint diagnostic_outputs_confirmado_se_sostiene check (
    status <> 'confirmed'
    or (root_cause_id is not null
        and confidence in ('high', 'medium')
        and traceability_complete)
  ),
  -- Apartado 17: INSUFFICIENT_DATA dice que falta.
  constraint diagnostic_outputs_sin_datos_dice_que_falta check (
    status <> 'insufficient_data'
    or (missing_components <> '{}' or data_gap_summary is not null)
  ),
  -- Apartado 17 y 41: invalidar conserva el motivo.
  constraint diagnostic_outputs_invalidar_se_motiva check (
    status <> 'invalidated' or supersession_reason is not null
  ),
  -- Apartado 15: completo con limitaciones exige escribirlas.
  constraint diagnostic_outputs_limitaciones_se_escriben check (
    completeness_status <> 'complete_with_limitations' or limitation_summary is not null
  ),
  constraint diagnostic_outputs_bloqueado_dice_que_bloquea check (
    completeness_status <> 'blocked' or blocking_components <> '{}'
  ),

  -- Apartado 6: sustituir no es borrar, y exige motivo.
  constraint diagnostic_outputs_sustitucion_se_motiva check (
    superseded_by is null or supersession_reason is not null
  ),
  -- Una version sustituida ya no es la vigente.
  constraint diagnostic_outputs_sustituida_no_es_vigente check (
    superseded_by is null or not is_current
  ),

  -- Apartados 33 y 35: un fallo tecnico no se presenta como conclusion.
  constraint diagnostic_outputs_fallo_no_es_final check (
    failure_kind is null or finalization_status = 'invalid_output'
  ),
  constraint diagnostic_outputs_fallo_se_explica check (
    failure_kind is null or failure_detail is not null
  ),
  -- Apartado 35: degradar se anuncia.
  constraint diagnostic_outputs_degradado_avisa check (
    not degraded or limitation_summary is not null
  ),

  -- Apartado 27.
  constraint diagnostic_outputs_revision_manual_se_motiva check (
    not manual_review_required or manual_review_reason is not null
  ),

  -- Apartado 14: al handoff solo se llega por la puerta.
  constraint diagnostic_outputs_handoff_exige_gate check (
    not handoff_ready or finalization_status = 'finalized_valid'
  ),

  -- Apartado 25: lo que ve el cliente lleva su resumen y su lenguaje.
  constraint diagnostic_outputs_visible_tiene_resumen check (
    visibility <> 'user_visible' or user_summary is not null
  ),

  -- Apartado 22: sin snapshot no hay reproducibilidad, y sin ella no es final.
  constraint diagnostic_outputs_final_tiene_snapshot check (
    finalization_status <> 'finalized_valid' or snapshot_id is not null
  ),

  constraint diagnostic_outputs_version_unica unique (case_id, version)
);

comment on table public.diagnostic_outputs is
  'F3/D14 apartados 2 a 6. El objeto diagnostico canonico, versionado y append-only. **No hay '
  'columna de prioridad, accion ni estrategia** (apartados 13 y 41). Y el lenguaje que ve el '
  'cliente no se escribe a mano: el check `diagnostic_outputs_lenguaje_calibrado` exige que el '
  'resumen empiece por la formula que corresponde a su nivel de confianza, segun los guardrails '
  '43 a 46 de D11.';

comment on column public.diagnostic_outputs.user_summary is
  'Apartado 25. **La deuda de lenguaje de D09, D10 y D11 se paga aqui.** Antes se vigilaba con '
  'expresiones regulares lo que alguien escribia; ahora la entradilla se compone desde la '
  'confianza y el check no admite otra. "Está claro que" con confianza baja no se detecta: no '
  'se puede guardar.';

comment on column public.diagnostic_outputs.finalization_status is
  'Apartado 38. `finalized_valid` exige las doce condiciones del gate a la vez. El primer '
  'invariante del apartado 41 es no emitir como final un diagnostico no validado, y esta es la '
  'garantia.';

create index if not exists diagnostic_outputs_caso_idx
  on public.diagnostic_outputs (case_id, version desc);
create index if not exists diagnostic_outputs_org_idx
  on public.diagnostic_outputs (organization_id, status, finalization_status);

create unique index if not exists diagnostic_outputs_vigente_idx
  on public.diagnostic_outputs (case_id)
  where is_current;

drop trigger if exists set_diagnostic_outputs_updated_at on public.diagnostic_outputs;
create trigger set_diagnostic_outputs_updated_at before update on public.diagnostic_outputs
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. El snapshot reproducible (apartados 21 y 22)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,

  as_of timestamptz not null,
  source_versions jsonb not null default '{}'::jsonb,
  data_ranges jsonb not null default '{}'::jsonb,
  normalization_version varchar(24),
  metric_definition_versions jsonb not null default '{}'::jsonb,
  knowledge_refs text[] not null default '{}',
  rules_version varchar(24),
  model_version varchar(40),
  prompt_version varchar(40),
  known_issues text,

  -- Apartado 22.
  reproducible boolean not null default false,
  snapshot_available boolean not null default false,
  sources_resolvable boolean not null default false,
  rules_version_available boolean not null default false,
  knowledge_refs_resolvable boolean not null default false,
  model_metadata_available boolean not null default false,
  reproducibility_limitations text,

  created_at timestamptz not null default now(),

  -- Apartado 22: reproducible no es una declaracion de intenciones. Son las
  -- cinco cosas que hacen falta para volver a llegar a la misma conclusion.
  constraint diagnostic_snapshots_reproducible_de_verdad check (
    not reproducible
    or (snapshot_available and sources_resolvable and rules_version_available
        and knowledge_refs_resolvable and model_metadata_available)
  ),
  constraint diagnostic_snapshots_no_reproducible_se_explica check (
    reproducible or reproducibility_limitations is not null
  )
);

comment on table public.diagnostic_snapshots is
  'F3/D14 apartados 21 y 22. Sin esto, una conclusion no se puede volver a obtener y el apartado '
  '22 dice que entonces no es enterprise-grade. `reproducible` exige las cinco condiciones a la '
  'vez: no es una etiqueta optimista.';

create index if not exists diagnostic_snapshots_caso_idx
  on public.diagnostic_snapshots (case_id, as_of desc);

alter table public.diagnostic_outputs
  drop constraint if exists diagnostic_outputs_snapshot_fk;
alter table public.diagnostic_outputs
  add constraint diagnostic_outputs_snapshot_fk
  foreign key (snapshot_id) references public.diagnostic_snapshots (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. El ledger de evidencia (apartados 7 y 8)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_output_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  output_id uuid not null references public.diagnostic_outputs (id) on delete cascade,

  -- Apartado 7: claim -> evidence -> source -> transformation -> snapshot.
  claim text not null,
  claim_layer varchar(20) not null,
  source varchar(40) not null,
  source_ref text not null,
  metric varchar(80),
  period_start timestamptz,
  period_end timestamptz,
  scope varchar(40),
  value_note text,
  reliability varchar(20) not null default 'unknown',
  transformations text,
  snapshot_ref uuid references public.diagnostic_snapshots (id) on delete set null,

  -- Apartado 7: la contradictoria no se oculta, asi que tiene su sitio.
  stance varchar(16) not null default 'supporting',

  created_at timestamptz not null default now(),

  constraint diagnostic_output_evidence_capa check (claim_layer in (
    'what', 'where', 'measurement', 'signal', 'symptom', 'why', 'root_cause',
    'constraint', 'current_impact', 'future_impact', 'severity', 'forecast', 'overall'
  )),
  constraint diagnostic_output_evidence_postura check (
    stance in ('supporting', 'contradicting', 'inconclusive')
  ),
  constraint diagnostic_output_evidence_fiabilidad check (
    reliability in ('high', 'medium', 'low', 'unreliable', 'unknown')
  ),
  constraint diagnostic_output_evidence_periodo check (
    period_end is null or period_start is null or period_end >= period_start
  ),
  -- Una evidencia sin origen no es evidencia: es una afirmacion.
  constraint diagnostic_output_evidence_tiene_origen check (
    length(btrim(source_ref)) >= 3
  ),
  -- Apartado 7: si se transformo el dato, se dice como.
  constraint diagnostic_output_evidence_transformacion_visible check (
    transformations is null or length(btrim(transformations)) >= 10
  )
);

comment on table public.diagnostic_output_evidence is
  'F3/D14 apartado 7. El ledger que hace que toda afirmacion material se pueda reconstruir hasta '
  'un dato concreto. `stance` incluye `contradicting` porque el apartado 41 prohibe ocultar la '
  'evidencia contradictoria material: si no tuviera sitio, desapareceria sola.';

create index if not exists diagnostic_output_evidence_salida_idx
  on public.diagnostic_output_evidence (output_id, stance);
create index if not exists diagnostic_output_evidence_capa_idx
  on public.diagnostic_output_evidence (output_id, claim_layer);

-- ---------------------------------------------------------------------------
-- 4. Los validadores (apartados 16 y 17)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  output_id uuid not null references public.diagnostic_outputs (id) on delete cascade,

  validator varchar(24) not null,
  result varchar(20) not null default 'invalid',
  message text,
  blocking boolean not null default false,

  created_at timestamptz not null default now(),

  -- Apartado 16: los once validadores.
  constraint diagnostic_validations_validador check (validator in (
    'structural', 'semantic', 'causal', 'evidence', 'confidence', 'severity',
    'temporal', 'confounder', 'scope', 'contradiction', 'output_integrity'
  )),
  constraint diagnostic_validations_resultado check (
    result in ('valid', 'pass_with_warnings', 'invalid')
  ),
  -- Apartado 16: una advertencia solo deja pasar si esta explicitada.
  constraint diagnostic_validations_aviso_se_explicita check (
    result <> 'pass_with_warnings' or message is not null
  ),
  constraint diagnostic_validations_invalido_se_explica check (
    result <> 'invalid' or message is not null
  ),
  -- Un error que compromete la integridad bloquea; si no bloquea, no era error.
  constraint diagnostic_validations_bloqueo_es_invalido check (
    not blocking or result = 'invalid'
  ),
  constraint diagnostic_validations_unico unique (output_id, validator)
);

comment on table public.diagnostic_validations is
  'F3/D14 apartados 16 y 17. Los once validadores con su resultado. Una advertencia sin mensaje '
  'no es una advertencia: es una salida sin revisar con apariencia de revisada.';

create index if not exists diagnostic_validations_salida_idx
  on public.diagnostic_validations (output_id, result);

-- ---------------------------------------------------------------------------
-- 5. Las transiciones de estado y las reaperturas (apartados 5, 9 y 19)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  output_id uuid references public.diagnostic_outputs (id) on delete set null,

  from_status varchar(24),
  to_status varchar(24) not null,
  -- Apartado 5: actor, momento, razon y evidencia.
  actor varchar(24) not null,
  actor_ref text,
  reason text not null,
  evidence_ref text,
  new_evidence text,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint diagnostic_transitions_desde check (from_status is null or from_status in (
    'open', 'investigating', 'partially_confirmed', 'confirmed', 'recovering',
    'closed', 'closed_pending_outcome', 'inconclusive', 'insufficient_data',
    'invalidated', 'reopened'
  )),
  constraint diagnostic_transitions_hasta check (to_status in (
    'open', 'investigating', 'partially_confirmed', 'confirmed', 'recovering',
    'closed', 'closed_pending_outcome', 'inconclusive', 'insufficient_data',
    'invalidated', 'reopened'
  )),
  -- Apartado 9: quien o que componente produjo el cambio. Un rol, no una
  -- persona: D09 ya decidio que aqui no se senala a nadie.
  constraint diagnostic_transitions_actor check (
    actor in ('engine', 'validator', 'consultant', 'scheduler', 'external_event')
  ),
  constraint diagnostic_transitions_motivo check (length(btrim(reason)) >= 15),
  constraint diagnostic_transitions_hay_cambio check (
    from_status is null or from_status <> to_status
  ),
  -- Apartado 19: reabrir exige evidencia nueva, no un cambio de opinion.
  constraint diagnostic_transitions_reabrir_exige_evidencia check (
    to_status <> 'reopened' or new_evidence is not null
  ),
  -- Apartado 5: invalidar una conclusion confirmada exige evidencia material.
  constraint diagnostic_transitions_invalidar_exige_evidencia check (
    to_status <> 'invalidated' or evidence_ref is not null or new_evidence is not null
  )
);

comment on table public.diagnostic_transitions is
  'F3/D14 apartados 5, 9 y 19. Cada cambio de estado con su actor, su momento, su razon y su '
  'evidencia. Reabrir exige evidencia nueva (apartado 19): un caso no se reabre por un cambio de '
  'opinion. `actor` es un rol y no una persona, en la misma linea que D09.';

create index if not exists diagnostic_transitions_caso_idx
  on public.diagnostic_transitions (case_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 6. El cierre y la verificacion del resultado (apartado 18)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  output_id uuid references public.diagnostic_outputs (id) on delete set null,

  resolved_at timestamptz,
  closure_kind varchar(24) not null default 'pending_outcome',
  outcome_verified boolean not null default false,
  outcome_evidence text,
  recovery_status varchar(20) not null default 'not_recovering',
  residual_issues text,
  followup_required boolean not null default false,
  followup_note text,
  confidence varchar(20) not null default 'insufficient_data',
  administrative_closure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diagnostic_closures_tipo check (
    closure_kind in ('verified', 'administrative', 'pending_outcome')
  ),
  constraint diagnostic_closures_recuperacion check (recovery_status in (
    'not_recovering', 'early_recovery', 'partial_recovery',
    'near_baseline', 'recovered', 'relapsed'
  )),
  constraint diagnostic_closures_confianza check (
    confidence in ('high', 'medium', 'low', 'insufficient_data')
  ),
  -- Apartado 18: **resolver la causa no basta para cerrar.** Un cierre
  -- verificado exige haber comprobado el resultado empresarial.
  constraint diagnostic_closures_verificado_se_comprueba check (
    closure_kind <> 'verified' or (outcome_verified and outcome_evidence is not null)
  ),
  -- Y si se cierra sin comprobarlo, hay que decir que es administrativo y por que.
  constraint diagnostic_closures_administrativo_se_motiva check (
    closure_kind <> 'administrative' or administrative_closure_reason is not null
  ),
  constraint diagnostic_closures_seguimiento_se_concreta check (
    not followup_required or followup_note is not null
  ),
  constraint diagnostic_closures_unico unique (case_id)
);

comment on table public.diagnostic_closures is
  'F3/D14 apartado 18. **RESOLUTION != CLOSURE.** Cerrar exige verificar el resultado '
  'empresarial, o declarar por escrito que es un cierre administrativo. Sin esas dos salidas, '
  'todo el mundo cierra en cuanto toca la causa.';

create index if not exists diagnostic_closures_caso_idx
  on public.diagnostic_closures (case_id);

drop trigger if exists set_diagnostic_closures_updated_at on public.diagnostic_closures;
create trigger set_diagnostic_closures_updated_at before update on public.diagnostic_closures
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Conocimiento != evidencia: se amplia D11, no se duplica (apartado 26)
-- ---------------------------------------------------------------------------
--
-- `knowledge_applicability` de D11 ya separa la confianza de recuperacion de la
-- del diagnostico, que es exactamente la frontera del apartado 26. Crear aqui
-- un DIAGNOSTIC_REFERENCE_RECORD paralelo daria dos registros del mismo
-- documento que acabarian discrepando.

alter table public.knowledge_applicability
  add column if not exists knowledge_type varchar(24),
  add column if not exists retrieval_context text,
  add column if not exists used_for text,
  add column if not exists output_id uuid references public.diagnostic_outputs (id) on delete set null;

alter table public.knowledge_applicability
  drop constraint if exists knowledge_applicability_tipo;
alter table public.knowledge_applicability
  add constraint knowledge_applicability_tipo check (
    knowledge_type is null or knowledge_type in (
      'doctrine', 'pattern', 'benchmark', 'playbook_reference',
      'regulation', 'vendor_doc', 'internal_note'
    )
  );

comment on column public.knowledge_applicability.knowledge_type is
  'F3/D14 apartado 26. REFERENCE_KNOWLEDGE no se convierte por si mismo en CASE_EVIDENCE: un '
  'patron recuperado por similitud no demuestra que ese patron ocurra en este negocio. Esta '
  'tabla es la de D11 ampliada, no una paralela.';

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------

alter table public.diagnostic_outputs enable row level security;
alter table public.diagnostic_snapshots enable row level security;
alter table public.diagnostic_output_evidence enable row level security;
alter table public.diagnostic_validations enable row level security;
alter table public.diagnostic_transitions enable row level security;
alter table public.diagnostic_closures enable row level security;

-- Apartado 23: el cliente solo ve lo marcado `user_visible`, y solo de su
-- organizacion. El staff ve todo lo de las organizaciones que tiene asignadas.
drop policy if exists "diagnostic_outputs_select_staff" on public.diagnostic_outputs;
create policy "diagnostic_outputs_select_staff" on public.diagnostic_outputs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_outputs_select_cliente" on public.diagnostic_outputs;
create policy "diagnostic_outputs_select_cliente" on public.diagnostic_outputs
  for select to authenticated
  using (visibility = 'user_visible' and private.can_access_org(organization_id));

drop policy if exists "diagnostic_snapshots_select_staff" on public.diagnostic_snapshots;
create policy "diagnostic_snapshots_select_staff" on public.diagnostic_snapshots
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_output_evidence_select_staff" on public.diagnostic_output_evidence;
create policy "diagnostic_output_evidence_select_staff" on public.diagnostic_output_evidence
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_validations_select_staff" on public.diagnostic_validations;
create policy "diagnostic_validations_select_staff" on public.diagnostic_validations
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_transitions_select_staff" on public.diagnostic_transitions;
create policy "diagnostic_transitions_select_staff" on public.diagnostic_transitions
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_closures_select_staff" on public.diagnostic_closures;
create policy "diagnostic_closures_select_staff" on public.diagnostic_closures
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
