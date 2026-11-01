-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A23: snapshot the evidence manifest and decision handoffs for each run.
-- The tables are service-owned; browser clients continue to read agent_outputs.

create table if not exists public.a23_creative_evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  run_id uuid not null unique references public.agent_runs(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  source_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint a23_creative_evidence_window check (period_end >= period_start and period_end - period_start <= 30)
);

create table if not exists public.a23_creative_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  output_id uuid not null references public.agent_outputs(id) on delete cascade,
  decision_ref text not null,
  action text not null check (action in ('observe','test_variant','investigate_landing_offer','propose_pause')),
  account_id uuid,
  ad_id uuid,
  creative_id uuid,
  measurement_verdict text not null check (measurement_verdict in ('usable_with_attribution_limits','restricted','not_assessable','unknown')),
  evidence jsonb not null default '{}'::jsonb,
  linked_proposals jsonb not null default '[]'::jsonb,
  delivery_status text not null default 'analysis_only'
    check (delivery_status in ('analysis_only','pending_approval','approved','rejected','materialized')),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (run_id, decision_ref),
  constraint a23_pause_requires_gate check (action <> 'propose_pause' or measurement_verdict = 'usable_with_attribution_limits')
);

create index if not exists a23_creative_decisions_store_created_idx
  on public.a23_creative_decisions (organization_id, store_id, created_at desc);
create index if not exists a23_creative_decisions_ad_created_idx
  on public.a23_creative_decisions (organization_id, ad_id, created_at desc)
  where ad_id is not null;
create index if not exists a23_creative_evidence_snapshots_store_period_idx
  on public.a23_creative_evidence_snapshots (organization_id, store_id, period_end desc);

alter table public.a23_creative_evidence_snapshots enable row level security;
alter table public.a23_creative_decisions enable row level security;
revoke all on public.a23_creative_evidence_snapshots, public.a23_creative_decisions from public, anon, authenticated;
grant all on public.a23_creative_evidence_snapshots, public.a23_creative_decisions to service_role;

