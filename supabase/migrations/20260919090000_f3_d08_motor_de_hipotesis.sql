-- FASE 3 / D08 — Generador y contraste de hipotesis.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d08-requisitos-contrato-hipotesis.md
--          conocimiento/fase-03/04-policies-guardrails/d08-guardrails-hipotesis.md
--          conocimiento/fase-03/05-experience-learning/d08-historial-y-calibracion-de-hipotesis.md
--          conocimiento/fase-03/06-tenant-context/d08-contexto-motor-hipotesis.md
--
-- D07 deja ramas que sobreviven. D08 las convierte en hipotesis explicitas y las
-- somete a prueba. Sigue sin decidir la causa raiz: el guardrail 45 dice que eso
-- es D09, y el 25 que D08 no produce accion ni prioridad.
--
-- NO SE CREA UNA SEGUNDA TABLA DE HIPOTESIS. `diagnostic_hypotheses` ya existe
-- desde D00 y es la misma entidad, solo que alli se guardaba en su version
-- minima (codigo, enunciado, estado, motivo de rechazo). Crear aqui
-- `hypotheses` al lado seria garantizar que dentro de seis meses digan cosas
-- distintas sobre la misma H1 — el mismo argumento por el que D05 reutiliza
-- `health_references` y D07 reutiliza `context_confounders`. Se amplia la que
-- hay.
--
-- ESO INCLUYE AMPLIAR EL VOCABULARIO DE ESTADOS DE D00. Los seis valores de
-- entonces se sustituyen por los diez del apartado 3. Se puede hacer sin migrar
-- nada porque las tablas estan vacias en los dos entornos; hacerlo dentro de
-- seis meses ya no seria gratis. Queda anotado en la bitacora de D00.
--
-- LOS OCHO PRINCIPIOS DE LA CABECERA SON EL BLOQUE:
--   LA PRIMERA CAUSA PLAUSIBLE NO ES UN DIAGNOSTICO. PRIOR != CONCLUSION.
--   SOPORTADA != CONFIRMADA. CANDIDATA A RAIZ != RAIZ. NO OBSERVADO != OBSERVADO
--   AUSENTE. CONFIANZA != COBERTURA. CONTRIBUCION CONTABLE != CONTRIBUCION
--   CAUSAL. TEST DIAGNOSTICO != ACCION DE NEGOCIO.
--
-- "NO OBSERVADO" NO ES "OBSERVADO AUSENTE" (guardrail 5), Y AQUI ES UNA COLUMNA.
-- `diagnostic_evidence.observation_kind` distingue las tres cosas:
-- `observed_present`, `observed_absent` y `not_observed`. No haber mirado no es
-- evidencia de que no pasa, y con la columna puesta ya no se puede colar como
-- si lo fuera: hay un check que impide que lo no observado contradiga nada.
--
-- SIN RUTA CAUSAL EN D07 NO HAY HIPOTESIS CAUSAL (guardrail 19). Una hipotesis
-- de tipo causa directa, contributoria o candidata a raiz esta obligada por
-- check a apuntar a una ruta de `causal_paths`. Inventar una causa sin camino
-- por el que llegue es exactamente lo que el bloque existe para impedir.
--
-- CONFIRMED DEBE SER RARO (guardrail 32), y aqui cuesta: exige confianza alta,
-- condicion de falsacion escrita y separacion alta respecto de las
-- alternativas. El guardrail 35 dice que `inconclusive` es mejor que el teatro
-- de la certeza, asi que `inconclusive` es un estado de primera clase y no una
-- forma de fracaso.
--
-- LO QUE NO ESTA AQUI: no hay `root_cause` (solo `root_cause_candidate`, y el
-- guardrail 4 explica la diferencia), ni `priority`, ni `action`, ni
-- `recommendation`. D09 decide la raiz; actuar es F5+.

-- ---------------------------------------------------------------------------
-- 1. La hipotesis, ampliada
-- ---------------------------------------------------------------------------

