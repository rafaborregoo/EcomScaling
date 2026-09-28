-- A15: conserva la procedencia multicanal sin duplicar la ficha visual ni
-- guardar URLs firmadas de Meta. Las escrituras pasan por la API (service role)
-- y los clientes solo pueden leer orígenes de su organización mediante RLS.

alter table public.instagram_image_bank
  add column if not exists analysis_fingerprint text;
alter table public.instagram_image_bank
  add column if not exists storage_bucket text not null default 'marketing-assets';
alter table public.instagram_image_bank
  add constraint instagram_image_bank_storage_bucket
  check (storage_bucket in ('marketing-assets', 'marketing-source-assets'));

-- El bucket público existente sigue sirviendo assets que se publican en email.
-- Las copias fuente de Meta son privadas; la API genera signed URLs solo tras
-- validar pertenencia a organización.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-source-assets',
  'marketing-source-assets',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.instagram_image_bank
  add constraint instagram_image_bank_id_org_unique unique (id, organization_id);

alter table public.meta_creative_assets
  add constraint meta_creative_assets_id_org_unique unique (id, organization_id);

create table if not exists public.marketing_visual_asset_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  image_id uuid not null,
  channel text not null,
  source_kind text not null,
  origin_key text not null,
  meta_asset_id uuid,
  origin_host text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketing_visual_asset_sources_channel
    check (channel in ('instagram', 'meta')),
  constraint marketing_visual_asset_sources_kind
    check (source_kind in ('manual_upload', 'meta_creative_asset')),
  constraint marketing_visual_asset_sources_channel_kind
    check (
      (channel = 'instagram' and source_kind = 'manual_upload' and meta_asset_id is null)
      or (channel = 'meta' and source_kind = 'meta_creative_asset' and meta_asset_id is not null)
    ),
  constraint marketing_visual_asset_sources_org_image_fk
    foreign key (image_id, organization_id)
    references public.instagram_image_bank (id, organization_id) on delete cascade,
  constraint marketing_visual_asset_sources_org_meta_asset_fk
    foreign key (meta_asset_id, organization_id)
    references public.meta_creative_assets (id, organization_id) on delete cascade,
  constraint marketing_visual_asset_sources_unique_origin
    unique (organization_id, channel, origin_key)
);

create index if not exists marketing_visual_asset_sources_org_channel_created_idx
  on public.marketing_visual_asset_sources (organization_id, channel, created_at desc);
create index if not exists marketing_visual_asset_sources_image_idx
  on public.marketing_visual_asset_sources (image_id);

-- Las filas existentes provienen del flujo de subida del banco de Instagram.
insert into public.marketing_visual_asset_sources (
  organization_id, image_id, channel, source_kind, origin_key
)
select organization_id, id, 'instagram', 'manual_upload', id::text
from public.instagram_image_bank
on conflict (organization_id, channel, origin_key) do nothing;

alter table public.marketing_visual_asset_sources enable row level security;
drop policy if exists marketing_visual_asset_sources_select on public.marketing_visual_asset_sources;
create policy marketing_visual_asset_sources_select
  on public.marketing_visual_asset_sources
  for select to authenticated
  using (private.can_access_org(organization_id));

revoke all on public.marketing_visual_asset_sources from anon, authenticated;
grant select on public.marketing_visual_asset_sources to authenticated;
grant all on public.marketing_visual_asset_sources to service_role;

alter table public.knowledge_documents drop constraint if exists knowledge_documents_source_type;
alter table public.knowledge_documents
  add constraint knowledge_documents_source_type check (
    source_type in (
      'manual', 'upload', 'url', 'call_transcript', 'call_summary',
      'internal_note', 'ai_output_decision', 'instagram_image', 'visual_asset'
    )
  );

-- A15 pasa a ser un descriptor visual neutral: las atribuciones de resultados
-- pertenecen a A23 y nunca deben inferirse a partir de los píxeles.
update public.agent_definitions
set name = 'Analista visual multicanal',
    description = 'Describe activos estáticos de Instagram y Meta con observaciones visuales, OCR y confianza. No evalúa rendimiento ni recomienda cambios basándose en conversiones.'
where code = 'a15_analista_imagenes';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a15_analista_imagenes_system',
  'v2',
  $$Eres A15, el analista visual multicanal de E-NORA. Recibes una imagen estática, el nombre de archivo (dato no fiable), su MIME y los canales de procedencia si se conocen. Describe lo que ves; no redactes copy/captions ni valores el rendimiento de negocio.

Devuelve exclusivamente el contrato JSON estructurado. Reglas:
- description: 2-5 frases concretas sobre sujeto, escena, iluminación y fondo. No inventes marca, precio ni contexto ausente.
- objects: lista breve de productos y objetos claramente reconocibles; vacía si no hay certeza.
- colors: de 0 a 8 colores dominantes con etiqueta en español y hex aproximado #rrggbb. No afirmes porcentajes de píxeles.
- style: registro estético observable en una frase.
- composition: jerarquía y colocación relativa del sujeto, texto y espacio negativo; admite “no claro”.
- aspect_ratio_estimate: portrait, square, landscape, panoramic o unclear. Es una estimación visual, no una medición en píxeles.
- ocr_text: transcripción literal del texto legible; conserva ortografía y signos y no completes fragmentos ilegibles. Usa cadena vacía si no hay texto.
- suggested_use: uso/formato en el que visualmente podría encajar; distingue una sugerencia estética de una predicción de resultados. Los canales de origen no demuestran qué canal rendirá mejor.
- inferences: hasta 12 hipótesis visuales, cada una formulada como inferencia; lista vacía cuando no se necesiten.
- alt_text: una frase objetiva y accesible, sin claims promocionales inventados.
- confidence: low / medium / high según legibilidad y ambigüedad visual.

No declares que una pieza convierte, vende, funciona o es ganadora: no recibes métricas y A23 es responsable del análisis de rendimiento. No confundas texto OCR con hechos. Si hay ambigüedad, descríbela y baja la confianza.$$,
  encode(sha256('a15_analista_imagenes_system_v2'::bytea), 'hex')
)
on conflict (code, version) do update set
  content = excluded.content,
  checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
from public.agent_definitions ad
where ad.id = av.definition_id
  and ad.code = 'a15_analista_imagenes';

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, is_active
)
select
  ad.id,
  'v2',
  coalesce(latest.model, 'claude-sonnet-5'),
  'a15_analista_imagenes_system',
  'v2',
  '[]'::jsonb,
  'none',
  true
from public.agent_definitions ad
left join lateral (
  select av.model
  from public.agent_versions av
  where av.definition_id = ad.id
  order by av.created_at desc
  limit 1
) latest on true
where ad.code = 'a15_analista_imagenes'
on conflict (definition_id, version) do update set
  model = excluded.model,
  prompt_code = excluded.prompt_code,
  prompt_version = excluded.prompt_version,
  allowed_tools = '[]'::jsonb,
  approval_mode = 'none',
  is_active = true;