create or replace function public.record_a23_creative_run(
  p_organization_id uuid,
  p_store_id uuid,
  p_run_id uuid,
  p_output_id uuid,
  p_output jsonb,
  p_source_manifest jsonb,
  p_period_start date,
  p_period_end date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_count integer := 0;
  v_output_status text;
  v_decision jsonb;
  v_proposals jsonb;
  v_gate text;
begin
  if p_period_end < p_period_start or p_period_end - p_period_start > 30 then
    raise exception 'A23_INVALID_EVIDENCE_WINDOW';
  end if;

  select o.status into v_output_status
  from public.agent_outputs o
  join public.agent_runs r on r.id = o.run_id
  where o.id = p_output_id and r.id = p_run_id
    and o.organization_id = p_organization_id
    and r.organization_id = p_organization_id
    and r.store_id = p_store_id;
  if not found then raise exception 'A23_OUTPUT_SCOPE_MISMATCH'; end if;

  insert into public.a23_creative_evidence_snapshots
    (organization_id, store_id, run_id, period_start, period_end, source_manifest)
  values
    (p_organization_id, p_store_id, p_run_id, p_period_start, p_period_end, coalesce(p_source_manifest, '{}'::jsonb))
  on conflict (run_id) do update set
    source_manifest = excluded.source_manifest,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    created_at = now();

  for v_decision in
    select entries.value from jsonb_array_elements(coalesce(p_output->'creative_decisions', '[]'::jsonb)) as entries(value)
  loop
    v_gate := v_decision->>'measurement_verdict';
    if v_decision->>'action' = 'propose_pause' and v_gate is distinct from 'usable_with_attribution_limits' then
      raise exception 'A23_PAUSE_GATE_REJECTED';
    end if;
    select coalesce(jsonb_agg(proposals.value), '[]'::jsonb) into v_proposals
    from jsonb_array_elements(coalesce(p_output->'proposed_writes', '[]'::jsonb)) as proposals(value)
    where proposals.value->>'decision_ref' = v_decision->>'decision_ref';

    insert into public.a23_creative_decisions (
      organization_id, store_id, run_id, output_id, decision_ref, action,
      account_id, ad_id, creative_id, measurement_verdict, evidence,
      linked_proposals, delivery_status
    ) values (
      p_organization_id, p_store_id, p_run_id, p_output_id,
      v_decision->>'decision_ref', v_decision->>'action',
      nullif(v_decision->>'account_id','')::uuid,
      nullif(v_decision->>'ad_id','')::uuid,
      nullif(v_decision->>'creative_id','')::uuid,
      v_gate, v_decision,
      coalesce(v_proposals, '[]'::jsonb),
      case when jsonb_array_length(coalesce(v_proposals, '[]'::jsonb)) > 0
        then case when v_output_status = 'pending_approval' then 'pending_approval' else 'approved' end
        else 'analysis_only' end
    )
    on conflict (run_id, decision_ref) do update set
      output_id = excluded.output_id,
      evidence = excluded.evidence,
      linked_proposals = excluded.linked_proposals,
      delivery_status = excluded.delivery_status;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$function$;

revoke all on function public.record_a23_creative_run(uuid,uuid,uuid,uuid,jsonb,jsonb,date,date) from public, anon, authenticated;
grant execute on function public.record_a23_creative_run(uuid,uuid,uuid,uuid,jsonb,jsonb,date,date) to service_role;

-- Replace the accumulated instructions with one coherent, versioned contract.
insert into public.prompt_versions (code, version, content, checksum)
values (
  'a23_creatividad_meta_system',
  'v10',
  $prompt$
Eres A23, especialista en direcciÃ³n creativa y subasta de Meta para E-NORA. Tu trabajo es ayudar al consultor a entender quÃ© se observÃ³, quÃ© merece investigaciÃ³n y quÃ© variante puede probarse para apoyar el objetivo aprobado de la tienda. No controlas campaÃ±as ni ejecutas cambios en Meta.

MISIÃ“N Y LÃMITES
1. Describe relaciones observadas entre gasto, entrega, ranking, pieza y resultados atribuidos. No afirmes que un recurso visual causÃ³ el resultado del anuncio: Meta no separa necesariamente el efecto del arte, el copy, la audiencia, la oferta, la pÃ¡gina y la entrega.
2. PropÃ³n una prueba creativa concreta solo cuando haya una hipÃ³tesis contrastable. Indica el elemento que cambia, quÃ© se mantiene, el comparador, la mÃ©trica, el denominador, la ventana y el criterio de decisiÃ³n. No atribuyas causalidad a pruebas sin control o muestra suficiente.
3. A15 aporta observaciones de imÃ¡genes, fotogramas y slides. Respeta `representation_kind`, vigencia y cobertura. Una miniatura no demuestra movimiento, audio, montaje ni los primeros segundos. La tasa de un vÃ­deo debe incluir su evento y denominador.
4. A14 es la autoridad para el margen, break-even y viabilidad econÃ³mica. Usa gasto y divisa de la misma cuenta; no sumes monedas incompatibles. Si A14 no aporta un criterio comparable, no etiquetes econÃ³micamente un anuncio como ganador o perdedor.
5. A24 es la autoridad determinista sobre fiabilidad de mediciÃ³n. Copia exactamente su estado, procedencia, alcance y vigencia. Con `restricted`, `not_assessable` o `unknown`, no recomiendes pausar por ventas, ROAS o compras. A24 no demuestra causalidad.
6. A25 explica cambios de configuraciÃ³n, presupuesto y piezas. Si el contexto de cambio no estÃ¡ disponible, marca esa limitaciÃ³n y no compares periodos como si fueran idÃ©nticos. El rendimiento pagado de Meta no representa el alcance orgÃ¡nico de Instagram.
7. Mi Camino contiene el objetivo, versiÃ³n, revisiÃ³n e hitos aprobados de esta tienda. Vincula una propuesta solo a un hito exacto que aparezca en el contexto. No uses un hito por semejanza de tÃ­tulo o posiciÃ³n. Si no hay objetivo aprobado, propone como mÃ¡ximo una investigaciÃ³n operativa claramente separada del plan.
8. Coordina el resultado: A15 prepara la observaciÃ³n visual; A16 u otro productor crea la pieza; A05/A17/A18/A19 ordenan calendario y plan; A14/A24 validan economÃ­a y medida; A25 explica cambios. Una propuesta de tarea necesita revisiÃ³n humana y no autoriza gasto, publicaciÃ³n ni ediciÃ³n de campaÃ±as.

EVIDENCIA Y DISPONIBILIDAD
- Usa solo los bloques, herramientas y resultados entregados en este turno. Diferencia `available`, `no_data_returned`, `unavailable`, parcial, no importado y obsoleto. Un fallo o ausencia de importaciÃ³n nunca equivale a cero.
- Para cada seÃ±al conserva tienda, cuenta, anuncio o creatividad cuando estÃ©n disponibles; periodo, divisa, fuente, frescura y cobertura. No compares importes de distintas divisas.
- `has_video` solo describe el formato cuando la fuente de identidad lo confirma. Una reproducciÃ³n ausente significa desconocido, no imagen estÃ¡tica ni cero. `hook_rate` y `hold_rate` deben indicar el denominador observado; no uses un umbral de impresiones como sustituto de muestra de reproducciones.
- Los rankings son observaciones descriptivas fechadas y agregadas por dimensiÃ³n. `UNKNOWN` y ausencia de veredicto no son malos resultados. No expliques automÃ¡ticamente un ranking de conversiÃ³n por landing, oferta o pieza.
- La disponibilidad de las fuentes y los lÃ­mites de muestra visual deben aparecer en warnings cuando cambien la conclusiÃ³n. Explica cuÃ¡ntos anuncios y representaciones se inspeccionaron y quÃ© quedÃ³ fuera.

SALIDA
- Devuelve de cero a cinco `creative_decisions`; una lista vacÃ­a estÃ¡ permitida cuando no hay evidencia suficiente.
- Usa `decision_ref` secuencial `a23-1` â€¦ `a23-5`, Ãºnico dentro de la ejecuciÃ³n. En cada decisiÃ³n rellena la tienda/cuenta/anuncio/creatividad exactos cuando existan; en otro caso usa null. No inventes identificadores.
- Cada decisiÃ³n requiere `action` (`observe`, `test_variant`, `investigate_landing_offer`, `propose_pause`), `signal`, `window`, `spend_implicated`, `spend_currency`, `uncertainty`, `hypothesis`, `success_criterion` y `measurement_verdict`. Gasto y divisa son ambos null o ambos observados.
- Cada `proposed_write` debe incluir `decision_ref` de una decisiÃ³n de esta misma ejecuciÃ³n. No redactes tareas independientes del registro de decisiÃ³n. Las propuestas deben describir el trabajo revisable, su propietario, evidencia y condiciÃ³n de cierre. Una tarea que sugiera pausa solo se permite vinculada a `propose_pause` con gate A24 `usable_with_attribution_limits`.
- TEST_VARIANT exige primary_metric, metric_denominator, comparator, evaluation_window_days (1-90) y maturity_days (0-90 o null). MantÃ©n constantes las demÃ¡s variables; si no existe baseline observado, declÃ¡ralo y no declares ganador.
- No inventes datos, cuentas, identificadores, ventanas, costes, baseline, objetivo, veredicto ni criterio econÃ³mico. ExpÃ³n la incertidumbre concreta y el siguiente paso responsable.
- MantÃ©n lenguaje claro en espaÃ±ol. No hay lÃ­mite artificial de 22 palabras para explicar una decisiÃ³n; conserva el razonamiento necesario para que el consultor la revise.
$prompt$,
  encode(sha256(convert_to($prompt$
Eres A23, especialista en direcciÃ³n creativa y subasta de Meta para E-NORA. Tu trabajo es ayudar al consultor a entender quÃ© se observÃ³, quÃ© merece investigaciÃ³n y quÃ© variante puede probarse para apoyar el objetivo aprobado de la tienda. No controlas campaÃ±as ni ejecutas cambios en Meta.

MISIÃ“N Y LÃMITES
1. Describe relaciones observadas entre gasto, entrega, ranking, pieza y resultados atribuidos. No afirmes que un recurso visual causÃ³ el resultado del anuncio: Meta no separa necesariamente el efecto del arte, el copy, la audiencia, la oferta, la pÃ¡gina y la entrega.
2. PropÃ³n una prueba creativa concreta solo cuando haya una hipÃ³tesis contrastable. Indica el elemento que cambia, quÃ© se mantiene, el comparador, la mÃ©trica, el denominador, la ventana y el criterio de decisiÃ³n. No atribuyas causalidad a pruebas sin control o muestra suficiente.
3. A15 aporta observaciones de imÃ¡genes, fotogramas y slides. Respeta `representation_kind`, vigencia y cobertura. Una miniatura no demuestra movimiento, audio, montaje ni los primeros segundos. La tasa de un vÃ­deo debe incluir su evento y denominador.
4. A14 es la autoridad para el margen, break-even y viabilidad econÃ³mica. Usa gasto y divisa de la misma cuenta; no sumes monedas incompatibles. Si A14 no aporta un criterio comparable, no etiquetes econÃ³micamente un anuncio como ganador o perdedor.
5. A24 es la autoridad determinista sobre fiabilidad de mediciÃ³n. Copia exactamente su estado, procedencia, alcance y vigencia. Con `restricted`, `not_assessable` o `unknown`, no recomiendes pausar por ventas, ROAS o compras. A24 no demuestra causalidad.
6. A25 explica cambios de configuraciÃ³n, presupuesto y piezas. Si el contexto de cambio no estÃ¡ disponible, marca esa limitaciÃ³n y no compares periodos como si fueran idÃ©nticos. El rendimiento pagado de Meta no representa el alcance orgÃ¡nico de Instagram.
7. Mi Camino contiene el objetivo, versiÃ³n, revisiÃ³n e hitos aprobados de esta tienda. Vincula una propuesta solo a un hito exacto que aparezca en el contexto. No uses un hito por semejanza de tÃ­tulo o posiciÃ³n. Si no hay objetivo aprobado, propone como mÃ¡ximo una investigaciÃ³n operativa claramente separada del plan.
8. Coordina el resultado: A15 prepara la observaciÃ³n visual; A16 u otro productor crea la pieza; A05/A17/A18/A19 ordenan calendario y plan; A14/A24 validan economÃ­a y medida; A25 explica cambios. Una propuesta de tarea necesita revisiÃ³n humana y no autoriza gasto, publicaciÃ³n ni ediciÃ³n de campaÃ±as.

EVIDENCIA Y DISPONIBILIDAD
- Usa solo los bloques, herramientas y resultados entregados en este turno. Diferencia `available`, `no_data_returned`, `unavailable`, parcial, no importado y obsoleto. Un fallo o ausencia de importaciÃ³n nunca equivale a cero.
- Para cada seÃ±al conserva tienda, cuenta, anuncio o creatividad cuando estÃ©n disponibles; periodo, divisa, fuente, frescura y cobertura. No compares importes de distintas divisas.
- `has_video` solo describe el formato cuando la fuente de identidad lo confirma. Una reproducciÃ³n ausente significa desconocido, no imagen estÃ¡tica ni cero. `hook_rate` y `hold_rate` deben indicar el denominador observado; no uses un umbral de impresiones como sustituto de muestra de reproducciones.
- Los rankings son observaciones descriptivas fechadas y agregadas por dimensiÃ³n. `UNKNOWN` y ausencia de veredicto no son malos resultados. No expliques automÃ¡ticamente un ranking de conversiÃ³n por landing, oferta o pieza.
- La disponibilidad de las fuentes y los lÃ­mites de muestra visual deben aparecer en warnings cuando cambien la conclusiÃ³n. Explica cuÃ¡ntos anuncios y representaciones se inspeccionaron y quÃ© quedÃ³ fuera.

SALIDA
- Devuelve de cero a cinco `creative_decisions`; una lista vacÃ­a estÃ¡ permitida cuando no hay evidencia suficiente.
- Usa `decision_ref` secuencial `a23-1` â€¦ `a23-5`, Ãºnico dentro de la ejecuciÃ³n. En cada decisiÃ³n rellena la tienda/cuenta/anuncio/creatividad exactos cuando existan; en otro caso usa null. No inventes identificadores.
- Cada decisiÃ³n requiere `action` (`observe`, `test_variant`, `investigate_landing_offer`, `propose_pause`), `signal`, `window`, `spend_implicated`, `spend_currency`, `uncertainty`, `hypothesis`, `success_criterion` y `measurement_verdict`. Gasto y divisa son ambos null o ambos observados.
- Cada `proposed_write` debe incluir `decision_ref` de una decisiÃ³n de esta misma ejecuciÃ³n. No redactes tareas independientes del registro de decisiÃ³n. Las propuestas deben describir el trabajo revisable, su propietario, evidencia y condiciÃ³n de cierre. Una tarea que sugiera pausa solo se permite vinculada a `propose_pause` con gate A24 `usable_with_attribution_limits`.
- TEST_VARIANT exige primary_metric, metric_denominator, comparator, evaluation_window_days (1-90) y maturity_days (0-90 o null). MantÃ©n constantes las demÃ¡s variables; si no existe baseline observado, declÃ¡ralo y no declares ganador.
- No inventes datos, cuentas, identificadores, ventanas, costes, baseline, objetivo, veredicto ni criterio econÃ³mico. ExpÃ³n la incertidumbre concreta y el siguiente paso responsable.
- MantÃ©n lenguaje claro en espaÃ±ol. No hay lÃ­mite artificial de 22 palabras para explicar una decisiÃ³n; conserva el razonamiento necesario para que el consultor la revise.
$prompt$, 'UTF8')), 'hex')
)
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
from public.agent_definitions d
where av.definition_id = d.id and av.is_active and d.code = 'a23_creatividad_meta';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v10', source.model, 'a23_creatividad_meta_system', 'v10', source.allowed_tools, source.approval_mode
from public.agent_definitions d
join public.agent_versions source on source.definition_id = d.id and source.version = 'v9'
where d.code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update set
  prompt_code = excluded.prompt_code,
  prompt_version = excluded.prompt_version,
  allowed_tools = excluded.allowed_tools,
  approval_mode = excluded.approval_mode,
  is_active = true;

do $a23_v10_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a23_creatividad_meta_system' and version = 'v10'
      and position('decision_ref' in content) > 0
      and position('A14' in content) > 0
      and position('A24' in content) > 0
      and position('Mi Camino' in content) > 0
      and position('22 palabras' in lower(content)) > 0
  ) or not exists (
    select 1 from public.agent_versions av
    join public.agent_definitions d on d.id = av.definition_id
    where d.code = 'a23_creatividad_meta' and av.version = 'v10'
      and av.prompt_version = 'v10' and av.is_active
  ) then raise exception 'A23_V10_CANONICAL_PROMPT_OR_ACTIVE_VERSION_MISSING'; end if;
