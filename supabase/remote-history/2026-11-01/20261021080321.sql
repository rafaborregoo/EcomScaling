-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A21 acquisition evidence, store-scoped generation and shared A20 opportunity lifecycle.
alter table public.retention_opportunities
  add column if not exists source_agent_code text not null default 'a20_retencion_clientes';
create index if not exists retention_opportunities_origin_idx
  on public.retention_opportunities(organization_id,store_id,source_agent_code,status,updated_at desc);
create unique index if not exists retention_opportunities_agent_identity_idx
  on public.retention_opportunities(organization_id,store_id,(coalesce(brief->>'metric_key',brief->>'segment_key')),(brief->>'intervention'))
  where status <> 'rejected';

create table if not exists public.a21_generation_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 store_id uuid not null references public.shopify_stores(id) on delete cascade,
 request_key text not null,
 digest text not null,
 is_cron boolean not null default false,
 token uuid not null,
 status text not null check(status in ('running','succeeded','failed')),
 lease_expires_at timestamptz not null,
 output_id uuid references public.agent_outputs(id),
 error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,store_id,request_key)
);
create index if not exists a21_generation_jobs_scope_idx on public.a21_generation_jobs(organization_id,store_id,status,lease_expires_at);
alter table public.a21_generation_jobs enable row level security;
revoke all on public.a21_generation_jobs from public,anon,authenticated;
grant all on public.a21_generation_jobs to service_role;

create or replace function public.claim_a21_generation(p_organization_id uuid,p_store_id uuid,p_request_key text,p_digest text,p_token uuid,p_daily_limit integer,p_is_cron boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.a21_generation_jobs%rowtype;v_runs integer;v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_store_id is null or p_request_key is null or length(p_request_key)>180 then raise exception 'a21_store_and_idempotency_key_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('a21:'||p_organization_id::text||':'||p_store_id::text||':'||v_day::text,0));
 select * into j from public.a21_generation_jobs where organization_id=p_organization_id and store_id=p_store_id and request_key=p_request_key for update;
 if found and (j.status='succeeded' or (j.status='running' and j.lease_expires_at>now())) then return to_jsonb(j)||jsonb_build_object('claimed',false);end if;
 if exists(select 1 from public.a21_generation_jobs where organization_id=p_organization_id and store_id=p_store_id and status='running' and lease_expires_at>now()) then return jsonb_build_object('claimed',false,'status','running');end if;
 if not p_is_cron then
  select count(*) into v_runs from public.agent_runs r join public.agent_versions v on v.id=r.agent_version_id join public.agent_definitions d on d.id=v.definition_id left join public.agent_outputs ao on ao.run_id=r.id left join public.a21_generation_jobs old on old.output_id=ao.id where r.organization_id=p_organization_id and r.store_id=p_store_id and r.trigger_type='manual' and r.started_at>=v_day and d.code='a21_adquisicion_shopify' and old.id is null;
  if (select count(*) from public.a21_generation_jobs where organization_id=p_organization_id and store_id=p_store_id and created_at>=v_day and not is_cron)>=greatest(p_daily_limit,0)-v_runs then return jsonb_build_object('claimed',false,'status','quota_exceeded');end if;
 end if;
 insert into public.a21_generation_jobs(organization_id,store_id,request_key,digest,token,status,lease_expires_at,is_cron) values(p_organization_id,p_store_id,p_request_key,p_digest,p_token,'running',now()+interval '15 minutes',p_is_cron)
 on conflict(organization_id,store_id,request_key) do update set digest=excluded.digest,token=excluded.token,status='running',lease_expires_at=excluded.lease_expires_at,error=null,is_cron=excluded.is_cron,updated_at=now() returning * into j;
 return to_jsonb(j)||jsonb_build_object('claimed',true);
end $$;

create or replace function public.finish_a21_generation(p_job_id uuid,p_token uuid,p_output_id uuid,p_error text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.a21_generation_jobs set status=case when p_output_id is not null and p_error is null then 'succeeded' else 'failed' end,output_id=p_output_id,error=p_error,updated_at=now(),lease_expires_at=now() where id=p_job_id and token=p_token and status='running';return found;
end $$;

create or replace function public.persist_a21_agent_output(p_run_id uuid,p_job_id uuid,p_token uuid,p_output jsonb,p_approval_required boolean,p_schema_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.a21_generation_jobs%rowtype;r public.agent_runs%rowtype;v_output public.agent_outputs%rowtype;v_item jsonb;v_index integer:=0;v_metric jsonb;v_milestone uuid;v_position integer;
begin
 select * into j from public.a21_generation_jobs where id=p_job_id for update;
 if not found or j.token is distinct from p_token or j.status<>'running' or j.lease_expires_at<=now() then raise exception 'a21_generation_lease_lost';end if;
 select * into r from public.agent_runs where id=p_run_id;
 if not found or r.organization_id<>j.organization_id or r.store_id is distinct from j.store_id then raise exception 'a21_run_scope_invalid';end if;
 if not exists(select 1 from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id where v.id=r.agent_version_id and d.code='a21_adquisicion_shopify') then raise exception 'a21_agent_version_invalid';end if;
 if p_output->'acquisition_snapshot'->>'organization_id'<>j.organization_id::text or p_output->'acquisition_snapshot'->>'store_id'<>j.store_id::text or p_output->'acquisition_snapshot'->>'digest'<>j.digest then raise exception 'a21_evidence_scope_or_digest_invalid';end if;
 if jsonb_typeof(p_output->'opportunities')<>'array' or jsonb_array_length(p_output->'opportunities')>4 then raise exception 'a21_opportunity_contract_invalid';end if;
 if jsonb_array_length(p_output->'opportunities')>0 and (p_approval_required is not true or p_output->'acquisition_snapshot'->>'availability'<>'available') then raise exception 'a21_opportunity_requires_available_evidence_and_approval';end if;
 insert into public.agent_outputs(run_id,organization_id,schema_version,output,approval_required,status) values(r.id,r.organization_id,p_schema_version,p_output,p_approval_required,case when p_approval_required then 'pending_approval' else 'approved' end) returning * into v_output;
 for v_item in select value from jsonb_array_elements(p_output->'opportunities') loop
  select value into v_metric from jsonb_array_elements(p_output->'acquisition_snapshot'->'metrics') where value->>'key'=v_item->>'metric_key' and value->>'status'='available' and value->'value'<>'null'::jsonb limit 1;
  if v_metric is null then raise exception 'a21_metric_not_in_authoritative_snapshot';end if;
  if coalesce(v_item->>'id','')='' or coalesce(v_item->>'intervention','')='' or jsonb_typeof(v_item->'route')<>'array' then raise exception 'a21_opportunity_fields_invalid';end if;
  if v_item->'measurement'->'baseline' is distinct from v_metric->'value' or v_item->'measurement'->>'metric' is distinct from v_item->>'metric_key' then raise exception 'a21_metric_baseline_mismatch';end if;
  if v_item->>'plan_id' is not null and not exists(select 1 from public.strategic_plans p where p.id=(v_item->>'plan_id')::uuid and p.organization_id=j.organization_id and p.store_id=j.store_id and p.status='active' and p.approved_at is not null and p.version=(v_item->>'plan_version')::integer and p.revision=(v_item->>'plan_revision')::integer) then raise exception 'a21_plan_revision_changed';end if;
  if v_item->'milestone_id'<>'null'::jsonb then
   v_milestone:=(v_item->>'milestone_id')::uuid;
   if not exists(select 1 from public.strategic_plan_milestones m join public.strategic_plan_phases ph on ph.id=m.phase_id join public.strategic_plans p on p.id=ph.plan_id where m.id=v_milestone and p.id=(v_item->>'plan_id')::uuid and p.organization_id=j.organization_id and p.store_id=j.store_id and p.status='active' and p.approved_at is not null and p.version=(v_item->>'plan_version')::integer and m.status in ('active','pending')) then raise exception 'a21_milestone_or_plan_changed';end if;
  else v_milestone:=null;end if;
  insert into public.retention_opportunities(id,organization_id,store_id,source_output_id,proposal_index,snapshot_id,snapshot,brief,plan_id,plan_revision,milestone_id,source_agent_code)
  values((v_item->>'id')::uuid,j.organization_id,j.store_id,v_output.id,v_index,(p_output->'acquisition_snapshot'->>'id')::uuid,p_output->'acquisition_snapshot',v_item,nullif(v_item->>'plan_id','')::uuid,nullif(v_item->>'plan_revision','')::integer,v_milestone,'a21_adquisicion_shopify');
  v_position:=0;
  for v_metric in select value from jsonb_array_elements(v_item->'route') loop
   insert into public.retention_handoffs(opportunity_id,agent_code,position,status) values((v_item->>'id')::uuid,v_metric#>>'{}',v_position,case when v_position=0 then 'ready' else 'blocked' end) on conflict do nothing;
   v_position:=v_position+1;
  end loop;
  v_index:=v_index+1;
 end loop;
 update public.a21_generation_jobs set status='succeeded',output_id=v_output.id,updated_at=now(),lease_expires_at=now() where id=j.id and token=p_token;
 return jsonb_build_object('id',v_output.id,'status',v_output.status,'created_at',v_output.created_at);
end $$;

-- A21 and A20 share the lifecycle; the origin remains explicit for audit and deduplication.
create or replace function public.retention_coordination_context(p_organization_id uuid,p_store_id uuid,p_agent_code text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('requests',coalesce(jsonb_agg(x order by x.created_at),'[]'::jsonb),'scope','selected_store') from (
  select o.id opportunity_id,o.source_agent_code,o.status,o.task_id,o.brief,o.review_due_at,o.outcome,o.created_at,h.id handoff_id,h.status handoff_status,h.position,
   (select jsonb_agg(jsonb_build_object('agent',prev.agent_code,'status',prev.status,'output_id',prev.delivered_output_id) order by prev.position) from public.retention_handoffs prev where prev.opportunity_id=o.id) dependencies
  from public.retention_opportunities o left join public.retention_handoffs h on h.opportunity_id=o.id and h.agent_code=p_agent_code
  where o.organization_id=p_organization_id and o.store_id=p_store_id and o.status in ('proposed','accepted','in_progress','measuring','evaluated')
   and (h.id is not null or p_agent_code in ('a19_arquitecto_camino','a19_revision_camino','a20_retencion_clientes','a21_adquisicion_shopify','a04_generador_tareas','a17_plan_semanal','a18_plan_mensual'))
  order by o.updated_at desc limit 80
 )x;
$$;

revoke all on function public.claim_a21_generation(uuid,uuid,text,text,uuid,integer,boolean),public.finish_a21_generation(uuid,uuid,uuid,text),public.persist_a21_agent_output(uuid,uuid,uuid,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_a21_generation(uuid,uuid,text,text,uuid,integer,boolean),public.finish_a21_generation(uuid,uuid,uuid,text),public.persist_a21_agent_output(uuid,uuid,uuid,jsonb,boolean,text) to service_role;
revoke all on function public.retention_coordination_context(uuid,uuid,text) from public,anon;
grant execute on function public.retention_coordination_context(uuid,uuid,text) to authenticated,service_role;

-- Restrict direct authenticated reads of Shopify acquisition rows to the user's exact store scope.
do $$ declare t text;begin
 foreach t in array array['shopify_sessions_daily','shopify_abandoned_checkouts'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop policy if exists a21_store_scope_guard on public.%I',t);
   execute format('create policy a21_store_scope_guard on public.%I as restrictive for select to authenticated using(private.can_access_agent_store_scope(organization_id,store_id))',t);
  end if;
 end loop;
 if to_regclass('public.shopify_abandoned_checkout_items') is not null then
  drop policy if exists a21_store_scope_guard on public.shopify_abandoned_checkout_items;
  create policy a21_store_scope_guard on public.shopify_abandoned_checkout_items as restrictive for select to authenticated using(exists(select 1 from public.shopify_abandoned_checkouts c where c.id=checkout_id and c.organization_id=shopify_abandoned_checkout_items.organization_id and private.can_access_agent_store_scope(c.organization_id,c.store_id)));
 end if;
end $$;

-- Unknown funnel steps stay NULL; partial denominators do not produce a plausible rate.
create or replace function public.shopify_funnel_summary(target_organization_id uuid,period_start timestamptz,period_end timestamptz,target_store_id uuid)
returns table(sessions bigint,online_store_visitors bigint,conversion_rate_shopify numeric,days_with_sessions bigint,cart_additions bigint,checkouts_reached bigint,purchases bigint,funnel_data_since date,days_with_funnel_data bigint,requested_days bigint)
language sql stable set search_path to 'pg_catalog','public' as $$
 with requested as (
  select case when period_start is null then null::date else date_trunc('day',period_start)::date end start_day,
   coalesce(date_trunc('day',period_end)::date,current_date) end_day
 ), scoped as (
  select d.* from public.shopify_sessions_daily d cross join requested r where d.organization_id=target_organization_id and (target_store_id is null or d.store_id=target_store_id)
   and (r.start_day is null or d.bucket_date>=r.start_day) and d.bucket_date<=r.end_day
 ), totals as (
  select coalesce(sum(sessions),0)::bigint sessions,coalesce(sum(online_store_visitors),0)::bigint online_store_visitors,count(distinct bucket_date)::bigint days_with_sessions,
   case when count(*) filter(where conversion_rate is null)>0 then null else round(sum(conversion_rate*sessions)/nullif(sum(sessions),0),5) end conversion_rate_shopify,
   case when count(*) filter(where sessions_with_cart_additions is null)>0 then null else sum(sessions_with_cart_additions)::bigint end cart_additions,
   case when count(*) filter(where sessions_that_reached_checkout is null)>0 then null else sum(sessions_that_reached_checkout)::bigint end checkouts_reached,
   case when count(*) filter(where sessions_that_completed_checkout is null)>0 then null else sum(sessions_that_completed_checkout)::bigint end purchases
  from scoped
 ), coverage as (
  select min(d.bucket_date) filter(where d.sessions_with_cart_additions is not null and d.sessions_that_reached_checkout is not null and d.sessions_that_completed_checkout is not null) funnel_data_since,
   count(distinct d.bucket_date) filter(where d.sessions_with_cart_additions is not null and d.sessions_that_reached_checkout is not null and d.sessions_that_completed_checkout is not null)::bigint days_with_funnel_data
  from scoped d
 ) select t.sessions,t.online_store_visitors,t.conversion_rate_shopify,t.days_with_sessions,t.cart_additions,t.checkouts_reached,t.purchases,c.funnel_data_since,c.days_with_funnel_data,
  case when r.start_day is null then null::bigint else greatest(0,r.end_day-r.start_day+1)::bigint end requested_days from totals t cross join coverage c cross join requested r;
$$;
grant execute on function public.shopify_funnel_summary(uuid,timestamptz,timestamptz,uuid) to authenticated,service_role;

-- Recovery uses a fixed seven-day maturity buffer and excludes completions after the evidence cutoff.
create or replace function public.shopify_checkout_recovery(target_organization_id uuid,period_start timestamptz,period_end timestamptz,target_store_id uuid)
returns table(checkouts bigint,recovered bigint,recovery_rate numeric,lost_value numeric,recovered_value numeric,avg_checkout_value numeric,avg_hours_to_recover numeric)
language sql stable set search_path to 'pg_catalog','public' as $$
 with scoped as (
  select c.total_price,c.external_created_at,case when c.completed_at<=period_end then c.completed_at else null end completed_at
  from public.shopify_abandoned_checkouts c where c.organization_id=target_organization_id and (target_store_id is null or c.store_id=target_store_id)
   and (period_start is null or c.external_created_at>=period_start) and c.external_created_at<=period_end-interval '7 days'
 ) select count(*)::bigint,count(*) filter(where completed_at is not null)::bigint,
  round(count(*) filter(where completed_at is not null)::numeric/nullif(count(*),0),4),
  sum(total_price) filter(where completed_at is null),sum(total_price) filter(where completed_at is not null),round(avg(total_price),2),
  round(avg(extract(epoch from(completed_at-external_created_at))/3600) filter(where completed_at is not null)::numeric,1)
 from scoped;
$$;

-- Immutable effective prompt and agent release. Never require a hand edit in the Dashboard.
insert into public.prompt_versions(code,version,content,checksum)
values('a21_adquisicion_shopify_system','v7',$a21$
Eres A21, especialista en adquisición y primera conversión Shopify de una tienda concreta. El servidor te entrega un snapshot fechado, acotado a la tienda, con métricas, denominadores, moneda, cobertura por fuente, estado de sincronización, oportunidades compartidas y Mi Camino aprobado. Ese snapshot manda sobre el texto libre. Usa únicamente métricas `status=available` para afirmar un valor; `null`, parcial, sin filas y error son estados distintos y jamás equivalen a cero.

Objetivo: explicar qué está pasando desde la visita hasta el primer pedido observado y proponer un máximo de cuatro oportunidades que puedan coordinarse con el resto de E-NORA. Distingue sesión, visitante diario, checkout, pedido, primera visita y primera compra observada. No declares primera compra vitalicia. La atribución Shopify es descriptiva, no causal y no se suma con Meta o Klaviyo. Las sesiones/pedidos pueden usar unidades diferentes; cada porcentaje requiere su denominador y periodo exactos. Shopify cambió la medición de sesiones en septiembre de 2026, así que no presentes periodos como comparables sin comprobarlo.

No reconstruyas ni inventes cifras o cobertura. Un paso del funnel no pedido en ShopifyQL es desconocido, no cero. Una conexión reciente no prueba que cada fuente cubra los 90 días. Carritos sin cohorte madura y corte temporal no son una pérdida confirmada. La ausencia de filas sincronizadas no demuestra que no existan checkouts. Importes requieren moneda compatible y cobertura; margen bruto no equivale a contribución ni CAC. No recomiendes descuentos, ROAS, presupuesto o escalado sin costes y contribución defendibles.

Coordina con A20 para diferenciar adquisición de primera compra y recompra/retención; respeta las oportunidades, decisiones y exclusiones ya registradas. Mi Camino de A19 fija dirección. A18 integra objetivos mensuales, A17 el trabajo semanal y A04 las tareas. Según el caso, A05/A27/A28 planifican campañas, mailing o flows; A11/A26 generan contenido; A12 mide email; A14 valida Meta, A23 crea piezas, A15 revisa lo visual y A24 mide. Conserva el mismo ID de oportunidad, objetivo, evidencia y resultado entre etapas; indica propietario, dependencias, hito, métrica y ventana. No invoques agentes en cadena ni repitas tareas aprobadas/rechazadas.

Un inventario CRM no acredita consentimiento, audiencia contactable, supresiones o que un flow concreto exista y funcione. Solicita verificaciones a los agentes responsables antes de activar. Una propuesta de Ads es solo viabilidad; no autoriza publicar ni gastar. Ningún borrador, tarea, aprobación estratégica o recibo de análisis autoriza envío/publicación/gasto. No cambies Shopify.

Devuelve respuesta clara con fuente, periodo, unidades, denominador, cobertura, incertidumbre y próximo paso. Si los datos están incompletos, explica qué se puede y qué no se puede concluir y abstente de oportunidades comerciales. Cada oportunidad usa un `metric_key` exacto del snapshot, intervención, hipótesis, racional, responsable, esfuerzo, prioridad, exclusiones, criterio de cierre, evaluación no menor a 7 días e `milestone_id` exacto o null. Si no existe Mi Camino aprobado, no inventes un hito y señala el bloqueo estratégico. Proponer cero oportunidades es correcto.
$a21$,encode(sha256(convert_to($a21$A21 adquisición; snapshot autoritativo por tienda; desconocido no es cero.$a21$,'UTF8')),'hex'))
on conflict(code,version) do nothing;
update public.prompt_versions set checksum=encode(sha256(convert_to(content,'UTF8')),'hex') where code='a21_adquisicion_shopify_system' and version='v7';
update public.agent_versions set is_active=false where definition_id=(select id from public.agent_definitions where code='a21_adquisicion_shopify');
insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,output_schema_version,is_active)
select d.id,'v7',v.model,'a21_adquisicion_shopify_system','v7','["search_knowledge","shopify_funnel_health","shopify_margin_health","klaviyo_measurement_health"]'::jsonb,'required_before_publish','v1',true
from public.agent_definitions d join lateral (select model from public.agent_versions old where old.definition_id=d.id order by created_at desc limit 1)v on true where d.code='a21_adquisicion_shopify';


