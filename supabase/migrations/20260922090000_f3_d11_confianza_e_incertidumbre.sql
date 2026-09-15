-- FASE 3 / D11 — Confianza e incertidumbre.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d11-requisitos-contrato-confianza-incertidumbre.md
--          conocimiento/fase-03/04-policies-guardrails/d11-guardrails-confianza-incertidumbre.md
--          conocimiento/fase-03/03-runtime/d11-flujo-evaluacion-confianza-incertidumbre.md
--          conocimiento/fase-03/06-tenant-context/d11-contexto-confianza-incertidumbre.md
--          conocimiento/fase-03/05-experience-learning/d11-calibracion-historica-confianza.md
--
-- El bloque que audita a todos los anteriores. D01 a D10 llevan diez migraciones
-- declarando `confidence` campo a campo; D11 es el que dice si esa confianza
-- esta bien puesta, de donde sale y que la limita.
--
-- NO HAY NINGUN NUMERO. En todo el bloque existe **una sola columna numerica**,
-- `retrieval_similarity`, y esta en la unica tabla que no decide nada sobre el
-- negocio. El guardrail 36 prohibe convertir la incertidumbre en un porcentaje
-- opaco y el apartado 149 del corpus prohibe literalmente "Confianza: 75%".
-- La garantia es que no hay donde escribirlo: no existe `confidence_score`, ni
-- `probability`, ni `certainty_pct`. Hay un test.
--
-- NO HAY CONFIANZA SIN CLAIM (apartado 17, guardrail 3, apartado 94 del
-- corpus). `claim` y `target_question` son obligatorios: una confianza que no
-- dice de que afirmacion habla no se puede auditar, y es exactamente la etiqueta
-- global que el bloque existe para impedir. La misma evidencia sostiene una
-- pregunta con confianza alta y otra con confianza baja (apartado 91).
--
-- UN CAP QUE NO BAJA EL NIVEL NO ES UN CAP (apartado 5, guardrails 16 a 20).
-- `confidence_caps` guarda de donde viene el techo y por que, y un trigger
-- mantiene `capped_at` en el claim como el mas restrictivo de sus caps. El
-- check no deja que el nivel supere ese techo. Sin eso, un cap seria un
-- comentario.
--
-- CONFIANZA != COMPLETITUD (guardrail 4). Dos columnas con dos vocabularios
-- distintos, y ninguna se deriva de la otra: se puede estar muy seguro de una
-- explicacion parcial, y se puede tener una explicacion completa de algo medido
-- con datos malos (apartados 85, 255 y 256).
--
-- NO HABER VISTO UN PROBLEMA NO ES HABER VISTO QUE NO LO HAY (guardrail 8,
-- apartado 233). `negative_claim_state` tiene tres valores y no dos:
-- `no_evidence`, `evidence_of_no_problem` y `evidence_of_stability`. Afirmar
-- estabilidad exige declarar cobertura y que la medicion sea fiable (29, 31).
--
-- SIMILARITY NO ES VERDAD DE NEGOCIO (guardrails 5, 6, 39 a 42). La confianza
-- de recuperacion vive en **otra tabla** que la confianza del diagnostico, para
-- que no se puedan leer como el mismo numero. Y la applicability alta exige
-- haberlo validado contra el caso: el parecido de un vector no valida nada.
--
-- LOS UNKNOWN UNKNOWNS NO SE MODELAN, Y ESO ES DELIBERADO (apartado 8,
-- guardrail 38). Solo existe `is_known_unknown`. Fingir un catalogo de lo que
-- no se sabe que no se sabe seria justo la sobreconfianza que el bloque
-- combate; lo que queda en su lugar son los caps y la obligacion de declarar
-- limitaciones.
--
-- LO QUE NO ESTA AQUI: ninguna formula de agregacion de confianza, ningun
-- modelo bayesiano, ningun umbral numerico y ninguna funcion de decay (apartado
-- 29 y guardrail 49: el decay es especifico del dominio, no universal). Y
-- tampoco prioridad ni accion (guardrails 57 y 58).

