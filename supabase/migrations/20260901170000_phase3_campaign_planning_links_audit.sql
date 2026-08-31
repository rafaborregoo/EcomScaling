-- Fase 3: conectar la planificación con Marketing y conservar trazabilidad.
-- Los enlaces son opcionales: el calendario también puede contener acciones
-- operativas todavía no publicadas en ningún proveedor.

alter table public.campaign_calendar_items
  add column if not exists marketing_draft_id uuid references public.marketing_content_drafts (id) on delete set null,
  add column if not exists meta_campaign_id uuid references public.meta_campaigns (id) on delete set null,
  add column if not exists klaviyo_campaign_id uuid references public.klaviyo_campaigns (id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

create index if not exists campaign_calendar_items_marketing_draft_idx
  on public.campaign_calendar_items (organization_id, marketing_draft_id)
  where marketing_draft_id is not null and deleted_at is null;
create index if not exists campaign_calendar_items_meta_campaign_idx
  on public.campaign_calendar_items (organization_id, meta_campaign_id)
  where meta_campaign_id is not null and deleted_at is null;
create index if not exists campaign_calendar_items_klaviyo_campaign_idx
  on public.campaign_calendar_items (organization_id, klaviyo_campaign_id)
  where klaviyo_campaign_id is not null and deleted_at is null;
create index if not exists campaign_calendar_items_active_starts_idx
  on public.campaign_calendar_items (organization_id, starts_at)
  where deleted_at is null;

create or replace function private.enforce_campaign_calendar_links_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare linked_org uuid;
begin
  if new.marketing_draft_id is not null then
    select organization_id into linked_org from public.marketing_content_drafts where id = new.marketing_draft_id;
    if linked_org is distinct from new.organization_id then
      raise exception 'marketing draft belongs to another organization';
    end if;
  end if;
  if new.meta_campaign_id is not null then
    select organization_id into linked_org from public.meta_campaigns where id = new.meta_campaign_id;
    if linked_org is distinct from new.organization_id then
      raise exception 'meta campaign belongs to another organization';
    end if;
  end if;
  if new.klaviyo_campaign_id is not null then
    select organization_id into linked_org from public.klaviyo_campaigns where id = new.klaviyo_campaign_id;
    if linked_org is distinct from new.organization_id then
      raise exception 'klaviyo campaign belongs to another organization';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_campaign_calendar_links_scope on public.campaign_calendar_items;
create trigger enforce_campaign_calendar_links_scope
before insert or update on public.campaign_calendar_items
for each row execute function private.enforce_campaign_calendar_links_scope();

create or replace function private.audit_campaign_calendar_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare actor uuid;
begin
  actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    coalesce(new.organization_id, old.organization_id), actor,
    case when tg_op = 'INSERT' then 'campaign_calendar_item.created'
         when tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then 'campaign_calendar_item.archived'
         else 'campaign_calendar_item.updated' end,
    'campaign_calendar_item', coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_campaign_calendar_change on public.campaign_calendar_items;
create trigger audit_campaign_calendar_change
after insert or update or delete on public.campaign_calendar_items
for each row execute function private.audit_campaign_calendar_change();

comment on column public.campaign_calendar_items.marketing_draft_id is 'Borrador del módulo Marketing asociado a esta acción.';
comment on column public.campaign_calendar_items.meta_campaign_id is 'Campaña Meta sincronizada asociada a esta acción.';
comment on column public.campaign_calendar_items.klaviyo_campaign_id is 'Campaña Klaviyo sincronizada asociada a esta acción.';
comment on column public.campaign_calendar_items.deleted_at is 'Archivado lógico; las acciones archivadas no aparecen en la planificación activa.';
