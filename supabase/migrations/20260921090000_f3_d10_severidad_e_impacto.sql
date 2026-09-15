-- FASE 3 / D10 — Severidad e impacto.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d10-requisitos-contrato-severidad-impacto.md
--          conocimiento/fase-03/04-policies-guardrails/d10-guardrails-severidad-impacto.md
--          conocimiento/fase-03/03-runtime/d10-flujo-evaluacion-severidad-impacto.md
--          conocimiento/fase-03/06-tenant-context/d10-contexto-severidad-impacto.md
--          conocimiento/fase-03/05-experience-learning/d10-memoria-severidad-impacto.md
--
-- El primer bloque de la fase que puede ordenar algo -- y justo por eso el que
-- hereda todas las fronteras que D05 a D09 han ido guardando. D10 mide cuanto
-- dano hay. **No decide que se ataca primero** (guardrails 3, 46, 47 y 48): un
-- HIGH puede ir antes que un CRITICAL segun esfuerzo, valor estrategico y
-- momento, y esa decision es de F4.
--
-- DONDE D09 NO TENIA SITIO PARA UNA PERSONA, D10 NO TIENE SITIO PARA UNA
-- DECISION. No existe ninguna columna llamada `priority`, `recommended_action`,
-- `playbook`, `effort`, `intervention_order` ni `rank` en ninguna de las cinco
-- tablas. Y tampoco existe ninguna columna de probabilidad numerica: el
-- guardrail 29 prohibe inventar un "13,7 %" sin modelo calibrado, y la garantia
-- es que `likelihood` solo admite low/medium/high/unknown -- no hay donde
-- escribir el numero. Hay tests que comprueban las tres ausencias.
--
-- SEVERIDAD NO ES UNA CIFRA (guardrails 9 y 10). Un -20 % no es "grave": lo
-- grave depende de sobre cuanto negocio cae, cuanto cuesta, cuanto dura, si se
-- propaga y si hay colchon. Por eso **no hay ninguna columna donde escribir el
-- porcentaje de cambio** en `severity_assessments`: la magnitud de la metrica
-- vive en D05, y aqui hay que declarar exposicion, impacto y colchon.
--
-- CINCO SEVERIDADES, NO UNA (apartado 3). Aguda, acumulada, prospectiva,
-- estructural y global son columnas distintas: un problema cronico moderado
-- puede acumular mas dano que un incidente breve critico (guardrail 42). Y
-- **no hay formula** que derive la global de las otras cuatro -- la fuente dice
-- explicitamente que no la define (apartado 29), y el apartado 95 del corpus
-- permite que una sola dimension domine. Inventarla aqui seria decidir por
-- quien evalua.
--
-- TRES CONFIANZAS SEPARADAS (apartado 27, guardrail 4). La confianza en la
-- causa, la confianza en el impacto y la confianza en la severidad son tres
-- juicios distintos. Se puede estar muy seguro de que el dano es grave y nada
-- seguro de por que pasa -- guardrail 13: la incertidumbre no obliga a bajar la
-- severidad, y hay un test que comprueba que esa combinacion **se permite**.
--
-- LO OBSERVADO, LO ESTIMADO, LO INFERIDO Y LO PRONOSTICADO NO SE MEZCLAN
-- (guardrails 19 a 22). En `impact_measurements`, `evidence_type` y `timing`
-- estan atados por check: lo `observed` solo puede ser `realized` u `ongoing`, y
-- lo `potential` o `projected` nunca puede presentarse como observado. Un
-- pronostico no se disfraza de medicion.
--
-- PERDIDA REALIZADA != COSTE DE OPORTUNIDAD (guardrails 6, 43, 44 y 45), y
-- REVENUE-AT-RISK != REVENUE PERDIDO (32). Son valores de `nature`, y cada uno
-- tiene su check: el coste de oportunidad no puede ser `realized` ni `observed`.
--
-- REVERSIBILIDAD != RECUPERABILIDAD (guardrail 7). Dos columnas con dos
-- vocabularios distintos, a proposito: no comparten ni un valor, asi que no se
-- pueden confundir copiando uno en el otro. Que la causa se arregle en diez
-- minutos no devuelve los pedidos que no se hicieron.
--
-- LO LOCAL NO SE GLOBALIZA (guardrail 14 y apartado 219 del corpus), CON UNA
-- EXCEPCION: la continuidad (apartado 220). Una amenaza de liquidez es global
-- aunque hoy toque pocas transacciones.
--
-- MEDIR MAL NO ES PERDER DINERO (guardrails 49, 50 y 51). Un fallo de tracking
-- puede tener impacto CRITICAL en la dimension `data` con el impacto sobre
-- revenue en UNKNOWN, y eso es una salida valida, no un hueco. Hay un test.

