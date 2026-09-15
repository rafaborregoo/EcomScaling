-- FASE 3 / D06 — Motor de sintomas.
--
-- Fuentes: conocimiento/fase-03/02-contratos-IA/d06-requisitos-contrato-sintomas.md
--          conocimiento/fase-03/04-policies-guardrails/d06-guardrails-sintomas.md
--          conocimiento/fase-03/03-runtime/d06-flujo-motor-sintomas.md
--          conocimiento/fase-03/06-tenant-context/d06-contexto-motor-sintomas.md
--          conocimiento/fase-03/05-experience-learning/d06-memoria-diagnostica-sintomas.md
--
-- D05 tiene prohibido interpretar: puede decir "el CTR cae un 34%" y nada mas.
-- D06 es el bloque que cruza esa linea y solo esa. Convierte senales coherentes
-- entre si en un patron empresarial observable. Sigue sin poder decir por que
-- pasa (D07-D09) ni que hacer (F5+).
--
-- LAS OCHO PRIMERAS LINEAS DE LOS GUARDRAILS SON LA FRONTERA: senal no es
-- sintoma, y sintoma no es hipotesis, ni causa, ni restriccion, ni salud, ni
-- gap de madurez, ni prioridad, ni recomendacion. Por eso aqui no existe
-- ninguna columna `hypothesis`, `root_cause`, `cause`, `constraint`, `action`,
-- `recommendation`, `priority`, `severity` ni `health_state`.
--
-- LA OMISION MAS IMPORTANTE ES `direction`, Y ES DELIBERADA. El guardrail 21
-- dice que la valencia es contextual y el 22 lo ejemplifica: "CAC arriba" no es
-- automaticamente un sintoma negativo -- puede ser el precio de entrar en un
-- mercado nuevo. Si el sintoma guardase la direccion de la metrica, calcular la
-- valencia a partir de ella seria la cosa mas natural del mundo y nadie se
-- daria cuenta. La direccion vive en las senales de D05, a un join de
-- distancia: consultarla exige un acto deliberado. **La garantia no es que
-- este prohibido derivar valencia de direccion; es que el dato no esta aqui.**
--
-- SIMULTANEIDAD NO ES SINTOMA (guardrails 9 y 10). Que cinco senales caigan el
-- mismo martes no las relaciona. Por eso los factores de coherencia son
-- columnas separadas -- `same_time_window` no es lo mismo que
-- `known_relationship` -- y un sintoma no puede declararse de confianza alta
-- sin relacion conocida, scope compatible y calidad de senal suficiente.
--
-- LO LOCAL NO SE GENERALIZA NI SE ESCONDE (guardrails 23, 24, 25 y 26). Un
-- sintoma con scope distinto de `business` esta obligado a decir donde: el
-- check exige `scope_detail` no vacio. "Deterioro de adquisicion" y "deterioro
-- de prospecting en Francia" no son el mismo hallazgo, y el agregado estable no
-- es excusa para tapar el segundo.
--
-- LAS RELACIONES SON CANDIDATAS, NO ARISTAS CAUSALES (guardrails 14 y 18). El
-- catalogo de `symptom_relations.relation` contiene `may_precede`,
-- `may_follow`, `often_cooccurs` y `related`. No contiene `causes` ni
-- `caused_by`, y anadirlo exigiria tocar este check, que es justo la friccion
-- que se busca. El grafo causal es D07.
--
-- LA MEMORIA ORIENTA, NO CONFIRMA (guardrail 36, experience-learning 11). Un
-- sintoma puede apuntar al episodio anterior parecido con `previous_symptom_id`
-- y guardar el contexto de entonces, pero el snapshot es inmutable por trigger:
-- reescribirlo con el contexto de hoy convierte la memoria en una profecia
-- cumplida. Mismo guardrail que en D02.
--
-- SALUD Y SINTOMA COEXISTEN, A PROPOSITO SIN CHECK (guardrails 40, 41 y 42).
-- Una capacidad HEALTHY puede presentar un sintoma adelantado de riesgo, y un
-- gap de madurez de D03 no es un sintoma. No hay ninguna restriccion que ate
-- `symptoms` a `capability_health` ni a `capability_maturity`: la combinacion
-- aparentemente contradictoria tiene que poder existir, y hay tests que
-- comprueban que se permite para que nadie la "arregle" mas adelante.

-- ---------------------------------------------------------------------------
-- 1. El sintoma
-- ---------------------------------------------------------------------------

