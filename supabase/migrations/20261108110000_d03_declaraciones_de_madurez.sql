-- D03 (madurez por capacidad): lo que declara una persona.
--
-- El motor tiene techo estructural en `defined`: `measured` exige que la medida
-- cambie decisiones (guardrail 20) y eso no se observa en ninguna tabla. Lo
-- declara el consultor. Vive aparte de `capability_maturity` porque el motor
-- reescribe el perfil en cada pasada y la declaracion tiene que sobrevivirle.
--
-- Estado actual = una fila por (organizacion, capacidad), upsert in-place
-- (ADR-0006 punto 1). Escritura via service role con chequeo manual de cartera
-- (punto 7); RLS solo deja leer al staff.
--
-- Idempotente (CLAUDE.md).

create table if not exists public.capability_maturity_declarations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  capability varchar(40) not null,
  influences_decisions boolean not null,
  has_ownership boolean not null,
  owner_role varchar(60),
  note text,
  declared_by uuid references public.profiles (id) on delete set null,
  declared_at timestamptz not null default now(),
  constraint capability_maturity_declarations_unique unique (organization_id, capability)
);

comment on table public.capability_maturity_declarations is
  'D03: lo que un consultor declara de una capacidad y el dato no puede ver (si la medida cambia decisiones, si hay responsable). maturity-engine lo aplica en cada pasada; solo sube de defined a measured si el dato ya demuestra medicion.';

alter table public.capability_maturity_declarations enable row level security;

drop policy if exists "capability_maturity_declarations_select_staff" on public.capability_maturity_declarations;
create policy "capability_maturity_declarations_select_staff" on public.capability_maturity_declarations
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

grant select on public.capability_maturity_declarations to authenticated;
