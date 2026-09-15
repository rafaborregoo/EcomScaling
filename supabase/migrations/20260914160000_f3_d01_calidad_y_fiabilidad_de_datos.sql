-- FASE 3 / D01 — Calidad y fiabilidad de los datos.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d01-requisitos-contrato-calidad-datos.md
--          conocimiento/fase-03/04-policies-guardrails/d01-guardrails-calidad-diagnostico.md
--          conocimiento/fase-03/06-tenant-context/d01-configuracion-calidad-y-semantica.md
--
-- D01 responde a una sola pregunta, antes que cualquier motor de la fase 3:
-- ¿el dato disponible aguanta la interpretacion que se le quiere dar? Es el
-- bloque que impide que "las ventas han caido" signifique en realidad "el
-- pixel dejo de disparar".
--
-- QUE LE FALTABA A D00. `diagnostic_cases.data_quality` es un jsonb libre: el
-- contrato exigia que la calidad del dato cupiera en el caso, pero no habia
-- catalogo detras. Esta migracion es ese catalogo. El jsonb se queda como
-- snapshot (apartado 61 de D00: releer un caso debe mostrar lo que se sabia
-- entonces) y las tablas de aqui son la evaluacion viva.
--
-- EL ARTEFACTO NO DEFINE ESQUEMA, A PROPOSITO. Su apartado 18 dice
-- explicitamente que no se inventen tablas, columnas ni ids a partir de el, y
-- que eso es trabajo de un contrato tecnico posterior. Esta migracion ES ese
-- contrato tecnico: los vocabularios cerrados (freshness, missingness,
-- variance, roles de fuente) salen literalmente del documento; los nombres de
-- tabla y columna son decision de aqui.
--
-- CONFIGURACION Y OBSERVACION SON COSAS DISTINTAS. El apartado 13 del tenant
-- context lo exige: `data_source_expectations` y `tenant_metric_definitions`
-- son configuracion estable del ecommerce (que cadencia se espera, que es
-- "revenue" en esta tienda); `data_quality_assessments`, `_issues` y
-- `data_source_reconciliations` son telemetria de una evaluacion concreta.
-- Mezclarlas haria que cambiar la definicion de CAC reescribiera el pasado.
--
-- LA DEFINICION DE UNA METRICA ES UNA SERIE TEMPORAL, NO UN VALOR. El
-- apartado 3 exige poder declarar METRIC_DEFINITION_DRIFT. Con una fila por
-- metrica no se puede: se sobreescribe y el historico queda comparado contra
-- una formula que entonces no existia (guardrail 10). Por eso la definicion
-- lleva `effective_from`/`effective_to` y el drift es, simplemente, que haya
-- mas de una fila vigente en el periodo comparado.
--
-- LO QUE NO SE COMPARA, NO SE RESTA. En `data_source_reconciliations`, si las
-- fuentes no son comparables las columnas de diferencia tienen que quedar
-- nulas (guardrail 6). Y una discrepancia no se convierte en error hasta que
-- alguien escribe por que (guardrail 4): son dos fuentes que pueden estar
-- midiendo cosas distintas, no una rota.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- TENANT CONTEXT 1 — que se espera de cada fuente (tenant apartados 1, 2, 6)
-- ---------------------------------------------------------------------------

