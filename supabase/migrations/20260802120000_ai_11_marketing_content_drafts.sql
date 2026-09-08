-- AI-11 Fase A: borradores de contenido Klaviyo sin conexión al proveedor.
-- No existe ningún camino de envío/publicación remota en esta fase.
create table if not exists public.marketing_content_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  agent_output_id uuid references public.agent_outputs (id) on delete set null,
  content_type varchar(30) not null,
  status varchar(30) not null default 'pending_approval',
  request jsonb not null,
  summary text not null,
  template_name varchar(160) not null,
  subject varchar(255) not null,
  preheader varchar(255) not null default '',
  from_name varchar(160) not null default '',
  reply_to varchar(320),
  purpose varchar(500) not null,
  audience varchar(500) not null,
  locale varchar(20) not null,
  tone varchar(120) not null,
  plain_text text not null,
  html text not null,
  blocks jsonb not null default '[]'::jsonb,
  personalization_tokens jsonb not null default '[]'::jsonb,
  compliance_notes jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  confidence varchar(20) not null,
  warnings jsonb not null default '[]'::jsonb,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_content_drafts_content_type check (content_type in ('campaign', 'flow_step', 'popup')),
  constraint marketing_content_drafts_status check (status in ('draft', 'pending_approval', 'approved', 'rejected')),
  constraint marketing_content_drafts_confidence check (confidence in ('low', 'medium', 'high'))
);

create index if not exists marketing_content_drafts_org_created_idx on public.marketing_content_drafts (organization_id, created_at desc);
create index if not exists marketing_content_drafts_status_idx on public.marketing_content_drafts (organization_id, status);
create unique index if not exists marketing_content_drafts_agent_output_idx on public.marketing_content_drafts (agent_output_id)
  where agent_output_id is not null;

drop trigger if exists set_marketing_content_drafts_updated_at on public.marketing_content_drafts;
create trigger set_marketing_content_drafts_updated_at
before update on public.marketing_content_drafts
for each row execute function private.set_updated_at();

alter table public.marketing_content_drafts enable row level security;

drop policy if exists "marketing_content_drafts_select_consultants" on public.marketing_content_drafts;
create policy "marketing_content_drafts_select_consultants" on public.marketing_content_drafts for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.marketing_content_drafts to authenticated;

comment on table public.marketing_content_drafts is
  'AI-11 Fase A: borradores Klaviyo sanitizados, revisables y nunca enviados/publicados por API.';

insert into public.agent_definitions (code, name, description)
values (
  'a11_generador_marketing',
  'Generador de marketing Klaviyo',
  'Genera borradores de email, flow step o popup para revisión humana; no conecta ni envía contenido a Klaviyo.'
)
on conflict (code) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a11_generador_marketing_system',
  'v1',
  $$Eres el generador de marketing de EcomScaling. Crea un borrador portable para Klaviyo a partir del brief del consultor. No inventes métricas, resultados, productos, descuentos, URLs ni condiciones que no estén en el brief o en las fuentes disponibles. Si falta información, deja el campo claro y añade un warning. Devuelve siempre el contrato estructurado completo: resumen, nombre de plantilla, asunto, preheader, remitente, reply-to, propósito, audiencia, locale, tono, texto plano, HTML compatible con email, bloques reutilizables, tokens de personalización, notas de compliance, fuentes, confianza, warnings y approval_required=true. El HTML debe usar estructura compatible con clientes de correo, sin script, iframe, handlers, javascript:, CSS externo, Flexbox ni Grid. Para popup devuelve un snippet sencillo y seguro. El resultado es un borrador para revisión humana: nunca envías, publicas ni afirmas que Klaviyo está conectado.$$,
  encode(sha256('a11_generador_marketing_system_v1'::bytea), 'hex')
)
on conflict (code, version) do nothing;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a11_generador_marketing_system', 'v1',
  '["data_coverage", "search_knowledge", "get_organization_profile", "get_strategic_plan", "list_open_tasks", "list_open_alerts", "get_call_history", "get_financial_settings"]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a11_generador_marketing'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