-- ---------------------------------------------------------------------------
-- 1. La evaluacion de severidad
-- ---------------------------------------------------------------------------

create table if not exists public.severity_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  -- D10 consume D09, no lo repite.
  root_cause_id uuid references public.root_causes (id) on delete set null,
  constraint_id uuid references public.business_constraints (id) on delete set null,

  assessment_status varchar(16) not null default 'current',

  -- Apartado 91 del corpus: la severidad siempre lo es respecto de un target.
  target varchar(40) not null,
  scope varchar(16) not null default 'business',
  scope_detail jsonb not null default '{}'::jsonb,

  -- Apartado 3: el perfil, no un numero.
  acute_severity varchar(20) not null default 'unknown',
  cumulative_severity varchar(20) not null default 'unknown',
  forward_risk_severity varchar(20) not null default 'unknown',
  structural_severity varchar(20) not null default 'unknown',
  overall_severity varchar(20) not null default 'unknown',

  -- Apartado 27: tres juicios distintos.
  cause_confidence varchar(20) not null default 'insufficient',
  impact_confidence varchar(20) not null default 'insufficient',
  severity_confidence varchar(20) not null default 'insufficient',

  trajectory varchar(24) not null default 'unknown',
  velocity varchar(24) not null default 'unknown',
  recurrence varchar(20) not null default 'unknown',

  -- Apartado 15: el tiempo activo es parte de la gravedad.
  duration_hours numeric,
  onset_at timestamptz,
  material_damage_at timestamptz,
  contained_at timestamptz,
  recovered_at timestamptz,

  -- Apartado 18.
  time_to_material_damage_hours numeric,
  time_to_threshold_hours numeric,
  time_to_buffer_exhaustion_hours numeric,

  -- Guardrail 12 y apartado 66 del corpus: un fallo en el camino critico puede
  -- ser severo desde el primer minuto, sin duracion que lo justifique.
  critical_path_failure boolean not null default false,

  -- Guardrail 8 y apartado 170: que una capacidad sea critica no significa que
  -- hoy este danada. Son dos columnas porque son dos preguntas.
  capability_criticality varchar(20) not null default 'unknown',

  -- Guardrail 14: para que lo local sea global hay que declarar que la
  -- exposicion es material, y decir sobre que denominador.
  material_exposure boolean not null default false,
  exposure_basis text,

  -- Guardrail 11: BUSINESS_THREAT es excepcional y hay que decir de que tipo.
  threat_kind varchar(24),
  continuity_rationale text,

  -- Guardrail 7: dos preguntas distintas, dos vocabularios sin un valor en comun.
  reversibility varchar(24) not null default 'unknown',
  recoverability varchar(24) not null default 'unknown',
  absorption_capacity varchar(20) not null default 'unknown',

  -- Guardrails 49 a 51.
  measurement_compromised boolean not null default false,

  -- Guardrail 55: D10 produce insumos de escalado. El 56: no define a quien se
  -- avisa ni por donde. Por eso esto es una lectura del estado, no una orden.
  escalation_signal varchar(20) not null default 'none',

  summary text,
  assumptions text,
  limitations text,

  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint severity_assessments_estado check (
    assessment_status in ('current', 'superseded')
  ),
  constraint severity_assessments_scope check (scope in (
    'business','capability','subcapability','channel','market','product','segment'
  )),
  constraint severity_assessments_aguda check (
    acute_severity in ('info','low','moderate','high','critical','business_threat','unknown')
  ),
  constraint severity_assessments_acumulada check (
    cumulative_severity in ('info','low','moderate','high','critical','business_threat','unknown')
  ),
  constraint severity_assessments_prospectiva check (
    forward_risk_severity in ('info','low','moderate','high','critical','business_threat','unknown')
  ),
  constraint severity_assessments_estructural check (
    structural_severity in ('info','low','moderate','high','critical','business_threat','unknown')
  ),
  constraint severity_assessments_global check (
    overall_severity in ('info','low','moderate','high','critical','business_threat','unknown')
  ),
  constraint severity_assessments_confianza_causa check (
    cause_confidence in ('high','medium','low','insufficient')
  ),
  constraint severity_assessments_confianza_impacto check (
    impact_confidence in ('high','medium','low','insufficient')
  ),
  constraint severity_assessments_confianza_severidad check (
    severity_confidence in ('high','medium','low','insufficient')
  ),
  constraint severity_assessments_trayectoria check (trajectory in (
    'improving','stable','deteriorating','rapidly_deteriorating','recovering','volatile','unknown'
  )),
  constraint severity_assessments_velocidad check (velocity in (
    'stable','worsening','rapidly_deteriorating','recovering','unknown'
  )),
  constraint severity_assessments_recurrencia check (
    recurrence in ('first_time','recurrent','chronic','unknown')
  ),
  constraint severity_assessments_criticidad check (
    capability_criticality in ('minimal','moderate','high','critical','unknown')
  ),
  constraint severity_assessments_amenaza check (threat_kind is null or threat_kind in (
    'continuity','liquidity','ability_to_transact','customer_trust','legal_operational'
  )),
  -- Guardrail 7: los dos vocabularios no comparten ningun valor. Copiar uno en
  -- el otro no pasa el check.
  constraint severity_assessments_reversibilidad check (
    reversibility in ('easily_reversible','reversible','difficult','unknown')
  ),
  constraint severity_assessments_recuperabilidad check (
    recoverability in ('fully_recoverable','partially_recoverable','not_recoverable','unknown')
  ),
  constraint severity_assessments_absorcion check (
    absorption_capacity in ('strong','moderate','thin','none','unknown')
  ),
  constraint severity_assessments_escalado check (
    escalation_signal in ('none','escalating','sustained','de_escalating')
  ),

  -- Guardrail 11: BUSINESS_THREAT reservado a continuidad, liquidez, capacidad
  -- de transaccionar, confianza o continuidad legal -- y razonado.
  constraint severity_assessments_amenaza_excepcional check (
    overall_severity <> 'business_threat'
    or (threat_kind is not null and continuity_rationale is not null)
  ),

  -- Guardrail 14 y apartado 219: lo local no se globaliza. Apartado 220: salvo
  -- continuidad, y salvo un fallo del camino critico (guardrail 12).
  constraint severity_assessments_local_no_es_global check (
    overall_severity not in ('critical','business_threat')
    or scope = 'business'
    or material_exposure
    or threat_kind is not null
    or critical_path_failure
  ),

  -- Guardrails 15 y 17: declarar que la exposicion es material obliga a decir
  -- sobre que base. Un 3 % de revenue puede ser un 30 % de contribution.
  constraint severity_assessments_materialidad_razonada check (
    not material_exposure or exposure_basis is not null
  ),

  -- Guardrail 54: afirmar gravedad alta con poca confianza se permite
  -- (guardrail 13) -- pero entonces hay que escribir las limitaciones.
  constraint severity_assessments_incierto_declara_limites check (
    overall_severity not in ('critical','business_threat')
    or severity_confidence in ('high','medium')
    or limitations is not null
  ),

  -- Guardrail 50: si la medicion esta comprometida no se puede estar muy
  -- seguro del impacto economico.
  constraint severity_assessments_medicion_comprometida check (
    not measurement_compromised or impact_confidence <> 'high'
  ),

  -- Apartado 18 del corpus: lo local se localiza.
  constraint severity_assessments_localizada check (
    scope = 'business' or scope_detail <> '{}'::jsonb
  ),

  constraint severity_assessments_duracion_no_negativa check (
    (duration_hours is null or duration_hours >= 0)
    and (time_to_material_damage_hours is null or time_to_material_damage_hours >= 0)
    and (time_to_threshold_hours is null or time_to_threshold_hours >= 0)
    and (time_to_buffer_exhaustion_hours is null or time_to_buffer_exhaustion_hours >= 0)
  ),

  -- La linea temporal del apartado 184 va en un sentido.
  constraint severity_assessments_linea_temporal check (
    (material_damage_at is null or onset_at is null or material_damage_at >= onset_at)
    and (recovered_at is null or material_damage_at is null or recovered_at >= material_damage_at)
    and (contained_at is null or onset_at is null or contained_at >= onset_at)
  )
);

