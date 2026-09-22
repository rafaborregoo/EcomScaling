# Inventario de metricas

Una fila por funcion SQL de metrica, cruzada con quien la consume.
**Generado por script desde el codigo** -- no se edita a mano, se regenera:

```
node scripts/inventario-metricas.mjs
```

Cada columna vacia es una cola de trabajo distinta:

| Columna vacia | Que falta | Punto del DoD |
| --- | --- | --- |
| **Pantalla** | la cifra se calcula pero nadie la ve | 7 (la vista existe) |
| **Tool** | ningun agente puede leerla | 8 (consumo por agentes) |
| **sin uso** | no la llama ni la UI ni un agente | trabajo pagado y muerto |

El eje son las **areas de negocio** de `fase-05` / `fase-06`, no los
conectores: el corpus esta organizado asi y el consultor pregunta asi. El
conector solo dice de donde sale el dato.

Las heuristicas de area y de pantalla fallan por exceso: comprueba a mano antes
de dar por muerta una metrica marcada **sin uso**.

## Resumen

| Area | Bloque | Metricas | Sin pantalla | Sin tool | Sin uso |
| --- | --- | --- | --- | --- | --- |
| Adquisicion y demanda | 5.01 / 6.03 | 1 | 0 | 0 | 0 |
| Paid media | 5.02 / 6.04 | 11 | 1 | 2 | 1 |
| Conversion y CRO | 5.03 / 6.05 | 3 | 0 | 0 | 0 |
| Oferta, pricing y AOV | 5.04 / 6.06 | 3 | 0 | 0 | 0 |
| Retencion, CRM y LTV | 5.05 / 6.07 | 9 | 1 | 2 | 2 |
| Unit economics y rentabilidad | 5.06 / 6.08 | 4 | 0 | 1 | 0 |
| Producto, catalogo e inventario | 5.07 / 6.10 | 2 | 1 | 0 | 0 |
| Operaciones y CX | 5.08 / 6.09 | 2 | 0 | 0 | 0 |
| Plataforma (no es metrica de negocio) | -- | 27 | 6 | 26 | 1 |

## Adquisicion y demanda -- bloques `5.01 / 6.03`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `shopify_attribution_by_channel` | Shopify | `shopify/insights-sections` | `shopify_demand_sources`, `report_confidence` | `shopify_order_facts` |

## Paid media -- bloques `5.02 / 6.04`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `ads_spend_summary` | propio | **--** | **--** | `meta_insight_rows_daily`<br>`meta_ad_accounts` |
| `meta_attribution_window_rank` | Meta | **sin uso** | **--** | **--** |
| `meta_audience_overview` | Meta | `meta/insights-sections` | `report_confidence` | `meta_custom_audiences`<br>`meta_ad_accounts`<br>`meta_ad_sets` |
| `meta_change_impact` | Meta | `meta/insights-sections` | `meta_change_log`, `report_confidence` | `meta_insight_rows_daily`<br>`meta_ad_accounts`<br>`meta_insight_action_metrics` +4 |
| `meta_creative_performance` | Meta | `meta/insights-sections` | `meta_creative_health`, `report_confidence` | `meta_insight_rows_daily`<br>`meta_ad_accounts`<br>`meta_insight_action_metrics` +3 |
| `meta_creative_ranking_distribution` | Meta | `meta/insights-sections` | `meta_creative_health`, `report_confidence` | `meta_insight_rows_daily`<br>`meta_ad_accounts` |
| `meta_learning_phase_status` | Meta | `meta/insights-sections` | `meta_delivery_health`, `report_confidence` | `meta_ad_sets`<br>`meta_campaigns`<br>`meta_ad_accounts` +2 |
| `meta_pixel_health` | Meta | `meta/insights-sections` | `meta_delivery_health`, `report_confidence` | `meta_pixels`<br>`meta_ad_accounts`<br>`meta_pixel_daily_stats` |
| `meta_spend_by_campaign` | Meta | `dashboard`<br>`panel` +2 | `meta_spend_detail` | `meta_insight_rows_daily`<br>`meta_ad_accounts`<br>`meta_insight_action_metrics` +1 |
| `meta_spend_daily` | Meta | `dashboard`<br>`panel` +2 | `meta_spend_detail` | `meta_insight_rows_daily`<br>`meta_ad_accounts` |
| `meta_spend_summary` | Meta | `meta/insights-sections`<br>`dashboard` +3 | `report_confidence` | `meta_insight_rows_daily`<br>`meta_ad_accounts`<br>`meta_insight_action_metrics` |

