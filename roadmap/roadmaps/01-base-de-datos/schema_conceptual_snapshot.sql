-- =============================================================================
-- SNAPSHOT CONCEPTUAL — NO EJECUTABLE. NO ES UNA MIGRACION DE SUPABASE.
-- =============================================================================
-- Origen: export de una herramienta de diseno ER (ex "BDD EcomScaling.sql").
-- Renombrado y marcado como no-ejecutable el 2026-07-20 (auditoria de
-- documentacion, ver roadmap/roadmaps/99-decisiones-y-seguimiento/ESTADOS_Y_EVIDENCIA.md).
--
-- La UNICA fuente ejecutable de verdad para el esquema real son las migraciones
-- en supabase/migrations/*.sql (ver README.md raiz). Este archivo NUNCA debe
-- aplicarse contra una base de datos ni usarse para verificar si algo "existe".
--
-- Problemas conocidos de este archivo (documentados, no corregidos aqui a
-- proposito -- parchear un dump conceptual como si fuera produccion es mas
-- peligroso que dejarlo claramente marcado como referencia):
--   - Declara `auth.users` propio: Supabase ya administra el schema auth, esa
--     tabla aqui es solo ilustrativa.
--   - Sin CREATE EXTENSION (usa gen_random_uuid() y vector sin declararlas).
--   - Sin RLS, sin policies, sin GRANT/REVOKE, sin triggers, sin CHECK.
--   - Varias foreign keys con la direccion invertida (ej. organizations ->
--     organization_financial_settings en vez de al reves).
--   - Desalineado con el esquema real en varios puntos: faltan las tablas del
--     runtime de agentes (DB-08), knowledge_search (DB-11), shopify_customers
--     (DB-05); la dimension del vector aqui difiere de la real.
--
-- Para ver el esquema REAL aplicado hoy: `supabase migration list` (o el
-- archivo `schema_generado_desde_migraciones.sql` en esta misma carpeta,
-- regenerado manualmente -- automatizar su regeneracion + chequeo de drift en
-- CI sigue pendiente, ver ESTADO_GLOBAL.md).
-- =============================================================================

CREATE SCHEMA "auth";

CREATE SCHEMA "private";

CREATE TYPE "platform_role" AS ENUM (
  'user',
  'consultant',
  'platform_admin'
);

CREATE TYPE "organization_status" AS ENUM (
  'onboarding',
  'active',
  'suspended',
  'cancelled'
);

CREATE TYPE "member_role" AS ENUM (
  'owner',
  'manager',
  'member',
  'readonly'
);

CREATE TYPE "subscription_status" AS ENUM (
  'pending',
  'trial',
  'active',
  'paused',
  'cancelled',
  'expired'
);

CREATE TYPE "integration_provider" AS ENUM (
  'shopify',
  'meta',
  'klaviyo',
  'loom',
  'fathom',
  'highlevel'
);

CREATE TYPE "integration_status" AS ENUM (
  'pending',
  'connected',
  'disconnected',
  'expired',
  'error'
);

CREATE TYPE "sync_status" AS ENUM (
  'pending',
  'running',
  'completed',
  'partial',
  'failed'
);

CREATE TYPE "task_status" AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'ignored',
  'cancelled'
);

CREATE TYPE "task_priority" AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE "task_source" AS ENUM (
  'manual',
  'alert',
  'consulting_call',
  'strategic_plan',
  'ai_consultant',
  'system'
);

CREATE TYPE "alert_status" AS ENUM (
  'open',
  'acknowledged',
  'resolved',
  'dismissed'
);

CREATE TYPE "alert_severity" AS ENUM (
  'info',
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE "plan_status" AS ENUM (
  'draft',
  'active',
  'completed',
  'archived'
);

CREATE TYPE "plan_phase_status" AS ENUM (
  'locked',
  'pending',
  'active',
  'completed'
);

CREATE TYPE "milestone_status" AS ENUM (
  'locked',
  'pending',
  'in_progress',
  'completed',
  'skipped'
);

CREATE TYPE "call_status" AS ENUM (
  'draft',
  'processing',
  'pending_review',
  'approved',
  'published',
  'failed'
);

CREATE TYPE "ai_review_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'edited'
);

CREATE TYPE "campaign_status" AS ENUM (
  'draft',
  'planned',
  'scheduled',
  'sent',
  'cancelled'
);

CREATE TYPE "campaign_channel" AS ENUM (
  'email',
  'sms',
  'whatsapp',
  'meta_ads',
  'other'
);

CREATE TYPE "knowledge_document_status" AS ENUM (
  'draft',
  'processing',
  'ready',
  'failed',
  'archived'
);

CREATE TYPE "conversation_status" AS ENUM (
  'active',
  'closed',
  'archived'
);

CREATE TYPE "message_role" AS ENUM (
  'user',
  'assistant',
  'system',
  'tool'
);

CREATE TYPE "notification_status" AS ENUM (
  'unread',
  'read',
  'archived'
);

CREATE TYPE "meta_insight_level" AS ENUM (
  'account',
  'campaign',
  'adset',
  'ad'
);

CREATE TYPE "meta_creative_asset_type" AS ENUM (
  'image',
  'video',
  'primary_text',
  'headline',
  'description',
  'call_to_action',
  'link_url',
  'thumbnail',
  'other'
);

CREATE TYPE "meta_report_status" AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE "metric_origin" AS ENUM (
  'api',
  'calculated',
  'manual'
);

CREATE TYPE "klaviyo_audience_type" AS ENUM (
  'list',
  'segment'
);

CREATE TYPE "klaviyo_audience_role" AS ENUM (
  'included',
  'excluded'
);

CREATE TYPE "klaviyo_report_entity_type" AS ENUM (
  'campaign',
  'campaign_message',
  'flow',
  'flow_message',
  'form',
  'segment'
);

CREATE TYPE "klaviyo_report_type" AS ENUM (
  'values',
  'series',
  'metric_aggregate'
);

CREATE TYPE "klaviyo_report_status" AS ENUM (
  'pending',
  'running',
  'completed',
  'failed'
);

CREATE TYPE "product_cost_source" AS ENUM (
  'shopify',
  'manual',
  'imported',
  'calculated'
);

CREATE TYPE "product_traffic_source" AS ENUM (
  'shopifyql',
  'web_pixel',
  'manual',
  'unavailable'
);

CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY,
  "full_name" varchar(180),
  "avatar_url" text,
  "phone" varchar(40),
  "platform_role" platform_role NOT NULL DEFAULT 'user',
  "is_active" boolean NOT NULL DEFAULT true,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "legal_name" varchar(200),
  "display_name" varchar(200) NOT NULL,
  "slug" varchar(120) UNIQUE NOT NULL,
  "tax_id" varchar(40),
  "website_url" text,
  "ecommerce_url" text,
  "timezone" varchar(80) NOT NULL DEFAULT 'Europe/Madrid',
  "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
  "status" organization_status NOT NULL DEFAULT 'onboarding',
  "onboarding_completed_at" timestamptz,
  "activated_at" timestamptz,
  "suspended_at" timestamptz,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "organization_members" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" member_role NOT NULL DEFAULT 'member',
  "is_active" boolean NOT NULL DEFAULT true,
  "invited_by" uuid,
  "invited_at" timestamptz,
  "joined_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "consultant_assignments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "consultant_user_id" uuid NOT NULL,
  "is_primary" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "assigned_by" uuid,
  "assigned_at" timestamptz NOT NULL DEFAULT (now()),
  "ended_at" timestamptz
);

CREATE TABLE "service_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "plan_code" varchar(50) NOT NULL,
  "status" subscription_status NOT NULL DEFAULT 'pending',
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "cancelled_at" timestamptz,
  "external_subscription_id" varchar(200),
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "organization_financial_settings" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid UNIQUE NOT NULL,
  "break_even_roas" numeric(10,4),
  "fixed_cost_calculation_mode" varchar(40) NOT NULL DEFAULT 'expense_sum',
  "fixed_monthly_cost_override" numeric(14,2),
  "default_gross_margin_percentage" numeric(8,4),
  "default_product_cost_percentage" numeric(8,4),
  "calculation_method" varchar(60),
  "configured_by" uuid,
  "configured_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "fixed_expenses" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "name" varchar(180) NOT NULL,
  "category" varchar(100),
  "monthly_amount" numeric(14,2) NOT NULL,
  "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
  "starts_on" date,
  "ends_on" date,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shipping_cost_rules" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "zone_code" varchar(50) NOT NULL,
  "zone_name" varchar(120) NOT NULL,
  "country_codes" jsonb,
  "charged_to_customer" numeric(12,2),
  "actual_shipping_cost" numeric(12,2),
  "free_shipping_threshold" numeric(12,2),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "organization_metric_targets" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "metric_code" varchar(100) NOT NULL,
  "minimum_value" numeric(16,4),
  "maximum_value" numeric(16,4),
  "target_value" numeric(16,4),
  "lookback_days" int,
  "configured_by" uuid,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "integration_connections" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "provider" integration_provider NOT NULL,
  "external_account_id" varchar(255),
  "external_account_name" varchar(255),
  "status" integration_status NOT NULL DEFAULT 'pending',
  "non_secret_settings" jsonb,
  "scopes" jsonb,
  "connected_by" uuid,
  "connected_at" timestamptz,
  "token_expires_at" timestamptz,
  "last_successful_sync_at" timestamptz,
  "last_error_at" timestamptz,
  "last_error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "integration_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "provider" integration_provider NOT NULL,
  "sync_scope" varchar(120),
  "sync_mode" varchar(60),
  "api_version" varchar(20),
  "external_operation_id" varchar(255),
  "status" sync_status NOT NULL DEFAULT 'pending',
  "records_read" int NOT NULL DEFAULT 0,
  "records_created" int NOT NULL DEFAULT 0,
  "records_updated" int NOT NULL DEFAULT 0,
  "records_failed" int NOT NULL DEFAULT 0,
  "cursor_value" text,
  "watermark_updated_at" timestamptz,
  "error_code" varchar(120),
  "error_message" text,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_stores" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "external_shop_id" varchar(255) NOT NULL,
  "myshopify_domain" varchar(255) NOT NULL,
  "primary_domain" varchar(255),
  "shop_name" varchar(255) NOT NULL,
  "currency_code" varchar(3),
  "timezone" varchar(100),
  "plan_display_name" varchar(120),
  "weight_unit" varchar(30),
  "taxes_included" boolean,
  "is_active" boolean NOT NULL DEFAULT true,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_products" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "external_product_id" varchar(255) NOT NULL,
  "title" varchar(255) NOT NULL,
  "handle" varchar(255),
  "vendor" varchar(180),
  "product_type" varchar(180),
  "status" varchar(50),
  "published_at" timestamptz,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_variants" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "external_variant_id" varchar(255) NOT NULL,
  "title" varchar(255),
  "barcode" varchar(180),
  "current_price" numeric(14,2),
  "compare_at_price" numeric(14,2),
  "position" int,
  "taxable" boolean,
  "inventory_policy" varchar(50),
  "is_active" boolean NOT NULL DEFAULT true,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "product_costs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "unit_cost" numeric(14,4) NOT NULL,
  "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
  "source" product_cost_source NOT NULL,
  "is_override" boolean NOT NULL DEFAULT false,
  "valid_from" date NOT NULL,
  "valid_until" date,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_order_facts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "external_order_id" varchar(255) NOT NULL,
  "order_name" varchar(100),
  "customer_reference_hash" varchar(255),
  "financial_status" varchar(80),
  "fulfillment_status" varchar(80),
  "source_name" varchar(100),
  "currency_code" varchar(3),
  "presentment_currency_code" varchar(3),
  "gross_sales" numeric(14,2) NOT NULL DEFAULT 0,
  "discounts" numeric(14,2) NOT NULL DEFAULT 0,
  "refunds" numeric(14,2) NOT NULL DEFAULT 0,
  "net_sales" numeric(14,2) NOT NULL DEFAULT 0,
  "current_subtotal_price" numeric(14,2) NOT NULL DEFAULT 0,
  "current_shipping_price" numeric(14,2) NOT NULL DEFAULT 0,
  "current_total_tax" numeric(14,2) NOT NULL DEFAULT 0,
  "current_total_price" numeric(14,2) NOT NULL DEFAULT 0,
  "total_items" int NOT NULL DEFAULT 0,
  "is_first_customer_order" boolean,
  "is_test_order" boolean NOT NULL DEFAULT false,
  "external_created_at" timestamptz,
  "processed_at" timestamptz,
  "external_updated_at" timestamptz,
  "cancelled_at" timestamptz,
  "cancel_reason" varchar(120),
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_order_items" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "product_id" uuid,
  "variant_id" uuid,
  "external_line_item_id" varchar(255) NOT NULL,
  "title" varchar(255) NOT NULL,
  "sku_snapshot" varchar(180),
  "vendor_snapshot" varchar(180),
  "quantity_original" int NOT NULL DEFAULT 0,
  "quantity_current" int NOT NULL DEFAULT 0,
  "unit_price" numeric(14,2) NOT NULL DEFAULT 0,
  "original_line_total" numeric(14,2) NOT NULL DEFAULT 0,
  "discount_total" numeric(14,2) NOT NULL DEFAULT 0,
  "current_line_total" numeric(14,2) NOT NULL DEFAULT 0,
  "refunded_quantity" int NOT NULL DEFAULT 0,
  "refunded_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_refunds" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "external_refund_id" varchar(255) NOT NULL,
  "total_refunded" numeric(14,2) NOT NULL DEFAULT 0,
  "currency_code" varchar(3),
  "external_created_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_refund_items" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "refund_id" uuid NOT NULL,
  "order_item_id" uuid NOT NULL,
  "location_id" uuid,
  "external_refund_line_item_id" varchar(255),
  "quantity" int NOT NULL,
  "subtotal" numeric(14,2) NOT NULL DEFAULT 0,
  "total_tax" numeric(14,2) NOT NULL DEFAULT 0,
  "restock_type" varchar(80),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_inventory_items" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "variant_id" uuid UNIQUE NOT NULL,
  "external_inventory_item_id" varchar(255) NOT NULL,
  "sku" varchar(180),
  "tracked" boolean NOT NULL DEFAULT false,
  "requires_shipping" boolean NOT NULL DEFAULT true,
  "current_unit_cost" numeric(14,4),
  "cost_currency_code" varchar(3),
  "country_code_of_origin" varchar(2),
  "province_code_of_origin" varchar(10),
  "harmonized_system_code" varchar(20),
  "measurement_data" jsonb,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_inventory_level_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "external_inventory_level_id" varchar(255),
  "available_quantity" int,
  "on_hand_quantity" int,
  "committed_quantity" int,
  "incoming_quantity" int,
  "quantities_data" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "captured_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_daily_store_metrics" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "metric_date" date NOT NULL,
  "orders_count" int NOT NULL DEFAULT 0,
  "units_sold" int NOT NULL DEFAULT 0,
  "gross_revenue" numeric(14,2) NOT NULL DEFAULT 0,
  "net_revenue" numeric(14,2) NOT NULL DEFAULT 0,
  "refunds" numeric(14,2) NOT NULL DEFAULT 0,
  "shipping_revenue" numeric(14,2) NOT NULL DEFAULT 0,
  "unique_customers" int NOT NULL DEFAULT 0,
  "new_customers" int NOT NULL DEFAULT 0,
  "returning_customers" int NOT NULL DEFAULT 0,
  "average_order_value" numeric(14,2),
  "recurrence_90d" numeric(8,4),
  "estimated_product_cost" numeric(14,2),
  "estimated_shipping_cost" numeric(14,2),
  "estimated_fixed_cost" numeric(14,2),
  "estimated_ad_cost" numeric(14,2),
  "estimated_net_profit" numeric(14,2),
  "estimated_profit_per_order" numeric(14,2),
  "calculated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_daily_product_metrics" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "variant_id" uuid,
  "metric_date" date NOT NULL,
  "units_sold" int NOT NULL DEFAULT 0,
  "orders_count" int NOT NULL DEFAULT 0,
  "gross_revenue" numeric(14,2) NOT NULL DEFAULT 0,
  "discounts" numeric(14,2) NOT NULL DEFAULT 0,
  "refunds" numeric(14,2) NOT NULL DEFAULT 0,
  "net_revenue" numeric(14,2) NOT NULL DEFAULT 0,
  "available_stock" int,
  "calculated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_daily_product_traffic_metrics" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "metric_date" date NOT NULL,
  "source" product_traffic_source NOT NULL,
  "page_views" int NOT NULL DEFAULT 0,
  "add_to_cart_count" int NOT NULL DEFAULT 0,
  "checkout_started_count" int NOT NULL DEFAULT 0,
  "purchases_count" int NOT NULL DEFAULT 0,
  "conversion_rate" numeric(8,4),
  "calculated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shopify_locations" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "store_id" uuid NOT NULL,
  "external_location_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "fulfills_online_orders" boolean,
  "address_data" jsonb,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "name" varchar(200) NOT NULL,
  "reference_code" varchar(100),
  "default_lead_time_days" int,
  "country_code" varchar(2),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "product_supply_settings" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "supplier_id" uuid,
  "lead_time_days" int NOT NULL,
  "safety_stock_quantity" int NOT NULL DEFAULT 0,
  "reorder_point_quantity" int,
  "minimum_order_quantity" int,
  "season_code" varchar(80),
  "season_start_month" int,
  "season_end_month" int,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "stock_forecasts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "forecast_date" date NOT NULL,
  "forecast_period_start" date NOT NULL,
  "forecast_period_end" date NOT NULL,
  "expected_units_sold" int,
  "current_stock" int,
  "safety_stock" int,
  "recommended_order_quantity" int,
  "recommended_order_date" date,
  "projected_stockout_date" date,
  "calculation_data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_ad_accounts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "business_account_id" uuid,
  "external_ad_account_id" varchar(255) NOT NULL,
  "account_name" varchar(255) NOT NULL,
  "account_status_code" int,
  "disable_reason_code" int,
  "currency_code" varchar(3),
  "timezone_name" varchar(100),
  "timezone_offset_hours_utc" numeric(6,2),
  "amount_spent" numeric(16,2),
  "balance" numeric(16,2),
  "spend_cap" numeric(16,2),
  "minimum_daily_budget" numeric(16,2),
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "external_created_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "ad_account_id" uuid NOT NULL,
  "external_campaign_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "objective" varchar(120),
  "buying_type" varchar(80),
  "configured_status" varchar(80),
  "effective_status" varchar(80),
  "special_ad_categories" jsonb,
  "daily_budget" numeric(16,2),
  "lifetime_budget" numeric(16,2),
  "budget_remaining" numeric(16,2),
  "bid_strategy" varchar(120),
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_ad_sets" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "external_ad_set_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "configured_status" varchar(80),
  "effective_status" varchar(80),
  "optimization_goal" varchar(120),
  "billing_event" varchar(120),
  "bid_strategy" varchar(120),
  "bid_amount" numeric(16,2),
  "daily_budget" numeric(16,2),
  "lifetime_budget" numeric(16,2),
  "budget_remaining" numeric(16,2),
  "destination_type" varchar(120),
  "promoted_object" jsonb,
  "targeting_data" jsonb,
  "attribution_spec" jsonb,
  "is_dynamic_creative" boolean NOT NULL DEFAULT false,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_creatives" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "ad_account_id" uuid NOT NULL,
  "external_creative_id" varchar(255) NOT NULL,
  "name" varchar(255),
  "object_type" varchar(100),
  "object_story_id" varchar(255),
  "effective_object_story_id" varchar(255),
  "call_to_action_type" varchar(100),
  "primary_text" text,
  "headline" varchar(500),
  "description" text,
  "link_url" text,
  "thumbnail_url" text,
  "image_hash" varchar(255),
  "external_video_id" varchar(255),
  "url_tags" text,
  "object_story_spec" jsonb,
  "asset_feed_spec" jsonb,
  "degrees_of_freedom_spec" jsonb,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "external_created_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_creative_assets" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "creative_id" uuid NOT NULL,
  "asset_type" meta_creative_asset_type NOT NULL,
  "position" int NOT NULL DEFAULT 0,
  "external_asset_id" varchar(255),
  "asset_hash" varchar(255),
  "text_value" text,
  "media_url" text,
  "thumbnail_url" text,
  "link_url" text,
  "asset_label" varchar(180),
  "is_primary" boolean NOT NULL DEFAULT false,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_ads" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "ad_set_id" uuid NOT NULL,
  "current_creative_id" uuid,
  "external_ad_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "configured_status" varchar(80),
  "effective_status" varchar(80),
  "parsed_angle" varchar(180),
  "parsed_format" varchar(120),
  "parsed_hook" varchar(255),
  "naming_parser_version" varchar(50),
  "parsed_naming_data" jsonb,
  "tracking_specs" jsonb,
  "conversion_specs" jsonb,
  "review_feedback" jsonb,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_ad_creative_assignments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "ad_id" uuid NOT NULL,
  "creative_id" uuid NOT NULL,
  "valid_from" timestamptz NOT NULL,
  "valid_until" timestamptz,
  "detected_at" timestamptz NOT NULL DEFAULT (now()),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_insight_rows_daily" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "ad_account_id" uuid NOT NULL,
  "campaign_id" uuid,
  "ad_set_id" uuid,
  "ad_id" uuid,
  "level" meta_insight_level NOT NULL,
  "external_entity_id" varchar(255) NOT NULL,
  "metric_date" date NOT NULL,
  "publisher_platform" varchar(80),
  "platform_position" varchar(120),
  "device_platform" varchar(80),
  "breakdowns" jsonb,
  "breakdown_hash" varchar(64) NOT NULL DEFAULT 'none',
  "attribution_windows" jsonb,
  "attribution_hash" varchar(64) NOT NULL DEFAULT 'default',
  "action_report_time" varchar(50) NOT NULL DEFAULT 'default',
  "spend" numeric(18,4) NOT NULL DEFAULT 0,
  "impressions" bigint NOT NULL DEFAULT 0,
  "reach" bigint NOT NULL DEFAULT 0,
  "frequency" numeric(12,6),
  "clicks" bigint NOT NULL DEFAULT 0,
  "unique_clicks" bigint NOT NULL DEFAULT 0,
  "inline_link_clicks" bigint NOT NULL DEFAULT 0,
  "outbound_clicks" bigint NOT NULL DEFAULT 0,
  "cpm" numeric(18,6),
  "cpc" numeric(18,6),
  "ctr" numeric(12,6),
  "cpp" numeric(18,6),
  "raw_data" jsonb,
  "synced_at" timestamptz NOT NULL DEFAULT (now()),
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_insight_action_metrics" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "insight_row_id" uuid NOT NULL,
  "metric_name" varchar(120) NOT NULL,
  "action_type" varchar(180) NOT NULL DEFAULT 'none',
  "attribution_window" varchar(80) NOT NULL DEFAULT 'default',
  "value" numeric(20,6),
  "raw_value" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_calculated_metrics_daily" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "insight_row_id" uuid NOT NULL,
  "metric_code" varchar(120) NOT NULL,
  "value" numeric(20,8),
  "formula_code" varchar(120) NOT NULL,
  "formula_version" varchar(50) NOT NULL,
  "input_data" jsonb,
  "calculated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_insight_report_runs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "ad_account_id" uuid NOT NULL,
  "sync_run_id" uuid,
  "external_report_run_id" varchar(255) NOT NULL,
  "level" meta_insight_level NOT NULL,
  "status" meta_report_status NOT NULL DEFAULT 'pending',
  "percent_complete" numeric(6,2) NOT NULL DEFAULT 0,
  "request_params" jsonb NOT NULL,
  "error_code" varchar(120),
  "error_message" text,
  "requested_at" timestamptz NOT NULL DEFAULT (now()),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "downloaded_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_business_accounts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "external_business_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "verification_status" varchar(80),
  "vertical" varchar(120),
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "meta_pages" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "business_account_id" uuid,
  "external_page_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "category" varchar(180),
  "tasks" jsonb,
  "picture_url" text,
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_accounts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "external_account_id" varchar(255) NOT NULL,
  "account_name" varchar(255),
  "timezone" varchar(100),
  "default_currency" varchar(3),
  "public_api_key" varchar(50),
  "api_revision" varchar(30) NOT NULL DEFAULT '2026-04-15',
  "is_active" boolean NOT NULL DEFAULT true,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_lists" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "external_list_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "opt_in_process" varchar(80),
  "is_active" boolean NOT NULL DEFAULT true,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_list_daily_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "list_id" uuid NOT NULL,
  "snapshot_date" date NOT NULL,
  "profile_count" bigint NOT NULL DEFAULT 0,
  "captured_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_segments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "external_segment_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "is_active" boolean,
  "is_starred" boolean NOT NULL DEFAULT false,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_segment_daily_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "segment_id" uuid NOT NULL,
  "snapshot_date" date NOT NULL,
  "profile_count" bigint NOT NULL DEFAULT 0,
  "captured_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_flows" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "external_flow_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" varchar(80),
  "trigger_type" varchar(180),
  "archived" boolean NOT NULL DEFAULT false,
  "definition_hash" varchar(64),
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_flow_actions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "flow_id" uuid NOT NULL,
  "external_action_id" varchar(255) NOT NULL,
  "action_type" varchar(120) NOT NULL,
  "status" varchar(80),
  "position" int,
  "settings_data" jsonb,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_flow_messages" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "flow_action_id" uuid NOT NULL,
  "external_message_id" varchar(255) NOT NULL,
  "external_template_id" varchar(255),
  "channel" varchar(50) NOT NULL,
  "name" varchar(255),
  "subject" varchar(500),
  "preview_text" text,
  "from_email" varchar(255),
  "from_label" varchar(255),
  "reply_to_email" varchar(255),
  "status" varchar(80),
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "external_campaign_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" varchar(80),
  "archived" boolean NOT NULL DEFAULT false,
  "primary_channel" varchar(50),
  "scheduled_at" timestamptz,
  "send_time" timestamptz,
  "send_strategy" jsonb,
  "send_options" jsonb,
  "tracking_options" jsonb,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_campaign_messages" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "external_message_id" varchar(255) NOT NULL,
  "external_template_id" varchar(255),
  "channel" varchar(50) NOT NULL,
  "name" varchar(255),
  "label" varchar(255),
  "subject" varchar(500),
  "preview_text" text,
  "from_email" varchar(255),
  "from_label" varchar(255),
  "reply_to_email" varchar(255),
  "status" varchar(80),
  "scheduled_at" timestamptz,
  "sent_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_campaign_audiences" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "audience_type" klaviyo_audience_type NOT NULL,
  "audience_role" klaviyo_audience_role NOT NULL DEFAULT 'included',
  "list_id" uuid,
  "segment_id" uuid,
  "external_audience_id" varchar(255),
  "priority" int,
  "raw_data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_forms" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "external_form_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" varchar(80),
  "has_ab_test" boolean NOT NULL DEFAULT false,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_report_runs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "sync_run_id" uuid,
  "report_type" klaviyo_report_type NOT NULL,
  "entity_type" klaviyo_report_entity_type NOT NULL,
  "conversion_metric_id" uuid,
  "statistics" jsonb NOT NULL,
  "timeframe_start" timestamptz NOT NULL,
  "timeframe_end" timestamptz NOT NULL,
  "interval" varchar(50),
  "channel" varchar(50),
  "filters" jsonb,
  "request_data" jsonb,
  "api_revision" varchar(30) NOT NULL DEFAULT '2026-04-15',
  "status" klaviyo_report_status NOT NULL DEFAULT 'pending',
  "error_code" varchar(120),
  "error_message" text,
  "requested_at" timestamptz NOT NULL DEFAULT (now()),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_report_values" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "report_run_id" uuid NOT NULL,
  "entity_type" klaviyo_report_entity_type NOT NULL,
  "external_entity_id" varchar(255) NOT NULL,
  "campaign_id" uuid,
  "campaign_message_id" uuid,
  "flow_id" uuid,
  "flow_message_id" uuid,
  "form_id" uuid,
  "segment_id" uuid,
  "statistic_name" varchar(180) NOT NULL,
  "value_numeric" numeric(20,6),
  "value_json" jsonb,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "interval" varchar(50),
  "channel" varchar(50),
  "dimensions" jsonb,
  "dimension_hash" varchar(64) NOT NULL DEFAULT 'none',
  "raw_data" jsonb,
  "captured_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_metrics" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "external_metric_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "external_integration_id" varchar(255),
  "integration_name" varchar(180),
  "integration_category" varchar(120),
  "is_conversion_candidate" boolean NOT NULL DEFAULT false,
  "is_primary_conversion_metric" boolean NOT NULL DEFAULT false,
  "external_created_at" timestamptz,
  "external_updated_at" timestamptz,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "klaviyo_daily_account_metrics" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "conversion_metric_id" uuid,
  "metric_date" date NOT NULL,
  "channel" varchar(50) NOT NULL DEFAULT 'email',
  "flow_attributed_revenue" numeric(16,2) NOT NULL DEFAULT 0,
  "campaign_attributed_revenue" numeric(16,2) NOT NULL DEFAULT 0,
  "total_attributed_revenue" numeric(16,2) NOT NULL DEFAULT 0,
  "total_store_revenue" numeric(16,2),
  "attributed_revenue_percentage" numeric(10,6),
  "recipients" bigint NOT NULL DEFAULT 0,
  "delivered" bigint NOT NULL DEFAULT 0,
  "opens" bigint NOT NULL DEFAULT 0,
  "clicks" bigint NOT NULL DEFAULT 0,
  "conversions" numeric(16,4) NOT NULL DEFAULT 0,
  "calculation_version" varchar(50) NOT NULL,
  "calculated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "marketing_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "klaviyo_campaign_id" uuid,
  "name" varchar(255) NOT NULL,
  "channel" campaign_channel NOT NULL DEFAULT 'email',
  "campaign_month" date,
  "reason" varchar(255),
  "offer_description" text,
  "planned_send_at" timestamptz,
  "actual_send_at" timestamptz,
  "status" campaign_status NOT NULL DEFAULT 'draft',
  "expected_revenue" numeric(14,2),
  "actual_revenue" numeric(14,2),
  "internal_notes" text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "marketing_campaign_products" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "variant_id" uuid,
  "expected_units" int,
  "required_stock" int,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "alert_rule_templates" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "code" varchar(120) UNIQUE NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "metric_code" varchar(120),
  "default_severity" alert_severity NOT NULL,
  "default_lookback_days" int,
  "default_condition" jsonb NOT NULL,
  "alert_title_template" text NOT NULL,
  "alert_message_template" text NOT NULL,
  "task_title_template" text,
  "task_description_template" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "phase" int NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "organization_alert_rules" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "severity_override" alert_severity,
  "condition_override" jsonb,
  "configured_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "alerts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "rule_template_id" uuid,
  "organization_rule_id" uuid,
  "source_entity_type" varchar(100),
  "source_entity_id" uuid,
  "status" alert_status NOT NULL DEFAULT 'open',
  "severity" alert_severity NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "metric_code" varchar(120),
  "metric_value" numeric(16,4),
  "threshold_value" numeric(16,4),
  "context_data" jsonb,
  "fingerprint" varchar(255),
  "first_detected_at" timestamptz NOT NULL DEFAULT (now()),
  "last_detected_at" timestamptz NOT NULL DEFAULT (now()),
  "acknowledged_by" uuid,
  "acknowledged_at" timestamptz,
  "resolved_by" uuid,
  "resolved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "alert_id" uuid,
  "assigned_to" uuid,
  "created_by" uuid,
  "source" task_source NOT NULL,
  "status" task_status NOT NULL DEFAULT 'pending',
  "priority" task_priority NOT NULL DEFAULT 'medium',
  "title" varchar(255) NOT NULL,
  "description" text,
  "due_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "ignored_at" timestamptz,
  "ignored_reason" text,
  "is_visible_to_client" boolean NOT NULL DEFAULT true,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "task_status_history" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "previous_status" task_status,
  "new_status" task_status NOT NULL,
  "changed_by" uuid,
  "reason" text,
  "changed_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "task_comments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "is_internal" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "strategic_plans" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "status" plan_status NOT NULL DEFAULT 'draft',
  "version" int NOT NULL DEFAULT 1,
  "starts_on" date,
  "completed_on" date,
  "created_by" uuid NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "strategic_plan_phases" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "position" int NOT NULL,
  "status" plan_phase_status NOT NULL DEFAULT 'locked',
  "activated_at" timestamptz,
  "completed_at" timestamptz,
  "activated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "strategic_plan_milestones" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "phase_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "position" int NOT NULL,
  "status" milestone_status NOT NULL DEFAULT 'locked',
  "target_date" date,
  "activated_at" timestamptz,
  "completed_at" timestamptz,
  "completed_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "milestone_task_links" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "milestone_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "milestone_internal_notes" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "milestone_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "consulting_calls" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "consultant_user_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "scheduled_at" timestamptz,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "loom_url" text,
  "fathom_external_id" varchar(255),
  "recording_url" text,
  "status" call_status NOT NULL DEFAULT 'draft',
  "is_visible_to_client" boolean NOT NULL DEFAULT false,
  "published_at" timestamptz,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "call_transcripts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "call_id" uuid NOT NULL,
  "version" int NOT NULL DEFAULT 1,
  "is_current" boolean NOT NULL DEFAULT true,
  "source" varchar(80) NOT NULL,
  "language_code" varchar(10),
  "transcript_text" text NOT NULL,
  "transcript_segments" jsonb,
  "word_count" int,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "call_ai_summaries" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "call_id" uuid NOT NULL,
  "transcript_id" uuid NOT NULL,
  "version" int NOT NULL DEFAULT 1,
  "review_status" ai_review_status NOT NULL DEFAULT 'pending',
  "topics_summary" text NOT NULL,
  "decisions_summary" text,
  "raw_ai_output" jsonb,
  "model_provider" varchar(80),
  "model_name" varchar(120),
  "prompt_version" varchar(80),
  "generated_at" timestamptz NOT NULL DEFAULT (now()),
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "published_at" timestamptz
);

CREATE TABLE "call_task_links" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "call_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "extracted_by_ai" boolean NOT NULL DEFAULT true,
  "approved_by" uuid,
  "approved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "instagram_accounts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "page_id" uuid,
  "external_account_id" varchar(255) NOT NULL,
  "username" varchar(255) NOT NULL,
  "name" varchar(255),
  "biography" text,
  "website_url" text,
  "profile_picture_url" text,
  "account_type" varchar(80),
  "current_followers_count" bigint,
  "current_follows_count" bigint,
  "current_media_count" bigint,
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "raw_data" jsonb,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "instagram_account_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "snapshot_date" date NOT NULL,
  "followers_count" bigint,
  "follows_count" bigint,
  "media_count" bigint,
  "captured_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "instagram_account_insight_values" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "metric_name" varchar(180) NOT NULL,
  "metric_period" varchar(80) NOT NULL,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "value_numeric" numeric(20,6),
  "value_json" jsonb,
  "breakdown" jsonb,
  "breakdown_hash" varchar(64) NOT NULL DEFAULT 'none',
  "origin" metric_origin NOT NULL DEFAULT 'api',
  "captured_at" timestamptz NOT NULL DEFAULT (now()),
  "raw_data" jsonb
);

CREATE TABLE "instagram_media" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "parent_media_id" uuid,
  "external_media_id" varchar(255) NOT NULL,
  "shortcode" varchar(100),
  "media_type" varchar(80),
  "media_product_type" varchar(80),
  "caption" text,
  "permalink" text,
  "media_url" text,
  "thumbnail_url" text,
  "username_snapshot" varchar(255),
  "current_like_count" bigint,
  "current_comments_count" bigint,
  "is_carousel_child" boolean NOT NULL DEFAULT false,
  "is_deleted" boolean NOT NULL DEFAULT false,
  "external_published_at" timestamptz,
  "media_url_refreshed_at" timestamptz,
  "last_synced_at" timestamptz,
  "raw_data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "instagram_follower_winners" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "media_id" uuid NOT NULL,
  "reporting_month" date NOT NULL,
  "rank_position" int NOT NULL,
  "estimated_followers_gained" int,
  "source" metric_origin NOT NULL DEFAULT 'manual',
  "notes" text,
  "submitted_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "instagram_media_insight_values" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "media_id" uuid NOT NULL,
  "metric_name" varchar(180) NOT NULL,
  "metric_period" varchar(80) NOT NULL DEFAULT 'lifetime',
  "period_start" timestamptz,
  "period_end" timestamptz,
  "value_numeric" numeric(20,6),
  "value_json" jsonb,
  "breakdown" jsonb,
  "breakdown_hash" varchar(64) NOT NULL DEFAULT 'none',
  "origin" metric_origin NOT NULL DEFAULT 'api',
  "captured_at" timestamptz NOT NULL DEFAULT (now()),
  "raw_data" jsonb
);

CREATE TABLE "knowledge_documents" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid,
  "title" varchar(255) NOT NULL,
  "document_type" varchar(100),
  "storage_path" text,
  "mime_type" varchar(120),
  "status" knowledge_document_status NOT NULL DEFAULT 'draft',
  "is_global" boolean NOT NULL DEFAULT true,
  "version" int NOT NULL DEFAULT 1,
  "checksum" varchar(255),
  "metadata" jsonb,
  "uploaded_by" uuid NOT NULL,
  "processed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid,
  "document_id" uuid NOT NULL,
  "chunk_index" int NOT NULL,
  "content" text NOT NULL,
  "token_count" int,
  "embedding" vector(1536),
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "title" varchar(255),
  "status" conversation_status NOT NULL DEFAULT 'active',
  "context_snapshot" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" message_role NOT NULL,
  "content" text NOT NULL,
  "source_citations" jsonb,
  "model_name" varchar(120),
  "input_tokens" int,
  "output_tokens" int,
  "latency_ms" int,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid,
  "user_id" uuid NOT NULL,
  "status" notification_status NOT NULL DEFAULT 'unread',
  "type" varchar(120) NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text,
  "action_url" text,
  "entity_type" varchar(100),
  "entity_id" uuid,
  "read_at" timestamptz,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid,
  "actor_user_id" uuid,
  "action" varchar(160) NOT NULL,
  "entity_type" varchar(100),
  "entity_id" uuid,
  "old_data" jsonb,
  "new_data" jsonb,
  "request_id" varchar(255),
  "ip_address" varchar(64),
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "auth"."users" (
  "id" uuid PRIMARY KEY,
  "email" varchar,
  "created_at" timestamptz
);

CREATE TABLE "private"."integration_credentials" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "connection_id" uuid UNIQUE NOT NULL,
  "access_token_encrypted" text,
  "refresh_token_encrypted" text,
  "api_key_encrypted" text,
  "client_secret_encrypted" text,
  "encryption_key_version" varchar(50),
  "token_expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "private"."webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "organization_id" uuid,
  "connection_id" uuid,
  "provider" integration_provider NOT NULL,
  "source_account_identifier" varchar(255),
  "provider_context" jsonb,
  "api_version" varchar(20),
  "external_event_id" varchar(255),
  "event_type" varchar(180) NOT NULL,
  "payload" jsonb NOT NULL,
  "signature_valid" boolean NOT NULL DEFAULT false,
  "processed" boolean NOT NULL DEFAULT false,
  "processing_attempts" int NOT NULL DEFAULT 0,
  "processing_error" text,
  "triggered_at" timestamptz,
  "received_at" timestamptz NOT NULL DEFAULT (now()),
  "processed_at" timestamptz
);

CREATE TABLE "private"."meta_asset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "connection_id" uuid NOT NULL,
  "asset_type" varchar(80) NOT NULL,
  "external_asset_id" varchar(255) NOT NULL,
  "access_token_encrypted" text NOT NULL,
  "scopes" jsonb,
  "token_expires_at" timestamptz,
  "encryption_key_version" varchar(50),
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE UNIQUE INDEX ON "organization_members" ("organization_id", "user_id");

CREATE INDEX ON "organization_members" ("organization_id");

CREATE INDEX ON "organization_members" ("user_id");

CREATE UNIQUE INDEX ON "consultant_assignments" ("organization_id", "consultant_user_id");

CREATE INDEX ON "consultant_assignments" ("organization_id");

CREATE INDEX ON "consultant_assignments" ("consultant_user_id");

CREATE INDEX ON "service_subscriptions" ("organization_id");

CREATE INDEX ON "service_subscriptions" ("status");

CREATE INDEX ON "fixed_expenses" ("organization_id");

CREATE UNIQUE INDEX ON "shipping_cost_rules" ("organization_id", "zone_code");

CREATE UNIQUE INDEX ON "organization_metric_targets" ("organization_id", "metric_code");

CREATE INDEX ON "integration_connections" ("organization_id");

CREATE INDEX ON "integration_connections" ("provider");

CREATE UNIQUE INDEX ON "integration_connections" ("organization_id", "provider", "external_account_id");

CREATE INDEX ON "integration_sync_runs" ("organization_id");

CREATE INDEX ON "integration_sync_runs" ("connection_id");

CREATE INDEX ON "integration_sync_runs" ("provider");

CREATE INDEX ON "integration_sync_runs" ("status");

CREATE INDEX ON "integration_sync_runs" ("external_operation_id");

CREATE INDEX ON "integration_sync_runs" ("organization_id", "created_at");

CREATE UNIQUE INDEX ON "shopify_stores" ("organization_id", "external_shop_id");

CREATE UNIQUE INDEX ON "shopify_stores" ("connection_id");

CREATE UNIQUE INDEX ON "shopify_stores" ("myshopify_domain");

CREATE INDEX ON "shopify_stores" ("organization_id");

CREATE UNIQUE INDEX ON "shopify_products" ("store_id", "external_product_id");

CREATE INDEX ON "shopify_products" ("organization_id");

CREATE INDEX ON "shopify_products" ("store_id");

CREATE UNIQUE INDEX ON "shopify_variants" ("product_id", "external_variant_id");

CREATE INDEX ON "shopify_variants" ("organization_id");

CREATE INDEX ON "shopify_variants" ("product_id");

CREATE INDEX ON "shopify_variants" ("barcode");

CREATE INDEX ON "product_costs" ("organization_id");

CREATE INDEX ON "product_costs" ("inventory_item_id");

CREATE INDEX ON "product_costs" ("valid_from");

CREATE UNIQUE INDEX ON "product_costs" ("inventory_item_id", "valid_from", "source");

CREATE UNIQUE INDEX ON "shopify_order_facts" ("store_id", "external_order_id");

CREATE INDEX ON "shopify_order_facts" ("organization_id");

CREATE INDEX ON "shopify_order_facts" ("store_id");

CREATE INDEX ON "shopify_order_facts" ("processed_at");

CREATE INDEX ON "shopify_order_facts" ("external_updated_at");

CREATE INDEX ON "shopify_order_facts" ("customer_reference_hash");

CREATE INDEX ON "shopify_order_facts" ("organization_id", "processed_at");

CREATE UNIQUE INDEX ON "shopify_order_items" ("order_id", "external_line_item_id");

CREATE INDEX ON "shopify_order_items" ("organization_id");

CREATE INDEX ON "shopify_order_items" ("order_id");

CREATE INDEX ON "shopify_order_items" ("product_id");

CREATE INDEX ON "shopify_order_items" ("variant_id");

CREATE INDEX ON "shopify_order_items" ("sku_snapshot");

CREATE UNIQUE INDEX ON "shopify_refunds" ("order_id", "external_refund_id");

CREATE INDEX ON "shopify_refunds" ("organization_id");

CREATE INDEX ON "shopify_refunds" ("order_id");

CREATE INDEX ON "shopify_refunds" ("external_created_at");

CREATE INDEX ON "shopify_refund_items" ("organization_id");

CREATE INDEX ON "shopify_refund_items" ("refund_id");

CREATE INDEX ON "shopify_refund_items" ("order_item_id");

CREATE UNIQUE INDEX ON "shopify_refund_items" ("refund_id", "external_refund_line_item_id");

CREATE UNIQUE INDEX ON "shopify_inventory_items" ("external_inventory_item_id");

CREATE INDEX ON "shopify_inventory_items" ("organization_id");

CREATE INDEX ON "shopify_inventory_items" ("sku");

CREATE INDEX ON "shopify_inventory_level_snapshots" ("organization_id");

CREATE INDEX ON "shopify_inventory_level_snapshots" ("inventory_item_id");

CREATE INDEX ON "shopify_inventory_level_snapshots" ("location_id");

CREATE INDEX ON "shopify_inventory_level_snapshots" ("captured_at");

CREATE UNIQUE INDEX ON "shopify_inventory_level_snapshots" ("inventory_item_id", "location_id", "captured_at");

CREATE UNIQUE INDEX ON "shopify_daily_store_metrics" ("store_id", "metric_date");

CREATE INDEX ON "shopify_daily_store_metrics" ("organization_id");

CREATE INDEX ON "shopify_daily_store_metrics" ("metric_date");

CREATE INDEX ON "shopify_daily_product_metrics" ("organization_id");

CREATE INDEX ON "shopify_daily_product_metrics" ("product_id");

CREATE INDEX ON "shopify_daily_product_metrics" ("variant_id");

CREATE INDEX ON "shopify_daily_product_metrics" ("metric_date");

CREATE UNIQUE INDEX ON "shopify_daily_product_metrics" ("product_id", "variant_id", "metric_date");

CREATE INDEX ON "shopify_daily_product_traffic_metrics" ("organization_id");

CREATE INDEX ON "shopify_daily_product_traffic_metrics" ("store_id");

CREATE INDEX ON "shopify_daily_product_traffic_metrics" ("product_id");

CREATE INDEX ON "shopify_daily_product_traffic_metrics" ("metric_date");

CREATE UNIQUE INDEX ON "shopify_daily_product_traffic_metrics" ("product_id", "metric_date", "source");

CREATE UNIQUE INDEX ON "shopify_locations" ("store_id", "external_location_id");

CREATE INDEX ON "shopify_locations" ("organization_id");

CREATE INDEX ON "shopify_locations" ("store_id");

CREATE INDEX ON "suppliers" ("organization_id");

CREATE UNIQUE INDEX ON "product_supply_settings" ("variant_id", "supplier_id");

CREATE INDEX ON "product_supply_settings" ("organization_id");

CREATE INDEX ON "stock_forecasts" ("organization_id");

CREATE INDEX ON "stock_forecasts" ("variant_id");

CREATE INDEX ON "stock_forecasts" ("forecast_date");

CREATE UNIQUE INDEX ON "meta_ad_accounts" ("connection_id", "external_ad_account_id");

CREATE INDEX ON "meta_ad_accounts" ("organization_id");

CREATE INDEX ON "meta_ad_accounts" ("business_account_id");

CREATE INDEX ON "meta_ad_accounts" ("account_status_code");

CREATE UNIQUE INDEX ON "meta_campaigns" ("ad_account_id", "external_campaign_id");

CREATE INDEX ON "meta_campaigns" ("organization_id");

CREATE INDEX ON "meta_campaigns" ("ad_account_id");

CREATE INDEX ON "meta_campaigns" ("effective_status");

CREATE INDEX ON "meta_campaigns" ("objective");

CREATE UNIQUE INDEX ON "meta_ad_sets" ("campaign_id", "external_ad_set_id");

CREATE INDEX ON "meta_ad_sets" ("organization_id");

CREATE INDEX ON "meta_ad_sets" ("campaign_id");

CREATE INDEX ON "meta_ad_sets" ("effective_status");

CREATE INDEX ON "meta_ad_sets" ("optimization_goal");

CREATE UNIQUE INDEX ON "meta_creatives" ("ad_account_id", "external_creative_id");

CREATE INDEX ON "meta_creatives" ("organization_id");

CREATE INDEX ON "meta_creatives" ("ad_account_id");

CREATE INDEX ON "meta_creatives" ("external_video_id");

CREATE INDEX ON "meta_creatives" ("image_hash");

CREATE INDEX ON "meta_creative_assets" ("organization_id");

CREATE INDEX ON "meta_creative_assets" ("creative_id");

CREATE INDEX ON "meta_creative_assets" ("asset_type");

CREATE INDEX ON "meta_creative_assets" ("external_asset_id");

CREATE INDEX ON "meta_creative_assets" ("asset_hash");

CREATE UNIQUE INDEX ON "meta_ads" ("ad_set_id", "external_ad_id");

CREATE INDEX ON "meta_ads" ("organization_id");

CREATE INDEX ON "meta_ads" ("ad_set_id");

CREATE INDEX ON "meta_ads" ("current_creative_id");

CREATE INDEX ON "meta_ads" ("effective_status");

CREATE INDEX ON "meta_ads" ("parsed_angle");

CREATE INDEX ON "meta_ads" ("parsed_format");

CREATE INDEX ON "meta_ad_creative_assignments" ("organization_id");

CREATE INDEX ON "meta_ad_creative_assignments" ("ad_id");

CREATE INDEX ON "meta_ad_creative_assignments" ("creative_id");

CREATE INDEX ON "meta_ad_creative_assignments" ("valid_from");

CREATE INDEX ON "meta_insight_rows_daily" ("organization_id");

CREATE INDEX ON "meta_insight_rows_daily" ("ad_account_id");

CREATE INDEX ON "meta_insight_rows_daily" ("campaign_id");

CREATE INDEX ON "meta_insight_rows_daily" ("ad_set_id");

CREATE INDEX ON "meta_insight_rows_daily" ("ad_id");

CREATE INDEX ON "meta_insight_rows_daily" ("level");

CREATE INDEX ON "meta_insight_rows_daily" ("metric_date");

CREATE INDEX ON "meta_insight_rows_daily" ("publisher_platform");

CREATE INDEX ON "meta_insight_rows_daily" ("platform_position");

CREATE UNIQUE INDEX ON "meta_insight_rows_daily" ("ad_account_id", "level", "external_entity_id", "metric_date", "breakdown_hash", "attribution_hash", "action_report_time");

CREATE INDEX ON "meta_insight_action_metrics" ("organization_id");

CREATE INDEX ON "meta_insight_action_metrics" ("insight_row_id");

CREATE INDEX ON "meta_insight_action_metrics" ("metric_name");

CREATE INDEX ON "meta_insight_action_metrics" ("action_type");

CREATE UNIQUE INDEX ON "meta_insight_action_metrics" ("insight_row_id", "metric_name", "action_type", "attribution_window");

CREATE INDEX ON "meta_calculated_metrics_daily" ("organization_id");

CREATE INDEX ON "meta_calculated_metrics_daily" ("insight_row_id");

CREATE INDEX ON "meta_calculated_metrics_daily" ("metric_code");

CREATE UNIQUE INDEX ON "meta_calculated_metrics_daily" ("insight_row_id", "metric_code", "formula_version");

CREATE UNIQUE INDEX ON "meta_insight_report_runs" ("external_report_run_id");

CREATE INDEX ON "meta_insight_report_runs" ("organization_id");

CREATE INDEX ON "meta_insight_report_runs" ("ad_account_id");

CREATE INDEX ON "meta_insight_report_runs" ("status");

CREATE UNIQUE INDEX ON "meta_business_accounts" ("connection_id", "external_business_id");

CREATE INDEX ON "meta_business_accounts" ("organization_id");

CREATE INDEX ON "meta_business_accounts" ("connection_id");

CREATE UNIQUE INDEX ON "meta_pages" ("connection_id", "external_page_id");

CREATE INDEX ON "meta_pages" ("organization_id");

CREATE INDEX ON "meta_pages" ("business_account_id");

CREATE UNIQUE INDEX ON "klaviyo_accounts" ("connection_id", "external_account_id");

CREATE UNIQUE INDEX ON "klaviyo_accounts" ("connection_id");

CREATE INDEX ON "klaviyo_accounts" ("organization_id");

CREATE UNIQUE INDEX ON "klaviyo_lists" ("account_id", "external_list_id");

CREATE INDEX ON "klaviyo_lists" ("organization_id");

CREATE INDEX ON "klaviyo_lists" ("account_id");

CREATE INDEX ON "klaviyo_lists" ("name");

CREATE UNIQUE INDEX ON "klaviyo_list_daily_snapshots" ("list_id", "snapshot_date");

CREATE INDEX ON "klaviyo_list_daily_snapshots" ("organization_id");

CREATE INDEX ON "klaviyo_list_daily_snapshots" ("snapshot_date");

CREATE UNIQUE INDEX ON "klaviyo_segments" ("account_id", "external_segment_id");

CREATE INDEX ON "klaviyo_segments" ("organization_id");

CREATE INDEX ON "klaviyo_segments" ("account_id");

CREATE INDEX ON "klaviyo_segments" ("name");

CREATE INDEX ON "klaviyo_segments" ("is_active");

CREATE UNIQUE INDEX ON "klaviyo_segment_daily_snapshots" ("segment_id", "snapshot_date");

CREATE INDEX ON "klaviyo_segment_daily_snapshots" ("organization_id");

CREATE INDEX ON "klaviyo_segment_daily_snapshots" ("snapshot_date");

CREATE UNIQUE INDEX ON "klaviyo_flows" ("account_id", "external_flow_id");

CREATE INDEX ON "klaviyo_flows" ("organization_id");

CREATE INDEX ON "klaviyo_flows" ("account_id");

CREATE INDEX ON "klaviyo_flows" ("status");

CREATE INDEX ON "klaviyo_flows" ("trigger_type");

CREATE INDEX ON "klaviyo_flows" ("archived");

CREATE UNIQUE INDEX ON "klaviyo_flow_actions" ("flow_id", "external_action_id");

CREATE INDEX ON "klaviyo_flow_actions" ("organization_id");

CREATE INDEX ON "klaviyo_flow_actions" ("flow_id");

CREATE INDEX ON "klaviyo_flow_actions" ("action_type");

CREATE INDEX ON "klaviyo_flow_actions" ("status");

CREATE UNIQUE INDEX ON "klaviyo_flow_messages" ("flow_action_id", "external_message_id");

CREATE INDEX ON "klaviyo_flow_messages" ("organization_id");

CREATE INDEX ON "klaviyo_flow_messages" ("flow_action_id");

CREATE INDEX ON "klaviyo_flow_messages" ("channel");

CREATE INDEX ON "klaviyo_flow_messages" ("status");

CREATE UNIQUE INDEX ON "klaviyo_campaigns" ("account_id", "external_campaign_id");

CREATE INDEX ON "klaviyo_campaigns" ("organization_id");

CREATE INDEX ON "klaviyo_campaigns" ("account_id");

CREATE INDEX ON "klaviyo_campaigns" ("status");

CREATE INDEX ON "klaviyo_campaigns" ("archived");

CREATE INDEX ON "klaviyo_campaigns" ("scheduled_at");

CREATE UNIQUE INDEX ON "klaviyo_campaign_messages" ("campaign_id", "external_message_id");

CREATE INDEX ON "klaviyo_campaign_messages" ("organization_id");

CREATE INDEX ON "klaviyo_campaign_messages" ("campaign_id");

CREATE INDEX ON "klaviyo_campaign_messages" ("channel");

CREATE INDEX ON "klaviyo_campaign_messages" ("status");

CREATE INDEX ON "klaviyo_campaign_messages" ("sent_at");

CREATE INDEX ON "klaviyo_campaign_audiences" ("organization_id");

CREATE INDEX ON "klaviyo_campaign_audiences" ("campaign_id");

CREATE INDEX ON "klaviyo_campaign_audiences" ("audience_type");

CREATE INDEX ON "klaviyo_campaign_audiences" ("audience_role");

CREATE INDEX ON "klaviyo_campaign_audiences" ("list_id");

CREATE INDEX ON "klaviyo_campaign_audiences" ("segment_id");

CREATE UNIQUE INDEX ON "klaviyo_forms" ("account_id", "external_form_id");

CREATE INDEX ON "klaviyo_forms" ("organization_id");

CREATE INDEX ON "klaviyo_forms" ("account_id");

CREATE INDEX ON "klaviyo_forms" ("status");

CREATE INDEX ON "klaviyo_forms" ("has_ab_test");

CREATE INDEX ON "klaviyo_report_runs" ("organization_id");

CREATE INDEX ON "klaviyo_report_runs" ("account_id");

CREATE INDEX ON "klaviyo_report_runs" ("sync_run_id");

CREATE INDEX ON "klaviyo_report_runs" ("report_type");

CREATE INDEX ON "klaviyo_report_runs" ("entity_type");

CREATE INDEX ON "klaviyo_report_runs" ("status");

CREATE INDEX ON "klaviyo_report_runs" ("requested_at");

CREATE INDEX ON "klaviyo_report_values" ("organization_id");

CREATE INDEX ON "klaviyo_report_values" ("report_run_id");

CREATE INDEX ON "klaviyo_report_values" ("entity_type");

CREATE INDEX ON "klaviyo_report_values" ("external_entity_id");

CREATE INDEX ON "klaviyo_report_values" ("statistic_name");

CREATE INDEX ON "klaviyo_report_values" ("period_start");

CREATE INDEX ON "klaviyo_report_values" ("period_end");

CREATE INDEX ON "klaviyo_report_values" ("channel");

CREATE UNIQUE INDEX ON "klaviyo_report_values" ("report_run_id", "entity_type", "external_entity_id", "statistic_name", "period_start", "period_end", "dimension_hash");

CREATE UNIQUE INDEX ON "klaviyo_metrics" ("account_id", "external_metric_id");

CREATE INDEX ON "klaviyo_metrics" ("organization_id");

CREATE INDEX ON "klaviyo_metrics" ("account_id");

CREATE INDEX ON "klaviyo_metrics" ("name");

CREATE INDEX ON "klaviyo_metrics" ("integration_name");

CREATE INDEX ON "klaviyo_metrics" ("is_primary_conversion_metric");

CREATE INDEX ON "klaviyo_daily_account_metrics" ("organization_id");

CREATE INDEX ON "klaviyo_daily_account_metrics" ("account_id");

CREATE INDEX ON "klaviyo_daily_account_metrics" ("metric_date");

CREATE INDEX ON "klaviyo_daily_account_metrics" ("channel");

CREATE INDEX ON "klaviyo_daily_account_metrics" ("conversion_metric_id");

CREATE UNIQUE INDEX ON "klaviyo_daily_account_metrics" ("account_id", "metric_date", "channel", "conversion_metric_id");

CREATE INDEX ON "marketing_campaigns" ("organization_id");

CREATE INDEX ON "marketing_campaigns" ("campaign_month");

CREATE INDEX ON "marketing_campaigns" ("status");

CREATE INDEX ON "marketing_campaign_products" ("campaign_id");

CREATE INDEX ON "marketing_campaign_products" ("product_id");

CREATE UNIQUE INDEX ON "organization_alert_rules" ("organization_id", "template_id");

CREATE INDEX ON "organization_alert_rules" ("organization_id");

CREATE INDEX ON "alerts" ("organization_id");

CREATE INDEX ON "alerts" ("status");

CREATE INDEX ON "alerts" ("severity");

CREATE INDEX ON "alerts" ("fingerprint");

CREATE INDEX ON "alerts" ("organization_id", "status", "severity");

CREATE INDEX ON "tasks" ("organization_id");

CREATE INDEX ON "tasks" ("assigned_to");

CREATE INDEX ON "tasks" ("status");

CREATE INDEX ON "tasks" ("priority");

CREATE INDEX ON "tasks" ("due_at");

CREATE INDEX ON "tasks" ("organization_id", "status", "priority");

CREATE INDEX ON "task_status_history" ("task_id");

CREATE INDEX ON "task_status_history" ("organization_id");

CREATE INDEX ON "task_comments" ("task_id");

CREATE INDEX ON "task_comments" ("organization_id");

CREATE INDEX ON "strategic_plans" ("organization_id");

CREATE INDEX ON "strategic_plans" ("status");

CREATE UNIQUE INDEX ON "strategic_plan_phases" ("plan_id", "position");

CREATE INDEX ON "strategic_plan_phases" ("organization_id");

CREATE UNIQUE INDEX ON "strategic_plan_milestones" ("phase_id", "position");

CREATE INDEX ON "strategic_plan_milestones" ("organization_id");

CREATE UNIQUE INDEX ON "milestone_task_links" ("milestone_id", "task_id");

CREATE INDEX ON "milestone_task_links" ("organization_id");

CREATE INDEX ON "milestone_internal_notes" ("milestone_id");

CREATE INDEX ON "milestone_internal_notes" ("organization_id");

CREATE INDEX ON "consulting_calls" ("organization_id");

CREATE INDEX ON "consulting_calls" ("consultant_user_id");

CREATE INDEX ON "consulting_calls" ("scheduled_at");

CREATE INDEX ON "consulting_calls" ("status");

CREATE INDEX ON "call_transcripts" ("organization_id");

CREATE INDEX ON "call_transcripts" ("call_id");

CREATE INDEX ON "call_transcripts" ("is_current");

CREATE UNIQUE INDEX ON "call_transcripts" ("call_id", "version");

CREATE INDEX ON "call_ai_summaries" ("organization_id");

CREATE INDEX ON "call_ai_summaries" ("call_id");

CREATE INDEX ON "call_ai_summaries" ("transcript_id");

CREATE UNIQUE INDEX ON "call_ai_summaries" ("call_id", "version");

CREATE UNIQUE INDEX ON "call_task_links" ("call_id", "task_id");

CREATE INDEX ON "call_task_links" ("organization_id");

CREATE UNIQUE INDEX ON "instagram_accounts" ("connection_id", "external_account_id");

CREATE INDEX ON "instagram_accounts" ("organization_id");

CREATE INDEX ON "instagram_accounts" ("page_id");

CREATE INDEX ON "instagram_accounts" ("username");

CREATE UNIQUE INDEX ON "instagram_account_snapshots" ("account_id", "snapshot_date");

CREATE INDEX ON "instagram_account_snapshots" ("organization_id");

CREATE INDEX ON "instagram_account_snapshots" ("snapshot_date");

CREATE INDEX ON "instagram_account_insight_values" ("organization_id");

CREATE INDEX ON "instagram_account_insight_values" ("account_id");

CREATE INDEX ON "instagram_account_insight_values" ("metric_name");

CREATE INDEX ON "instagram_account_insight_values" ("period_start");

CREATE INDEX ON "instagram_account_insight_values" ("period_end");

CREATE UNIQUE INDEX ON "instagram_account_insight_values" ("account_id", "metric_name", "metric_period", "period_start", "period_end", "breakdown_hash");

CREATE UNIQUE INDEX ON "instagram_media" ("account_id", "external_media_id");

CREATE INDEX ON "instagram_media" ("organization_id");

CREATE INDEX ON "instagram_media" ("account_id");

CREATE INDEX ON "instagram_media" ("parent_media_id");

CREATE INDEX ON "instagram_media" ("media_type");

CREATE INDEX ON "instagram_media" ("media_product_type");

CREATE INDEX ON "instagram_media" ("external_published_at");

CREATE UNIQUE INDEX ON "instagram_follower_winners" ("account_id", "reporting_month", "rank_position");

CREATE INDEX ON "instagram_follower_winners" ("organization_id");

CREATE INDEX ON "instagram_follower_winners" ("account_id");

CREATE INDEX ON "instagram_follower_winners" ("media_id");

CREATE INDEX ON "instagram_media_insight_values" ("organization_id");

CREATE INDEX ON "instagram_media_insight_values" ("media_id");

CREATE INDEX ON "instagram_media_insight_values" ("metric_name");

CREATE INDEX ON "instagram_media_insight_values" ("captured_at");

CREATE UNIQUE INDEX ON "instagram_media_insight_values" ("media_id", "metric_name", "metric_period", "breakdown_hash", "captured_at");

CREATE INDEX ON "knowledge_documents" ("organization_id");

CREATE INDEX ON "knowledge_documents" ("status");

CREATE INDEX ON "knowledge_documents" ("is_global");

CREATE UNIQUE INDEX ON "knowledge_chunks" ("document_id", "chunk_index");

CREATE INDEX ON "knowledge_chunks" ("organization_id");

CREATE INDEX ON "ai_conversations" ("organization_id");

CREATE INDEX ON "ai_conversations" ("user_id");

CREATE INDEX ON "ai_conversations" ("status");

CREATE INDEX ON "ai_messages" ("conversation_id");

CREATE INDEX ON "ai_messages" ("organization_id");

CREATE INDEX ON "ai_messages" ("created_at");

CREATE INDEX ON "notifications" ("user_id");

CREATE INDEX ON "notifications" ("organization_id");

CREATE INDEX ON "notifications" ("status");

CREATE INDEX ON "notifications" ("created_at");

CREATE INDEX ON "audit_logs" ("organization_id");

CREATE INDEX ON "audit_logs" ("actor_user_id");

CREATE INDEX ON "audit_logs" ("entity_type");

CREATE INDEX ON "audit_logs" ("entity_id");

CREATE INDEX ON "audit_logs" ("created_at");

CREATE UNIQUE INDEX ON "private"."webhook_events" ("provider", "external_event_id");

CREATE INDEX ON "private"."webhook_events" ("organization_id");

CREATE INDEX ON "private"."webhook_events" ("connection_id");

CREATE INDEX ON "private"."webhook_events" ("event_type");

CREATE INDEX ON "private"."webhook_events" ("processed");

CREATE INDEX ON "private"."webhook_events" ("received_at");

CREATE UNIQUE INDEX ON "private"."meta_asset_tokens" ("connection_id", "asset_type", "external_asset_id");

CREATE INDEX ON "private"."meta_asset_tokens" ("connection_id");

CREATE INDEX ON "private"."meta_asset_tokens" ("token_expires_at");

COMMENT ON TABLE "profiles" IS 'Perfil público asociado a auth.users.';

COMMENT ON TABLE "organizations" IS 'Cada organización representa una tienda o cliente de EcomScaling.';

COMMENT ON TABLE "organization_members" IS 'Usuarios pertenecientes a una tienda.';

COMMENT ON TABLE "consultant_assignments" IS 'Controla qué consultores pueden acceder a cada cliente.';

COMMENT ON TABLE "service_subscriptions" IS 'El acceso a la aplicación depende de una suscripción activa.';

COMMENT ON TABLE "organization_financial_settings" IS 'Configuración necesaria para estimar beneficio neto y rentabilidad.';

COMMENT ON TABLE "organization_metric_targets" IS 'Objetivos personalizados: popup conversion, hook rate, recurrencia, etc.';

COMMENT ON TABLE "integration_connections" IS 'Solo contiene metadatos no sensibles de la conexión.';

COMMENT ON TABLE "integration_sync_runs" IS 'Registra sincronizaciones paginadas, webhooks, reconciliaciones y Bulk Operations.';

COMMENT ON TABLE "shopify_stores" IS 'Tienda Shopify identificada automáticamente mediante la query shop.';

COMMENT ON TABLE "shopify_variants" IS 'Variante comercial del producto. El SKU, coste y control de inventario pertenecen principalmente a InventoryItem.';

COMMENT ON TABLE "product_costs" IS 'Histórico de costes. Puede proceder de Shopify o haber sido sobrescrito manualmente.';

COMMENT ON TABLE "shopify_order_facts" IS 'Pedido sincronizado sin almacenar nombre, email, teléfono ni dirección del comprador.';

COMMENT ON TABLE "shopify_order_items" IS 'Línea económica del pedido. Conserva datos históricos aunque el producto se modifique o elimine.';

COMMENT ON TABLE "shopify_refunds" IS 'Cabecera del reembolso económico de un pedido.';

COMMENT ON TABLE "shopify_refund_items" IS 'Productos y cantidades concretas incluidas en un reembolso.';

COMMENT ON TABLE "shopify_inventory_items" IS 'Entidad de inventario de Shopify asociada normalmente 1:1 con una variante.';

COMMENT ON TABLE "shopify_inventory_level_snapshots" IS 'Fotografía histórica de las cantidades de un InventoryItem en una Location concreta.';

COMMENT ON TABLE "shopify_daily_product_metrics" IS 'Métricas comerciales diarias calculadas a partir de pedidos, devoluciones e inventario.';

COMMENT ON TABLE "shopify_daily_product_traffic_metrics" IS 'Tráfico por producto obtenido mediante ShopifyQL, Web Pixel u otra fuente validada.';

COMMENT ON TABLE "shopify_locations" IS 'Almacenes, tiendas físicas u operadores logísticos donde Shopify mantiene inventario.';

COMMENT ON TABLE "meta_ad_accounts" IS 'Cuenta publicitaria Meta seleccionada por el cliente.';

COMMENT ON TABLE "meta_creatives" IS 'Cabecera de la creatividad. Las variantes de imágenes, vídeos y textos se guardan en meta_creative_assets.';

COMMENT ON TABLE "meta_creative_assets" IS 'Activos individuales de una creatividad clásica o dinámica.';

COMMENT ON TABLE "meta_ad_creative_assignments" IS 'Histórico de creatividades asociadas a un anuncio para no perder la relación temporal.';

COMMENT ON TABLE "meta_insight_rows_daily" IS 'Fila base de Ads Insights. Las acciones, valores, ROAS y métricas de vídeo se normalizan aparte.';

COMMENT ON TABLE "meta_insight_action_metrics" IS 'Valores de arrays de Ads Insights: actions, action_values, purchase_roas, costes por acción y métricas de vídeo.';

COMMENT ON TABLE "meta_calculated_metrics_daily" IS 'KPIs calculados por EcomScaling: hook_rate, hold_rate, canonical_roas, cac o creative_fatigue.';

COMMENT ON TABLE "meta_insight_report_runs" IS 'Seguimiento de informes asíncronos de Ads Insights.';

COMMENT ON TABLE "meta_business_accounts" IS 'Business Manager o portfolio empresarial de Meta accesible mediante la autorización.';

COMMENT ON TABLE "meta_pages" IS 'Página de Facebook vinculada a una cuenta profesional de Instagram.';

COMMENT ON TABLE "klaviyo_accounts" IS 'Cuenta de Klaviyo detectada automáticamente tras completar OAuth.';

COMMENT ON TABLE "klaviyo_lists" IS 'Listas estáticas de perfiles utilizadas como audiencias o triggers.';

COMMENT ON TABLE "klaviyo_list_daily_snapshots" IS 'Histórico agregado del tamaño de una lista. No almacena sus miembros.';

COMMENT ON TABLE "klaviyo_segments" IS 'Audiencias dinámicas definidas por condiciones dentro de Klaviyo.';

COMMENT ON TABLE "klaviyo_segment_daily_snapshots" IS 'Histórico agregado del tamaño del segmento.';

COMMENT ON TABLE "klaviyo_flows" IS 'Automatización de Klaviyo. Sus acciones y mensajes se almacenan en tablas separadas.';

COMMENT ON TABLE "klaviyo_flow_actions" IS 'Acciones internas del flow: envío de email, SMS, espera, condición, etc.';

COMMENT ON TABLE "klaviyo_flow_messages" IS 'Mensaje asociado a una acción de flow. No almacena perfiles destinatarios.';

COMMENT ON TABLE "klaviyo_campaigns" IS 'Cabecera de la campaña. El contenido y el canal se detallan mediante mensajes.';

COMMENT ON TABLE "klaviyo_campaign_messages" IS 'Mensaje de email, SMS, push u otro canal asociado a una campaña.';

COMMENT ON TABLE "klaviyo_campaign_audiences" IS 'Relaciona campañas con listas y segmentos incluidos o excluidos. Debe existir list_id o segment_id según audience_type.';

COMMENT ON TABLE "klaviyo_forms" IS 'Formulario o pop-up de Klaviyo. Su rendimiento se obtiene mediante Reporting API.';

COMMENT ON TABLE "klaviyo_report_runs" IS 'Auditoría de cada consulta realizada a Reporting API o Metric Aggregates.';

COMMENT ON TABLE "klaviyo_report_values" IS 'Valor normalizado de Reporting API. Solo una de las referencias campaign, flow, form o segment debe aplicar según entity_type.';

COMMENT ON TABLE "klaviyo_metrics" IS 'Definiciones de métricas de Klaviyo. Una se seleccionará como métrica oficial de conversión/revenue.';

COMMENT ON TABLE "klaviyo_daily_account_metrics" IS 'Tabla derivada por EcomScaling IA a partir de Reporting API y revenue de Shopify.';

COMMENT ON TABLE "alert_rule_templates" IS 'Reglas globales: ROAS bajo, stock cero, sin campaña, flow sin envíos, etc.';

COMMENT ON TABLE "milestone_internal_notes" IS 'Solo visibles para consultores y administradores.';

COMMENT ON TABLE "call_transcripts" IS 'Versiones de la transcripción de una llamada. Solo una debe permanecer como versión actual.';

COMMENT ON TABLE "instagram_accounts" IS 'Cuenta profesional de Instagram Business o Creator.';

COMMENT ON TABLE "instagram_account_snapshots" IS 'Fotografía diaria del tamaño de la cuenta para calcular crecimiento.';

COMMENT ON TABLE "instagram_account_insight_values" IS 'Insights de la cuenta profesional almacenados sin depender de columnas rígidas.';

COMMENT ON TABLE "instagram_media" IS 'Posts, reels, stories y elementos hijos de carruseles.';

COMMENT ON TABLE "instagram_follower_winners" IS 'Ranking manual mensual porque Instagram no atribuye de forma general los seguidores ganados a cada publicación.';

COMMENT ON TABLE "instagram_media_insight_values" IS 'Snapshots de Insights de cada publicación. Las métricas disponibles dependen del tipo de medio.';

COMMENT ON TABLE "knowledge_documents" IS 'Documentos globales de metodología o documentos específicos de un cliente.';

COMMENT ON TABLE "knowledge_chunks" IS 'La dimensión del vector se ajustará al proveedor de embeddings elegido.';

COMMENT ON TABLE "auth"."users" IS 'Tabla gestionada por Supabase Auth. No crear manualmente.';

COMMENT ON TABLE "private"."integration_credentials" IS 'Nunca exponer mediante Supabase API pública. Acceso exclusivo desde backend seguro.';

COMMENT ON TABLE "private"."webhook_events" IS 'Eventos externos validados y procesados de forma idempotente desde el backend.';

COMMENT ON TABLE "private"."meta_asset_tokens" IS 'Tokens específicos de Página, sistema u otros activos Meta. Nunca accesible desde el frontend.';

ALTER TABLE "auth"."users" ADD FOREIGN KEY ("id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organizations" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_members" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_members" ADD FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_members" ADD FOREIGN KEY ("invited_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "consultant_assignments" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "consultant_assignments" ADD FOREIGN KEY ("consultant_user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "consultant_assignments" ADD FOREIGN KEY ("assigned_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "service_subscriptions" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organizations" ADD FOREIGN KEY ("id") REFERENCES "organization_financial_settings" ("organization_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_financial_settings" ADD FOREIGN KEY ("configured_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fixed_expenses" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fixed_expenses" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shipping_cost_rules" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_metric_targets" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_metric_targets" ADD FOREIGN KEY ("configured_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration_connections" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration_connections" ADD FOREIGN KEY ("connected_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration_connections" ADD FOREIGN KEY ("id") REFERENCES "private"."integration_credentials" ("connection_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration_sync_runs" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration_sync_runs" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "private"."webhook_events" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "private"."webhook_events" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_stores" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration_connections" ADD FOREIGN KEY ("id") REFERENCES "shopify_stores" ("connection_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_products" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_products" ADD FOREIGN KEY ("store_id") REFERENCES "shopify_stores" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_variants" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_variants" ADD FOREIGN KEY ("product_id") REFERENCES "shopify_products" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_inventory_items" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_variants" ADD FOREIGN KEY ("id") REFERENCES "shopify_inventory_items" ("variant_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_locations" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_locations" ADD FOREIGN KEY ("store_id") REFERENCES "shopify_stores" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_inventory_level_snapshots" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_inventory_level_snapshots" ADD FOREIGN KEY ("inventory_item_id") REFERENCES "shopify_inventory_items" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_inventory_level_snapshots" ADD FOREIGN KEY ("location_id") REFERENCES "shopify_locations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_costs" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_costs" ADD FOREIGN KEY ("inventory_item_id") REFERENCES "shopify_inventory_items" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_costs" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_order_facts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_order_facts" ADD FOREIGN KEY ("store_id") REFERENCES "shopify_stores" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_order_items" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_order_items" ADD FOREIGN KEY ("order_id") REFERENCES "shopify_order_facts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_order_items" ADD FOREIGN KEY ("product_id") REFERENCES "shopify_products" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_order_items" ADD FOREIGN KEY ("variant_id") REFERENCES "shopify_variants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_refunds" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_refunds" ADD FOREIGN KEY ("order_id") REFERENCES "shopify_order_facts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_refund_items" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_refund_items" ADD FOREIGN KEY ("refund_id") REFERENCES "shopify_refunds" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_refund_items" ADD FOREIGN KEY ("order_item_id") REFERENCES "shopify_order_items" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_refund_items" ADD FOREIGN KEY ("location_id") REFERENCES "shopify_locations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_store_metrics" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_store_metrics" ADD FOREIGN KEY ("store_id") REFERENCES "shopify_stores" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_product_metrics" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_product_metrics" ADD FOREIGN KEY ("product_id") REFERENCES "shopify_products" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_product_metrics" ADD FOREIGN KEY ("variant_id") REFERENCES "shopify_variants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_product_traffic_metrics" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_product_traffic_metrics" ADD FOREIGN KEY ("store_id") REFERENCES "shopify_stores" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shopify_daily_product_traffic_metrics" ADD FOREIGN KEY ("product_id") REFERENCES "shopify_products" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "suppliers" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "suppliers" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_supply_settings" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_supply_settings" ADD FOREIGN KEY ("variant_id") REFERENCES "shopify_variants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_supply_settings" ADD FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_supply_settings" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "stock_forecasts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "stock_forecasts" ADD FOREIGN KEY ("variant_id") REFERENCES "shopify_variants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_accounts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration_connections" ADD FOREIGN KEY ("id") REFERENCES "klaviyo_accounts" ("connection_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_lists" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_lists" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_list_daily_snapshots" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_list_daily_snapshots" ADD FOREIGN KEY ("list_id") REFERENCES "klaviyo_lists" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_segments" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_segments" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_segment_daily_snapshots" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_segment_daily_snapshots" ADD FOREIGN KEY ("segment_id") REFERENCES "klaviyo_segments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_flows" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_flows" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_flow_actions" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_flow_actions" ADD FOREIGN KEY ("flow_id") REFERENCES "klaviyo_flows" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_flow_messages" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_flow_messages" ADD FOREIGN KEY ("flow_action_id") REFERENCES "klaviyo_flow_actions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaigns" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaigns" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaign_messages" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaign_messages" ADD FOREIGN KEY ("campaign_id") REFERENCES "klaviyo_campaigns" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaign_audiences" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaign_audiences" ADD FOREIGN KEY ("campaign_id") REFERENCES "klaviyo_campaigns" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaign_audiences" ADD FOREIGN KEY ("list_id") REFERENCES "klaviyo_lists" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_campaign_audiences" ADD FOREIGN KEY ("segment_id") REFERENCES "klaviyo_segments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_forms" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_forms" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_metrics" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_metrics" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_runs" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_runs" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_runs" ADD FOREIGN KEY ("sync_run_id") REFERENCES "integration_sync_runs" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_runs" ADD FOREIGN KEY ("conversion_metric_id") REFERENCES "klaviyo_metrics" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("report_run_id") REFERENCES "klaviyo_report_runs" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("campaign_id") REFERENCES "klaviyo_campaigns" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("campaign_message_id") REFERENCES "klaviyo_campaign_messages" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("flow_id") REFERENCES "klaviyo_flows" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("flow_message_id") REFERENCES "klaviyo_flow_messages" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("form_id") REFERENCES "klaviyo_forms" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_report_values" ADD FOREIGN KEY ("segment_id") REFERENCES "klaviyo_segments" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_daily_account_metrics" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_daily_account_metrics" ADD FOREIGN KEY ("account_id") REFERENCES "klaviyo_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "klaviyo_daily_account_metrics" ADD FOREIGN KEY ("conversion_metric_id") REFERENCES "klaviyo_metrics" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "marketing_campaigns" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "marketing_campaigns" ADD FOREIGN KEY ("klaviyo_campaign_id") REFERENCES "klaviyo_campaigns" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "marketing_campaigns" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "marketing_campaign_products" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "marketing_campaign_products" ADD FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "marketing_campaign_products" ADD FOREIGN KEY ("product_id") REFERENCES "shopify_products" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "marketing_campaign_products" ADD FOREIGN KEY ("variant_id") REFERENCES "shopify_variants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_alert_rules" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_alert_rules" ADD FOREIGN KEY ("template_id") REFERENCES "alert_rule_templates" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_alert_rules" ADD FOREIGN KEY ("configured_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "alerts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "alerts" ADD FOREIGN KEY ("rule_template_id") REFERENCES "alert_rule_templates" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "alerts" ADD FOREIGN KEY ("organization_rule_id") REFERENCES "organization_alert_rules" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "alerts" ADD FOREIGN KEY ("acknowledged_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "alerts" ADD FOREIGN KEY ("resolved_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tasks" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tasks" ADD FOREIGN KEY ("alert_id") REFERENCES "alerts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tasks" ADD FOREIGN KEY ("assigned_to") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tasks" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_status_history" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_status_history" ADD FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_status_history" ADD FOREIGN KEY ("changed_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_comments" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_comments" ADD FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_comments" ADD FOREIGN KEY ("author_user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plans" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plans" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plans" ADD FOREIGN KEY ("approved_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plan_phases" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plan_phases" ADD FOREIGN KEY ("plan_id") REFERENCES "strategic_plans" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plan_phases" ADD FOREIGN KEY ("activated_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plan_milestones" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plan_milestones" ADD FOREIGN KEY ("phase_id") REFERENCES "strategic_plan_phases" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "strategic_plan_milestones" ADD FOREIGN KEY ("completed_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "milestone_task_links" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "milestone_task_links" ADD FOREIGN KEY ("milestone_id") REFERENCES "strategic_plan_milestones" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "milestone_task_links" ADD FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "milestone_internal_notes" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "milestone_internal_notes" ADD FOREIGN KEY ("milestone_id") REFERENCES "strategic_plan_milestones" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "milestone_internal_notes" ADD FOREIGN KEY ("author_user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "consulting_calls" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "consulting_calls" ADD FOREIGN KEY ("consultant_user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "consulting_calls" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_transcripts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "consulting_calls" ADD FOREIGN KEY ("id") REFERENCES "call_transcripts" ("call_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_transcripts" ADD FOREIGN KEY ("created_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_ai_summaries" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_ai_summaries" ADD FOREIGN KEY ("call_id") REFERENCES "consulting_calls" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_ai_summaries" ADD FOREIGN KEY ("reviewed_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_task_links" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_task_links" ADD FOREIGN KEY ("call_id") REFERENCES "consulting_calls" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_task_links" ADD FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "call_task_links" ADD FOREIGN KEY ("approved_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_business_accounts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_business_accounts" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_pages" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_pages" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_pages" ADD FOREIGN KEY ("business_account_id") REFERENCES "meta_business_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "private"."meta_asset_tokens" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_accounts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_accounts" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_accounts" ADD FOREIGN KEY ("business_account_id") REFERENCES "meta_business_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_campaigns" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_campaigns" ADD FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_sets" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_sets" ADD FOREIGN KEY ("campaign_id") REFERENCES "meta_campaigns" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_creatives" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_creatives" ADD FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_creative_assets" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_creative_assets" ADD FOREIGN KEY ("creative_id") REFERENCES "meta_creatives" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ads" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ads" ADD FOREIGN KEY ("ad_set_id") REFERENCES "meta_ad_sets" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ads" ADD FOREIGN KEY ("current_creative_id") REFERENCES "meta_creatives" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_creative_assignments" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_creative_assignments" ADD FOREIGN KEY ("ad_id") REFERENCES "meta_ads" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_ad_creative_assignments" ADD FOREIGN KEY ("creative_id") REFERENCES "meta_creatives" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_rows_daily" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_rows_daily" ADD FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_rows_daily" ADD FOREIGN KEY ("campaign_id") REFERENCES "meta_campaigns" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_rows_daily" ADD FOREIGN KEY ("ad_set_id") REFERENCES "meta_ad_sets" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_rows_daily" ADD FOREIGN KEY ("ad_id") REFERENCES "meta_ads" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_action_metrics" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_action_metrics" ADD FOREIGN KEY ("insight_row_id") REFERENCES "meta_insight_rows_daily" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_calculated_metrics_daily" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_calculated_metrics_daily" ADD FOREIGN KEY ("insight_row_id") REFERENCES "meta_insight_rows_daily" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_report_runs" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_report_runs" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_report_runs" ADD FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "meta_insight_report_runs" ADD FOREIGN KEY ("sync_run_id") REFERENCES "integration_sync_runs" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_accounts" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_accounts" ADD FOREIGN KEY ("connection_id") REFERENCES "integration_connections" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_accounts" ADD FOREIGN KEY ("page_id") REFERENCES "meta_pages" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_account_snapshots" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_account_snapshots" ADD FOREIGN KEY ("account_id") REFERENCES "instagram_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_account_insight_values" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_account_insight_values" ADD FOREIGN KEY ("account_id") REFERENCES "instagram_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_media" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_media" ADD FOREIGN KEY ("account_id") REFERENCES "instagram_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_media" ADD FOREIGN KEY ("parent_media_id") REFERENCES "instagram_media" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_media_insight_values" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_media_insight_values" ADD FOREIGN KEY ("media_id") REFERENCES "instagram_media" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_follower_winners" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_follower_winners" ADD FOREIGN KEY ("account_id") REFERENCES "instagram_accounts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_follower_winners" ADD FOREIGN KEY ("media_id") REFERENCES "instagram_media" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "instagram_follower_winners" ADD FOREIGN KEY ("submitted_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "knowledge_documents" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "knowledge_documents" ADD FOREIGN KEY ("uploaded_by") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "knowledge_chunks" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "knowledge_chunks" ADD FOREIGN KEY ("document_id") REFERENCES "knowledge_documents" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ai_conversations" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ai_conversations" ADD FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ai_messages" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ai_messages" ADD FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("actor_user_id") REFERENCES "profiles" ("id") DEFERRABLE INITIALLY IMMEDIATE;