comment on table public.severity_assessments is
  'F3/D10 apartado 1. Mide cuanto dano hay. **No hay columna de prioridad, accion, playbook, '
  'esfuerzo ni orden de intervencion** (guardrails 3, 46, 47 y 48): eso es F4. Tampoco hay '
  'donde escribir el porcentaje de cambio de una metrica -- los guardrails 9 y 10 dicen que la '
  'magnitud no define la gravedad, y la garantia es que no cabe.';

comment on column public.severity_assessments.overall_severity is
  'Apartados 3 y 95 del corpus. **No se deriva por formula de las otras cuatro**: la fuente no '
  'define ninguna (apartado 29) y una sola dimension puede dominar -- revenue LOW con cash '
  'BUSINESS_THREAT da BUSINESS_THREAT. Quien evalua decide y lo razona.';

comment on column public.severity_assessments.capability_criticality is
  'Guardrail 8 y apartado 170. Que checkout sea la capacidad mas critica del negocio no '
  'significa que hoy este danado. Criticidad e impacto actual son dos columnas porque son dos '
  'preguntas distintas.';

comment on column public.severity_assessments.recoverability is
  'Guardrail 7. No comparte ni un valor con `reversibility` a proposito: que el fallo se '
  'arregle en diez minutos (reversible) no devuelve los pedidos que no se hicieron '
  '(no recuperable).';