create table if not exists public.data_source_expectations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  -- De donde viene el dato y que mide. `phenomenon` es lo que el negocio
  -- quiere saber (orders, revenue, spend...); `dataset` es como lo llama esa
  -- fuente. No son lo mismo y confundirlos es el guardrail 8.
  source varchar(40) not null,
  dataset varchar(60) not null,
  phenomenon varchar(40) not null,

  -- Apartado 2 del tenant context -- no se asume que Shopify sea siempre la
  -- fuente primaria de revenue ni que analytics lo sea de traffic: cada
  -- ecommerce lo resuelve con su arquitectura.
  source_role varchar(20) not null,

  -- Apartado 1 -- la freshness no tiene un umbral global (guardrail 1).
  -- Pedidos live se miden en minutos y un P&L mensual en dias: el umbral es
  -- esta columna, no una constante del codigo.
  expected_cadence_minutes integer,
  delay_tolerance_minutes integer,
  time_sensitivity varchar(20),

  ingestion_mechanism varchar(20),
  -- Apartado 5 -- la referencia temporal de reporting. Sin esto, comparar
  -- dias entre fuentes en husos distintos produce caidas que no existen.
  source_timezone text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint data_source_expectations_role check (
    source_role in ('primary', 'secondary', 'validation', 'derived')
  ),
  constraint data_source_expectations_sensibilidad check (
    time_sensitivity is null
    or time_sensitivity in ('real_time', 'high', 'medium', 'low')
  ),
  constraint data_source_expectations_ingesta check (
    ingestion_mechanism is null
    or ingestion_mechanism in ('webhook', 'batch', 'api_pull', 'manual', 'derived')
  ),
  constraint data_source_expectations_cadencia_positiva check (
    expected_cadence_minutes is null or expected_cadence_minutes > 0
  ),
  -- Guardrail 22 -- una fuente derivada no puede declararse mas fresca que
  -- sus inputs, asi que tampoco puede prometer cadencia propia.
  constraint data_source_expectations_derivada_sin_cadencia check (
    source_role <> 'derived' or expected_cadence_minutes is null
  )
);

comment on table public.data_source_expectations is
  'F3/D01 tenant-context. Que se espera de cada fuente en ESTA tienda: cadencia, rol y huso. Configuracion estable, no telemetria (tenant apartado 13).';

comment on column public.data_source_expectations.expected_cadence_minutes is
  'Cadencia esperada de actualizacion. El guardrail 1 prohibe un umbral global de freshness: el umbral vive aqui, por fuente y uso.';

create unique index if not exists data_source_expectations_unico_idx
  on public.data_source_expectations (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source,
    dataset,
    phenomenon
  );

-- Apartado 2 -- un fenomeno tiene una sola fuente primaria. Dos primarias es
-- justo la ambiguedad que el paso 4 del runtime tiene que resolver antes de
-- reconciliar nada.
create unique index if not exists data_source_expectations_primaria_idx
  on public.data_source_expectations (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    phenomenon
  )
  where source_role = 'primary';

drop trigger if exists set_data_source_expectations_updated_at on public.data_source_expectations;
create trigger set_data_source_expectations_updated_at
before update on public.data_source_expectations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- TENANT CONTEXT 2 — que significa cada metrica AQUI (tenant apartados 3, 4, 8, 9)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_metric_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  metric varchar(80) not null,
  definition text not null,
  -- Solo si es derivada. El guardrail 24 pide lineage para usarla como
  -- evidencia fuerte; la formula es el minimo de ese lineage.
  formula text,

  -- Apartado 11 del contrato -- gross, net, total y recognized revenue no son
  -- sinonimos, y mezclarlos es el guardrail 9.
  revenue_basis varchar(24),
  includes_shipping boolean,
  includes_taxes boolean,
  discount_treatment varchar(24),
  refund_recognition varchar(24),
  -- Apartado 9 del tenant context -- que estados de pedido cuentan como
  -- negocio real en esta tienda.
  included_order_states text[] not null default '{}',

  reporting_currency char(3),
  scope varchar(40),

  -- Apartado 3 del contrato -- METRIC_DEFINITION_DRIFT. La definicion es una
  -- serie temporal: comparar dos periodos que caen a lados distintos de un
  -- cambio de formula es el guardrail 10.
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  change_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_metric_definitions_revenue_basis check (
    revenue_basis is null or revenue_basis in (
      'gross_sales', 'net_sales', 'total_sales', 'recognized_revenue'
    )
  ),
  constraint tenant_metric_definitions_descuentos check (
    discount_treatment is null or discount_treatment in (
      'included', 'excluded', 'net_of_discounts'
    )
  ),
  constraint tenant_metric_definitions_refunds check (
    refund_recognition is null or refund_recognition in (
      'at_order_date', 'at_refund_date', 'not_deducted'
    )
  ),
  constraint tenant_metric_definitions_vigencia check (
    effective_to is null or effective_to > effective_from
  ),
  -- Una definicion que se sustituye sin decir por que borra la razon del
  -- drift, que es justo lo que hay que leer al comparar historico.
  constraint tenant_metric_definitions_cierre_motivado check (
    effective_to is null or change_reason is not null
  )
);