create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,

  -- Apartados 1 y 2: familia de dominio y tipo canonico.
  symptom_family varchar(24) not null,
  canonical_type varchar(80) not null,
  label text not null,

  -- Apartado 3. Sin `direction` de la que derivarla (ver cabecera).
  valence varchar(12) not null,

  capability varchar(24),

  -- Apartados 6 y 19: donde pasa, con el detalle obligatorio si no es global.
  scope varchar(16) not null default 'business',
  scope_detail jsonb not null default '{}'::jsonb,

  -- Apartados 8, 9 y 10.
  diagnostic_depth varchar(16) not null default 'surface',
  process_position varchar(12),
  time_role varchar(12),

  -- Apartado 11 y memoria diagnostica.
  onset_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  persistence varchar(12) not null default 'acute',
  recurrence_count integer not null default 0,

  -- Apartados 4 y 18: los factores de coherencia, uno a uno. El resultado no se
  -- resume en un campo: los factores SON el resultado, y un resumen invitaria a
  -- mirarlo en lugar de a ellos.
  same_time_window boolean not null default false,
  compatible_scope boolean not null default false,
  compatible_direction boolean not null default false,
  known_relationship boolean not null default false,
  sufficient_signal_quality boolean not null default false,
  coherence_relationship varchar(16),

  confidence varchar(20) not null default 'low',
  -- Guardrail 33: D01 limita que senales pueden usarse. Se hereda, no se supone.
  data_confidence varchar(20) not null default 'low',

  -- Guardrails 19 y 20: D02 tiene que poder corregir el patron.
  context_assessment_id uuid references public.context_assessments (id) on delete set null,
  context_reviewed boolean not null default false,

  business_relevance varchar(12) not null default 'medium',

  -- Apartado 7: jerarquia padre-hijo.
  parent_symptom_id uuid references public.symptoms (id) on delete set null,
  -- Apartado 21: el episodio anterior parecido.
  previous_symptom_id uuid references public.symptoms (id) on delete set null,
  context_snapshot jsonb not null default '{}'::jsonb,

  status varchar(16) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint symptoms_familia check (symptom_family in (
    'acquisition','creative','conversion','offer','product','retention',
    'inventory','operations','financial','data','technology','team',
    'strategy','cross_capability'
  )),
  constraint symptoms_valencia check (valence in ('negative','positive','neutral','mixed')),
  constraint symptoms_capacidad check (capability is null or capability in (
    'market','product','offer','unit_economics','acquisition','creative',
    'conversion','retention','inventory','operations','finance','data',
    'technology','team','strategy'
  )),
  constraint symptoms_scope check (scope in (
    'business','capability','subcapability','channel','market','product','segment'
  )),
  constraint symptoms_profundidad check (diagnostic_depth in ('surface','intermediate','deep')),
  constraint symptoms_posicion check (
    process_position is null or process_position in ('upstream','midstream','downstream')
  ),
  constraint symptoms_rol_temporal check (
    time_role is null or time_role in ('leading','coincident','lagging')
  ),
  constraint symptoms_persistencia check (
    persistence in ('acute','recurring','chronic','persistent')
  ),
  constraint symptoms_confianza check (
    confidence in ('insufficient_data','low','medium','high')
  ),
  constraint symptoms_confianza_dato check (
    data_confidence in ('insufficient_data','low','medium','high')
  ),
  constraint symptoms_relevancia check (
    business_relevance in ('low','medium','high','critical')
  ),
  constraint symptoms_estado check (status in ('active','resolved','superseded')),
  constraint symptoms_relacion_catalogo check (
    coherence_relationship is null or coherence_relationship in (
      'temporal','mathematical','funnel','functional','economic','operational'
    )
  ),

  -- Guardrails 9 y 10: si se afirma que hay relacion conocida, hay que decir de
  -- que clase. "Pasaron a la vez" no es una clase de relacion.
  constraint symptoms_relacion_declarada check (
    not known_relationship or coherence_relationship is not null
  ),

  -- Guardrails 12 y 34: no elevar un cluster debil a sintoma fuerte.
  constraint symptoms_confianza_exige_coherencia check (
    confidence <> 'high'
    or (sufficient_signal_quality and known_relationship and compatible_scope)
  ),

  -- Guardrail 33: la confianza del sintoma no puede superar a la del dato.
  constraint symptoms_sin_dato_no_hay_confianza check (
    data_confidence <> 'insufficient_data'
    or confidence in ('insufficient_data','low')
  ),

  -- Guardrails 19 y 20: afirmar con fuerza sin haber mirado el contexto es como
  -- se fabrican los sintomas falsos de temporada, promocion o mix.
  constraint symptoms_alta_confianza_exige_contexto check (
    confidence <> 'high' or context_reviewed
  ),

  -- Guardrails 23, 25 y 26: si no es global, tiene que decir donde.
  constraint symptoms_local_se_localiza check (
    scope = 'business' or scope_detail <> '{}'::jsonb
  ),

  -- Experience-learning 2: recurrente exige haberlo visto mas de una vez.
  constraint symptoms_recurrente_tiene_historia check (
    persistence <> 'recurring' or recurrence_count >= 2
  ),

  constraint symptoms_resuelto_tiene_fecha check (
    status <> 'resolved' or resolved_at is not null
  ),
  constraint symptoms_ventana_coherente check (last_seen_at >= first_seen_at)
);