-- ---------------------------------------------------------------------------
-- 1. La matriz de confianza: una fila por claim (apartados 1, 16, 17)
-- ---------------------------------------------------------------------------

create table if not exists public.claim_confidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,

  -- Apartado 16 y 150 del corpus: la confianza es distinta en cada capa. La
  -- existencia del problema puede ser alta y la causa raiz media a la vez.
  claim_layer varchar(20) not null,
  -- A que fila de D05-D10 se refiere, cuando se refiere a una.
  subject_kind varchar(24),
  subject_id uuid,

  -- Apartado 17 y 94: **no hay confianza sin claim**. Las dos son obligatorias.
  claim text not null,
  target_question text not null,

  -- Apartado 3 y guardrail 21: los estados no son equivalentes y no se aplanan.
  epistemic_state varchar(16) not null default 'unknown',
  confidence_level varchar(20) not null default 'insufficient_data',

  -- Guardrails 25, 27 y 28: la separacion frente a las alternativas que
  -- sobreviven es lo que deja subir a alta, no cuantas hay (apartado 78).
  alternative_separation varchar(20) not null default 'unknown',
  -- Guardrails 12 y 27: las contradicciones se preservan, no se resuelven
  -- bajando la voz.
  contradiction_level varchar(20) not null default 'none',

  -- Guardrail 4 y apartado 85: confianza y completitud son dos cosas.
  completeness varchar(16) not null default 'partial',
  explanatory_coverage varchar(20) not null default 'unknown',

  -- Apartado 21 y guardrail 8.
  negative_claim_state varchar(24),
  coverage_declared text,

  -- Apartado 5: el techo efectivo, que mantiene el trigger de mas abajo.
  capped_at varchar(20),
  cap_reason text,

  -- Apartado 19 y guardrails 48 a 51. **Sin formula de decay**: el dominio dice
  -- cuanto dura la evidencia, no una constante global.
  assessed_at timestamptz not null default now(),
  recency_domain varchar(24),
  is_stale boolean not null default false,
  decay_reason text,

  -- Apartado 23: que evidencia haria subir esto.
  desired_level varchar(20),
  missing_evidence text,
  next_evidence_required text,

  -- Guardrails 52 y 53: cuanto mas cuesta equivocarse, mas conservador el
  -- reporte -- pero una confianza baja no puede tapar un riesgo serio.
  error_cost varchar(16) not null default 'unknown',

  -- Apartados 25 y 26, guardrails 34 y 35: especificas, no plantilla.
  assumptions text,
  limitations text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint claim_confidence_capa check (claim_layer in (
    'what','where','measurement','signal','symptom','why','root_cause',
    'constraint','current_impact','future_impact','severity','forecast','overall'
  )),
  constraint claim_confidence_sujeto check (subject_kind is null or subject_kind in (
    'signal','symptom','causal_path','hypothesis','root_cause','business_constraint',
    'severity_assessment','impact_measurement','capability_health','data_quality'
  )),
  -- Apartado 3.
  constraint claim_confidence_estado check (epistemic_state in (
    'observed','derived','inferred','hypothesized','confirmed','unknown'
  )),
  -- Apartado 2.
  constraint claim_confidence_nivel check (
    confidence_level in ('high','medium','low','insufficient_data')
  ),
  constraint claim_confidence_separacion check (
    alternative_separation in ('strong','moderate','weak','none','not_applicable','unknown')
  ),
  constraint claim_confidence_contradiccion check (
    contradiction_level in ('none','immaterial','material','decisive')
  ),
  -- Apartado 15.
  constraint claim_confidence_completitud check (
    completeness in ('complete_enough','partial','incomplete')
  ),
  constraint claim_confidence_cobertura check (
    explanatory_coverage in ('full','partial','minimal','unknown')
  ),
  constraint claim_confidence_negativo check (negative_claim_state is null or negative_claim_state in (
    'no_evidence','evidence_of_no_problem','evidence_of_stability'
  )),
  constraint claim_confidence_techo check (
    capped_at is null or capped_at in ('high','medium','low','insufficient_data')
  ),
  constraint claim_confidence_deseado check (
    desired_level is null or desired_level in ('high','medium','low','insufficient_data')
  ),
  constraint claim_confidence_coste_error check (
    error_cost in ('low','moderate','high','severe','unknown')
  ),
  constraint claim_confidence_recencia check (recency_domain is null or recency_domain in (
    'payments','ads','traffic','conversion','inventory','fulfillment','finance',
    'retention','brand','technology'
  )),

  -- Apartado 5: **un cap que no baja el nivel no es un cap.**
  constraint claim_confidence_el_techo_manda check (
    capped_at is null
    or (case confidence_level
          when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end)
       <= (case capped_at
          when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end)
  ),
  constraint claim_confidence_techo_se_motiva check (
    capped_at is null or cap_reason is not null
  ),

  -- Guardrail 25: con separacion debil no se llega a alta. El apartado 78 dice
  -- que lo que importa no es cuantas alternativas hay, sino la fuerza de las
  -- que sobreviven -- por eso `not_applicable` tambien vale.
  constraint claim_confidence_separacion_debil_no_sube check (
    confidence_level <> 'high'
    or alternative_separation in ('strong','not_applicable')
  ),

  -- Guardrail 12 y apartado 73: una contradiccion material o decisiva no
  -- convive con confianza alta.
  constraint claim_confidence_contradiccion_no_sube check (
    confidence_level <> 'high' or contradiction_level in ('none','immaterial')
  ),

  -- Guardrail 23 y apartado 51: CONFIRMED exige validacion suficiente. Y el 2:
  -- alta no es certeza absoluta, asi que confirmado no exime de limitaciones.
  constraint claim_confidence_confirmado_se_valida check (
    epistemic_state <> 'confirmed'
    or (confidence_level = 'high' and limitations is not null)
  ),

  -- Guardrail 24: una suposicion no se presenta como un hecho.
  constraint claim_confidence_hipotesis_no_es_observacion check (
    epistemic_state <> 'hypothesized' or confidence_level <> 'high'
  ),

  -- Guardrail 22 y 60: `unknown` es una salida valida, pero es una salida --
  -- no puede ir con una confianza que afirme algo.
  constraint claim_confidence_no_saber_es_no_saber check (
    epistemic_state <> 'unknown' or confidence_level = 'insufficient_data'
  ),

  -- Guardrails 29 y 31, apartado 231: afirmar que no hay problema exige haber
  -- mirado, y afirmar estabilidad exige ademas medicion completa.
  constraint claim_confidence_ausencia_exige_cobertura check (
    negative_claim_state is null
    or negative_claim_state = 'no_evidence'
    or coverage_declared is not null
  ),
  constraint claim_confidence_estabilidad_exige_medicion check (
    negative_claim_state is distinct from 'evidence_of_stability'
    or (completeness = 'complete_enough' and epistemic_state in ('observed','derived'))
  ),

  -- Guardrail 30: si faltan datos, la afirmacion negativa es `no_evidence`.
  constraint claim_confidence_sin_datos_es_sin_evidencia check (
    confidence_level <> 'insufficient_data'
    or negative_claim_state is null
    or negative_claim_state = 'no_evidence'
  ),

  -- Apartado 23: pedir mas confianza sin decir que falta no es un plan.
  constraint claim_confidence_mejora_dice_que_falta check (
    desired_level is null or missing_evidence is not null
  ),

  -- Guardrails 34 y 35: una limitacion de plantilla no es una limitacion.
  constraint claim_confidence_limitacion_concreta check (
    limitations is null or length(btrim(limitations)) >= 25
  ),

  -- Guardrail 48: si se marca caducada, hay que decir por que.
  constraint claim_confidence_caducidad_se_explica check (
    not is_stale or decay_reason is not null
  ),

  -- Apartado 17: un claim vacio no es un claim.
  constraint claim_confidence_claim_dice_algo check (
    length(btrim(claim)) >= 10 and length(btrim(target_question)) >= 10
  ),

  constraint claim_confidence_unico unique (case_id, claim_layer, subject_id, claim)
);