comment on table public.tenant_metric_definitions is
  'F3/D01 tenant-context. Que significa una metrica en ESTA tienda, con vigencia: dos filas del mismo metric son METRIC_DEFINITION_DRIFT (contrato apartado 3).';

comment on column public.tenant_metric_definitions.effective_to is
  'Null = definicion vigente. Al cerrarla se exige change_reason: sin el motivo, una comparacion historica no puede saber que cambio.';

create unique index if not exists tenant_metric_definitions_unico_idx
  on public.tenant_metric_definitions (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric,
    effective_from
  );

-- Una sola definicion vigente por metrica: si hubiera dos, ningun motor
-- sabria cual aplica y el guardrail 8 dejaria de poder comprobarse.
create unique index if not exists tenant_metric_definitions_vigente_idx
  on public.tenant_metric_definitions (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric
  )
  where effective_to is null;

drop trigger if exists set_tenant_metric_definitions_updated_at on public.tenant_metric_definitions;
create trigger set_tenant_metric_definitions_updated_at
before update on public.tenant_metric_definitions
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- EVALUACION — freshness, cobertura y fiabilidad (contrato apartados 1, 7, 13, 14, 15)
-- ---------------------------------------------------------------------------

create table if not exists public.data_quality_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  source varchar(40) not null,
  dataset varchar(60) not null,
  phenomenon varchar(40) not null,

  -- Apartado 15 -- la fiabilidad no es global. Una fuente puede ser solida en
  -- Espana y no cubrir Francia; declararla "buena" a secas es el guardrail 3.
  scope varchar(40) not null default 'global',
  scope_detail jsonb not null default '{}'::jsonb,

  period_start timestamptz not null,
  period_end timestamptz not null,
  -- Apartado 14 -- un periodo abierto no se compara contra uno cerrado
  -- (guardrail 18).
  period_settlement varchar(20) not null default 'unknown',

  -- Freshness contra la cadencia esperada, no contra un umbral fijo: se copia
  -- la cadencia que regia al evaluar, por el mismo motivo que D00 guarda
  -- snapshots -- releer la evaluacion debe mostrar contra que se juzgo.
  last_sync_at timestamptz,
  expected_cadence_minutes integer,
  freshness varchar(20) not null,

  -- Apartado 1 -- cobertura y ausencias.
  expected_observations bigint,
  available_observations bigint,
  coverage numeric,
  missingness varchar(30),

  -- Apartado 7 -- granularidad. Una senal real con granularidad insuficiente
  -- no se confirma: se declara el gap (rama E del runtime).
  granularity_available varchar(20),
  granularity_required varchar(20),
  granularity_sufficient boolean,

  -- Apartado 13 -- fragilidad estadistica (guardrails 29, 30, 31).
  sampled boolean not null default false,
  sampling_rate numeric,
  evidence_fragility varchar(30),

  -- Apartado 6 -- moneda y tiempo. Sin esto, FX y husos se confunden con
  -- negocio (guardrails 20, 21).
  source_timezone text,
  reporting_timezone text,
  native_currency char(3),
  reporting_currency char(3),
  conversion_rate numeric,
  conversion_at timestamptz,

  reliability varchar(20) not null,
  -- Apartado 1 -- "razones que justifican la degradacion". Una fiabilidad
  -- baja sin motivo no es evaluable ni discutible.
  degradation_reasons text[] not null default '{}',

  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint data_quality_assessments_freshness check (
    freshness in (
      'real_time', 'fresh', 'delayed', 'stale', 'severely_stale', 'unknown'
    )
  ),
  constraint data_quality_assessments_missingness check (
    missingness is null or missingness in (
      'random', 'systematic', 'time_range', 'segment', 'source'
    )
  ),
  constraint data_quality_assessments_reliability check (
    reliability in ('high', 'medium', 'low', 'unusable')
  ),
  constraint data_quality_assessments_settlement check (
    period_settlement in ('open', 'partially_settled', 'settled', 'unknown')
  ),
  constraint data_quality_assessments_fragilidad check (
    evidence_fragility is null or evidence_fragility in (
      'low_sample', 'high_variance', 'insufficient_observations'
    )
  ),
  constraint data_quality_assessments_granularidad check (
    (
      granularity_available is null or granularity_available in (
        'real_time', 'hourly', 'daily', 'weekly', 'monthly', 'campaign',
        'adset', 'ad', 'product', 'sku', 'customer'
      )
    )
    and (
      granularity_required is null or granularity_required in (
        'real_time', 'hourly', 'daily', 'weekly', 'monthly', 'campaign',
        'adset', 'ad', 'product', 'sku', 'customer'
      )
    )
  ),
  constraint data_quality_assessments_periodo check (period_end > period_start),
  constraint data_quality_assessments_coverage_rango check (
    coverage is null or (coverage >= 0 and coverage <= 1)
  ),
  constraint data_quality_assessments_observaciones check (
    expected_observations is null
    or available_observations is null
    or (expected_observations >= 0 and available_observations >= 0)
  ),
  -- Guardrail 32 -- una cobertura sin denominador es un porcentaje inventado.
  constraint data_quality_assessments_coverage_con_denominador check (
    coverage is null or expected_observations is not null
  ),
  -- Guardrail 2 -- no tratar datos incompletos como completos. Si falta algo,
  -- hay que decir de que tipo es la ausencia: no es lo mismo que falten dias
  -- sueltos que que falte entero un mercado.
  constraint data_quality_assessments_incompleto_declara_ausencia check (
    coverage is null or coverage >= 1 or missingness is not null
  ),
  -- Guardrail 1 + 22 -- un dato obsoleto o de frescura desconocida no sostiene
  -- fiabilidad alta.
  constraint data_quality_assessments_alta_exige_frescura check (
    reliability <> 'high'
    or freshness in ('real_time', 'fresh', 'delayed')
  ),
  -- Guardrails 29, 30 -- evidencia fragil no es evidencia fuerte.
  constraint data_quality_assessments_fragil_no_es_alta check (
    evidence_fragility is null or reliability <> 'high'
  ),
  -- Apartado 1 -- degradar sin motivo escrito no es evaluar, es opinar.
  constraint data_quality_assessments_degradacion_motivada check (
    reliability not in ('low', 'unusable')
    or cardinality(degradation_reasons) > 0
  ),
  -- Guardrail 21 -- si hay dos monedas hay conversion, y una conversion sin
  -- tipo ni momento no se puede auditar.
  constraint data_quality_assessments_fx_completo check (
    native_currency is null
    or reporting_currency is null
    or native_currency = reporting_currency
    or (conversion_rate is not null and conversion_at is not null)
  )
);