comment on table public.symptoms is
  'F3/D06. Patron empresarial observable formado por senales coherentes entre si. '
  'No guarda direccion de metrica (la valencia es contextual, guardrail 22), ni causa, '
  'ni accion, ni prioridad: esas fronteras se garantizan por ausencia de columna.';

comment on column public.symptoms.valence is
  'Guardrail 21: contextual. No se deriva de la direccion de ninguna metrica; la '
  'direccion ni siquiera esta en esta tabla.';

comment on column public.symptoms.context_snapshot is
  'Contexto de cuando se observo, inmutable por trigger. Reescribirlo con el contexto '
  'de hoy convierte la memoria diagnostica en una profecia cumplida.';

create index if not exists symptoms_org_idx on public.symptoms (organization_id, status);
create index if not exists symptoms_familia_idx on public.symptoms (organization_id, symptom_family);
create index if not exists symptoms_padre_idx on public.symptoms (parent_symptom_id);
create index if not exists symptoms_anterior_idx on public.symptoms (previous_symptom_id);

drop trigger if exists set_symptoms_updated_at on public.symptoms;
create trigger set_symptoms_updated_at before update on public.symptoms
for each row execute function private.set_updated_at();

-- Un sintoma no puede ser su propio padre ni su propio antecedente. Va como
-- trigger y no como check porque `id` se genera por default y el check sobre la
-- propia fila no lo ve en el insert.
create or replace function private.symptoms_sin_ciclo_directo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.parent_symptom_id = new.id then
    raise exception 'Un sintoma no puede ser su propio padre (F3/D06 apartado 7).';
  end if;
  if new.previous_symptom_id = new.id then
    raise exception 'Un sintoma no puede ser su propio episodio anterior (F3/D06 apartado 21).';
  end if;
  return new;
end;
$$;

drop trigger if exists symptoms_sin_ciclo_directo on public.symptoms;
create trigger symptoms_sin_ciclo_directo
  before insert or update on public.symptoms
  for each row execute function private.symptoms_sin_ciclo_directo();

-- Guardrail 36 y experience-learning 10: la memoria solo sirve si conserva el
-- contexto de entonces. Mismo guardrail que D02, y por el mismo motivo.
create or replace function private.prevent_symptom_snapshot_overwrite()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.context_snapshot <> '{}'::jsonb
     and new.context_snapshot is distinct from old.context_snapshot then
    raise exception
      'El snapshot contextual de un sintoma es inmutable (F3/D06): reescribirlo con el contexto actual hace que dos episodios parezcan comparables cuando no lo son.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_symptom_snapshot_overwrite on public.symptoms;
create trigger prevent_symptom_snapshot_overwrite
  before update on public.symptoms
  for each row execute function private.prevent_symptom_snapshot_overwrite();

-- ---------------------------------------------------------------------------
-- 2. Las senales que lo sostienen (apartado 5)
-- ---------------------------------------------------------------------------

create table if not exists public.symptom_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  symptom_id uuid not null references public.symptoms (id) on delete cascade,
  signal_id uuid not null references public.signals (id) on delete cascade,

  -- Guardrail 13: la evidencia contradictoria se preserva, no se descarta. Por
  -- eso `contradicting` es un rol de primera clase y no un borrado.
  role varchar(16) not null default 'supporting',
  note text,
  created_at timestamptz not null default now(),

  constraint symptom_signals_rol check (
    role in ('required','supporting','contradicting','neutral')
  ),
  constraint symptom_signals_unica unique (symptom_id, signal_id)
);

comment on table public.symptom_signals is
  'F3/D06 apartado 5. Une sintoma y senales de D05 diciendo que papel juega cada una. '
  'El rol `contradicting` existe porque el guardrail 13 obliga a conservar lo que no encaja.';

create index if not exists symptom_signals_sintoma_idx on public.symptom_signals (symptom_id);
create index if not exists symptom_signals_senal_idx on public.symptom_signals (signal_id);