comment on table public.claim_confidence is
  'F3/D11 apartados 1, 16 y 17. **No hay confianza sin claim**: `claim` y `target_question` son '
  'obligatorios porque una confianza global desligada de una afirmacion no se puede auditar '
  '(apartado 94). Y **no hay ninguna columna numerica**: ni score, ni probabilidad, ni '
  'porcentaje. El guardrail 36 y el apartado 149 prohiben "Confianza: 75%", y la garantia es '
  'que no cabe.';

comment on column public.claim_confidence.capped_at is
  'Apartado 5 y guardrails 16 a 20. El techo efectivo, que mantiene el trigger a partir de '
  '`confidence_caps`. El check impide que el nivel lo supere: **un cap que no baja el nivel no '
  'es un cap**, es un comentario.';

comment on column public.claim_confidence.completeness is
  'Guardrail 4 y apartado 85. Vocabulario distinto del de `confidence_level` a proposito: se '
  'puede estar muy seguro de una explicacion parcial, y se puede explicar del todo algo medido '
  'con datos malos. Ninguna se deriva de la otra.';

comment on column public.claim_confidence.negative_claim_state is
  'Apartado 21 y guardrail 8. Tres valores y no dos: no haber visto un problema (`no_evidence`) '
  'no es haber visto que no lo hay (`evidence_of_no_problem`) ni haber medido que esta estable '
  '(`evidence_of_stability`).';

