-- Onboarding tras invitación (consultores y owners de cliente): 5 pantallas
-- (contraseña -> perfil -> Shopify/Meta/Klaviyo). `onboarding_completed_at`
-- marca que el usuario ya pasó por perfil+contraseña; el gate del portal lo
-- lee para redirigir a /onboarding mientras sea null.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Los perfiles que ya existen no deben caer en el gate: se dan por hechos.
-- Solo los invitados a partir de ahora nacen con la columna en null.
update public.profiles set onboarding_completed_at = now()
where onboarding_completed_at is null;

-- Bucket para la foto de perfil subida desde el ordenador. Público (el <img>
-- del avatar se sirve sin cabeceras de auth). Las presets generadas (DiceBear)
-- no tocan storage: son URLs externas guardadas tal cual en profiles.avatar_url.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuario escribe solo en su carpeta avatars/<uid>/...; la lectura es
-- pública por el bucket, no hace falta policy de select.
create policy "avatars_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