alter table public.diagnostic_hypotheses
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade,
  add column if not exists hypothesis_type varchar(32) not null default 'contextual_explanation',
  add column if not exists family varchar(24),
  add column if not exists target_node_id uuid references public.causal_nodes (id) on delete set null,
  add column if not exists scope varchar(16) not null default 'business',
  add column if not exists scope_detail jsonb not null default '{}'::jsonb,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,

  add column if not exists confidence varchar(20) not null default 'insufficient',
  -- Guardrail 2: el prior no es la conclusion, y por eso son dos columnas.
  add column if not exists prior_plausibility varchar(20) not null default 'unknown',
  -- Guardrail 6 y apartado 13: confianza y cobertura no son lo mismo.
  add column if not exists explanatory_coverage varchar(20) not null default 'unknown',
  -- Apartado 14: lo que queda sin explicar se conserva.
  add column if not exists unexplained_residual_material boolean not null default false,
  add column if not exists residual_note text,

  -- Apartado 18 y guardrail 4. **No existe `root_cause`**: eso es D09.
  add column if not exists root_cause_candidate boolean not null default false,
  -- Apartado 19.
  add column if not exists cause_timing varchar(20),
  add column if not exists cause_depth varchar(20),

  -- Apartado 10 y guardrail 12.
  add column if not exists relative_role varchar(24),
  -- Apartado 12: poca separacion limita la confianza.
  add column if not exists separation varchar(12) not null default 'unknown',

  -- Apartado 9: las ocho dimensiones de encaje, separadas.
  add column if not exists mechanism_fit varchar(16) not null default 'untested',
  add column if not exists temporal_fit varchar(16) not null default 'untested',
  add column if not exists scope_fit varchar(16) not null default 'untested',
  add column if not exists magnitude_fit varchar(16) not null default 'untested',
  add column if not exists context_fit varchar(16) not null default 'untested',
  add column if not exists maturity_fit varchar(16) not null default 'untested',
  add column if not exists health_fit varchar(16) not null default 'untested',
  add column if not exists signal_fit varchar(16) not null default 'untested',

  -- Apartado 20.
  add column if not exists uncertainty_kinds text[] not null default '{}',

  -- Apartados 24 y guardrails 57 a 60.
  add column if not exists falsification_condition text,
  add column if not exists why_it_wins text,
  add column if not exists why_alternatives_lose text,
  add column if not exists limitations text,
  add column if not exists assumptions text,

  -- Apartado 22 y guardrails 51 a 53: quien la propone no la valida.
  add column if not exists proposing_agent varchar(60),
  add column if not exists validating_agent varchar(60),
  -- Guardrail 25: la evidencia caduca.
  add column if not exists evidence_reviewed_at timestamptz;

-- El vocabulario de estados de D00 se sustituye por el del apartado 3.
alter table public.diagnostic_hypotheses drop constraint if exists diagnostic_hypotheses_status;
alter table public.diagnostic_hypotheses drop constraint if exists diagnostic_hypotheses_estado;
alter table public.diagnostic_hypotheses add constraint diagnostic_hypotheses_estado check (
  status in (
    'untested','under_test','supported','weakly_supported','partially_supported',
    'most_likely','contradicted','invalidated','confirmed','inconclusive'
  )
);
alter table public.diagnostic_hypotheses alter column status set default 'untested';

-- El motivo se exige ahora en los dos estados que cierran la puerta.
alter table public.diagnostic_hypotheses drop constraint if exists diagnostic_hypotheses_rechazo_motivado;
alter table public.diagnostic_hypotheses add constraint diagnostic_hypotheses_rechazo_motivado check (
  status not in ('invalidated','contradicted') or rejection_reason is not null
);

alter table public.diagnostic_hypotheses
  drop constraint if exists diagnostic_hypotheses_tipo,
  drop constraint if exists diagnostic_hypotheses_confianza,
  drop constraint if exists diagnostic_hypotheses_prior,
  drop constraint if exists diagnostic_hypotheses_cobertura,
  drop constraint if exists diagnostic_hypotheses_rol,
  drop constraint if exists diagnostic_hypotheses_separacion,
  drop constraint if exists diagnostic_hypotheses_momento,
  drop constraint if exists diagnostic_hypotheses_profundidad,
  drop constraint if exists diagnostic_hypotheses_scope,
  drop constraint if exists diagnostic_hypotheses_familia,
  drop constraint if exists diagnostic_hypotheses_causal_exige_ruta,
  drop constraint if exists diagnostic_hypotheses_confirmar_cuesta,
  drop constraint if exists diagnostic_hypotheses_alta_exige_separacion,
  drop constraint if exists diagnostic_hypotheses_primaria_se_explica,
  drop constraint if exists diagnostic_hypotheses_cobertura_vs_residual,
  drop constraint if exists diagnostic_hypotheses_parcial_sigue_parcial,
  drop constraint if exists diagnostic_hypotheses_candidata_no_es_raiz,
  drop constraint if exists diagnostic_hypotheses_incertidumbre_catalogo,
  drop constraint if exists diagnostic_hypotheses_localizada;