create index if not exists claim_confidence_caso_idx
  on public.claim_confidence (case_id, claim_layer);
create index if not exists claim_confidence_org_idx
  on public.claim_confidence (organization_id, confidence_level);
create index if not exists claim_confidence_sujeto_idx
  on public.claim_confidence (subject_kind, subject_id);

drop trigger if exists set_claim_confidence_updated_at on public.claim_confidence;
create trigger set_claim_confidence_updated_at before update on public.claim_confidence
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. De donde sale la confianza (apartado 4, apartado 30 del corpus)
-- ---------------------------------------------------------------------------

create table if not exists public.confidence_dimensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  claim_id uuid not null references public.claim_confidence (id) on delete cascade,

  dimension varchar(24) not null,
  rating varchar(16) not null,
  -- Apartado 30: los insumos de la confianza tienen que verse. Una dimension
  -- puntuada sin decir por que no explica nada.
  reason text not null,

  created_at timestamptz not null default now(),

  -- Apartado 4, menos las dos que son puerta y viven en el claim
  -- (`alternative_separation` y `contradiction_level`): cada cosa en un sitio.
  constraint confidence_dimensions_dimension check (dimension in (
    'data_reliability','data_coverage','context_quality','sample_sufficiency',
    'temporal_fit','scope_fit','mechanism_strength','evidence_consistency',
    'evidence_independence','missing_evidence'
  )),
  constraint confidence_dimensions_valor check (
    rating in ('strong','adequate','weak','absent','unknown')
  ),
  constraint confidence_dimensions_motivo check (length(btrim(reason)) >= 15),
  constraint confidence_dimensions_unico unique (claim_id, dimension)
);

comment on table public.confidence_dimensions is
  'F3/D11 apartado 4 y apartado 30 del corpus: los insumos de la confianza tienen que verse. '
  '`reason` es obligatorio -- una dimension puntuada sin decir por que no explica nada. Las dos '
  'dimensiones que son puerta para llegar a alta (separacion frente a alternativas y nivel de '
  'contradiccion) viven en la fila del claim, no aqui, para que cada cosa tenga un solo sitio.';

