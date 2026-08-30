-- AI-11 fase 3: bucket para imágenes subidas desde el ordenador en el editor
-- visual de plantillas. Público (las URLs van dentro de emails que Klaviyo
-- renderiza sin cabeceras de auth). Las escrituras van por SUPABASE_SERVICE_ROLE_KEY
-- tras chequeo manual de membership (ADR-0006 punto 7), así que no hacen falta
-- políticas RLS de insert para `authenticated`; el bucket público da lectura CDN.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-assets',
  'marketing-assets',
  true,
  5242880, -- 5 MiB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