alter table public.diagnostic_hypotheses
  add constraint diagnostic_hypotheses_tipo check (hypothesis_type in (
    'direct_cause','contributory_cause','root_cause_candidate','contextual_explanation',
    'data_quality_explanation','structural_explanation','external_explanation','interaction_hypothesis'
  )),
  add constraint diagnostic_hypotheses_confianza check (
    confidence in ('high','medium','low','insufficient')
  ),
  add constraint diagnostic_hypotheses_prior check (
    prior_plausibility in ('high','medium','low','unknown')
  ),
  add constraint diagnostic_hypotheses_cobertura check (
    explanatory_coverage in ('full','partial','minimal','unknown')
  ),
  add constraint diagnostic_hypotheses_rol check (
    relative_role is null or relative_role in ('primary','secondary','alternative','challenger')
  ),
  add constraint diagnostic_hypotheses_separacion check (separation in ('high','low','unknown')),
  add constraint diagnostic_hypotheses_momento check (
    cause_timing is null or cause_timing in ('acute','structural')
  ),
  add constraint diagnostic_hypotheses_profundidad check (
    cause_depth is null or cause_depth in ('immediate','underlying')
  ),
  add constraint diagnostic_hypotheses_scope check (scope in (
    'business','capability','subcapability','channel','market','product','segment'
  )),
  add constraint diagnostic_hypotheses_familia check (family is null or family in (
    'acquisition','creative','conversion','offer','product','retention',
    'inventory','operations','financial','data','technology','team','strategy','cross_capability'
  )),

  -- Guardrail 19: sin ruta causal valida en D07, la candidata se descarta.
  -- Inventar una causa sin camino por el que llegue es lo que este bloque
  -- existe para impedir.
  add constraint diagnostic_hypotheses_causal_exige_ruta check (
    hypothesis_type not in ('direct_cause','contributory_cause','root_cause_candidate')
    or source_path_id is not null
  ),

  -- Guardrail 32: confirmar tiene que costar. Y el 60: hay que decir que la
  -- falsaria.
  add constraint diagnostic_hypotheses_confirmar_cuesta check (
    status <> 'confirmed'
    or (confidence = 'high' and falsification_condition is not null and separation = 'high')
  ),

  -- Guardrails 12 y 34: confianza alta exige haber separado de las
  -- alternativas y poder decir por que pierden.
  add constraint diagnostic_hypotheses_alta_exige_separacion check (
    confidence <> 'high' or (separation = 'high' and why_alternatives_lose is not null)
  ),

  -- Guardrails 57 a 60: la hipotesis primaria explica por que gana, por que
  -- pierden las otras y que la falsaria.
  add constraint diagnostic_hypotheses_primaria_se_explica check (
    relative_role <> 'primary'
    or (why_it_wins is not null and why_alternatives_lose is not null
        and falsification_condition is not null)
  ),

  -- Guardrail 36: no se afirma explicacion completa con residual material.
  add constraint diagnostic_hypotheses_cobertura_vs_residual check (
    explanatory_coverage <> 'full' or not unexplained_residual_material
  ),

  -- Guardrail 37: una causa parcial se queda parcial.
  add constraint diagnostic_hypotheses_parcial_sigue_parcial check (
    hypothesis_type <> 'contributory_cause' or explanatory_coverage <> 'full'
  ),

  -- Guardrail 4 y 45: candidata a raiz no es raiz, y quien decide es D09. Lo
  -- unico que se puede exigir aqui es que una candidata diga que la falsaria.
  add constraint diagnostic_hypotheses_candidata_no_es_raiz check (
    not root_cause_candidate or falsification_condition is not null
  ),

  add constraint diagnostic_hypotheses_incertidumbre_catalogo check (
    uncertainty_kinds <@ array['data','model','context','causal']::text[]
  ),

  add constraint diagnostic_hypotheses_localizada check (
    scope = 'business' or scope_detail <> '{}'::jsonb
  );

