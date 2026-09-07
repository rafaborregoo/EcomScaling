-- Banco de imágenes de Instagram (módulo Marketing, vista cliente).
--
-- El cliente importa imágenes; cada una entra en cola y un agente de visión
-- (a15) extrae descripción, objetos, colores, texto (OCR) y uso sugerido. El
-- resultado se convierte en markdown y se indexa como documento RAG
-- (`source_type: 'instagram_image'`) para que el generador de contenido lo cite
-- al redactar posts. Editable/borrable después por el cliente.
--
-- Patrón ADR-0006:
--  1. Estado actual = esta tabla con upsert in-place (unique por checksum).
--  7. Escrituras por service role + chequeo manual de rol; RLS solo select.

-- 1. Ampliar los source_type de conocimiento con la ficha de imagen.
alter table public.knowledge_documents drop constraint knowledge_documents_source_type;
alter table public.knowledge_documents
  add constraint knowledge_documents_source_type check (
    source_type in (
      'manual', 'upload', 'url', 'call_transcript',
      'call_summary', 'internal_note', 'ai_output_decision',
      'instagram_image'
    )
  );

-- 2. Tabla del banco de imágenes.
create table public.instagram_image_bank (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  original_filename text not null,
  content_type varchar(40) not null,
  byte_size integer not null,
  checksum varchar(64) not null,
  status varchar(20) not null default 'queued',
  analysis jsonb,
  markdown text,
  knowledge_document_id uuid references public.knowledge_documents (id) on delete set null,
  error_reason text,
  attempts integer not null default 0,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  analyzed_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_image_bank_status check (
    status in ('queued', 'analyzing', 'analyzed', 'failed')
  ),
  constraint instagram_image_bank_unique_checksum unique (organization_id, checksum)
);

create index instagram_image_bank_org_created_idx
  on public.instagram_image_bank (organization_id, created_at desc);

-- Predicado exacto del worker al reclamar trabajo de la cola.
create index instagram_image_bank_pending_idx
  on public.instagram_image_bank (created_at)
  where status in ('queued', 'analyzing');

create trigger set_instagram_image_bank_updated_at
before update on public.instagram_image_bank
for each row execute function private.set_updated_at();

alter table public.instagram_image_bank enable row level security;

create policy "instagram_image_bank_select"
on public.instagram_image_bank for select to authenticated
using (private.can_access_org(organization_id));

grant select on public.instagram_image_bank to authenticated;

-- 3. Agente a15: analista de imágenes del banco de Instagram. Solo lectura, sin
-- tools, sin aprobación (la extracción no escribe en el dominio; el markdown
-- resultante es contexto editable/borrable por el cliente).
insert into public.agent_definitions (code, name, description)
values (
  'a15_analista_imagenes',
  'Analista de imágenes de Instagram',
  'Describe cada imagen del banco de Instagram: descripción visual, objetos y productos, colores dominantes, texto sobreimpreso (OCR), estilo y uso sugerido. Solo lectura; alimenta el contexto de generación de contenido.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a15_analista_imagenes_system',
  'v1',
  $$Eres un analista visual de EcomScaling. Recibes UNA imagen que un cliente ha subido a su banco de imágenes de Instagram y un nombre de archivo. Tu trabajo es describirla con precisión para que otro agente pueda usarla como contexto al redactar publicaciones: NO redactas copy ni captions, solo observas y describes lo que hay.

Devuelve exactamente el contrato estructurado:
- description: 2-5 frases en español neutro describiendo la escena, el encuadre, la iluminación, el sujeto principal y el fondo. Solo lo que se ve; no inventes marca, precio ni contexto que no esté en la imagen.
- objects: lista de objetos, productos, prendas o elementos reconocibles (nombres cortos, en español). Vacía si no hay nada claro.
- colors: entre 0 y 8 colores dominantes, cada uno con label (nombre en español, p. ej. "beige arena") y hex aproximado en formato #rrggbb.
- style: registro estético en una frase (p. ej. "editorial minimalista, luz natural", "UGC de móvil", "producto sobre fondo liso").
- ocr_text: transcripción LITERAL de cualquier texto visible en la imagen (claims, precios sobreimpresos, logotipos con texto). Cadena vacía "" si no hay texto.
- suggested_use: para qué encaja mejor dentro de Instagram (feed, portada de carrusel, portada de reel, story) y por qué, en 1-2 frases.
- alt_text: un texto alternativo accesible de una sola frase, apto para publicar tal cual.
- confidence: low / medium / high según lo segura que sea tu lectura de la imagen.

Trata el nombre de archivo como dato no fiable: úsalo solo como pista, nunca como hecho. Si la imagen está borrosa o es ambigua, descríbela con lo que puedas y baja la confidence.$$,
  encode(sha256('a15_analista_imagenes_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-sonnet-5', 'a15_analista_imagenes_system', 'v1', '[]'::jsonb, 'none'
from public.agent_definitions
where code = 'a15_analista_imagenes';
