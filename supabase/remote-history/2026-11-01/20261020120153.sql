-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A16: alcance por tienda, versiones recuperables y contratos de pieza.
alter table public.instagram_image_overlays
  add column if not exists store_id uuid references public.shopify_stores(id) on delete set null,
  add column if not exists content_revision integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists objective text not null default '',
  add column if not exists brand_context text not null default '',
  add column if not exists asset_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.instagram_image_overlays o
set store_id = i.store_id
from public.instagram_image_bank i
where o.image_id = i.id and o.store_id is null and i.store_id is not null;

alter table public.instagram_image_overlays
  drop constraint if exists instagram_image_overlays_content_revision_check,
  add constraint instagram_image_overlays_content_revision_check check (content_revision > 0),
  drop constraint if exists instagram_image_overlays_brief_length_check,
  add constraint instagram_image_overlays_brief_length_check
    check (char_length(objective) <= 800 and char_length(brand_context) <= 2000);

create index if not exists instagram_image_overlays_store_created_idx
  on public.instagram_image_overlays (organization_id, store_id, created_at desc)
  where archived_at is null;

create table if not exists public.instagram_image_overlay_revisions (
  id bigint generated always as identity primary key,
  overlay_id uuid not null references public.instagram_image_overlays(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision integer not null,
  snapshot jsonb not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (overlay_id, revision)
);
alter table public.instagram_image_overlay_revisions enable row level security;
create index if not exists instagram_image_overlay_revisions_overlay_idx
  on public.instagram_image_overlay_revisions (overlay_id, revision desc);
grant usage, select on sequence public.instagram_image_overlay_revisions_id_seq to service_role;

create or replace function private.capture_instagram_overlay_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.content_revision is distinct from old.content_revision then
    insert into public.instagram_image_overlay_revisions
      (overlay_id, organization_id, revision, snapshot, actor_user_id)
    values (
      new.id, new.organization_id, new.content_revision,
      to_jsonb(new), coalesce(auth.uid(), new.updated_by)
    ) on conflict (overlay_id, revision) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists capture_instagram_overlay_revision on public.instagram_image_overlays;
create trigger capture_instagram_overlay_revision
after insert or update on public.instagram_image_overlays
for each row execute function private.capture_instagram_overlay_revision();
insert into public.instagram_image_overlay_revisions (overlay_id, organization_id, revision, snapshot, actor_user_id)
select id, organization_id, content_revision, to_jsonb(instagram_image_overlays), updated_by
from public.instagram_image_overlays
on conflict (overlay_id, revision) do nothing;

drop policy if exists "instagram_image_overlays_select" on public.instagram_image_overlays;
create policy "instagram_image_overlays_select" on public.instagram_image_overlays
for select to authenticated using (
  private.can_access_org(organization_id)
  and (
    (instagram_image_overlays.store_id is null and exists (
      select 1 from public.organization_members m
      where m.organization_id = instagram_image_overlays.organization_id
        and m.user_id = (select auth.uid()) and m.is_active and m.access_scope = 'organization'
    )) or exists (
      select 1 from public.organization_members m
      where m.organization_id = instagram_image_overlays.organization_id
        and m.user_id = (select auth.uid()) and m.is_active
        and m.access_scope = 'store' and instagram_image_overlays.store_id = any(coalesce(m.store_ids, array[m.store_id]))
    )
  )
);
drop policy if exists "instagram_image_overlay_revisions_select" on public.instagram_image_overlay_revisions;
create policy "instagram_image_overlay_revisions_select" on public.instagram_image_overlay_revisions
for select to authenticated using (
  private.can_access_org(organization_id)
  and (
    (instagram_image_overlay_revisions.snapshot->>'store_id' is null and exists (
      select 1 from public.organization_members m
      where m.organization_id = instagram_image_overlay_revisions.organization_id
        and m.user_id = (select auth.uid()) and m.is_active and m.access_scope = 'organization'
    )) or exists (
      select 1 from public.organization_members m
      where m.organization_id = instagram_image_overlay_revisions.organization_id
        and m.user_id = (select auth.uid()) and m.is_active
        and m.access_scope = 'store' and (instagram_image_overlay_revisions.snapshot->>'store_id')::uuid = any(coalesce(m.store_ids, array[m.store_id]))
    )
  )
);
grant select on public.instagram_image_overlay_revisions to authenticated;
grant all on public.instagram_image_overlay_revisions to service_role;

create table if not exists public.instagram_overlay_draft_outputs (
  id uuid primary key default gen_random_uuid(),
  overlay_id uuid not null references public.instagram_image_overlays(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.shopify_stores(id) on delete set null,
  request_key uuid not null,
  run_id uuid not null references public.agent_runs(id) on delete restrict,
  overlay_revision integer not null,
  slide_index integer not null check (slide_index >= 0),
  image_id uuid references public.instagram_image_bank(id) on delete set null,
  source_checksum text,
  source_revision integer,
  draft jsonb not null,
  judgment jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (overlay_id, request_key)
);
alter table public.instagram_overlay_draft_outputs enable row level security;
create index if not exists instagram_overlay_draft_outputs_overlay_idx
  on public.instagram_overlay_draft_outputs (overlay_id, created_at desc);
drop policy if exists "instagram_overlay_draft_outputs_select" on public.instagram_overlay_draft_outputs;
create policy "instagram_overlay_draft_outputs_select" on public.instagram_overlay_draft_outputs
for select to authenticated using (
  private.can_access_org(organization_id) and (
    (instagram_overlay_draft_outputs.store_id is null and exists (
      select 1 from public.organization_members m
      where m.organization_id = instagram_overlay_draft_outputs.organization_id
        and m.user_id = (select auth.uid()) and m.is_active and m.access_scope = 'organization'
    )) or exists (
      select 1 from public.organization_members m
      where m.organization_id = instagram_overlay_draft_outputs.organization_id
        and m.user_id = (select auth.uid()) and m.is_active and m.access_scope = 'store'
        and instagram_overlay_draft_outputs.store_id = any(coalesce(m.store_ids, array[m.store_id]))
    )
  )
);
grant select on public.instagram_overlay_draft_outputs to authenticated;
grant all on public.instagram_overlay_draft_outputs to service_role;

-- Prompt versions are append-only; the runtime can pin this version and older
-- installations retain their existing v2 records for audit and rollback.
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v3', content || E'\n\nAjuste A16 v3: recibe tambiÃ©n contexto de marca, producto y oferta; intÃ©gralo solo cuando contenga hechos explÃ­citos. Adapta la propuesta al canal y al formato indicados. En carruseles, el primer slide debe abrir el hilo y los intermedios avanzar la idea; evita repetir el mismo CTA en todos los slides. Si faltan datos comerciales, usa una propuesta editorial neutra y no inventes oferta, precio o resultados.', encode(sha256(convert_to(content || E'\n\nAjuste A16 v3: recibe tambiÃ©n contexto de marca, producto y oferta; intÃ©gralo solo cuando contenga hechos explÃ­citos. Adapta la propuesta al canal y al formato indicados. En carruseles, el primer slide debe abrir el hilo y los intermedios avanzar la idea; evita repetir el mismo CTA en todos los slides. Si faltan datos comerciales, usa una propuesta editorial neutra y no inventes oferta, precio o resultados.', 'UTF8')), 'hex')
from public.prompt_versions
where code = 'a16_texto_sobre_imagen_system' and version = 'v2'
on conflict (code, version) do nothing;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v3', v.model, 'a16_texto_sobre_imagen_system', 'v3', '[]'::jsonb, 'none'
from public.agent_definitions d
join public.agent_versions v on v.definition_id = d.id and v.is_active
where d.code = 'a16_texto_sobre_imagen'
on conflict (definition_id, version) do nothing;
update public.agent_versions v set is_active = (v.version = 'v3')
from public.agent_definitions d where v.definition_id = d.id and d.code = 'a16_texto_sobre_imagen';


