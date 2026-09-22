-- El indice unico de klaviyo_report_runs era parcial
-- (`where idempotency_key is not null`), y eso rompe todo upsert que lo use.
--
-- Postgres solo infiere un indice parcial en un ON CONFLICT si la sentencia
-- repite su predicado, y PostgREST no emite ninguno: `onConflict` via .upsert()
-- falla siempre con 42P10 "no unique or exclusion constraint matching the ON
-- CONFLICT specification". Le pasa a apps/api/src/klaviyo-sync.ts al registrar
-- un report run (sync real de campaign-values) y a scripts/seed-klaviyo-history.ts.
--
-- Quitar el predicado no cambia la semantica: en un indice unico normal los
-- NULL siguen siendo distintos entre si, asi que las filas sin idempotency_key
-- se comportan igual que antes.

drop index if exists public.klaviyo_report_runs_account_idempotency_key_uidx;

create unique index if not exists klaviyo_report_runs_account_idempotency_key_uidx
  on public.klaviyo_report_runs (account_id, idempotency_key);

comment on column public.klaviyo_report_runs.idempotency_key is
  'Deterministic account-scoped key for a Reporting API request; permits safe retries.';
