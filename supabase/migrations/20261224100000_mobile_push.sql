-- App móvil: notificaciones push.
--
-- 1. Un dispositivo = un token de Expo Push; una persona puede tener varios.
-- 2. `notifications.push_sent_at` marca que el push de ese aviso ya se decidió
--    (enviado o descartado), igual que `email_sent_at` para el correo.
-- 3. Escrituras por la API (service role); RLS solo select (ADR-0006 punto 7).
--
-- Idempotente.

create table if not exists public.mobile_push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists mobile_push_tokens_user_idx
  on public.mobile_push_tokens (user_id);

alter table public.mobile_push_tokens enable row level security;

drop policy if exists mobile_push_tokens_select_own on public.mobile_push_tokens;
create policy mobile_push_tokens_select_own on public.mobile_push_tokens
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.mobile_push_tokens to authenticated;

alter table public.notifications
  add column if not exists push_sent_at timestamptz;

create index if not exists notifications_push_pending_idx
  on public.notifications (created_at)
  where push_sent_at is null;