comment on column public.diagnostic_hypotheses.root_cause_candidate is
  'Guardrail 4: CANDIDATA A RAIZ != RAIZ. No existe columna `root_cause` en ninguna tabla '
  'de la fase: decidirla es D09.';

comment on column public.diagnostic_hypotheses.separation is
  'Apartado 12. Poca separacion respecto de las alternativas limita la confianza, aunque '
  'la evidencia a favor sea buena: si dos explicaciones encajan igual de bien, elegir una '
  'es preferencia, no diagnostico.';

create index if not exists diagnostic_hypotheses_org_idx
  on public.diagnostic_hypotheses (organization_id, status);
create index if not exists diagnostic_hypotheses_ruta_idx
  on public.diagnostic_hypotheses (source_path_id);

-- ---------------------------------------------------------------------------
-- 2. La evidencia, ampliada (apartado 5 y guardrails 5, 20 a 25)
-- ---------------------------------------------------------------------------

alter table public.diagnostic_evidence
  -- Guardrail 5, hecho columna. No haber mirado no es haber visto que no pasa.
  add column if not exists observation_kind varchar(20) not null default 'observed_present',
  -- Guardrails 21 y 22: dos lecturas del mismo sitio no son dos fuentes.
  add column if not exists source_system varchar(40),
  add column if not exists independent boolean not null default false,
  add column if not exists independence_rationale text,
  add column if not exists directness varchar(16) not null default 'indirect',
  add column if not exists specificity varchar(16) not null default 'unknown',
  -- Guardrail 25: la evidencia rancia se degrada.
  add column if not exists observed_at timestamptz,
  add column if not exists freshness varchar(16) not null default 'unknown',
  add column if not exists contradiction_strength varchar(16);

alter table public.diagnostic_evidence
  drop constraint if exists diagnostic_evidence_observacion,
  drop constraint if exists diagnostic_evidence_directness,
  drop constraint if exists diagnostic_evidence_especificidad,
  drop constraint if exists diagnostic_evidence_frescura,
  drop constraint if exists diagnostic_evidence_fuerza_contradiccion,
  drop constraint if exists diagnostic_evidence_independencia_razonada,
  drop constraint if exists diagnostic_evidence_no_observado_no_contradice;

alter table public.diagnostic_evidence
  add constraint diagnostic_evidence_observacion check (
    observation_kind in ('observed_present','observed_absent','not_observed')
  ),
  add constraint diagnostic_evidence_directness check (
    directness in ('direct','indirect','proxy')
  ),
  add constraint diagnostic_evidence_especificidad check (
    specificity in ('specific','ambiguous','unknown')
  ),
  add constraint diagnostic_evidence_frescura check (
    freshness in ('fresh','aging','stale','unknown')
  ),
  add constraint diagnostic_evidence_fuerza_contradiccion check (
    contradiction_strength is null or contradiction_strength in ('strong','moderate','weak')
  ),
  -- Guardrail 22: decir que una fuente es independiente obliga a decir por que.
  add constraint diagnostic_evidence_independencia_razonada check (
    not independent or independence_rationale is not null
  ),
  -- Guardrail 5: lo que no se ha mirado no puede contradecir nada.
  add constraint diagnostic_evidence_no_observado_no_contradice check (
    observation_kind <> 'not_observed' or contradiction_strength is null
  );

comment on column public.diagnostic_evidence.observation_kind is
  'Guardrail 5: NO OBSERVADO != OBSERVADO AUSENTE. `not_observed` significa que nadie ha '
  'mirado; `observed_absent`, que se miro y no estaba. Confundirlos es como una hipotesis '
  'sobrevive a una comprobacion que nunca se hizo.';

-- Apartado 4: la evidencia que discrimina entre hipotesis es una categoria
-- propia, no un "apoya" mas.
alter table public.diagnostic_hypothesis_evidence
  drop constraint if exists diagnostic_hypothesis_evidence_relation;
alter table public.diagnostic_hypothesis_evidence
  add constraint diagnostic_hypothesis_evidence_relation check (
    relation in ('supports','contradicts','discriminates','inconclusive')
  );

-- ---------------------------------------------------------------------------
-- 3. Tests diagnosticos (apartados 7 y 8, guardrails 46 a 50)
-- ---------------------------------------------------------------------------