## Conversion y CRO -- bloques `5.03 / 6.05`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `shopify_checkout_recovery` | Shopify | `shopify/insights-sections` | `shopify_demand_sources`, `shopify_funnel_health`, `report_confidence` | `shopify_abandoned_checkouts` |
| `shopify_funnel_daily` | Shopify | `dashboard/client-dashboard`<br>`dashboard` +4 | `shopify_funnel_health` | `shopify_sessions_daily`<br>`shopify_abandoned_checkouts` |
| `shopify_funnel_summary` | Shopify | `dashboard/client-dashboard`<br>`dashboard` +4 | `shopify_funnel_health` | `shopify_sessions_daily` |

## Oferta, pricing y AOV -- bloques `5.04 / 6.06`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `shopify_discount_cost_by_code` | Shopify | `shopify/insights-sections` | `shopify_demand_sources`, `shopify_margin_health`, `report_confidence` | `shopify_order_facts`<br>`shopify_order_discount_applications` |
| `shopify_margin_summary` | Shopify | `dashboard/client-dashboard`<br>`dashboard` +4 | `shopify_margin_health` | `product_costs`<br>`shopify_order_items`<br>`shopify_order_facts` +1 |
| `shopify_top_products` | Shopify | `dashboard/client-dashboard`<br>`dashboard` +4 | `shopify_margin_health` | `shopify_order_items`<br>`shopify_order_facts`<br>`shopify_products` |

## Retencion, CRM y LTV -- bloques `5.05 / 6.07`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `klaviyo_email_inventory` | Klaviyo | `klaviyo/insights-sections` | `klaviyo_email_content`, `report_confidence` | `klaviyo_flow_messages`<br>`klaviyo_flows`<br>`klaviyo_flow_actions` +4 |
| `klaviyo_email_report` | Klaviyo | `klaviyo/insights-sections`<br>`integraciones/shared` +3 | `report_confidence` | `klaviyo_report_values`<br>`klaviyo_campaigns`<br>`klaviyo_flows` +3 |
| `klaviyo_link_clicks` | Klaviyo | **sin uso** | **--** | `klaviyo_email_click_events`<br>`klaviyo_accounts` |
| `klaviyo_measurement_health` | Klaviyo | `klaviyo/insights-sections` | `klaviyo_measurement_health`, `report_confidence` | `klaviyo_accounts`<br>`klaviyo_email_inventory`<br>`integration_sync_runs` +4 |
| `klaviyo_subject_performance` | Klaviyo | **sin uso** | **--** | `klaviyo_email_report` |
| `klaviyo_tracking_summary` | Klaviyo | **--** | `report_confidence` | `klaviyo_tracking_events` |
| `shopify_cohorts` | Shopify | `shopify/insights-sections` | `shopify_customer_health`, `report_confidence` | `shopify_order_facts` |
| `shopify_customer_recurrence` | Shopify | `shopify/insights-sections` | `shopify_customer_health`, `report_confidence` | `shopify_order_facts` |
| `shopify_customer_value` | Shopify | `shopify/insights-sections` | `shopify_customer_health`, `report_confidence` | `shopify_order_facts` |

## Unit economics y rentabilidad -- bloques `5.06 / 6.08`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `shopify_financial_monthly` | Shopify | `dashboard/client-dashboard`<br>`dashboard` +4 | **--** | **--** |
| `shopify_financial_summary` | Shopify | `admin/clientes`<br>`admin/consultores` +48 | `report_confidence` | `shopify_order_facts`<br>`organization_financial_settings`<br>`shipping_cost_rules` +3 |
| `shopify_sales_daily` | Shopify | `dashboard/client-dashboard`<br>`dashboard` +4 | `shopify_margin_health` | `shopify_order_facts` |
| `shopify_sales_summary` | Shopify | `tareas`<br>`dashboard/client-dashboard` +5 | `report_confidence` | `shopify_order_facts` |