comment on table public.data_quality_assessments is
  'F3/D01. Una evaluacion de si el dato de una fuente aguanta el uso: freshness, cobertura y fiabilidad para un scope y periodo concretos.';

comment on column public.data_quality_assessments.scope is
  'La fiabilidad se evalua por segmento, no solo por integracion (contrato apartado 15). "La fuente esta bien" a secas es el guardrail 3.';

comment on column public.data_quality_assessments.expected_cadence_minutes is
  'Copia de la cadencia esperada al evaluar, no referencia viva: releer la evaluacion debe mostrar contra que umbral se juzgo entonces.';

create index if not exists data_quality_assessments_org_idx
  on public.data_quality_assessments (organization_id, assessed_at desc);

create index if not exists data_quality_assessments_fuente_idx
  on public.data_quality_assessments (organization_id, source, phenomenon, assessed_at desc);

-- Lo que se consulta antes de diagnosticar: que fuentes NO aguantan.
create index if not exists data_quality_assessments_degradadas_idx
  on public.data_quality_assessments (organization_id, reliability, assessed_at desc)
  where reliability in ('low', 'unusable');

drop trigger if exists set_data_quality_assessments_updated_at on public.data_quality_assessments;
create trigger set_data_quality_assessments_updated_at
before update on public.data_quality_assessments
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- ISSUE — la anomalia tecnica concreta (contrato apartados 4, 8, 12, 17)
-- ---------------------------------------------------------------------------