create index if not exists confidence_dimensions_claim_idx
  on public.confidence_dimensions (claim_id);

-- ---------------------------------------------------------------------------
-- 3. Los techos (apartado 5, guardrails 16 a 20)
-- ---------------------------------------------------------------------------

create table if not exists public.confidence_caps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  claim_id uuid not null references public.claim_confidence (id) on delete cascade,

  cap_source varchar(28) not null,
  capped_level varchar(20) not null,
  reason text not null,

  created_at timestamptz not null default now(),

  constraint confidence_caps_origen check (cap_source in (
    'data_quality','insufficient_coverage','weak_temporal_fit','scope_mismatch',
    'external_cause_unobserved','inadequate_horizon','broad_structural_claim',
    'measurement_change','sample_too_small','dependent_evidence','stale_knowledge'
  )),
  constraint confidence_caps_nivel check (
    capped_level in ('high','medium','low','insufficient_data')
  ),
  constraint confidence_caps_motivo check (length(btrim(reason)) >= 20),
  constraint confidence_caps_unico unique (claim_id, cap_source)
);

comment on table public.confidence_caps is
  'F3/D11 apartado 5, guardrails 16 a 20. Un techo con su origen y su motivo. El trigger de '
  'abajo lo propaga a `claim_confidence.capped_at` como el mas restrictivo, y alli un check '
  'impide que el nivel lo supere.';

create index if not exists confidence_caps_claim_idx on public.confidence_caps (claim_id);

-- El cap tiene que morder. Sin esto seria un comentario al margen.
create or replace function private.claim_confidence_aplica_cap()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_claim uuid := coalesce(new.claim_id, old.claim_id);
  v_techo varchar(20);
  v_motivo text;
begin
  select c.capped_level, c.reason into v_techo, v_motivo
  from public.confidence_caps c
  where c.claim_id = v_claim
  order by case c.capped_level
             when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end asc,
           c.created_at asc
  limit 1;

  update public.claim_confidence cc
     set capped_at = v_techo,
         cap_reason = case when v_techo is null then null
                           else coalesce(cc.cap_reason, v_motivo) end,
         -- El techo baja el nivel si hace falta. Un cap que no baja nada no es
         -- un cap (apartado 5).
         confidence_level = case
           when v_techo is null then cc.confidence_level
           when (case cc.confidence_level
                   when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end)
              > (case v_techo
                   when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end)
           then v_techo
           else cc.confidence_level
         end
   where cc.id = v_claim;

  return null;
end;
$$;

comment on function private.claim_confidence_aplica_cap() is
  'F3/D11 apartado 5. Propaga el cap mas restrictivo al claim y baja el nivel si lo supera. '
  'Es lo que convierte un techo declarado en un techo real.';

drop trigger if exists claim_confidence_aplica_cap on public.confidence_caps;
create trigger claim_confidence_aplica_cap
after insert or update or delete on public.confidence_caps
for each row execute function private.claim_confidence_aplica_cap();

-- ---------------------------------------------------------------------------
-- 4. Lo que no se sabe (apartados 6 a 10)
-- ---------------------------------------------------------------------------

