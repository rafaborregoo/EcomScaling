-- ---------------------------------------------------------------------------
-- FASE 3 / D01 — lo que el motor necesita para poder reejecutarse.
--
-- `20260914160000` creo las tablas de D01 pensando en quien escribe a mano: una
-- evaluacion, un issue, cada uno con su fila. Con un motor que pasa cada dia
-- sobre todas las organizaciones eso no vale: la segunda pasada duplicaria todo
-- y la tercera triplicaria, hasta que "que fuentes fallan" deje de poder
-- responderse mirando la tabla.
--
-- El patron es el del ADR-0006 punto 1: estado actual con upsert in-place,
-- nunca append-only leido con DISTINCT ON. Lo que falta para poder hacerlo es
-- la huella por la que dos pasadas reconocen la misma cosa.
--
-- Idempotente (regla de CLAUDE.md): `add column if not exists` y
-- `create unique index if not exists`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- EVALUACION — una por fuente, scope y ventana
-- ---------------------------------------------------------------------------
--
-- Una evaluacion responde "¿aguanta esta fuente, para este fenomeno, en este
-- periodo?". Reevaluar el mismo periodo no crea una segunda respuesta: corrige
-- la primera. `assessed_at` dice cuando se miro por ultima vez.
--
-- La huella es columna generada y no la escribe el motor: si la calculara el
-- codigo, un dia calcularia distinto y la unicidad dejaria de significar lo que
-- dice. `at time zone 'UTC'` esta para que la expresion sea inmutable, que es
-- un instante en una columna generada: `::text` depende de DateStyle y `to_char`
-- del locale, y Postgres rechaza las dos.

alter table public.data_quality_assessments
  add column if not exists fingerprint text
  generated always as (
    source || '|' || dataset || '|' || phenomenon || '|' || scope
    || '|' || coalesce(store_id::text, '-')
    || '|' || extract(epoch from (period_start at time zone 'UTC'))::text
    || '|' || extract(epoch from (period_end at time zone 'UTC'))::text
  ) stored;

comment on column public.data_quality_assessments.fingerprint is
  'F3/D01. La identidad de una evaluacion: misma fuente, mismo scope y misma ventana son la misma evaluacion, no dos. Generada en base para que el motor no pueda calcularla distinto.';

create unique index if not exists data_quality_assessments_huella_idx
  on public.data_quality_assessments (organization_id, fingerprint);

-- ---------------------------------------------------------------------------
-- ISSUE — uno abierto por tipo, fuente y scope
-- ---------------------------------------------------------------------------
--
-- Aqui la unicidad es **parcial a proposito**, y es la decision de fondo de
-- esta migracion: solo puede haber un issue ABIERTO del mismo tipo sobre la
-- misma fuente. Los cerrados se acumulan, porque son el historial: saber que
-- este permiso ya se cayo tres veces en dos meses es informacion, y colapsarlos
-- en una sola fila la borraria.
--
-- El efecto secundario que interesa: un issue que alguien marco como explicado
-- no puede ser reabierto en silencio por la siguiente pasada del motor. Si la
-- averia vuelve, entra una fila nueva, con su fecha -- que es justo lo que hay
-- que ver.

alter table public.data_quality_issues
  add column if not exists fingerprint text
  generated always as (
    source || '|' || coalesce(dataset, '-') || '|' || coalesce(phenomenon, '-')
    || '|' || scope
    || '|' || coalesce(store_id::text, '-')
    || '|' || issue_type
  ) stored;

comment on column public.data_quality_issues.fingerprint is
  'F3/D01. La identidad de un fallo: mismo tipo, misma fuente, mismo scope. Unica solo entre los abiertos, para que el historial de cierres se conserve.';

create unique index if not exists data_quality_issues_huella_abierta_idx
  on public.data_quality_issues (organization_id, fingerprint)
  where status in ('open', 'investigating');
