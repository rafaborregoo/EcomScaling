-- ---------------------------------------------------------------------------
-- FASE 3 / D02 — lo que el motor de contextualizacion necesita para repetirse.
--
-- Mismo problema que resolvio `20260926090000` para D01 y misma forma de
-- resolverlo: sin una huella, la segunda pasada del motor duplica todo lo que
-- escribio la primera.
--
-- Aqui hay ademas una decision que conviene dejar por escrito, porque se nota
-- en el esquema: **`context_assessments.case_id` es obligatorio y hoy no hay
-- nadie que abra casos diagnosticos**. `D00` define que es un caso pero no
-- quien lo crea; `D06` (sintomas) seria su sitio natural y todavia no existe.
-- Mientras tanto lo abre el motor de `D02` a partir de una senal de `D05`, con
-- su huella para no abrir dos veces el mismo. Cuando exista `D06`, la apertura
-- se mueve alli y esta huella se queda igual -- anotado en
-- `conocimiento/TAREAS_PENDIENTES.md`.
--
-- Idempotente (regla de CLAUDE.md).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- CASO — uno por metrica, scope y ventana de analisis
-- ---------------------------------------------------------------------------
--
-- Dos investigaciones sobre la misma metrica, el mismo alcance y el mismo
-- periodo son la misma investigacion. Si de verdad son dos preguntas
-- distintas, se diferencian por `scope` o por ventana, que es justo lo que la
-- huella recoge.
--
-- El periodo entra como epoch UTC porque es la unica forma inmutable de meter
-- un instante en una columna generada: `::text` depende de DateStyle y
-- `to_char` del locale, y Postgres rechaza las dos.

alter table public.diagnostic_cases
  add column if not exists fingerprint text
  generated always as (
    target_metric || '|' || scope
    || '|' || coalesce(store_id::text, '-')
    || '|' || extract(epoch from (analysis_period_start at time zone 'UTC'))::text
    || '|' || extract(epoch from (analysis_period_end at time zone 'UTC'))::text
  ) stored;

comment on column public.diagnostic_cases.fingerprint is
  'F3/D02. La identidad de una investigacion: misma metrica, mismo alcance y misma ventana son el mismo caso. Existe para que un motor pueda reejecutarse sin abrir casos duplicados.';

create unique index if not exists diagnostic_cases_huella_idx
  on public.diagnostic_cases (organization_id, fingerprint);

-- ---------------------------------------------------------------------------
-- LECTURA CONTEXTUAL — una vigente por caso y alcance
-- ---------------------------------------------------------------------------
--
-- Aqui no hace falta huella: `case_id` + `scope` ya son la identidad natural.
-- Recontextualizar el mismo caso con el mismo alcance no produce una segunda
-- lectura, corrige la primera -- y `assessed_at` dice cuando se miro.
--
-- Al contrario que los issues de D01, aqui NO se conserva historial: el
-- contexto vigente de entonces ya queda congelado en `context_snapshot`, que
-- tiene su propio trigger anti-reescritura (guardrail 38). Guardar ademas cada
-- pasada seria la misma verdad dos veces.

create unique index if not exists context_assessments_caso_scope_idx
  on public.context_assessments (case_id, scope);
