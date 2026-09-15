-- FASE 3 / D06 — Idempotencia del motor de sintomas.
--
-- El contrato de D06 (`20260917090000`) define que es un sintoma. Esto es lo
-- que hace falta para que un motor pueda **escribirlos todos los dias sin
-- duplicarlos**, que es otra cosa.
--
-- LA DECISION: UN SINTOMA ES UN EPISODIO, NO UNA FOTO DIARIA. Si la caida de
-- ventas sigue ahi manana, no es un segundo sintoma: es el mismo, un dia mas
-- viejo. Por eso la huella no lleva fecha --`canonical_type`, `scope` y tienda,
-- nada mas-- y el indice unico es **parcial, solo sobre los activos**. Los
-- resueltos se acumulan como historia, que es justo lo que hace falta para el
-- paso 19 del runtime: sin episodios cerrados no hay forma de distinguir un
-- patron recurrente de uno cronico. Mismo criterio que las incidencias de D01,
-- y por el mismo motivo: reabrir en silencio algo que alguien cerro a mano
-- destruye el unico rastro de que se cerro.
--
-- La evidencia se desduplica por `md5(observation)` y no por el texto entero
-- porque el texto es libre y el indice btree tiene limite de tamano; el hash es
-- inmutable, que es lo que exige un indice sobre expresion.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- 1. La huella del episodio
-- ---------------------------------------------------------------------------

alter table public.symptoms
  add column if not exists fingerprint text
  generated always as (
    canonical_type || '|' || scope || '|' || coalesce(store_id::text, '-')
  ) stored;

comment on column public.symptoms.fingerprint is
  'F3/D06. Identidad del episodio: tipo, alcance y tienda. Sin fecha a proposito -- '
  'un sintoma que dura tres semanas es uno, no veintiuno.';

create unique index if not exists symptoms_huella_activa_idx
  on public.symptoms (organization_id, fingerprint)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- 2. Evidencia y puente con D00, sin duplicar
-- ---------------------------------------------------------------------------

-- El hash va en columna generada y no en el indice sobre expresion porque
-- PostgREST solo sabe resolver `on_conflict` con nombres de columna: un indice
-- sobre `md5(observation)` seria correcto en SQL e inservible desde el motor.
alter table public.symptom_evidence
  add column if not exists observation_hash text
  generated always as (md5(observation)) stored;

create unique index if not exists symptom_evidence_unica_idx
  on public.symptom_evidence (symptom_id, source_kind, observation_hash);

create unique index if not exists diagnostic_symptoms_origen_idx
  on public.diagnostic_symptoms (case_id, source_symptom_id)
  where source_symptom_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Lectura del mapa de sintomas (apartado 20)
-- ---------------------------------------------------------------------------
--
-- La pantalla pide los activos de una organizacion ordenados por familia. El
-- indice existente (`symptoms_org_idx`) cubre organizacion y estado; este anade
-- la capacidad, que es como el apartado 20 quiere ver el mapa.

create index if not exists symptoms_mapa_idx
  on public.symptoms (organization_id, status, capability);

-- ---------------------------------------------------------------------------
-- 4. La aritmetica del ecommerce, declarada
-- ---------------------------------------------------------------------------
--
-- `metric_dependencies` existe desde D05 y esta vacia, asi que hasta ahora no
-- servia para nada. Es la tabla de la que D06 lee **si dos metricas tienen algo
-- que ver**: el guardrail 9 prohibe crear un sintoma porque dos senales
-- coincidan, y el 10 exige una relacion declarada. Declararla es esto.
--
-- Sin organizacion porque no es una particularidad de nadie: las ventas netas
-- son pedidos por ticket medio en cualquier tienda. Las relaciones propias de
-- un tenant van con su `organization_id`, y el indice unico las separa.

insert into public.metric_dependencies (organization_id, metric, depends_on, relation, rationale)
select null, 'net_sales', 'orders_count', 'component',
       'Las ventas netas son el numero de pedidos por el ticket medio: si una se mueve sin la otra, lo que cambio es el ticket.'
where not exists (
  select 1 from public.metric_dependencies
  where organization_id is null
    and metric = 'net_sales'
    and depends_on = 'orders_count'
    and relation = 'component'
);
