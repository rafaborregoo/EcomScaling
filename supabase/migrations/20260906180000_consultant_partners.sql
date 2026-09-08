-- Consultores que trabajan juntos sobre la misma cartera.
--
-- `consultant_assignments` ya admite varios consultores por tienda (N:N con
-- is_primary), asi que "dos consultores llevando la misma tienda" no necesita
-- nada nuevo. Lo que faltaba es la parte persistente: si dos consultores se
-- reparten TODA la cartera, asignar cliente a cliente obliga a acordarse de
-- repetirlo en cada alta -- y el dia que se olvide, el socio deja de ver una
-- tienda sin que nada lo avise.
--
-- Esta tabla guarda con quien trabaja cada consultor. `createClientForConsultant`
-- la lee y asigna a los socios junto al creador, asi que una tienda nueva nace
-- ya compartida.
--
-- Simetria: se guardan las DOS direcciones (A->B y B->A) en la misma
-- transaccion. Una tabla con una sola fila obligaria a consultar
-- `where a = X or b = X` en todas las lecturas, que es la clase de detalle que
-- alguien olvida en la siguiente consulta y produce un socio "a medias".

create table if not exists public.consultant_partners (
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  partner_user_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (consultant_user_id, partner_user_id),
  constraint consultant_partners_not_self
    check (consultant_user_id <> partner_user_id)
);

comment on table public.consultant_partners is
  'Consultores que comparten cartera: cada pareja se guarda en las dos direcciones. Leida por createClientForConsultant para asignar al socio en cada alta.';

-- La lectura habitual es "los socios de X".
create index if not exists consultant_partners_consultant_idx on public.consultant_partners (consultant_user_id);

alter table public.consultant_partners enable row level security;

-- Un consultor ve sus propias parejas; platform admin las ve todas. Las
-- escrituras van por service role con chequeo manual en Node (ADR-0006 #7):
-- crear una pareja asigna tiendas, y eso no se decide desde el cliente.
drop policy if exists "consultant_partners_select_own" on public.consultant_partners;
create policy "consultant_partners_select_own" on public.consultant_partners for select to authenticated
using (
  private.is_platform_admin()
  or consultant_user_id = (select auth.uid())
  or partner_user_id = (select auth.uid())
);

grant select on public.consultant_partners to authenticated;