create index if not exists severity_assessments_org_idx
  on public.severity_assessments (organization_id, overall_severity, assessment_status);
create index if not exists severity_assessments_caso_idx
  on public.severity_assessments (case_id, assessed_at desc);

-- Apartado 1 de experience-learning: el historico se conserva. Una sola
-- evaluacion vigente por caso; las anteriores quedan como `superseded`.
create unique index if not exists severity_assessments_vigente_idx
  on public.severity_assessments (case_id)
  where assessment_status = 'current';

drop trigger if exists set_severity_assessments_updated_at on public.severity_assessments;
create trigger set_severity_assessments_updated_at before update on public.severity_assessments
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. El vector de impacto (apartados 4 a 12, 19 a 22)
-- ---------------------------------------------------------------------------

create table if not exists public.impact_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.severity_assessments (id) on delete cascade,

  dimension varchar(16) not null,
  -- Apartado 93 del corpus: la severidad por dimension, que es lo que forma el
  -- vector. La global vive en la evaluacion, no aqui.
  dimension_severity varchar(20) not null default 'unknown',

  -- Guardrails 6, 32, 43 y 44: que clase de dano es. No es lo mismo lo perdido
  -- que lo que se deja de ganar.
  nature varchar(20) not null default 'realized_loss',
  -- Apartado 5.
  timing varchar(12) not null,
  -- Apartado 6.
  evidence_type varchar(12) not null,
  -- Apartado 20.
  quantification varchar(12) not null default 'unknown',

  metric varchar(60),
  value numeric,
  value_low numeric,
  value_high numeric,
  unit varchar(16),

  period_start timestamptz,
  period_end timestamptz,
  -- Guardrail 27: un periodo aun sin asentar no da una cifra exacta.
  period_open boolean not null default false,

  -- Apartado 21.
  loss_rate numeric,
  loss_rate_unit varchar(12),

  method text,
  baseline_reference text,
  assumptions text,

  -- Guardrails 29 y 30: cualitativa. **No existe columna de probabilidad.**
  likelihood varchar(12),
  impact_confidence varchar(20) not null default 'insufficient',

  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint impact_measurements_dimension check (dimension in (
    'revenue','contribution','cash','customer','operations','brand','strategic',
    'continuity','data'
  )),
  constraint impact_measurements_severidad check (
    dimension_severity in ('info','low','moderate','high','critical','business_threat','unknown')
  ),
  constraint impact_measurements_naturaleza check (nature in (
    'realized_loss','ongoing_loss','at_risk','opportunity_cost','cost_increase','exposure_only'
  )),
  constraint impact_measurements_momento check (
    timing in ('realized','ongoing','potential','projected')
  ),
  constraint impact_measurements_evidencia check (
    evidence_type in ('observed','estimated','inferred','forecast')
  ),
  constraint impact_measurements_cuantificacion check (
    quantification in ('exact','estimated','range','directional','unknown')
  ),
  constraint impact_measurements_verosimilitud check (
    likelihood is null or likelihood in ('low','medium','high','unknown')
  ),
  constraint impact_measurements_tasa_unidad check (
    loss_rate_unit is null or loss_rate_unit in ('per_hour','per_day','per_week')
  ),
  constraint impact_measurements_confianza check (
    impact_confidence in ('high','medium','low','insufficient')
  ),

  -- Guardrail 20: un pronostico no se presenta como observacion, y lo observado
  -- es por definicion algo que ya paso o esta pasando.
  constraint impact_measurements_observado_ya_paso check (
    evidence_type <> 'observed' or timing in ('realized','ongoing')
  ),
  constraint impact_measurements_futuro_no_se_observa check (
    timing not in ('potential','projected') or evidence_type <> 'observed'
  ),

  -- Guardrails 5 y 30: el riesgo declara verosimilitud cualitativa; el dano ya
  -- ocurrido no tiene verosimilitud que declarar.
  constraint impact_measurements_riesgo_declara_verosimilitud check (
    timing not in ('potential','projected') or likelihood is not null
  ),
  constraint impact_measurements_lo_ocurrido_no_es_probable check (
    timing in ('potential','projected') or likelihood is null
  ),

  -- Guardrails 23, 27 y 53: "exacto" solo se dice sobre algo observado, con
  -- metodo escrito y el periodo cerrado.
  constraint impact_measurements_exacto_se_observa check (
    quantification <> 'exact'
    or (evidence_type = 'observed' and not period_open and method is not null)
  ),
  -- Guardrail 24: un rango es un rango.
  constraint impact_measurements_rango_tiene_dos_extremos check (
    quantification <> 'range'
    or (value_low is not null and value_high is not null and value_high > value_low)
  ),
  -- Guardrail 28: si no se puede cuantificar, no se cuantifica.
  constraint impact_measurements_direccional_no_cifra check (
    quantification not in ('directional','unknown')
    or (value is null and value_low is null and value_high is null)
  ),
  constraint impact_measurements_cifra_lleva_unidad check (
    (value is null and value_low is null and value_high is null) or unit is not null
  ),
  -- Guardrail 22: los supuestos se ven. Solo lo observado se libra.
  constraint impact_measurements_supuestos_visibles check (
    evidence_type = 'observed' or assumptions is not null
  ),
  -- Guardrail 21: lo inferido y lo pronosticado no sostienen confianza alta.
  constraint impact_measurements_confianza_no_supera_evidencia check (
    impact_confidence <> 'high' or evidence_type in ('observed','estimated')
  ),

  -- Guardrails 43, 44 y 45: el coste de oportunidad no es una perdida
  -- realizada, y nunca se observa -- se estima.
  constraint impact_measurements_oportunidad_no_es_perdida check (
    nature <> 'opportunity_cost'
    or (timing in ('potential','projected') and evidence_type <> 'observed')
  ),
  -- Guardrail 32: revenue-at-risk no es revenue perdido.
  constraint impact_measurements_en_riesgo_no_es_perdido check (
    nature <> 'at_risk' or timing in ('potential','projected')
  ),
  constraint impact_measurements_realizado_es_realizado check (
    nature <> 'realized_loss' or timing = 'realized'
  ),

  constraint impact_measurements_periodo check (
    period_end is null or period_start is null or period_end > period_start
  ),
  constraint impact_measurements_tasa check (
    loss_rate is null or loss_rate_unit is not null
  )
);