## Producto, catalogo e inventario -- bloques `5.07 / 6.10`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `shopify_stock_risk_products` | Shopify | **--** | `report_confidence` | `shopify_order_items`<br>`shopify_order_facts`<br>`shopify_inventory_current_state` +3 |
| `shopify_stock_summary` | Shopify | `consultor`<br>`consultor/workbench` +7 | `report_confidence` | `shopify_inventory_current_state`<br>`shopify_inventory_items`<br>`shopify_variants` +1 |

## Operaciones y CX -- bloques `5.08 / 6.09`

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `shopify_delivery_times` | Shopify | `shopify/insights-sections` | `shopify_fulfillment_health`, `report_confidence` | `shopify_fulfillments`<br>`shopify_order_facts` |
| `shopify_return_rate_by_product` | Shopify | `shopify/insights-sections` | `shopify_fulfillment_health`, `report_confidence` | `shopify_order_items`<br>`shopify_order_facts`<br>`shopify_return_line_items` |

## Plataforma (no es metrica de negocio)

| Metrica (funcion SQL) | Conector | Pantalla | Tool de agente | Tablas que lee |
| --- | --- | --- | --- | --- |
| `accept_client_invite` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | **--** |
| `admin_agent_runtime_stats` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `agent_runs`<br>`agent_versions`<br>`agent_definitions` |
| `admin_consultant_ai_stats` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `consultant_assignments`<br>`agent_runs`<br>`agent_versions` +1 |
| `admin_organization_ai_stats` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `agent_runs`<br>`agent_versions`<br>`agent_definitions` |
| `agent_sql_gateway` | propio | **--** | **--** | **--** |
| `billable_store_count` | propio | `dashboard`<br>`integraciones/shared` | **--** | `integration_connections` |
| `consultant_business_rollup` | propio | `consultor`<br>`consultor/workbench` +44 | **--** | `shopify_order_facts`<br>`meta_insight_rows_daily`<br>`meta_insight_action_metrics` +1 |
| `consultant_klaviyo_by_org` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `klaviyo_campaigns`<br>`klaviyo_report_values` |
| `consultant_klaviyo_signals` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `integration_connections`<br>`integration_sync_runs`<br>`klaviyo_flows` +3 |
| `consultant_meta_by_org` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `meta_insight_rows_daily`<br>`meta_insight_action_metrics` |
| `consultant_meta_signals` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `meta_insight_rows_daily`<br>`meta_ad_accounts`<br>`integration_connections` +4 |
| `consultant_orders_by_org` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `shopify_order_facts` |
| `consultant_orders_by_store` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `shopify_order_facts`<br>`shopify_stores` |
| `consultant_orders_daily_by_org` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `shopify_order_facts` |
| `consultant_store_signals` | propio | `admin/clientes`<br>`admin/consultores` +44 | **--** | `agent_runs`<br>`agent_versions`<br>`agent_definitions` +1 |
| `context_order_mix` | propio | **--** | **--** | `shopify_order_facts` |
| `copilot_bank_organization` | propio | **sin uso** | **--** | `organization_members`<br>`organizations` |
| `copilot_tokens_consumidos` | propio | **--** | **--** | `agent_runs` |
| `es_consultor` | propio | `acceso`<br>`admin/clientes` +145 | **--** | **--** |
| `knowledge_search` | propio | `admin/conocimiento`<br>`conocimiento` +1 | **--** | `knowledge_chunks`<br>`knowledge_documents` |
| `knowledge_search_hybrid` | propio | `admin/conocimiento`<br>`conocimiento` +1 | **--** | `knowledge_chunks`<br>`knowledge_documents` |
| `link_client_invite` | propio | `planes`<br>`registro` | **--** | **--** |
| `maturity_business_facts` | propio | **--** | **--** | `shopify_order_facts`<br>`shopify_customers`<br>`shopify_products` +7 |
| `organization_activity_digest` | propio | **--** | `report_confidence` | `integration_sync_runs`<br>`tasks`<br>`alerts` +1 |
| `plazas_de_cartera_ocupadas` | propio | **--** | **--** | `consultant_assignments`<br>`organizations`<br>`client_invites` |
| `reorder_strategic_milestones` | propio | `camino`<br>`consultor` | **--** | `strategic_plan_milestones` |
| `reorder_strategic_phases` | propio | `camino`<br>`consultor` | **--** | `strategic_plan_phases` |
