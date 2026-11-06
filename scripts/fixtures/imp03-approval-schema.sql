-- Synthetic tables only; the routines under test come from real migrations.
create schema private;
create table public.organizations(id uuid primary key,status text default 'active');
create table public.profiles(id uuid primary key,is_active boolean default true,is_platform_staff boolean default false,is_consultant boolean default false);
create table public.organization_members(organization_id uuid,user_id uuid,role text,is_active boolean default true,access_scope text default 'organization',store_id uuid,store_ids uuid[]);
create table public.consultant_assignments(organization_id uuid,consultant_user_id uuid,is_active boolean default true);
create table public.shopify_stores(id uuid primary key,organization_id uuid,is_active boolean default true);
create table public.agent_definitions(id uuid primary key,code text);
create table public.agent_versions(id uuid primary key,definition_id uuid);
create table public.agent_runs(id uuid primary key,organization_id uuid,store_id uuid,agent_version_id uuid,objective text);
create table public.agent_outputs(id uuid primary key,organization_id uuid,run_id uuid,status text,output jsonb,updated_at timestamptz default now(),published_at timestamptz);
create table public.agent_output_decision_claims(output_id uuid primary key,organization_id uuid,token uuid,decision text,edits jsonb,started_at timestamptz default now());
create table public.agent_approvals(id uuid primary key default gen_random_uuid(),output_id uuid unique,organization_id uuid,decision text,decided_by uuid,reason text,reason_category text,tasks_created integer,decided_at timestamptz default now());
create type public.task_priority as enum('low','medium','high','urgent');
create table public.tasks(id uuid primary key default gen_random_uuid(),organization_id uuid,store_id uuid,agent_output_id uuid,agent_proposal_index integer,metadata jsonb,
  source text,status text,priority public.task_priority,title text,description text,assigned_to uuid,created_by uuid,categories text[],updated_at timestamptz,
  unique(agent_output_id,agent_proposal_index));
create table public.agent_output_notes(id uuid primary key default gen_random_uuid(),output_id uuid,organization_id uuid,author_user_id uuid,author_kind text,body text,agent_proposal_index integer,unique(output_id,agent_proposal_index));
create function public.claim_agent_output_decision(uuid,uuid,uuid,text,jsonb) returns jsonb language sql security invoker set search_path='' as $$select '{}'::jsonb;$$;
create function private.is_consultant(p_actor uuid) returns boolean language sql stable security invoker set search_path='' as $$select coalesce((select is_consultant from public.profiles where id=p_actor),false);$$;
alter table public.agent_outputs enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_output_decision_claims enable row level security;
grant usage on schema private to service_role;
grant all on all tables in schema public to service_role;