comment on table public.impact_measurements is
  'F3/D10 apartados 4 a 12. Una fila por dimension y por clase de dano. **Las cuatro capas de '
  'evidencia (observed/estimated/inferred/forecast) y los cuatro momentos '
  '(realized/ongoing/potential/projected) estan atados por check**: lo observado no puede ser '
  'futuro y lo futuro no puede presentarse como observado (guardrails 19 a 21).';

comment on column public.impact_measurements.likelihood is
  'Guardrails 29 y 30. Cualitativa a proposito: **no existe ninguna columna donde escribir una '
  'probabilidad numerica**, porque no hay modelo calibrado que la sostenga. Un "13,7 %" '
  'inventado suena mas serio que un "medium" honesto, y es peor.';

comment on column public.impact_measurements.nature is
  'Guardrails 6, 32, 43 y 44. Perdida realizada, perdida en curso, revenue en riesgo, coste de '
  'oportunidad y aumento de coste son cinco cosas distintas que se suman mal entre si.';

create index if not exists impact_measurements_evaluacion_idx
  on public.impact_measurements (assessment_id, dimension);
create index if not exists impact_measurements_org_idx
  on public.impact_measurements (organization_id, dimension, timing);

drop trigger if exists set_impact_measurements_updated_at on public.impact_measurements;
create trigger set_impact_measurements_updated_at before update on public.impact_measurements
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. La exposicion: una cuota sin denominador no dice nada (apartado 13)
-- ---------------------------------------------------------------------------