create table if not exists public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  -- Nullable: un permission gap se detecta al conectar, sin evaluacion previa.
  assessment_id uuid references public.data_quality_assessments (id) on delete set null,

  issue_type varchar(40) not null,
  source varchar(40) not null,
  dataset varchar(60),
  phenomenon varchar(40),
  scope varchar(40) not null default 'global',

  description text not null,
  severity varchar(20) not null,
  -- "Material" = cambia la interpretacion. Un issue real pero irrelevante
  -- para la pregunta no debe bloquear nada (guardrail 34 al reves).
  material boolean not null default false,

  status varchar(20) not null default 'open',
  -- Apartado 17 -- que le pasa al diagnostico de aguas abajo.
  downstream_effect varchar(20) not null default 'none',
  explanation text,

  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint data_quality_issues_tipo check (
    issue_type in (
      -- Salud de integracion (apartado 8, guardrails 12, 13, 14)
      'permission_gap', 'credential_expired', 'rate_limited', 'partial_sync',
      'webhook_failure', 'duplicate_delivery', 'ingestion_degraded',
      -- Tracking y schema (apartado 4, guardrails 15, 16)
      'schema_drift', 'missing_events', 'duplicate_events', 'payload_error',
      'timestamp_error', 'funnel_inconsistency', 'tracking_regression',
      -- Semantica y atribucion (apartados 3, 10, guardrails 8, 9, 10, 11)
      'definition_drift', 'attribution_change', 'modeled_conversions',
      'consent_loss',
      -- Tiempo, moneda y cierre (apartados 6, 14, guardrails 18, 19, 20, 21)
      'historical_backfill', 'late_arriving_data', 'timezone_misalignment',
      'currency_unresolved', 'partial_period',
      -- Contaminacion y muestreo (apartados 12, 13, guardrails 16, 29)
      'contaminated_data', 'sampling',
      -- Integridad logica (apartado 5, guardrail 8)
      'math_inconsistency'
    )
  ),
  constraint data_quality_issues_severidad check (
    severity in ('info', 'low', 'moderate', 'high', 'critical')
  ),
  constraint data_quality_issues_estado check (
    status in ('open', 'investigating', 'explained', 'resolved', 'false_positive')
  ),
  constraint data_quality_issues_efecto check (
    downstream_effect in ('none', 'degraded', 'blocked')
  ),
  -- Guardrail 4 -- cerrar un issue como explicado, resuelto o falso positivo
  -- sin escribir por que es convertir una sospecha en veredicto.
  constraint data_quality_issues_cierre_motivado check (
    status not in ('explained', 'resolved', 'false_positive')
    or explanation is not null
  ),
  constraint data_quality_issues_resuelto_con_fecha check (
    (resolved_at is not null) = (status in ('resolved', 'false_positive'))
  ),
  -- Guardrail 36 -- bloquear o degradar aguas abajo solo tiene sentido si el
  -- fallo es material. Al reves, un fallo material que no toca el diagnostico
  -- deja de ser una advertencia util.
  constraint data_quality_issues_bloqueo_material check (
    downstream_effect = 'none' or material
  ),
  -- Un issue ya resuelto no puede seguir bloqueando el diagnostico.
  constraint data_quality_issues_resuelto_no_bloquea check (
    status not in ('resolved', 'false_positive') or downstream_effect = 'none'
  )
);

