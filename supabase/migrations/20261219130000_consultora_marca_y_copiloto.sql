-- Configuración v3, fases 4 y 5.
--
-- 1. Marca de la consultora (nombre comercial, logo, correo de respuesta) y
--    ajustes de partida que se copian a cada cliente nuevo al vincularse.
--    Solo tienen sentido en organizations.kind = 'consulting'; se guardan en la
--    misma tabla porque la consultora ya es una fila de organizations.
-- 2. Qué análisis automáticos de la IA corren en cada organización. El
--    orquestador (runDiagnosticOrchestratorTick) salta los grupos apagados.
--
-- Idempotente.

alter table public.organizations
  add column if not exists brand_name text,
  add column if not exists brand_logo_url text,
  add column if not exists brand_reply_to text,
  add column if not exists client_defaults jsonb;

create table if not exists public.organization_ai_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  -- Grupos de agentes apagados: 'lectura', 'tareas', 'stock', 'email',
  -- 'planes', 'canales'. Vacío = todo encendido.
  disabled_groups text[] not null default '{}',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.organization_ai_settings enable row level security;

drop policy if exists organization_ai_settings_select on public.organization_ai_settings;
create policy organization_ai_settings_select on public.organization_ai_settings
  for select to authenticated
  using (private.can_access_org(organization_id));

grant select on public.organization_ai_settings to authenticated;