create table if not exists public.impact_exposures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.severity_assessments (id) on delete cascade,

  denominator varchar(20) not null,
  denominator_value numeric,
  denominator_note text,
  exposure_share numeric,
  affected_segment text,

  -- Guardrails 15 y 16: se pueden registrar varios denominadores, y hay que
  -- decir cual se uso para juzgar -- y por que.
  is_chosen_denominator boolean not null default false,
  confidence varchar(20) not null default 'insufficient',
  rationale text,

  created_at timestamptz not null default now(),

  constraint impact_exposures_denominador check (denominator in (
    'revenue','contribution','spend','orders','customers','traffic','inventory_value','other'
  )),
  constraint impact_exposures_confianza check (
    confidence in ('high','medium','low','insufficient')
  ),
  constraint impact_exposures_cuota check (
    exposure_share is null or (exposure_share >= 0 and exposure_share <= 1)
  ),
  -- Una fila de exposicion que no dice ni cuanto ni de quien no es exposicion.
  constraint impact_exposures_dice_algo check (
    exposure_share is not null or affected_segment is not null
  ),
  -- Guardrail 16: elegir un denominador en vez de otro es un juicio, y se razona.
  constraint impact_exposures_elegido_se_razona check (
    not is_chosen_denominator or rationale is not null
  ),
  constraint impact_exposures_unico unique (assessment_id, denominator)
);

comment on table public.impact_exposures is
  'F3/D10 apartado 13 y guardrails 15 a 18. El denominador es obligatorio porque **una cuota '
  'sin base no significa nada**: el mismo incidente es un 3 % del revenue y un 30 % de la '
  'contribution, y elegir mal el denominador es la forma mas comun de exagerar o de quitar '
  'importancia. Un scope pequeno puede ser material (17): por eso no hay ningun umbral aqui.';

create index if not exists impact_exposures_evaluacion_idx
  on public.impact_exposures (assessment_id);

-- Guardrail 15: uno solo se usa para juzgar.
create unique index if not exists impact_exposures_elegido_unico_idx
  on public.impact_exposures (assessment_id)
  where is_chosen_denominator;

-- ---------------------------------------------------------------------------
-- 4. La propagacion (apartados 14 y 26, guardrails 33 a 36)
-- ---------------------------------------------------------------------------

create table if not exists public.impact_propagation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.severity_assessments (id) on delete cascade,

  from_capability varchar(24),
  to_capability varchar(24) not null,
  propagation_kind varchar(16) not null,
  -- Guardrail 36: lo sistemico se afirma con una ruta de D07, no con una
  -- sensacion de que "esto lo toca todo".
  causal_path_id uuid references public.causal_paths (id) on delete set null,
  evidence text,

  -- Guardrails 33 y 34: el eslabon de una cascada no es una perdida aparte.
  contributes_independent_loss boolean not null default false,
  propagation_risk varchar(12) not null default 'unknown',
  note text,

  created_at timestamptz not null default now(),

  constraint impact_propagation_origen check (from_capability is null or from_capability in (
    'market','product','offer','unit_economics','acquisition','creative','conversion',
    'retention','inventory','operations','finance','data','technology','team','strategy'
  )),
  constraint impact_propagation_destino check (to_capability in (
    'market','product','offer','unit_economics','acquisition','creative','conversion',
    'retention','inventory','operations','finance','data','technology','team','strategy'
  )),
  constraint impact_propagation_tipo check (
    propagation_kind in ('direct','second_order','cascade','systemic')
  ),
  constraint impact_propagation_riesgo check (
    propagation_risk in ('low','medium','high','unknown')
  ),
  constraint impact_propagation_sistemico_exige_ruta check (
    propagation_kind <> 'systemic' or causal_path_id is not null
  ),
  -- Guardrails 33 y 34: solo el impacto directo suma por su cuenta. Contar la
  -- cascada aparte es contar el mismo euro dos veces.
  constraint impact_propagation_cascada_no_suma_aparte check (
    not contributes_independent_loss or propagation_kind = 'direct'
  ),
  constraint impact_propagation_no_a_si_misma check (
    from_capability is null or from_capability <> to_capability
  ),
  constraint impact_propagation_unico unique (assessment_id, from_capability, to_capability)
);