-- ---------------------------------------------------------------------------
-- 3. Evidencia multimodal (apartado 17, guardrail 35)
-- ---------------------------------------------------------------------------

create table if not exists public.symptom_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  symptom_id uuid not null references public.symptoms (id) on delete cascade,

  source_kind varchar(16) not null,
  stance varchar(16) not null default 'supporting',
  observation text not null,
  -- Guardrail 35: un texto cualitativo sin representatividad es una anecdota.
  representativeness varchar(12),
  sample_size integer,
  reference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint symptom_evidence_fuente check (
    source_kind in ('metric','review','ticket','call','survey','log','other')
  ),
  constraint symptom_evidence_postura check (stance in ('supporting','contradicting')),
  constraint symptom_evidence_representatividad check (
    representativeness is null
    or representativeness in ('unknown','low','medium','high')
  ),
  -- Lo cualitativo esta obligado a declarar cuanto representa. Puede ser
  -- `unknown` -- lo que no puede es callarlo.
  constraint symptom_evidence_cualitativa_declara_alcance check (
    source_kind not in ('review','ticket','call','survey')
    or representativeness is not null
  ),
  constraint symptom_evidence_muestra_para_afirmar check (
    representativeness is null
    or representativeness not in ('medium','high')
    or sample_size is not null
  )
);

comment on table public.symptom_evidence is
  'F3/D06 apartado 17. Evidencia mas alla de las metricas (resenas, tickets, llamadas, '
  'encuestas, logs). La cualitativa esta obligada a declarar su representatividad: '
  'el guardrail 35 no deja que tres resenas sostengan un sintoma como si fueran trescientas.';

create index if not exists symptom_evidence_sintoma_idx on public.symptom_evidence (symptom_id, stance);

-- ---------------------------------------------------------------------------
-- 4. Relaciones candidatas (apartados 12 y 13)
-- ---------------------------------------------------------------------------

create table if not exists public.symptom_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  from_symptom_id uuid not null references public.symptoms (id) on delete cascade,
  to_symptom_id uuid not null references public.symptoms (id) on delete cascade,

  -- El catalogo entero. No hay `causes` ni `caused_by`, y anadirlos obligaria a
  -- tocar este check: esa friccion es el guardrail 18 hecho codigo.
  relation varchar(20) not null,
  rationale text,
  observed_lag_days integer,
  created_at timestamptz not null default now(),

  constraint symptom_relations_catalogo check (
    relation in ('may_precede','may_follow','often_cooccurs','related')
  ),
  constraint symptom_relations_no_reflexiva check (from_symptom_id <> to_symptom_id),
  constraint symptom_relations_unica unique (from_symptom_id, to_symptom_id, relation)
);

comment on table public.symptom_relations is
  'F3/D06 apartados 12 y 13. Grafo de sintomas NO causal: solo puede decir que uno '
  'suele preceder, seguir o coincidir con otro. El grafo causal es D07, y el catalogo '
  'de `relation` esta cerrado precisamente para que nadie cruce esa linea sin migracion.';

create index if not exists symptom_relations_desde_idx on public.symptom_relations (from_symptom_id);
create index if not exists symptom_relations_hacia_idx on public.symptom_relations (to_symptom_id);

-- ---------------------------------------------------------------------------
-- 5. Puente con D00
-- ---------------------------------------------------------------------------

alter table public.diagnostic_symptoms
  add column if not exists source_symptom_id uuid references public.symptoms (id) on delete set null;

comment on column public.diagnostic_symptoms.source_symptom_id is
  'F3/D06. El sintoma del motor que originó esta fila del caso diagnostico de D00.';

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.symptoms enable row level security;
alter table public.symptom_signals enable row level security;
alter table public.symptom_evidence enable row level security;
alter table public.symptom_relations enable row level security;

-- Audiencia (punto 7 del DoD del plan): material de trabajo del consultor. El
-- cliente no ve sintomas en crudo -- ve lo que se le puede explicar o accionar,
-- y eso llega mas adelante en la cadena. platform_admin ve todo.
drop policy if exists "symptoms_select_staff" on public.symptoms;
create policy "symptoms_select_staff" on public.symptoms
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "symptom_signals_select_staff" on public.symptom_signals;
create policy "symptom_signals_select_staff" on public.symptom_signals
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "symptom_evidence_select_staff" on public.symptom_evidence;
create policy "symptom_evidence_select_staff" on public.symptom_evidence
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

drop policy if exists "symptom_relations_select_staff" on public.symptom_relations;
create policy "symptom_relations_select_staff" on public.symptom_relations
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );
