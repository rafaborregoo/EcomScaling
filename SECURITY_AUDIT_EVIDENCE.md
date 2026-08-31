# Security audit — evidence run (2026-08-31)

Ejecutado vía Supabase MCP contra el único proyecto accesible.

## 1. Proyecto

| Campo | Valor |
|---|---|
| Nombre | SaaS-EcomScaling |
| Project ref | `cthjwpeygpzwdmjkxeqa` |
| URL | https://cthjwpeygpzwdmjkxeqa.supabase.co |
| Organización | `arlxaqgixdkkathwszso` |
| Región | eu-west-3 |
| Estado | ACTIVE_HEALTHY |
| Postgres | 17.6.1.141 (engine 17, canal ga) |
| Ramas / branches | **ninguna** (`list_branches` → `[]`) |
| Proyecto de staging separado | **no existe** — sólo hay este proyecto en la org |

`.env.local` del repo apunta a este mismo ref (`SUPABASE_URL=https://cthjwpeygpzwdmjkxeqa.supabase.co`), es decir, a producción. No hay `.env.test` ni `SUPABASE_TEST_PROJECT_REF` / `SUPABASE_PRODUCTION_PROJECT_REF` definidos.

## 2. Migraciones — APLICADAS a producción (2026-08-31, decisión del usuario: "solo migraciones a prod")

Las 3 se aplicaron vía `apply_migration` (MCP) contra `cthjwpeygpzwdmjkxeqa`, en orden, cada una `{"success":true}`:

1. `ai_diagnostic_activity_gate` → `schema_migrations.version = 20260831082735`
2. `ai_diagnostic_orchestrator` → `schema_migrations.version = 20260831082802`
3. `security_audit_gateway_hardening` → `schema_migrations.version = 20260831082831`

Verificación de objetos (todos presentes):

| objeto | resultado |
|---|---|
| `public.agent_runs.activity_digest` (columna) | ✅ existe |
| `public.organization_activity_digest(uuid)` (función) | ✅ existe |
| `public.ai_diagnostic_gate_log` (tabla) | ✅ existe |
| policy `ai_diagnostic_gate_log_select_admin` | ✅ 1 policy |
| `integration_sync_runs_org_written_idx` (índice parcial) | ✅ existe |
| `agent_versions` v7/v7/v8 para a02/a04/a06 | insertadas |
| `prompt_versions` a02_v6 / a04_v6 / a06_v7 | insertadas |

### Reconciliación de historial — RESUELTA (2026-08-31)

Tras el primer intento de `npx supabase db push` (que falló con "Remote migration versions not found in local migrations directory"), los 3 ficheros locales se **renombraron** para coincidir con las versiones que registró el MCP:

| antes | ahora |
|---|---|
| `20260901120000_ai_diagnostic_activity_gate.sql` | `20260831082735_ai_diagnostic_activity_gate.sql` |
| `20260901130000_ai_diagnostic_orchestrator.sql` | `20260831082802_ai_diagnostic_orchestrator.sql` |
| `20260901140000_security_audit_gateway_hardening.sql` | `20260831082831_security_audit_gateway_hardening.sql` |

Además se aplicaron 2 migraciones nuevas de endurecimiento (también ya presentes en remoto):

- `20260901150000_security_audit_advisor_hardening.sql` — `alter function ... set search_path` en 21 funciones (`shopify_*`, `meta_spend_*`, `klaviyo_email_report`, `admin_*`, `consultant_business_rollup`, `reorder_strategic_*`, `private.gateway_org_id`).
- `20260901160000_security_audit_activity_digest_hardening.sql` — `set search_path` en `public.organization_activity_digest`.

**Estado final:** `list_migrations` remoto == ficheros locales, uno a uno, hasta `20260901160000`. `npx supabase db push` no debería tener nada pendiente. El `migration repair` que falló usaba los números viejos (`20260901120000...`), que ya no tienen fichero — no hace falta.

### ⚠️ Acceso del CLI (aparte)

`npx supabase link --project-ref cthjwpeygpzwdmjkxeqa` → *"Your account does not have the necessary privileges to access this endpoint."* El token de acceso personal del CLI no tiene permisos de management-API para la org `arlxaqgixdkkathwszso`. Los comandos por conexión directa a BD (`db push`, `migration repair`) funcionan igual; `link`, `db pull` sin `--db-url`, advisors por CLI y branching necesitan un token de owner/admin de la org.

### (histórico) Desajuste de versión de migración

`apply_migration` (MCP) asigna su propio `version` (timestamp del momento, `2026083108xxxx`), **no** el prefijo del fichero (`20260901120000/130000/140000`). Efecto: para `supabase db push` / CI esos 3 ficheros siguen figurando como **no aplicados** y se reintentarán. Las migraciones 1 (`alter table ... add column` sin `if not exists`) y 2 (`create table` sin `if not exists`) **fallarían** en el reintento; la 3 es `create or replace` y es idempotente.