comment on table public.impact_propagation is
  'F3/D10 apartado 14 y guardrails 33 a 36. El grafo de impacto no es el grafo causal (D07): '
  'este dice por donde viaja el dano economico. **Solo lo directo puede sumarse como perdida '
  'independiente**; contar tambien la cascada seria contar el mismo euro dos veces.';

create index if not exists impact_propagation_evaluacion_idx
  on public.impact_propagation (assessment_id, propagation_kind);

-- ---------------------------------------------------------------------------
-- 5. Los colchones (apartados 24 y 25, guardrails 37 a 39)
-- ---------------------------------------------------------------------------

create table if not exists public.absorption_buffers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  buffer_type varchar(24) not null,
  capability varchar(24),
  description text not null,
  state varchar(16) not null default 'unknown',
  headroom text,
  exhaustion_horizon_days numeric,
  activated boolean not null default false,
  activated_at timestamptz,

  last_assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint absorption_buffers_tipo check (buffer_type in (
    'cash','safety_stock','inventory_cover','warehouse_capacity','spare_capacity',
    'backup_provider','alternate_supplier','alternate_channel','technical_redundancy',
    'creative_inventory'
  )),
  constraint absorption_buffers_capacidad check (capability is null or capability in (
    'market','product','offer','unit_economics','acquisition','creative','conversion',
    'retention','inventory','operations','finance','data','technology','team','strategy'
  )),
  constraint absorption_buffers_estado check (
    state in ('intact','consuming','thin','exhausted','unknown')
  ),
  constraint absorption_buffers_horizonte check (
    exhaustion_horizon_days is null or exhaustion_horizon_days >= 0
  ),
  -- Un colchon agotado no tiene horizonte por delante.
  constraint absorption_buffers_agotado_no_tiene_horizonte check (
    state <> 'exhausted' or coalesce(exhaustion_horizon_days, 0) = 0
  ),
  constraint absorption_buffers_activado_tiene_fecha check (
    not activated or activated_at is not null
  )
);

comment on table public.absorption_buffers is
  'F3/D10 apartados 24 y 25, guardrails 37 a 39. El colchon es un hecho del tenant, no de un '
  'caso: por eso cuelga de la organizacion y no de la evaluacion. Es lo que hace que **la '
  'misma causa no tenga la misma gravedad en dos tiendas** (guardrail 38) -- el mismo retraso '
  'de proveedor es un susto con seis semanas de stock y un paro con tres dias.';

create index if not exists absorption_buffers_org_idx
  on public.absorption_buffers (organization_id, state);

create unique index if not exists absorption_buffers_unico_idx
  on public.absorption_buffers (organization_id, buffer_type, coalesce(capability, ''));

drop trigger if exists set_absorption_buffers_updated_at on public.absorption_buffers;
create trigger set_absorption_buffers_updated_at before update on public.absorption_buffers
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.severity_assessments enable row level security;
alter table public.impact_measurements enable row level security;
alter table public.impact_exposures enable row level security;
alter table public.impact_propagation enable row level security;
alter table public.absorption_buffers enable row level security;

drop policy if exists "severity_assessments_select_staff" on public.severity_assessments;
create policy "severity_assessments_select_staff" on public.severity_assessments
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "impact_measurements_select_staff" on public.impact_measurements;
create policy "impact_measurements_select_staff" on public.impact_measurements
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "impact_exposures_select_staff" on public.impact_exposures;
create policy "impact_exposures_select_staff" on public.impact_exposures
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "impact_propagation_select_staff" on public.impact_propagation;
create policy "impact_propagation_select_staff" on public.impact_propagation
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "absorption_buffers_select_staff" on public.absorption_buffers;
create policy "absorption_buffers_select_staff" on public.absorption_buffers
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