create table if not exists public.diagnostic_uncertainties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  claim_id uuid references public.claim_confidence (id) on delete cascade,

  uncertainty_type varchar(24) not null,
  -- Guardrails 34 y 35: especifica, no plantilla.
  description text not null,
  materiality varchar(20) not null default 'material',
  -- Apartado 8: solo existe el known unknown. Lo otro no se puede enumerar sin
  -- fingir que se conoce, que es justo la sobreconfianza que D11 combate.
  is_known_unknown boolean not null default true,
  resolvability varchar(20) not null default 'with_new_data',
  required_evidence text,
  confidence_impact text,

  resolved_at timestamptz,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diagnostic_uncertainties_tipo check (uncertainty_type in (
    'data','context','measurement','model','causal','scope','temporal',
    'impact','forecast','knowledge'
  )),
  constraint diagnostic_uncertainties_materialidad check (
    materiality in ('low','material','high','critical_unknown')
  ),
  constraint diagnostic_uncertainties_resolubilidad check (
    resolvability in ('resolvable_now','with_new_data','over_time','not_resolvable')
  ),
  -- Guardrail 34: el boilerplate no informa. Una descripcion de tres palabras
  -- es boilerplate por construccion.
  constraint diagnostic_uncertainties_descripcion_concreta check (
    length(btrim(description)) >= 25
  ),
  -- Guardrail 33: un critical unknown no se deja caer sin decir que lo
  -- resolveria ni a que claim afecta.
  constraint diagnostic_uncertainties_critico_se_afronta check (
    materiality <> 'critical_unknown'
    or (required_evidence is not null and claim_id is not null)
  ),
  -- Lo que no tiene solucion no puede pedir evidencia para resolverse.
  constraint diagnostic_uncertainties_irresoluble_no_pide_datos check (
    resolvability <> 'not_resolvable' or required_evidence is null
  ),
  constraint diagnostic_uncertainties_resuelta_se_explica check (
    resolved_at is null or resolution_note is not null
  )
);

comment on table public.diagnostic_uncertainties is
  'F3/D11 apartados 6 a 10. **Solo existe `is_known_unknown`**: el apartado 8 dice que los '
  'unknown unknowns no se pueden modelar de forma exhaustiva, y fingir su catalogo seria la '
  'sobreconfianza que el bloque combate. Lo que queda en su lugar son los caps y la obligacion '
  'de declarar limitaciones (guardrail 38).';

create index if not exists diagnostic_uncertainties_caso_idx
  on public.diagnostic_uncertainties (case_id, materiality);
create index if not exists diagnostic_uncertainties_claim_idx
  on public.diagnostic_uncertainties (claim_id);

drop trigger if exists set_diagnostic_uncertainties_updated_at on public.diagnostic_uncertainties;
create trigger set_diagnostic_uncertainties_updated_at
before update on public.diagnostic_uncertainties
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Por que cambio la confianza (apartado 18, memoria apartado 1)
-- ---------------------------------------------------------------------------

create table if not exists public.confidence_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  claim_id uuid not null references public.claim_confidence (id) on delete cascade,

  previous_level varchar(20),
  new_level varchar(20) not null,
  previous_state varchar(16),
  new_state varchar(16),
  -- Apartado 120 del corpus: "por que cambio" es la mitad del valor del
  -- historico. Un cambio sin motivo no es auditable.
  reason text not null,
  evidence_ref text,

  changed_at timestamptz not null default now(),

  constraint confidence_history_nivel_previo check (
    previous_level is null or previous_level in ('high','medium','low','insufficient_data')
  ),
  constraint confidence_history_nivel_nuevo check (
    new_level in ('high','medium','low','insufficient_data')
  ),
  constraint confidence_history_estado_previo check (previous_state is null or previous_state in (
    'observed','derived','inferred','hypothesized','confirmed','unknown'
  )),
  constraint confidence_history_estado_nuevo check (new_state is null or new_state in (
    'observed','derived','inferred','hypothesized','confirmed','unknown'
  )),
  constraint confidence_history_motivo check (length(btrim(reason)) >= 20),
  -- Un "cambio" que no cambia nada no es una entrada de historico.
  constraint confidence_history_algo_cambio check (
    previous_level is distinct from new_level
    or previous_state is distinct from new_state
  )
);

comment on table public.confidence_history is
  'F3/D11 apartado 18 y apartado 120 del corpus. `reason` es obligatorio: saber que la '
  'confianza bajo sin saber por que no sirve para calibrar nada, que es justo para lo que F9 '
  'va a leer esta tabla.';