comment on table public.data_quality_issues is
  'F3/D01. La anomalia tecnica concreta y que le hace al diagnostico de aguas abajo: nada, degradarlo o bloquearlo (contrato apartado 17).';

comment on column public.data_quality_issues.material is
  'Si cambia la interpretacion. Un issue real pero inmaterial para la pregunta no debe bloquear el diagnostico ni degradar su confianza.';

comment on column public.data_quality_issues.downstream_effect is
  'Guardrail 36. `blocked` significa que ningun caso puede confirmarse sobre esta fuente hasta resolverlo; `degraded`, que puede pero no con confianza alta.';

create index if not exists data_quality_issues_org_idx
  on public.data_quality_issues (organization_id, detected_at desc);

create index if not exists data_quality_issues_abiertos_idx
  on public.data_quality_issues (organization_id, source, severity)
  where status in ('open', 'investigating');

create index if not exists data_quality_issues_bloqueantes_idx
  on public.data_quality_issues (organization_id, phenomenon)
  where downstream_effect in ('degraded', 'blocked');

drop trigger if exists set_data_quality_issues_updated_at on public.data_quality_issues;
create trigger set_data_quality_issues_updated_at
before update on public.data_quality_issues
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RECONCILIACION — dos fuentes sobre el mismo fenomeno (contrato apartado 2)
-- ---------------------------------------------------------------------------

create table if not exists public.data_source_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  phenomenon varchar(40) not null,
  scope varchar(40) not null default 'global',
  period_start timestamptz not null,
  period_end timestamptz not null,

  source_a varchar(40) not null,
  source_b varchar(40) not null,

  -- Guardrail 6 -- comparar dos fuentes exige antes comprobar que miden lo
  -- mismo, en el mismo periodo, con la misma metodologia.
  comparable boolean not null,
  non_comparability_reason varchar(40),

  value_a numeric,
  value_b numeric,
  difference_absolute numeric,
  difference_relative numeric,

  status varchar(24) not null,
  -- Guardrail 4 -- una discrepancia NO es un error. Dos fuentes pueden diferir
  -- porque miden distinto; llamarlo error sin explicacion inventa una averia.
  classification varchar(20) not null default 'unknown',
  explanation text,

  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint data_source_reconciliations_estado check (
    status in (
      'matched', 'acceptable_variance', 'material_variance',
      'severe_variance', 'not_comparable'
    )
  ),
  constraint data_source_reconciliations_clasificacion check (
    classification in ('unknown', 'discrepancy', 'error')
  ),
  constraint data_source_reconciliations_motivo check (
    non_comparability_reason is null or non_comparability_reason in (
      'different_definition', 'different_scope', 'different_period',
      'different_methodology', 'attribution_overlap', 'different_currency',
      'different_timezone'
    )
  ),
  constraint data_source_reconciliations_fuentes_distintas check (
    source_a <> source_b
  ),
  constraint data_source_reconciliations_periodo check (period_end > period_start),
  -- Guardrail 6 -- `not_comparable` y `comparable` son la misma afirmacion
  -- dicha dos veces; si se separan, acaban contradiciendose.
  constraint data_source_reconciliations_coherencia check (
    (status = 'not_comparable') = (comparable = false)
  ),
  constraint data_source_reconciliations_incomparable_motivado check (
    comparable or non_comparability_reason is not null
  ),
  -- Lo que no es comparable no se resta. Una diferencia calculada sobre dos
  -- definiciones distintas es un numero sin significado que despues alguien
  -- citara como evidencia.
  constraint data_source_reconciliations_incomparable_sin_diferencia check (
    comparable
    or (difference_absolute is null and difference_relative is null)
  ),
  -- Guardrail 4 -- declarar error exige decir cual.
  constraint data_source_reconciliations_error_explicado check (
    classification <> 'error' or explanation is not null
  )
);

