export type CatalogProductMetrics = {
  units_ordered: number;
  units_refunded: number;
  return_rate: number | null;
  orders_count: number;
  last_order_at: string | null;
  stock_available: number | null;
  tracked_variants: number;
  variants_total: number;
  variants_out: number;
  variants_low: number;
  variants_without_cost: number;
  price_min: number | null;
  price_max: number | null;
  /** true solo cuando todas las lineas del periodo tienen coste e importe neto. */
  margin_complete: boolean;
  margin_pct: number | null;
};

export type CatalogSummary = {
  total: number;
  active: number;
  draft: number;
  archived: number;
  out_of_stock: number;
  low_stock: number;
  without_cost: number;
  without_sales: number;
};

export type CatalogSort = "sales" | "stock" | "margin" | "updated" | "name";
export type CatalogFilter = "" | "out" | "low" | "no_cost" | "no_sales";

export type CatalogProduct = {
  id: string;
  store_id: string;
  store_name: string;
  currency_code: string | null;
  title: string;
  handle: string | null;
  vendor: string | null;
  product_type: string | null;
  description_text: string | null;
  tags: string[];
  shopify_category_id: string | null;
  shopify_category_name: string | null;
  metadata_coverage: "complete" | "partial" | "pending" | "unavailable" | "migration_pending" | string;
  status: string | null;
  published_at: string | null;
  external_updated_at: string | null;
  primary_image_url: string | null;
  primary_image_alt: string | null;
  /** null si la migracion de metricas aun no esta o fallo la consulta. */
  metrics?: CatalogProductMetrics | null;
  /** Unidades pedidas por semana, la mas antigua primero. */
  weekly_units?: number[] | null;
};

export type CatalogProductsResponse = {
  organization_id: string;
  page: number;
  page_size: number;
  total: number;
  products: CatalogProduct[];
  summary?: CatalogSummary | null;
  metrics_coverage?: "available" | "migration_pending" | "unavailable";
  period_days?: number;
};

export type CatalogVariant = {
  id: string;
  title: string | null;
  selected_options: Array<{ name: string; value: string }>;
  barcode: string | null;
  current_price: number | null;
  compare_at_price: number | null;
  position: number | null;
  inventory_policy: string | null;
  is_active: boolean;
  external_updated_at: string | null;
  inventory: {
    variant_id: string;
    sku: string | null;
    tracked: boolean;
    current_unit_cost: number | null;
    cost_currency_code: string | null;
    external_updated_at: string | null;
  } | null;
  inventory_levels: Array<{
    location_id: string;
    location_name: string;
    available_quantity: number | null;
    on_hand_quantity: number | null;
    committed_quantity: number | null;
    incoming_quantity: number | null;
    updated_at: string;
  }>;
  activity: CatalogVariantActivity | null;
  /** Cobertura de stock: disponible entre el ritmo de ventas de 30 dias. */
  cover?: {
    tracked: boolean;
    available: number;
    units_per_day_30d: number | null;
    days_of_cover: number | null;
  };
  image: {
    source_url: string | null;
    alt_text: string | null;
    width: number | null;
    height: number | null;
  } | null;
  bundle_components: Array<{
    component_variant_id: string | null;
    external_component_variant_id: string;
    product_title: string | null;
    variant_title: string | null;
    quantity: number;
    verification_status: "confirmed" | "unresolved_component";
  }> | null;
};

export type CatalogVariantActivity = {
  variant_id: string | null;
  variant_title: string | null;
  units_ordered: number;
  units_refunded: number;
  orders_count: number;
  last_order_at: string | null;
};

export type CatalogProductActivity = {
  status: "observed_only" | "migration_pending" | "unavailable";
  coverage_note: string;
  period_days: number;
  period_start: string;
  period_end: string;
  currency_code: string | null;
  units_ordered: number;
  units_refunded: number;
  last_order_at: string | null;
  variants: CatalogVariantActivity[];
};

export type CatalogBundleCoverage = {
  status: "complete" | "partial" | "failed" | "pending" | "migration_pending";
  variants_scanned: number | null;
  bundle_variants_count: number | null;
  components_count: number | null;
  unresolved_components_count: number | null;
  last_synced_at: string | null;
  error_code: string | null;
};

export type CatalogProductPromotion = {
  id: string;
  title: string | null;
  code: string | null;
  codes: string[];
  codes_coverage: string;
  configuration_coverage: string;
  summary: string | null;
  status: string | null;
  discount_class: string | null;
  starts_at: string | null;
  ends_at: string | null;
  matched_rule_side: "gets" | "buys";
  matched_targets: Array<{
    target_type: "product" | "variant" | "collection" | "all";
    external_target_id: string;
    title: string | null;
  }>;
};

export type CatalogProductMedia = {
  external_media_id: string;
  source_url: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  position: number;
};

export type CatalogProductDetailResponse = {
  organization_id: string;
  product: CatalogProduct & {
    external_product_id: string;
    connection_id: string | null;
    external_created_at: string | null;
  };
  variants: CatalogVariant[];
  media: CatalogProductMedia[];
  product_activity: CatalogProductActivity;
  bundle_parent_activity: {
    status: "migration_pending" | "unavailable" | "partial" | "observed_only";
    period_days: number;
    bundle_group_count: number;
    bundles_sold: number;
    last_order_at: string | null;
    unclassified_line_count: number;
    coverage_note: string;
  };
  media_coverage: "complete" | "partial" | "failed" | "running" | "pending" | "unavailable" | "migration_pending" | string;
  media_sync: {
    products_scanned: number | null;
    images_scanned: number | null;
    last_attempt_at: string | null;
    last_successful_full_sync_at: string | null;
    error_code: string | null;
  };
  selected_options_coverage: "available" | "migration_pending";
  bundle_coverage: CatalogBundleCoverage;
  inventory_levels_coverage: "available" | "migration_pending";
  related_promotions: CatalogProductPromotion[];
  promotion_target_coverage: {
    status: "complete" | "partial" | "failed" | "pending" | "migration_pending";
    by_rule_side: Array<{
      rule_side: string;
      status?: string;
      discounts_scanned?: number;
      targets_scanned?: number;
      last_synced_at?: string;
      error_code?: string | null;
    }>;
  };
  variant_page: number;
  variant_page_size: number;
  variant_total: number;
  metrics_coverage?: "available" | "migration_pending" | "unavailable";
  product_metrics?: (CatalogProductMetrics & {
    previous_units_ordered: number | null;
    units_per_day_14d: number | null;
  }) | null;
  weekly?: Array<{ week_start: string; units_ordered: number; units_refunded: number }> | null;
  copurchase?: {
    status: "observed_only" | "migration_pending" | "unavailable";
    product_orders: number | null;
    items: Array<{ product_id: string; title: string; orders_together: number; share: number | null }>;
  };
};

export type CatalogDiscountMetrics = {
  orders: number;
  discount_amount: number | null;
  amount_coverage: "complete" | "partial" | "unavailable" | string;
  net_revenue: number;
  aov: number | null;
  aov_baseline: number | null;
  new_customer_share: number | null;
  last_order_at: string | null;
};

export type CatalogDiscountMetricsCoverage = "observed_only" | "migration_pending" | "unavailable";

export type CatalogDiscount = {
  id: string;
  store_id: string;
  store_name: string;
  currency_code: string | null;
  title: string | null;
  code: string | null;
  codes: string[];
  codes_coverage: string;
  configuration_coverage: string;
  summary: string | null;
  rule_data: unknown;
  status: string | null;
  discount_class: string | null;
  value_type: string | null;
  value: number | null;
  usage_count: number;
  usage_limit: number | null;
  uses_per_order_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  external_updated_at: string | null;
  metrics?: CatalogDiscountMetrics | null;
  weekly_orders?: number[] | null;
};

export type CatalogDiscountsResponse = {
  organization_id: string;
  page: number;
  page_size: number;
  total: number;
  details_coverage: "available" | "migration_pending";
  discounts: CatalogDiscount[];
  period_days?: number;
  metrics_coverage?: CatalogDiscountMetricsCoverage;
  summary?: {
    total: number;
    active: number;
    scheduled: number;
    expired: number;
    disabled: number;
    closed: number;
    ending_soon: number;
    near_limit: number;
    app_managed: number;
    discount_amount: number | null;
  } | null;
};

export type CatalogDiscountApplication = {
  id: string;
  order_id: string;
  order_name: string | null;
  order_at: string | null;
  code: string | null;
  title: string | null;
  amount: number;
  amount_coverage: "complete" | "partial" | "unavailable" | string;
  currency_code: string | null;
  position: number;
};

export type CatalogDiscountDetailResponse = {
  organization_id: string;
  discount: CatalogDiscount;
  period_days?: number;
  metrics_coverage?: CatalogDiscountMetricsCoverage;
  metrics?: CatalogDiscountMetrics | null;
  weekly_orders?: number[] | null;
  top_products?: Array<{ product_id: string | null; title: string; units: number }> | null;
  codes_usage?: Array<{ code: string; orders: number; discount_amount: number | null; amount_coverage: string }> | null;
  details_coverage: "available" | "migration_pending";
  targets: Array<{
    rule_side: "gets" | "buys" | string;
    target_type: "all" | "product" | "variant" | "collection" | string;
    external_target_id: string;
    target_title: string | null;
  }>;
  targets_total: number | null;
  targets_page: number;
  targets_page_size: number;
  target_coverage: {
    status: "available" | "migration_pending" | "unavailable";
    by_rule_side: Array<{
      rule_side: string;
      status: string;
      discounts_scanned: number;
      targets_scanned: number;
      last_synced_at: string;
      error_code: string | null;
    }>;
  };
  applications: CatalogDiscountApplication[];
  applications_coverage: "migration_pending" | "unavailable" | "partial_page" | "observed_only";
  applications_total: number | null;
  applications_page: number;
  applications_page_size: number;
};
