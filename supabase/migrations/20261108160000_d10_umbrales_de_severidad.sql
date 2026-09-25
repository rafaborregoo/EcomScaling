-- D10: umbrales de gravedad por tienda.
--
-- Decision de producto del 2026-09-24: hay umbrales por defecto para toda la
-- cartera (DEFAULT_SEVERITY_THRESHOLDS en packages/contracts/src/severity.ts)
-- y el consultor los cambia por tienda. Esta tabla guarda solo los cambios: sin
-- fila, la tienda usa los de por defecto. Son cuotas (0..1) sobre la base
-- elegida por D10; el motor las convierte en la severidad aguda.
--
-- Estado actual = una fila por organizacion, upsert in-place (ADR-0006 punto
-- 1). Escritura con service role y chequeo manual de cartera (punto 7); RLS
-- solo deja leer al staff.
--
-- Idempotente (CLAUDE.md).

create table if not exists public.severity_thresholds (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  low numeric(6, 4) not null,
  moderate numeric(6, 4) not null,
  high numeric(6, 4) not null,
  critical numeric(6, 4) not null,
  declared_by uuid references public.profiles (id) on delete set null,
  declared_at timestamptz not null default now(),
  constraint severity_thresholds_orden check (
    low > 0 and low < moderate and moderate < high and high < critical and critical <= 1
  )
);

comment on table public.severity_thresholds is
  'D10: umbrales de cuota de una tienda (bajo, moderado, alto, critico) que sustituyen a los de por defecto. Sin fila, se usan los de por defecto del contrato.';

alter table public.severity_thresholds enable row level security;

drop policy if exists "severity_thresholds_select_staff" on public.severity_thresholds;
create policy "severity_thresholds_select_staff" on public.severity_thresholds
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

grant select on public.severity_thresholds to authenticated;