create table if not exists public.hypothesis_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hypothesis_id uuid not null references public.diagnostic_hypotheses (id) on delete cascade,

  diagnostic_question text not null,
  required_data text,
  -- Guardrail 17: si no se puede decir que se esperaria en cada caso, la
  -- hipotesis no es falsable y el test no discrimina nada.
  expected_if_true text not null,
  expected_if_false text not null,

  information_gain varchar(12) not null default 'unknown',
  cost varchar(12) not null default 'unknown',
  latency varchar(12) not null default 'unknown',
  availability varchar(20) not null default 'unknown',
  intrusiveness varchar(12) not null default 'unknown',
  -- Guardrail 46: primero los datos del sistema, luego preguntarle a nadie.
  mode varchar(12) not null default 'passive',

  status varchar(16) not null default 'proposed',
  result text,
  interpretation text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hypothesis_tests_ganancia check (
    information_gain in ('high','medium','low','unknown')
  ),
  constraint hypothesis_tests_coste check (cost in ('high','medium','low','unknown')),
  constraint hypothesis_tests_latencia check (latency in ('high','medium','low','unknown')),
  constraint hypothesis_tests_disponibilidad check (
    availability in ('available','needs_user','needs_integration','unavailable','unknown')
  ),
  constraint hypothesis_tests_intrusion check (
    intrusiveness in ('none','low','medium','high','unknown')
  ),
  constraint hypothesis_tests_modo check (mode in ('passive','active')),
  constraint hypothesis_tests_estado check (
    status in ('proposed','running','done','skipped','blocked')
  ),
  -- Un test hecho sin resultado ni interpretacion no es un test hecho.
  constraint hypothesis_tests_hecho_tiene_resultado check (
    status <> 'done' or (result is not null and interpretation is not null)
  ),
  -- Guardrail 47: no se le pide al usuario un dato que ya esta en el sistema.
  constraint hypothesis_tests_no_preguntar_lo_que_ya_hay check (
    availability <> 'available' or mode = 'passive'
  ),
  -- Guardrails 17 y 18: los dos lados de la prediccion tienen que decir algo.
  constraint hypothesis_tests_prediccion_util check (
    length(btrim(expected_if_true)) >= 10 and length(btrim(expected_if_false)) >= 10
  )
);

comment on table public.hypothesis_tests is
  'F3/D08 apartados 7 y 8. Un test DIAGNOSTICO: sirve para distinguir entre hipotesis. '
  'El guardrail 50 y el principio 8 lo dicen entero: un test diagnostico no autoriza una '
  'accion de negocio, y por eso aqui no hay ninguna columna que se parezca a una accion.';

create index if not exists hypothesis_tests_hipotesis_idx
  on public.hypothesis_tests (hypothesis_id, status);

drop trigger if exists set_hypothesis_tests_updated_at on public.hypothesis_tests;
create trigger set_hypothesis_tests_updated_at before update on public.hypothesis_tests
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. El historial de la hipotesis (apartado 21, guardrail 54)
-- ---------------------------------------------------------------------------

create table if not exists public.hypothesis_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hypothesis_id uuid not null references public.diagnostic_hypotheses (id) on delete cascade,

  from_status varchar(24),
  to_status varchar(24) not null,
  reason text not null,
  -- Guardrail 53: la calibracion por agente necesita saber quien movio que.
  actor varchar(60),
  evidence_added text[] not null default '{}',

  changed_at timestamptz not null default now(),

  constraint hypothesis_status_history_estado check (
    to_status in (
      'untested','under_test','supported','weakly_supported','partially_supported',
      'most_likely','contradicted','invalidated','confirmed','inconclusive'
    )
  )
);

comment on table public.hypothesis_status_history is
  'F3/D08 apartado 21 y guardrail 54: las hipotesis rechazadas no se borran, y el camino '
  'por el que una llego a su estado es parte del diagnostico. Sin esto, calibrar a los '
  'agentes (guardrail 53) es imposible: no se sabria quien acerto ni quien insistio.';

create index if not exists hypothesis_status_history_hipotesis_idx
  on public.hypothesis_status_history (hypothesis_id, changed_at);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.hypothesis_tests enable row level security;
alter table public.hypothesis_status_history enable row level security;

drop policy if exists "hypothesis_tests_select_staff" on public.hypothesis_tests;
create policy "hypothesis_tests_select_staff" on public.hypothesis_tests
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "hypothesis_status_history_select_staff" on public.hypothesis_status_history;
create policy "hypothesis_status_history_select_staff" on public.hypothesis_status_history
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );
