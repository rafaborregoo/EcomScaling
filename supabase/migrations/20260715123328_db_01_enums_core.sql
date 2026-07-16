do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_role' and typnamespace = 'public'::regnamespace) then
    create type public.platform_role as enum (
      'user',
      'consultant',
      'platform_admin'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_status' and typnamespace = 'public'::regnamespace) then
    create type public.organization_status as enum (
      'onboarding',
      'active',
      'suspended',
      'cancelled'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role' and typnamespace = 'public'::regnamespace) then
    create type public.member_role as enum (
      'owner',
      'manager',
      'member',
      'readonly'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status' and typnamespace = 'public'::regnamespace) then
    create type public.subscription_status as enum (
      'pending',
      'trial',
      'active',
      'paused',
      'cancelled',
      'expired'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_status' and typnamespace = 'public'::regnamespace) then
    create type public.notification_status as enum (
      'unread',
      'read',
      'archived'
    );
  end if;
end;
$$;