Arreglar antes del próximo push, apuntando al proyecto de producción:

```
supabase migration repair --status applied 20260901120000 20260901130000 20260901140000
```

(o insertar esas 3 versiones en `supabase_migrations.schema_migrations` a mano).

## 3a. Gateway DESPUÉS de aplicar `security_audit_gateway_hardening` (verificación read-only)

`pg_get_functiondef` + `pg_proc.prosecdef` + `has_function_privilege`:

| comprobación | esperado | obtenido |
|---|---|---|
| `prosecdef` (¿SECURITY DEFINER?) | false | **false** → SECURITY INVOKER ✅ |
| `anon` EXECUTE | false | **false** ✅ |
| `authenticated` EXECUTE | false | **false** ✅ |
| `service_role` EXECUTE | true | **true** ✅ |
| define `set search_path = pg_catalog, ai` | sí | ✅ |
| `set_config('search_path', 'ai, pg_catalog', true)` | sí | ✅ |
| `set_config('statement_timeout', '8000', true)` | sí | ✅ |
| `set_config('lock_timeout', '3000', true)` | sí | ✅ |
| `execute 'set local role ai_gateway'` | sí | ✅ |
| guard de coste `max_estimated_cost = 100000` (`query_cost_exceeded`) | sí | ✅ |

Definición vigente en producción:

```
CREATE OR REPLACE FUNCTION public.agent_sql_gateway(target_organization_id uuid, query_sql text, max_rows integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'ai'          -- SECURITY INVOKER (prosecdef=false)
AS $function$
declare
  ... effective_rows integer := least(greatest(coalesce(max_rows, 200), 1), 500);
  max_estimated_cost constant numeric := 100000;
begin
  perform set_config('app.gateway_org_id', target_organization_id::text, true);
  perform set_config('search_path', 'ai, pg_catalog', true);
  perform set_config('statement_timeout', '8000', true);
  perform set_config('lock_timeout', '3000', true);
  execute 'set local role ai_gateway';
  execute format('explain (format json, costs true) select * from (%s) gateway_inner', query_sql) into plan;
  estimated_total_cost := nullif(plan->0->'Plan'->>'Total Cost', '')::numeric;
  if coalesce(estimated_total_cost, 0) > max_estimated_cost then
    return jsonb_build_object('error', 'query_cost_exceeded', ...);
  end if;
  execute format('select coalesce(jsonb_agg(...)) from (select * from (%s) gateway_inner limit %s) ...', query_sql, effective_rows) into result;
  return jsonb_build_object('rows', result, 'row_limit', effective_rows, 'estimated_cost', estimated_total_cost);
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$function$
```

## 3. Estado del gateway ANTES de la migración (referencia)

`pg_get_functiondef('public.agent_sql_gateway(uuid,text,integer)')`:

```
CREATE OR REPLACE FUNCTION public.agent_sql_gateway(target_organization_id uuid, query_sql text, max_rows integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER                       <-- pendiente: debe pasar a SECURITY INVOKER
 SET search_path TO 'pg_catalog', 'ai'
AS $function$
...
  perform set_config('search_path', 'ai, pg_catalog', true);
  perform set_config('statement_timeout', '8000', true);   <-- OK
  -- falta lock_timeout
  -- falta: execute 'set local role ai_gateway'
  execute format('explain (format json, costs true) select * from (%s) gateway_inner', query_sql) into plan;
  ... guard de coste max_estimated_cost = 100000  <-- presente (label 'estimated_query_cost_exceeded')
$function$
```

Privilegios actuales (ya correctos):

| rol | EXECUTE |
|---|---|
| anon | **false** |
| authenticated | **false** |
| service_role | **true** |

Falta por aplicar (lo trae `20260901140000`): `SECURITY INVOKER`, `lock_timeout`, `set local role ai_gateway`. La contención de search_path, timeout, límite de filas y guard de coste ya están.

## 4. Advisors de seguridad — listado completo

> Re-ejecutado tras aplicar las migraciones. **Delta:** +1 WARN — `function_search_path_mutable` en `public.organization_activity_digest` (función nueva de la migración 1, `language sql stable` sin `set search_path`; conviene añadirle `set search_path = ''` en un follow-up). El gateway no genera ningún lint. Total seguridad: 35 lints (34 previos + 1).

### rls_enabled_no_policy — INFO (5)
| Tabla | Detalle |
|---|---|
| `private.integration_credentials` | RLS habilitado, sin políticas |
| `private.meta_asset_tokens` | RLS habilitado, sin políticas |
| `private.webhook_events` | RLS habilitado, sin políticas |
| `public.client_invites` | RLS habilitado, sin políticas |
| `public.memory_ingestion_queue` | RLS habilitado, sin políticas |