end
$a23_v10_guard$;

-- Canonical daily insight rows shared by A23 performance, ranking and trend queries.
create schema if not exists private;
create or replace view private.a23_meta_insight_rows_canonical
with (security_invoker = true)
as
select ranked.*
from (
  select r.*,
    row_number() over (
      partition by r.organization_id, r.ad_account_id, r.level, r.ad_id, r.metric_date, r.breakdown_hash
      order by (r.action_report_time = 'default') desc, r.synced_at desc, r.attribution_hash, r.id
    ) as a23_canonical_rank
  from public.meta_insight_rows_daily r
  where r.level = 'ad' and r.breakdown_hash = 'none' and r.ad_id is not null
) ranked
where ranked.a23_canonical_rank = 1;
revoke all on private.a23_meta_insight_rows_canonical from public, anon;
grant usage on schema private to authenticated, service_role;
grant select on private.a23_meta_insight_rows_canonical to authenticated, service_role;

alter table public.meta_ad_creative_assignments
  add column if not exists effective_at timestamptz,
  add column if not exists observed_at timestamptz not null default now(),
  add column if not exists effective_time_quality text not null default 'unknown';
alter table public.meta_ad_creative_assignments
  drop constraint if exists meta_ad_creative_assignments_effective_time_quality;
alter table public.meta_ad_creative_assignments
  add constraint meta_ad_creative_assignments_effective_time_quality
  check (effective_time_quality in ('unknown','observed_only','verified_effective_time'));

create or replace function public.sync_meta_ad_creative_assignment(
  p_organization_id uuid,
  p_ad_id uuid,
  p_creative_id uuid,
  p_observed_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_open public.meta_ad_creative_assignments%rowtype;
  v_effective_at timestamptz := coalesce(p_observed_at, now());
  v_id uuid;
begin
  if p_organization_id is null or p_ad_id is null or p_creative_id is null then
    raise exception 'META_CREATIVE_ASSIGNMENT_SCOPE_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_ad_id::text, 0)
  );
  select * into v_open from public.meta_ad_creative_assignments a
  where a.organization_id = p_organization_id and a.ad_id = p_ad_id and a.valid_until is null
  order by a.valid_from desc limit 1 for update;
  if found and v_open.creative_id = p_creative_id then
    update public.meta_ad_creative_assignments
    set observed_at = greatest(observed_at, v_effective_at)
    where id = v_open.id returning id into v_id;
    return v_id;
  end if;
  if found then
    v_effective_at := greatest(v_effective_at, v_open.valid_from + interval '1 millisecond');
    update public.meta_ad_creative_assignments
    set valid_until = v_effective_at, observed_at = greatest(observed_at, v_effective_at)
    where id = v_open.id;
  end if;
  insert into public.meta_ad_creative_assignments (
    organization_id, ad_id, creative_id, valid_from, observed_at,
    effective_at, effective_time_quality
  ) values (
    p_organization_id, p_ad_id, p_creative_id, v_effective_at, v_effective_at,
    null, 'observed_only'
  ) returning id into v_id;
  return v_id;
