-- Cuerpos de los emails de Klaviyo.
--
-- Hasta ahora el modulo guardaba el ASUNTO (klaviyo_campaign_messages.subject) y
-- el id de la plantilla (external_template_id), pero nunca resolvia ese id: el
-- cuerpo del email no existia en ninguna parte. Para un modulo de email eso deja
-- fuera justo lo que un agente puede leer y un panel no: el texto.
--
-- `html_content` y `text_content` vienen los dos de Klaviyo (/api/templates
-- devuelve ambos). El de texto es el que consumen los agentes; el HTML se guarda
-- para poder mostrar la pieza y para reprocesar si mas adelante hace falta
-- extraer estructura (bloques, CTAs) que hoy no extraemos.
--
-- raw_data va SIN html ni text: duplicar el cuerpo (una plantilla pasa de 100 KB
-- con facilidad) en la misma fila no aporta nada y multiplica la tabla por dos.
--
-- Enlace con los mensajes: por id externo, igual que campaigns <-> report_values.
-- No hay FK porque el mensaje puede referenciar una plantilla que el sync aun no
-- ha traido (o que se borro en Klaviyo), y esa fila no debe perderse por eso.
--
-- Idempotente (CLAUDE.md): `if not exists` en tabla, indices y politica.

create table if not exists public.klaviyo_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_template_id varchar(255) not null,
  name varchar(255),
  editor_type varchar(80),
  html_content text,
  text_content text,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_templates_unique_external unique (account_id, external_template_id)
);

-- El join real es klaviyo_campaign_messages.external_template_id -> aqui, dentro
-- de una organizacion.
create index if not exists klaviyo_templates_org_external_idx
  on public.klaviyo_templates (organization_id, external_template_id);

drop trigger if exists set_klaviyo_templates_updated_at on public.klaviyo_templates;
create trigger set_klaviyo_templates_updated_at
  before update on public.klaviyo_templates
  for each row execute function private.set_updated_at();

alter table public.klaviyo_templates enable row level security;

-- ADR-0006 pto 7: solo lectura para `authenticated`; el sync escribe con service
-- role tras comprobar la membresia a mano.
drop policy if exists "klaviyo_templates_select_authorized" on public.klaviyo_templates;
create policy "klaviyo_templates_select_authorized"
  on public.klaviyo_templates
  for select to authenticated
  using (private.can_access_org(organization_id));

grant select on public.klaviyo_templates to authenticated;

comment on table public.klaviyo_templates is
  'Plantillas de email de Klaviyo con su cuerpo (HTML y texto). Se enlazan con klaviyo_campaign_messages y klaviyo_flow_messages por external_template_id. No contiene datos de perfiles.';
comment on column public.klaviyo_templates.text_content is
  'Version de texto plano que devuelve Klaviyo. Es la que leen los agentes: el HTML no cabe en una ventana de contexto y no aporta sobre el texto.';
comment on column public.klaviyo_templates.raw_data is
  'Atributos de la plantilla SIN html ni text, que ya viven en sus columnas.';