comment on table public.data_source_reconciliations is
  'F3/D01. Contraste entre dos fuentes sobre el mismo fenomeno. Distingue discrepancia de error (contrato apartado 2): que difieran no prueba que una falle.';

comment on column public.data_source_reconciliations.comparable is
  'Guardrail 6. Si es false, las columnas de diferencia quedan nulas: restar dos metricas con definicion o periodo distintos produce un numero sin significado.';

create index if not exists data_source_reconciliations_org_idx
  on public.data_source_reconciliations (organization_id, assessed_at desc);

create index if not exists data_source_reconciliations_divergentes_idx
  on public.data_source_reconciliations (organization_id, phenomenon, assessed_at desc)
  where status in ('material_variance', 'severe_variance');

drop trigger if exists set_data_source_reconciliations_updated_at on public.data_source_reconciliations;
create trigger set_data_source_reconciliations_updated_at
before update on public.data_source_reconciliations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- PUENTE CON D00 — que evaluaciones sostienen un caso
-- ---------------------------------------------------------------------------
--
-- `diagnostic_cases.data_quality` sigue siendo el snapshot (lo que se sabia al
-- diagnosticar). Esta tabla es lo otro: que evaluaciones concretas se miraron,
-- para poder contestar despues "¿por que se degrado este caso?" sin adivinar.

create table if not exists public.diagnostic_case_data_quality (
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  assessment_id uuid not null references public.data_quality_assessments (id) on delete cascade,
  -- Para que se miro esa fuente en este caso.
  role varchar(20) not null default 'primary',
  created_at timestamptz not null default now(),

  primary key (case_id, assessment_id),

  constraint diagnostic_case_data_quality_rol check (
    role in ('primary', 'validation', 'context')
  )
);

comment on table public.diagnostic_case_data_quality is
  'F3/D01<->D00. Que evaluaciones de calidad sostienen un caso diagnostico. El snapshot sigue en diagnostic_cases.data_quality; esto es la traza consultable.';

create index if not exists diagnostic_case_data_quality_assessment_idx
  on public.diagnostic_case_data_quality (assessment_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Staff, igual que D00. Un issue de calidad es informacion que el cliente
-- acabara queriendo ver ("no vemos tu gasto de Meta, faltan permisos"), pero
-- hasta que exista pantalla y redaccion para eso, abrirlo seria ensenar
-- diagnostico tecnico a medio hacer. Abrirlo despues es cambiar una politica;
-- cerrarlo despues de una fuga, no.

alter table public.data_source_expectations enable row level security;
alter table public.tenant_metric_definitions enable row level security;
alter table public.data_quality_assessments enable row level security;
alter table public.data_quality_issues enable row level security;
alter table public.data_source_reconciliations enable row level security;
alter table public.diagnostic_case_data_quality enable row level security;

drop policy if exists "data_source_expectations_select_staff" on public.data_source_expectations;
create policy "data_source_expectations_select_staff" on public.data_source_expectations
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "tenant_metric_definitions_select_staff" on public.tenant_metric_definitions;
create policy "tenant_metric_definitions_select_staff" on public.tenant_metric_definitions
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "data_quality_assessments_select_staff" on public.data_quality_assessments;
create policy "data_quality_assessments_select_staff" on public.data_quality_assessments
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "data_quality_issues_select_staff" on public.data_quality_issues;
create policy "data_quality_issues_select_staff" on public.data_quality_issues
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "data_source_reconciliations_select_staff" on public.data_source_reconciliations;
create policy "data_source_reconciliations_select_staff" on public.data_source_reconciliations
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

-- Hereda del caso, igual que las hijas de D00.
drop policy if exists "diagnostic_case_data_quality_select_staff" on public.diagnostic_case_data_quality;
create policy "diagnostic_case_data_quality_select_staff" on public.diagnostic_case_data_quality
  for select to authenticated
  using (exists (select 1 from public.diagnostic_cases c where c.id = case_id));