create index if not exists confidence_history_claim_idx
  on public.confidence_history (claim_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 6. El conocimiento recuperado (apartado 20, guardrails 5, 6 y 39 a 42)
-- ---------------------------------------------------------------------------

create table if not exists public.knowledge_applicability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  claim_id uuid not null references public.claim_confidence (id) on delete cascade,

  source_ref text not null,
  source_authority varchar(20) not null default 'unknown',
  source_version varchar(40),
  source_updated_at timestamptz,

  -- **La unica columna numerica del bloque**, y esta aqui a proposito: en la
  -- tabla que no decide nada sobre el negocio (guardrail 6).
  retrieval_similarity numeric,

  applicability varchar(20) not null default 'unknown',
  -- Guardrail 39: el parecido no prueba que aplique. Validarlo contra el caso
  -- si, y es lo unico que deja subir a `high`.
  validated_against_case boolean not null default false,
  validation_note text,
  is_stale boolean not null default false,

  created_at timestamptz not null default now(),

  constraint knowledge_applicability_autoridad check (
    source_authority in ('canonical','expert','community','unverified','unknown')
  ),
  constraint knowledge_applicability_aplicabilidad check (
    applicability in ('high','medium','low','not_applicable','unknown')
  ),
  constraint knowledge_applicability_similitud check (
    retrieval_similarity is null
    or (retrieval_similarity >= 0 and retrieval_similarity <= 1)
  ),
  -- Guardrails 6, 39 y 40: ni el parecido ni la autoridad de la fuente hacen
  -- aplicable algo. Solo haberlo comprobado contra este caso.
  constraint knowledge_applicability_alta_se_valida check (
    applicability <> 'high' or validated_against_case
  ),
  constraint knowledge_applicability_validacion_se_escribe check (
    not validated_against_case or validation_note is not null
  ),
  -- Guardrail 41: lo caducado no puede ser muy aplicable.
  constraint knowledge_applicability_caduco_no_aplica_fuerte check (
    not is_stale or applicability in ('low','not_applicable','unknown')
  ),
  constraint knowledge_applicability_unico unique (claim_id, source_ref)
);

comment on table public.knowledge_applicability is
  'F3/D11 apartado 20 y guardrails 5, 6 y 39 a 42. **Tabla separada a proposito**: la confianza '
  'de recuperacion no es la confianza del diagnostico, y tenerlas en la misma fila terminaria '
  'con alguien leyendolas como el mismo numero. Aqui esta la unica columna numerica del bloque, '
  '`retrieval_similarity`, y el check impide que por si sola haga nada: para que algo sea muy '
  'aplicable hay que haberlo validado contra el caso.';

comment on column public.knowledge_applicability.retrieval_similarity is
  'Guardrail 6: vector similarity no es verdad de negocio. Se guarda porque es un dato de '
  'trazabilidad del retrieval, no porque signifique que el documento aplique.';

create index if not exists knowledge_applicability_claim_idx
  on public.knowledge_applicability (claim_id);

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------

alter table public.claim_confidence enable row level security;
alter table public.confidence_dimensions enable row level security;
alter table public.confidence_caps enable row level security;
alter table public.diagnostic_uncertainties enable row level security;
alter table public.confidence_history enable row level security;
alter table public.knowledge_applicability enable row level security;

drop policy if exists "claim_confidence_select_staff" on public.claim_confidence;
create policy "claim_confidence_select_staff" on public.claim_confidence
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "confidence_dimensions_select_staff" on public.confidence_dimensions;
create policy "confidence_dimensions_select_staff" on public.confidence_dimensions
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "confidence_caps_select_staff" on public.confidence_caps;
create policy "confidence_caps_select_staff" on public.confidence_caps
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "diagnostic_uncertainties_select_staff" on public.diagnostic_uncertainties;
create policy "diagnostic_uncertainties_select_staff" on public.diagnostic_uncertainties
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "confidence_history_select_staff" on public.confidence_history;
create policy "confidence_history_select_staff" on public.confidence_history
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "knowledge_applicability_select_staff" on public.knowledge_applicability;
create policy "knowledge_applicability_select_staff" on public.knowledge_applicability
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