(Las tablas `private.*` son de acceso sólo service_role por diseño; el lint es informativo. `public.client_invites` y `public.memory_ingestion_queue` sí conviene revisar.)

### function_search_path_mutable — WARN (21)
`search_path` no fijado en la definición de la función:

| Esquema.función |
|---|
| `public.shopify_sales_summary` (2 overloads) |
| `public.shopify_top_products` (2 overloads) |
| `public.shopify_stock_summary` (2 overloads) |
| `public.shopify_margin_summary` (2 overloads) |
| `public.shopify_financial_summary` |
| `public.shopify_stock_risk_products` |
| `public.shopify_sales_daily` |
| `public.meta_spend_summary` |
| `public.meta_spend_daily` |
| `public.klaviyo_email_report` |
| `public.admin_organization_ai_stats` |
| `public.admin_consultant_ai_stats` |
| `public.admin_agent_runtime_stats` |
| `public.consultant_business_rollup` |
| `public.reorder_strategic_phases` |
| `public.reorder_strategic_milestones` |
| `private.gateway_org_id` |

### authenticated_security_definer_function_executable — WARN (7)
Funciones `SECURITY DEFINER` invocables por `authenticated` vía `/rest/v1/rpc/...`:

| Función |
|---|
| `private.can_access_org(uuid)` |
| `private.can_manage_org(uuid)` |
| `private.current_member_role(uuid)` |
| `private.has_valid_subscription(uuid)` |
| `private.is_active_org_member(uuid)` |
| `private.is_assigned_consultant(uuid)` |
| `private.is_platform_admin()` |

(Son los helpers de RLS; que sean `SECURITY DEFINER` y ejecutables por `authenticated` es habitual en este patrón, pero el lint pide confirmar que es intencional o revocar EXECUTE / moverlos fuera del esquema expuesto.)

### auth_leaked_password_protection — WARN (1)
Protección de contraseñas filtradas (HaveIBeenPwned) **deshabilitada**. Activar en Auth → Password security.

Remediación: https://supabase.com/docs/guides/database/database-linter

## 5. Advisors de performance — listado completo (166 lints)

| Categoría | Nivel | Nº |
|---|---|---|
| `unindexed_foreign_keys` | INFO | 71 |
| `unused_index` | INFO | 72 |
| `multiple_permissive_policies` | WARN | 22 |
| `duplicate_index` | WARN | 1 |

### duplicate_index — WARN (1)
- `public.klaviyo_report_values`: índices idénticos `{klaviyo_report_values_code_contract_uidx, klaviyo_report_values_unique_value}` → eliminar uno.

### multiple_permissive_policies — WARN (22)
Tablas con 2 políticas permisivas para `authenticated` / `SELECT` (una `_select_authorized` + una `_write_*` que también cubre SELECT). Colapsar la de escritura a `FOR ALL` con `WITH CHECK` o separar acción:

`consultant_assignments`, `integration_connections`, `integration_sync_runs`, `klaviyo_accounts`, `klaviyo_campaign_audiences`, `klaviyo_campaign_messages`, `klaviyo_campaigns`, `klaviyo_daily_account_metrics`, `klaviyo_flow_actions`, `klaviyo_flow_messages`, `klaviyo_flows`, `klaviyo_forms`, `klaviyo_list_daily_snapshots`, `klaviyo_lists`, `klaviyo_metrics`, `klaviyo_report_runs`, `klaviyo_report_values`, `klaviyo_segment_daily_snapshots`, `klaviyo_segments`, `marketing_campaign_products`, `marketing_campaigns`, `service_subscriptions`.

### unindexed_foreign_keys — INFO (71)
FKs sin índice de cobertura:

private.webhook_events(organization_id); agent_approvals(decided_by); agent_runs(actor_user_id, store_id); ai_messages(run_id); alerts(acknowledged_by, organization_rule_id, resolved_by, rule_template_id); call_ai_summaries(approved_by, authored_by, run_id); call_internal_notes(author_user_id); call_task_links(created_by); call_transcripts(created_by); client_constraints(created_by); client_invites(invited_user_id); consultant_assignments(assigned_by); consulting_calls(consultant_user_id, created_by); fixed_expenses(created_by); instagram_account_insight_values(organization_id); instagram_account_snapshots(organization_id); instagram_follower_winners(media_id, organization_id, recorded_by); instagram_media_insight_values(account_id, organization_id); integration_connections(connected_by, deletion_requested_by); klaviyo_accounts(conversion_metric_selected_by); klaviyo_flow_messages(action_id); knowledge_documents(created_by, source_actor_id); marketing_campaign_products(campaign_id); marketing_campaigns(created_by); marketing_content_draft_notes(author_user_id); marketing_content_draft_versions(edited_by); marketing_content_drafts(agent_run_id, created_by, decided_by, last_edited_by); memory_ingestion_queue(document_id, source_actor_id, store_id); meta_ad_accounts(canonical_purchase_action_selected_by); meta_insight_report_runs(connection_id, sync_run_id); milestone_internal_notes(author_user_id); milestone_task_links(task_id); organization_alert_rules(configured_by, template_id); organization_financial_settings(created_by, updated_by); organization_members(invited_by); organization_metric_targets(created_by); organizations(created_by, deletion_requested_by); product_costs(created_by); shipping_cost_rules(created_by); shopify_inventory_current_state(location_id); shopify_refund_items(location_id); strategic_plan_milestones(completed_by, created_by); strategic_plan_phases(activated_by, created_by); strategic_plans(approved_by, created_by); task_comments(author_user_id); task_status_history(changed_by); tasks(created_by).

### unused_index — INFO (72)
Índices nunca usados (candidatos a drop tras confirmar que no cubren rutas nuevas):

profiles_is_active_idx; service_subscriptions_status_idx; notifications_status_idx; notifications_created_at_idx; audit_logs_entity_idx; audit_logs_created_at_idx; shopify_stores_domain_idx; shopify_inventory_level_snapshots_captured_at_idx; shopify_refund_items_refund_id_idx; shopify_customers_reference_hash_idx; organization_metric_targets_org_idx; meta_pages_business_account_id_idx; meta_asset_tokens_token_expires_at_idx; meta_ad_accounts_business_account_id_idx; meta_ad_accounts_account_status_code_idx; meta_campaigns_effective_status_idx; meta_campaigns_objective_idx; meta_ad_sets_campaign_id_idx; meta_ad_sets_effective_status_idx; meta_ad_sets_optimization_goal_idx; meta_creatives_external_video_id_idx; meta_creatives_image_hash_idx; meta_creative_assets_creative_id_idx; meta_creative_assets_asset_type_idx; meta_creative_assets_external_asset_id_idx; meta_creative_assets_asset_hash_idx; meta_ads_ad_set_id_idx; meta_ads_current_creative_id_idx; meta_ads_effective_status_idx; meta_ads_parsed_angle_idx; meta_ads_parsed_format_idx; meta_ad_creative_assignments_ad_id_idx; meta_ad_creative_assignments_creative_id_idx; meta_ad_creative_assignments_valid_from_idx; meta_insight_rows_daily_organization_id_idx; meta_insight_rows_daily_campaign_id_idx; meta_insight_rows_daily_ad_set_id_idx; meta_insight_rows_daily_ad_id_idx; meta_insight_rows_daily_publisher_platform_idx; meta_insight_rows_daily_platform_position_idx; meta_insight_action_metrics_metric_name_idx; meta_insight_action_metrics_action_type_idx; meta_calculated_metrics_daily_metric_code_idx; meta_insight_report_runs_status_idx; alerts_severity_idx; alerts_fingerprint_idx; strategic_plans_status_idx; tasks_priority_idx; tasks_due_at_idx; knowledge_chunks_embedding_idx; consulting_calls_organization_id_idx; organizations_pending_purge_idx; knowledge_documents_audience_idx; knowledge_chunks_content_fts_idx; call_ai_summaries_transcript_id_idx; marketing_content_draft_versions_draft_version_idx; klaviyo_report_values_run_idx; klaviyo_daily_account_metrics_period_idx; instagram_accounts_connection_idx; instagram_account_snapshots_account_date_idx; instagram_account_insights_account_period_idx; instagram_media_account_published_idx; instagram_media_insights_media_captured_idx; instagram_follower_winners_account_period_idx; memory_ingestion_queue_claim_idx; agent_version_evaluations_version_idx; agent_version_eval_results_evaluation_idx; marketing_content_draft_notes_draft_idx; tasks_organization_categories_idx; objective_definitions_owner_idx; client_invites_organization_id_idx; client_invites_consultant_user_id_idx.

## 6. Pasos 4 y 6 — NO ejecutados (decisión del usuario: "solo migraciones a prod")

- **Paso 4 — `npm run test:remote -w @ecomscaling/api`**: no ejecutado. `scripts/run-remote-tests.mjs` rechaza correr si `SUPABASE_TEST_PROJECT_REF === SUPABASE_PRODUCTION_PROJECT_REF`, y sólo existe el proyecto de producción. La suite hace mutaciones (inserta/borra) — correrla exigiría un proyecto de staging distinto.
- **Paso 6 — prueba concurrente de redención de invitaciones (200 vs 409)**: no ejecutada, por el mismo motivo (escribe/borra `client_invites` y `organization_members`).

Para cerrarlos hace falta un proyecto/rama de staging separado. Con una rama de Supabase (~$0.0134/h mientras exista) se puede cablear `SUPABASE_TEST_PROJECT_REF` = ref de la rama y ejecutar ambos.