end
$function$;
revoke all on function public.sync_meta_ad_creative_assignment(uuid,uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.sync_meta_ad_creative_assignment(uuid,uuid,uuid,timestamptz) to service_role;

create or replace function public.meta_creative_ranking_observations(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table (
  ad_id uuid,
  ad_account_id uuid,
  metric_date date,
  spend_currency text,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with scoped as (
    select r.ad_id, r.ad_account_id, r.metric_date, r.quality_ranking,
      r.engagement_rate_ranking, r.conversion_rate_ranking, a.currency_code
    from private.a23_meta_insight_rows_canonical r
    join public.meta_ad_accounts a on a.id = r.ad_account_id
    where r.organization_id = target_organization_id
      and target_store_id is not null
      and r.metric_date between period_start and period_end
      and a.store_id = target_store_id and a.is_active and a.is_selected
  ), latest as (
    select distinct on (ad_id, ad_account_id)
      ad_id, ad_account_id, metric_date, currency_code,
      quality_ranking, engagement_rate_ranking, conversion_rate_ranking
    from scoped
    where quality_ranking is not null or engagement_rate_ranking is not null or conversion_rate_ranking is not null
    order by ad_id, ad_account_id, metric_date desc
  )
  select ad_id, ad_account_id, metric_date, currency_code::text,
    quality_ranking::text, engagement_rate_ranking::text, conversion_rate_ranking::text
  from latest;
$function$;
revoke all on function public.meta_creative_ranking_observations(uuid,date,date,uuid) from public, anon, authenticated;
grant execute on function public.meta_creative_ranking_observations(uuid,date,date,uuid) to service_role;
create or replace function public.meta_creative_performance(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  min_impressions bigint default 1000,
  target_campaign_id uuid default null
)
returns table(
  ad_id uuid,
  ad_name text,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  spend numeric,
  impressions bigint,
  outbound_clicks bigint,
  outbound_ctr numeric,
  video_plays bigint,
  hook_rate numeric,
  hold_rate numeric,
  thruplay_rate numeric,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  purchases numeric,
  purchase_value numeric,
  roas numeric,
  cost_per_purchase numeric,
  purchase_attribution_window text,
  has_video boolean,
  enough_volume boolean,
  days_with_data bigint,
  spend_currency text
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.id, r.ad_id, r.spend, r.impressions, r.metric_date,
      r.outbound_clicks, r.video_plays, r.video_p100_watched, r.video_thruplays,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking,
      r.ad_account_id, r.campaign_id
    from private.a23_meta_insight_rows_canonical r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_campaign_id is null or r.campaign_id = target_campaign_id)
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  row_purchases as (
    select distinct on (m.insight_row_id, m.metric_name)
      m.insight_row_id, m.metric_name, m.value, m.attribution_window, b.ad_id
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    order by
      m.insight_row_id,
      m.metric_name,
      public.meta_attribution_window_rank(m.attribution_window)
  ),
  purchases_by_ad as (
    select
      ad_id,
      sum(value) filter (where metric_name = 'actions') as purchases,
      sum(value) filter (where metric_name = 'action_values') as purchase_value,
      (array_agg(attribution_window order by
        public.meta_attribution_window_rank(attribution_window)))[1] as attribution_window
    from row_purchases
    group by ad_id
  ),
  latest_verdict as (
    select distinct on (b.ad_id)
      b.ad_id,
      b.quality_ranking,
      b.engagement_rate_ranking,
      b.conversion_rate_ranking
    from base_rows b
    where b.quality_ranking is not null
       or b.engagement_rate_ranking is not null
       or b.conversion_rate_ranking is not null
    order by b.ad_id, b.metric_date desc
  ),
  totals as (
    select
      b.ad_id,
      sum(b.spend) as spend,
      sum(b.impressions)::bigint as impressions,
      sum(b.outbound_clicks)::bigint as outbound_clicks,
      sum(b.video_plays)::bigint as video_plays,
      sum(b.video_p100_watched)::bigint as video_p100_watched,
      sum(b.video_thruplays)::bigint as video_thruplays,
      count(distinct b.metric_date)::bigint as days_with_data
    from base_rows b
    group by b.ad_id
  )
  select
    t.ad_id,
    d.name::text as ad_name,
    s.name::text as ad_set_name,
    c.name::text as campaign_name,
    d.effective_status::text,
    coalesce(t.spend, 0) as spend,
    coalesce(t.impressions, 0) as impressions,
    t.outbound_clicks,
    case
      when t.impressions >= min_impressions and t.outbound_clicks is not null
      then round(t.outbound_clicks::numeric / t.impressions, 6)
    end as outbound_ctr,
    t.video_plays,
    case
      when t.impressions >= min_impressions and t.video_plays is not null
      then round(t.video_plays::numeric / t.impressions, 6)
    end as hook_rate,
    case
      when t.impressions >= min_impressions and t.video_p100_watched is not null
      then round(t.video_p100_watched::numeric / nullif(t.video_plays, 0), 6)
    end as hold_rate,
    case
      when t.impressions >= min_impressions and t.video_thruplays is not null
      then round(t.video_thruplays::numeric / t.impressions, 6)
    end as thruplay_rate,
    v.quality_ranking::text,
    v.engagement_rate_ranking::text,
    v.conversion_rate_ranking::text,
    p.purchases as purchases,
    p.purchase_value as purchase_value,
    case
      when coalesce(t.spend, 0) > 0 and p.purchase_value is not null
      then round(p.purchase_value / t.spend, 4)
    end as roas,
    case
      when p.purchases > 0
      then round(coalesce(t.spend, 0) / p.purchases, 2)
    end as cost_per_purchase,
    p.attribution_window::text as purchase_attribution_window,
    t.video_plays is not null as has_video,
    coalesce(t.impressions, 0) >= min_impressions as enough_volume,
    t.days_with_data,
    account.currency_code::text as spend_currency
  from totals t
  join public.meta_ads d on d.id = t.ad_id
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  join public.meta_ad_accounts account
    on account.id = c.ad_account_id
   and account.organization_id = target_organization_id
  left join latest_verdict v on v.ad_id = t.ad_id
  left join purchases_by_ad p on p.ad_id = t.ad_id
  order by coalesce(t.spend, 0) desc;
$function$;

create or replace function public.meta_creative_ranking_distribution(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  dimension text,
  ranking_value text,
  ads bigint,
  spend numeric,
  spend_share numeric,
  currency_code text
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.ad_id, r.ad_account_id, r.spend, r.metric_date,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking
    from private.a23_meta_insight_rows_canonical r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  spend_by_ad as (
    select ad_id, ad_account_id, sum(spend) as spend
    from base_rows
    group by ad_id, ad_account_id
  ),
  latest_verdict as (
    select distinct on (ad_id, ad_account_id)
      ad_id, ad_account_id, quality_ranking,
      engagement_rate_ranking, conversion_rate_ranking
    from base_rows
    where quality_ranking is not null
       or engagement_rate_ranking is not null
       or conversion_rate_ranking is not null
    order by ad_id, ad_account_id, metric_date desc
  ),
  spread as (
    select
      d.dimension,
      coalesce(d.value, 'SIN_VEREDICTO') as ranking_value,
      s.spend,
      account.currency_code::text as currency_code
    from spend_by_ad s
    join public.meta_ad_accounts account
      on account.id = s.ad_account_id
     and account.organization_id = target_organization_id
    left join latest_verdict v
      on v.ad_id = s.ad_id and v.ad_account_id = s.ad_account_id
    cross join lateral (values
      ('calidad', v.quality_ranking),
      ('interaccion', v.engagement_rate_ranking),
      ('conversion', v.conversion_rate_ranking)
    ) as d(dimension, value)
  ),
  grouped as (
    select
      dimension,
      ranking_value,
      currency_code,
      count(*)::bigint as ads,
      case when currency_code is not null then sum(spend) end as spend
    from spread
    group by dimension, ranking_value, currency_code
  )
  select
    dimension,
    ranking_value,
    ads,
    spend,
    case
      when currency_code is not null
       and sum(spend) over (partition by dimension, currency_code) > 0
      then round(spend / sum(spend) over (partition by dimension, currency_code), 4)
    end as spend_share,
    currency_code
  from grouped
  order by dimension, currency_code nulls last, spend desc nulls last;
$function$;

create or replace function public.meta_creative_daily_trend(
  target_organization_id uuid,
  target_ad_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  ad_scope record;
  trend_rows jsonb;
  days_with_data integer := 0;
begin
  if target_organization_id is null or target_ad_id is null
     or period_start is null or period_end is null
     or period_end < period_start
     or period_end - period_start > 90
     or period_end > current_date then
    raise exception 'invalid_meta_creative_daily_trend_input';
  end if;

  select a.id as ad_account_id, a.canonical_purchase_action_type
  into ad_scope
  from public.meta_ads d
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  join public.meta_ad_accounts a on a.id = c.ad_account_id
  where d.id = target_ad_id
    and d.organization_id = target_organization_id
    and target_store_id is not null
    and a.store_id = target_store_id
    and a.is_active and a.is_selected;

  if not found then
    return jsonb_build_object('status', 'not_found_or_out_of_scope');
  end if;

  with ranked_rows as (
    select
      r.id,
      r.metric_date,
      r.spend,
      r.impressions,
      r.reach,
      r.frequency,
      r.outbound_clicks,
      r.cpm,
      r.action_report_time,
      r.attribution_hash,
      row_number() over (
        partition by r.metric_date
        order by (r.action_report_time = 'default') desc,
                 r.synced_at desc,
                 r.attribution_hash asc,
                 r.id asc
      ) as row_rank
    from private.a23_meta_insight_rows_canonical r
    where r.organization_id = target_organization_id
      and r.ad_account_id = ad_scope.ad_account_id
      and r.ad_id = target_ad_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.metric_date between period_start and period_end
  ), chosen_rows as (
    select * from ranked_rows where row_rank = 1
  ), purchase_windows as (
    select m.insight_row_id, m.attribution_window,
      sum(m.value) filter (where m.metric_name = 'actions') as purchases,
      sum(m.value) filter (where m.metric_name = 'action_values') as purchase_value,
      count(*) filter (where m.metric_name = 'actions') > 0 as has_actions,
      count(*) filter (where m.metric_name = 'action_values') > 0 as has_values
    from public.meta_insight_action_metrics m
    join chosen_rows r on r.id = m.insight_row_id
    where m.organization_id = target_organization_id
      and m.action_type = ad_scope.canonical_purchase_action_type
      and m.metric_name in ('actions', 'action_values')
    group by m.insight_row_id, m.attribution_window
  ), purchase_by_row as (
    select distinct on (insight_row_id) insight_row_id, purchases, purchase_value,
      attribution_window
    from purchase_windows
    order by insight_row_id, (has_actions and has_values) desc,
      public.meta_attribution_window_rank(attribution_window)
  ), daily as (
    select
      r.metric_date,
      r.spend,
      r.impressions,
      r.reach,
      r.frequency,
      r.outbound_clicks,
      coalesce(r.cpm, case when r.impressions > 0 then r.spend * 1000 / r.impressions end) as cpm,
      p.purchases as purchases,
      p.purchase_value as purchase_value,
      p.attribution_window
    from chosen_rows r
    left join purchase_by_row p on p.insight_row_id = r.id
  )
  select count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'date', d.metric_date,
           'spend', d.spend,
           'impressions', d.impressions,
           'reach', d.reach,
           'frequency', d.frequency,
           'outbound_clicks', d.outbound_clicks,
           'outbound_ctr', case when d.impressions > 0 then round(d.outbound_clicks::numeric / d.impressions, 6) end,
           'cpm', d.cpm,
           'purchases', d.purchases,
           'purchase_value', d.purchase_value,
           'cost_per_purchase', case when d.purchases > 0 then round(d.spend / d.purchases, 2) end,
           'purchase_attribution_window', d.attribution_window
         ) order by d.metric_date), '[]'::jsonb)
  into days_with_data, trend_rows
  from daily d;

  return jsonb_build_object(
    'status', 'available',
    'ad_id', target_ad_id,
    'period', jsonb_build_object('start', period_start, 'end', period_end),
    'grain', 'one canonical ad-level row per day',
    'days_with_data', days_with_data,
    'daily_metrics', trend_rows,
    'caveats', jsonb_build_array(
      'reach_and_frequency_are_daily_observations_and_must_not_be_summed_across_dates',
      'one_no_breakdown_row_per_date_is_selected_to_avoid_duplicate_attribution_report_rows',
      'purchase_metrics_follow_the_selected_row_attribution_window_and_may_not_match_other_reporting_windows',
      'daily_trend_is_descriptive_and_does_not_prove_creative_fatigue_or_causality'
    )
  );
end;
$$;
create or replace function public.meta_creative_performance_a23(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  min_impressions bigint default 1000,
  target_campaign_id uuid default null
)
returns table(
  ad_id uuid,
  ad_account_id uuid,
  ad_name text,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  spend numeric,
  impressions bigint,
  outbound_clicks bigint,
  outbound_ctr numeric,
  video_plays bigint,
  hook_rate numeric,
  hold_rate numeric,
  thruplay_rate numeric,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  purchases numeric,
  purchase_value numeric,
  roas numeric,
  cost_per_purchase numeric,
  purchase_attribution_window text,
  has_video boolean,
  video_format_status text,
  video_plays_status text,
  video_rate_denominator_plays bigint,
  enough_volume boolean,
  days_with_data bigint,
  spend_currency text
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.id, r.ad_id, r.spend, r.impressions, r.metric_date,
      r.outbound_clicks, r.video_plays, r.video_p100_watched, r.video_thruplays,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking,
      r.ad_account_id, r.campaign_id
    from private.a23_meta_insight_rows_canonical r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_campaign_id is null or r.campaign_id = target_campaign_id)
      and target_store_id is not null
      and exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
          and sa.is_active and sa.is_selected
      )
  ),
  row_purchase_windows as (
    select
      m.insight_row_id,
      b.ad_id,
      m.attribution_window,
      sum(m.value) filter (where m.metric_name = 'actions') as purchases,
      sum(m.value) filter (where m.metric_name = 'action_values') as purchase_value,
      count(*) filter (where m.metric_name = 'actions') > 0 as has_actions,
      count(*) filter (where m.metric_name = 'action_values') > 0 as has_values
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    group by m.insight_row_id, b.ad_id, m.attribution_window
  ),
  row_purchases as (
    select distinct on (insight_row_id)
      insight_row_id, ad_id, attribution_window, purchases, purchase_value
    from row_purchase_windows
    order by insight_row_id, (has_actions and has_values) desc,
      public.meta_attribution_window_rank(attribution_window)
  ),
  purchases_by_ad as (
    select ad_id, sum(purchases) as purchases, sum(purchase_value) as purchase_value,
      case when count(distinct attribution_window) = 1 then min(attribution_window)::text
           when count(distinct attribution_window) > 1 then 'mixed' end as attribution_window
    from row_purchases
    group by ad_id
  ),
  latest_verdict as (
    select distinct on (b.ad_id)
      b.ad_id,
      b.quality_ranking,
      b.engagement_rate_ranking,
      b.conversion_rate_ranking
    from base_rows b
    where b.quality_ranking is not null
       or b.engagement_rate_ranking is not null
       or b.conversion_rate_ranking is not null
    order by b.ad_id, b.metric_date desc
  ),
  totals as (
    select
      b.ad_id,
      b.ad_account_id,
      sum(b.spend) as spend,
      sum(b.impressions)::bigint as impressions,
      sum(b.outbound_clicks)::bigint as outbound_clicks,
      sum(b.video_plays)::bigint as video_plays,
      sum(b.video_p100_watched)::bigint as video_p100_watched,
      sum(b.video_thruplays)::bigint as video_thruplays,
      count(distinct b.metric_date)::bigint as days_with_data
    from base_rows b
    group by b.ad_id, b.ad_account_id
  )
  select
    t.ad_id,
    t.ad_account_id,
    d.name::text as ad_name,
    s.name::text as ad_set_name,
    c.name::text as campaign_name,
    d.effective_status::text,
    coalesce(t.spend, 0) as spend,
    coalesce(t.impressions, 0) as impressions,
    t.outbound_clicks,
    case
      when t.impressions >= min_impressions and t.outbound_clicks is not null
      then round(t.outbound_clicks::numeric / t.impressions, 6)
    end as outbound_ctr,
    t.video_plays,
    case
      when t.impressions >= min_impressions and t.video_plays >= 100
      then round(t.video_plays::numeric / t.impressions, 6)
    end as hook_rate,
    case
      when t.impressions >= min_impressions and t.video_plays >= 100 and t.video_p100_watched is not null
      then round(t.video_p100_watched::numeric / nullif(t.video_plays, 0), 6)
    end as hold_rate,
    case
      when t.impressions >= min_impressions and t.video_plays >= 100 and t.video_thruplays is not null
      then round(t.video_thruplays::numeric / t.impressions, 6)
    end as thruplay_rate,
    v.quality_ranking::text,
    v.engagement_rate_ranking::text,
    v.conversion_rate_ranking::text,
    p.purchases as purchases,
    p.purchase_value as purchase_value,
    case
      when coalesce(t.spend, 0) > 0 and p.purchase_value is not null
      then round(p.purchase_value / t.spend, 4)
    end as roas,
    case
      when p.purchases > 0
      then round(coalesce(t.spend, 0) / p.purchases, 2)
    end as cost_per_purchase,
    p.attribution_window::text as purchase_attribution_window,
    exists (
      select 1 from public.meta_creative_assets va
      where va.creative_id = d.current_creative_id and va.is_current and va.asset_type = 'video'
    ) as has_video,
    case
      when exists (select 1 from public.meta_creative_assets va where va.creative_id = d.current_creative_id and va.is_current and va.asset_type = 'video') then 'video'
      when exists (select 1 from public.meta_creative_assets ia where ia.creative_id = d.current_creative_id and ia.is_current and ia.asset_type = 'image') then 'image'
      else 'unknown'
    end as video_format_status,
    case when t.video_plays is null then 'unavailable' else 'available' end as video_plays_status,
    t.video_plays as video_rate_denominator_plays,
    coalesce(t.impressions, 0) >= min_impressions as enough_volume,
    t.days_with_data,
    account.currency_code::text as spend_currency
  from totals t
  join public.meta_ads d on d.id = t.ad_id
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  join public.meta_ad_accounts account
    on account.id = c.ad_account_id
   and account.organization_id = target_organization_id
   and account.store_id = target_store_id
   and account.is_active and account.is_selected
  left join latest_verdict v on v.ad_id = t.ad_id
  left join purchases_by_ad p on p.ad_id = t.ad_id
  order by coalesce(t.spend, 0) desc
  limit 200;
$function$;
revoke all on function public.meta_creative_performance_a23(uuid,date,date,uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.meta_creative_performance_a23(uuid,date,date,uuid,bigint,uuid) to service_role;

create or replace function public.meta_creative_diagnostics(
  target_organization_id uuid,
  target_ad_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  ad_row record;
  assignment_count integer := 0;
  single_assignment record;
  creative_rows jsonb := '[]'::jsonb;
  asset_rows jsonb := '[]'::jsonb;
  asset_count_total integer := 0;
  performance_row jsonb;
  attribution_status text;
begin
  if target_organization_id is null or target_ad_id is null
     or period_start is null or period_end is null
     or period_end < period_start
     or period_end - period_start > 90
     or period_end > current_date then
    raise exception 'invalid_meta_creative_diagnostics_input';
  end if;

  select
    d.id,
    d.name,
    d.effective_status,
    d.current_creative_id,
    s.id as ad_set_id,
    s.name as ad_set_name,
    s.is_dynamic_creative,
    c.id as campaign_id,
    c.name as campaign_name,
    c.objective,
    a.id as ad_account_id,
    a.account_name,
    a.store_id
  into ad_row
  from public.meta_ads d
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  join public.meta_ad_accounts a on a.id = c.ad_account_id
  where d.id = target_ad_id
    and d.organization_id = target_organization_id
    and (target_store_id is null or a.store_id = target_store_id);

  if not found then
    return jsonb_build_object('status', 'not_found_or_out_of_scope');
  end if;

  select count(*)::integer
  into assignment_count
  from public.meta_ad_creative_assignments x
  where x.organization_id = target_organization_id
    and x.ad_id = target_ad_id
    and x.valid_from < (period_end + 1)::timestamptz
    and (x.valid_until is null or x.valid_until > period_start::timestamptz);

  select x.creative_id, x.valid_from, x.valid_until, x.effective_at, x.effective_time_quality, x.observed_at
  into single_assignment
  from public.meta_ad_creative_assignments x
  where x.organization_id = target_organization_id
    and x.ad_id = target_ad_id
    and x.valid_from < (period_end + 1)::timestamptz
    and (x.valid_until is null or x.valid_until > period_start::timestamptz)
  order by x.valid_from
  limit 1;

  attribution_status := case
    when assignment_count = 0 then 'current_snapshot_only'
    when assignment_count > 1 then 'multiple_creatives_in_period'
    when single_assignment.effective_time_quality <> 'verified_effective_time'
      or single_assignment.effective_at is null
      then 'observed_only_no_verified_effective_time'
    when single_assignment.effective_at > period_start::timestamptz
      or (single_assignment.valid_until is not null
        and single_assignment.valid_until < (period_end + 1)::timestamptz)
      then 'assignment_does_not_cover_full_period'
    else 'single_creative_covers_period_verified'
  end;

  select count(*)::integer
  into asset_count_total
  from public.meta_creative_assets ca
  where ca.organization_id = target_organization_id
    and ca.creative_id in (
      select x.creative_id
      from public.meta_ad_creative_assignments x
      where x.organization_id = target_organization_id
        and x.ad_id = target_ad_id
        and x.valid_from < (period_end + 1)::timestamptz
        and (x.valid_until is null or x.valid_until > period_start::timestamptz)
      union
      select ad_row.current_creative_id
      where ad_row.current_creative_id is not null
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'creative_id', x.creative_id,
    'creative_name', cr.name,
    'valid_from', x.valid_from,
    'valid_until', x.valid_until,
    'call_to_action_type', cr.call_to_action_type,
    'primary_text', left(cr.primary_text, 1200),
    'headline', left(cr.headline, 500),
    'description', left(cr.description, 800),
    'object_type', cr.object_type,
    'link_host', case when cr.link_url ~* '^https?://[^/@?#]+(/|$)' then lower(split_part(split_part(regexp_replace(cr.link_url, '^https?://', '', 'i'), '/', 1), '?', 1)) else null end,
    'asset_feed_spec_present', cr.asset_feed_spec is not null,
    'dynamic_creative', ad_row.is_dynamic_creative
  ) order by x.valid_from), '[]'::jsonb)
  into creative_rows
  from public.meta_ad_creative_assignments x
  join public.meta_creatives cr
    on cr.id = x.creative_id and cr.organization_id = target_organization_id
  where x.organization_id = target_organization_id
    and x.ad_id = target_ad_id
    and x.valid_from < (period_end + 1)::timestamptz
    and (x.valid_until is null or x.valid_until > period_start::timestamptz);

  if assignment_count = 0 and ad_row.current_creative_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'creative_id', cr.id,
      'creative_name', cr.name,
      'valid_from', null,
      'valid_until', null,
      'call_to_action_type', cr.call_to_action_type,
      'primary_text', left(cr.primary_text, 1200),
      'headline', left(cr.headline, 500),
      'description', left(cr.description, 800),
      'object_type', cr.object_type,
      'link_host', case when cr.link_url ~* '^https?://[^/@?#]+(/|$)' then lower(split_part(split_part(regexp_replace(cr.link_url, '^https?://', '', 'i'), '/', 1), '?', 1)) else null end,
      'asset_feed_spec_present', cr.asset_feed_spec is not null,
      'dynamic_creative', ad_row.is_dynamic_creative
    )), '[]'::jsonb)
    into creative_rows
    from public.meta_creatives cr
    where cr.id = ad_row.current_creative_id
      and cr.organization_id = target_organization_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'creative_id', x.creative_id,
    'asset_type', x.asset_type,
    'position', x.position,
    'asset_label', x.asset_label,
    'is_primary', x.is_primary,
    'text_value', left(x.text_value, 600),
    'media_available', x.media_url is not null or x.thumbnail_url is not null,
    'destination_available', x.link_url is not null
  ) order by x.creative_id, x.position, x.asset_type), '[]'::jsonb)
  into asset_rows
  from (
    select ca.creative_id, ca.asset_type, ca.position, ca.asset_label,
           ca.is_primary, ca.text_value, ca.media_url, ca.thumbnail_url, ca.link_url
    from public.meta_creative_assets ca
    where ca.organization_id = target_organization_id
      and ca.creative_id in (
        select x.creative_id
        from public.meta_ad_creative_assignments x
        where x.organization_id = target_organization_id
          and x.ad_id = target_ad_id
          and x.valid_from < (period_end + 1)::timestamptz
          and (x.valid_until is null or x.valid_until > period_start::timestamptz)
        union
        select ad_row.current_creative_id
        where ad_row.current_creative_id is not null
      )
    order by ca.creative_id, ca.position, ca.asset_type
    limit 50
  ) x;

  select to_jsonb(p)
  into performance_row
  from public.meta_creative_performance_a23(
    target_organization_id,
    period_start,
    period_end,
    target_store_id,
    1000
  ) p
  where p.ad_id = target_ad_id
  limit 1;

  return jsonb_build_object(
    'status', 'available',
    'identity', jsonb_build_object(
      'ad_id', ad_row.id,
      'ad_name', ad_row.name,
      'effective_status', ad_row.effective_status,
      'ad_set_id', ad_row.ad_set_id,
      'ad_set_name', ad_row.ad_set_name,
      'campaign_id', ad_row.campaign_id,
      'campaign_name', ad_row.campaign_name,
      'objective', ad_row.objective,
      'ad_account_id', ad_row.ad_account_id,
      'account_name', ad_row.account_name,
      'store_id', ad_row.store_id,
      'is_dynamic_creative', ad_row.is_dynamic_creative
    ),
    'period', jsonb_build_object('start', period_start, 'end', period_end),
    'performance_grain', 'ad_period',
    'performance', performance_row,
    'assignment_count', assignment_count,
    'creative_attribution_status', attribution_status,
    'creative_performance_attributed', attribution_status = 'single_creative_covers_period_verified',
    'creatives', creative_rows,
    'assets', asset_rows,
    'assets_capped_at', 50,
    'assets_total', asset_count_total,
    'assets_truncated', asset_count_total > 50
  );
end;
$$;
revoke all on function public.meta_creative_diagnostics(uuid,uuid,date,date,uuid) from public, anon, authenticated;
grant execute on function public.meta_creative_diagnostics(uuid,uuid,date,date,uuid) to service_role;

create or replace function public.meta_creative_ranking_distribution_a23(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  dimension text,
  ranking_value text,
  ads bigint,
  spend numeric,
  spend_share numeric,
  currency_code text
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.ad_id, r.ad_account_id, r.spend, r.metric_date,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking
    from private.a23_meta_insight_rows_canonical r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and target_store_id is not null and exists (select 1 from public.meta_ad_accounts sa where sa.id = r.ad_account_id and sa.store_id = target_store_id and sa.is_active and sa.is_selected)
  ),
  spend_by_ad as (
    select ad_id, ad_account_id, sum(spend) as spend
    from base_rows
    group by ad_id, ad_account_id
  ),
  latest_verdict as (
    select distinct on (ad_id, ad_account_id)
      ad_id, ad_account_id, quality_ranking,
      engagement_rate_ranking, conversion_rate_ranking
    from base_rows
    where quality_ranking is not null
       or engagement_rate_ranking is not null
       or conversion_rate_ranking is not null
    order by ad_id, ad_account_id, metric_date desc
  ),
  spread as (
    select
      d.dimension,
      coalesce(d.value, 'SIN_VEREDICTO') as ranking_value,
      s.spend,
      account.currency_code::text as currency_code
    from spend_by_ad s
    join public.meta_ad_accounts account
      on account.id = s.ad_account_id
     and account.organization_id = target_organization_id
    left join latest_verdict v
      on v.ad_id = s.ad_id and v.ad_account_id = s.ad_account_id
    cross join lateral (values
      ('calidad', v.quality_ranking),
      ('interaccion', v.engagement_rate_ranking),
      ('conversion', v.conversion_rate_ranking)
    ) as d(dimension, value)
  ),
  grouped as (
    select
      dimension,
      ranking_value,
      currency_code,
      count(*)::bigint as ads,
      case when currency_code is not null then sum(spend) end as spend
    from spread
    group by dimension, ranking_value, currency_code
  )
  select
    dimension,
    ranking_value,
    ads,
    spend,
    case
      when currency_code is not null
       and sum(spend) over (partition by dimension, currency_code) > 0
      then round(spend / sum(spend) over (partition by dimension, currency_code), 4)
    end as spend_share,
    currency_code
  from grouped
  order by dimension, currency_code nulls last, spend desc nulls last;
$function$;
revoke all on function public.meta_creative_ranking_distribution_a23(uuid,date,date,uuid) from public, anon, authenticated;
grant execute on function public.meta_creative_ranking_distribution_a23(uuid,date,date,uuid) to service_role;

create or replace function public.reserve_a23_manual_refresh(
  p_run_id uuid, p_organization_id uuid, p_agent_code text, p_daily_limit integer,
  p_request_key text default null, p_store_id uuid default null
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_reserved integer;
  v_runs integer;
begin
  if p_agent_code <> 'a23_creatividad_meta' or p_store_id is null then raise exception 'invalid_a14_scope'; end if;
  if not exists (select 1 from public.shopify_stores s where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active) then
    raise exception 'invalid_store_scope';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':a23_creatividad_meta:' || p_store_id::text || ':' || v_day_start::text, 0));
  if p_request_key is not null and exists (
    select 1 from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reservation_day = v_day_start::date and r.request_key = p_request_key and r.store_id = p_store_id
  ) then return 'duplicate'; end if;
  select count(*) into v_runs from public.agent_runs r
    join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id
    where r.organization_id = p_organization_id and r.trigger_type = 'manual'
      and r.started_at >= v_day_start and d.code = p_agent_code and r.store_id = p_store_id
      and not exists (select 1 from public.agent_manual_refresh_reservations q where q.run_id = r.id);
  select count(*) into v_reserved from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reserved_at >= v_day_start and r.store_id = p_store_id;
  if v_runs + v_reserved >= greatest(p_daily_limit, 0) then return 'limit'; end if;
  insert into public.agent_manual_refresh_reservations(run_id, organization_id, agent_code, request_key, store_id)
  values (p_run_id, p_organization_id, p_agent_code, p_request_key, p_store_id) on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end;
$$;
revoke all on function public.reserve_a23_manual_refresh(uuid,uuid,text,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_a23_manual_refresh(uuid,uuid,text,integer,text,uuid) to service_role;

create or replace function public.materialize_a23_creative_task(
  p_task jsonb,
  p_organization_id uuid,
  p_store_id uuid,
  p_output_id uuid,
  p_proposal_index integer,
  p_plan_id uuid,
  p_plan_version integer,
  p_milestone_id uuid,
  p_decision_ref text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_task_id uuid;
  v_created boolean := false;
begin
  if p_organization_id is null or p_store_id is null or p_output_id is null
     or p_proposal_index is null or p_proposal_index < 0 or p_decision_ref is null then
    raise exception 'A23_TASK_SCOPE_REQUIRED';
  end if;
  if not exists (
    select 1 from public.agent_outputs o
    join public.agent_runs r on r.id = o.run_id
    join public.agent_versions av on av.id = r.agent_version_id
    join public.agent_definitions d on d.id = av.definition_id
    where o.id = p_output_id and o.organization_id = p_organization_id
      and o.status = 'pending_approval' and r.organization_id = p_organization_id
      and r.store_id = p_store_id and d.code = 'a23_creatividad_meta'
  ) then raise exception 'A23_OUTPUT_NOT_PENDING_OR_OUT_OF_SCOPE'; end if;

  if not exists (
    select 1 from public.a23_creative_decisions d
    where d.organization_id = p_organization_id and d.store_id = p_store_id
      and d.output_id = p_output_id and d.decision_ref = p_decision_ref
      and d.linked_proposals @> jsonb_build_array(jsonb_build_object('decision_ref', p_decision_ref))
      and (d.action <> 'propose_pause' or d.measurement_verdict = 'usable_with_attribution_limits')
  ) then raise exception 'A23_DECISION_LINK_OR_GATE_INVALID'; end if;

  if p_plan_id is not null and not exists (
    select 1 from public.strategic_plans p
    where p.id = p_plan_id and p.organization_id = p_organization_id
      and p.store_id = p_store_id and p.status = 'active'
      and p.approved_at is not null and p.version = p_plan_version
  ) then
    return jsonb_build_object('status', 'camino_changed_since_analysis');
  end if;
  if p_plan_id is null and (p_plan_version is not null or p_milestone_id is not null) then
    return jsonb_build_object('status', 'invalid_camino_snapshot');
  end if;
  if p_milestone_id is not null and not exists (
    select 1 from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id = m.phase_id
    join public.strategic_plans p on p.id = ph.plan_id
    where m.id = p_milestone_id and m.organization_id = p_organization_id
      and m.status in ('active', 'pending') and ph.status in ('active', 'pending')
      and p.id = p_plan_id and p.organization_id = p_organization_id
      and p.store_id = p_store_id and p.version = p_plan_version
      and p.status = 'active' and p.approved_at is not null
  ) then
    return jsonb_build_object('status', 'milestone_out_of_scope');
  end if;

  insert into public.tasks (
    agent_output_id, agent_proposal_index, organization_id, store_id, source,
    priority, title, description, created_by, assigned_to, metadata, categories
  ) values (
    p_output_id, p_proposal_index, p_organization_id, p_store_id, 'ai_consultant',
    coalesce(p_task->>'priority', 'medium'),
    coalesce(p_task->>'title', 'Propuesta creativa de Meta'),
    coalesce(p_task->>'description', ''),
    nullif(p_task->>'created_by', '')::uuid,
    nullif(p_task->>'assigned_to', '')::uuid,
    coalesce(p_task->'metadata', '{}'::jsonb),
    array(select jsonb_array_elements_text(coalesce(p_task->'categories', '[]'::jsonb)))
  ) on conflict (agent_output_id, agent_proposal_index) do nothing
  returning id into v_task_id;
  v_created := v_task_id is not null;
  if v_task_id is null then
    select t.id into v_task_id from public.tasks t
    where t.agent_output_id = p_output_id and t.agent_proposal_index = p_proposal_index
      and t.organization_id = p_organization_id and t.store_id = p_store_id;
  end if;
  if v_task_id is null then raise exception 'A23_TASK_RECOVERY_FAILED'; end if;

  if p_milestone_id is not null then
    insert into public.milestone_task_links (organization_id, milestone_id, task_id)
    values (p_organization_id, p_milestone_id, v_task_id)
    on conflict (milestone_id, task_id) do nothing;
  end if;
  update public.a23_creative_decisions
  set task_id = v_task_id, delivery_status = 'materialized'
  where organization_id = p_organization_id and output_id = p_output_id
    and decision_ref = p_decision_ref;
  return jsonb_build_object('status', 'materialized', 'task_id', v_task_id, 'created', v_created);
end
$function$;
revoke all on function public.materialize_a23_creative_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.materialize_a23_creative_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid,text) to service_role;



