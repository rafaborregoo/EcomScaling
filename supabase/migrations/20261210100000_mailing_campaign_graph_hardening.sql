-- ADR-0025 (endurecimiento): reintento/descarte de emails fallidos, presupuesto
-- de reintentos separado para rechazo humano, rol de membresia del aprobador,
-- cierre sin pisar campañas fallidas y exclusion entre procesos.
--
-- Idempotente: si el esquema se toca por fuera, db:push la reaplica sin dano.

-- Exclusion entre procesos (API y worker): quien tiene el lease mueve el grafo.
alter table public.marketing_mailing_sequences
  add column if not exists graph_lease_until timestamptz;

-- Si el cliente tenia consultor asignado al arrancar la campaña. Se guarda una
-- vez para no consultarlo en cada refresco de la pantalla.
alter table public.marketing_mailing_sequences
  add column if not exists graph_requires_consultant_review boolean not null default false;

-- Hasta 2 reintentos automaticos + 2 por rechazo humano = versiones 0..4.
alter table public.marketing_mailing_campaign_emails
  drop constraint if exists marketing_mailing_campaign_emails_attempt_check;
alter table public.marketing_mailing_campaign_emails
  add constraint marketing_mailing_campaign_emails_attempt_check check (attempt between 0 and 4);

-- Decision de una persona sobre un email fallido: reintentar o descartar.
alter table public.marketing_mailing_campaign_emails
  add column if not exists failure_decision varchar(16),
  add column if not exists failure_decided_by uuid references public.profiles (id) on delete set null,
  add column if not exists failure_decided_at timestamptz;

alter table public.marketing_mailing_campaign_emails
  drop constraint if exists marketing_mailing_campaign_emails_failure_decision_check;
alter table public.marketing_mailing_campaign_emails
  add constraint marketing_mailing_campaign_emails_failure_decision_check
  check (failure_decision is null or failure_decision in ('retry', 'discard'));

-- Rol de membresia (owner, manager...) de quien aprobo, ademas del rol de plataforma.
alter table public.marketing_mailing_campaign_emails
  add column if not exists decided_membership_role varchar(32);

comment on column public.marketing_mailing_sequences.graph_lease_until is
  'ADR-0025: lease de ejecucion del grafo (API o worker). Caduca solo si el proceso muere.';
comment on column public.marketing_mailing_campaign_emails.failure_decision is
  'ADR-0025: decision humana sobre un email fallido; el grafo la relee al reanudar y la limpia al salir de failed.';
