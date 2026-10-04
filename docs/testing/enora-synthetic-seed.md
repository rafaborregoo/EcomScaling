# E-NORA synthetic 12-month seed

Scenario: `enora_12m_v1`  
Source marker: `source=synthetic`  
Window: 2025-10-04 through 2026-10-03 (365 complete days)  
Normalized currency: EUR  
Normalized timezone: Europe/Madrid

## Safety contract

- The seed refuses the configured production Supabase project.
- The target tenant slug must start with `enora-synthetic-`.
- If the tenant already contains a non-synthetic integration connection, the seed refuses to run.
- The seed never calls Shopify, Klaviyo, or Meta provider APIs.
- Klaviyo provider campaigns are never sent. Synthetic campaign definitions stay `draft`.
- Meta provider metrics/events are never forged. Synthetic Meta history exists only in the isolated E-NORA database.
- With `META_TEST_MODE=true`, backend safe mutations block activation/publication and transitions to `ACTIVE`; DRAFT/PAUSED writes remain possible.

## Provider facts vs synthetic facts

Provider facts captured from connected MCPs and mirrored into the scenario:

- Shopify store name/domain, original currency/timezone.
- The eight current E-NORA demo products, product IDs, variant IDs, SKUs and current prices.
- Meta test ad account reference `946548861093802`.

Synthetic facts:

- Customers, sessions, carts, checkouts, orders and attributed journeys.
- Meta historical performance.
- Klaviyo historical delivery/performance and sampled profile-level event trails.
- Campaign/ad-set/ad rows used by E-NORA analytics. Their provider draft IDs are null until a real DRAFT/PAUSED hierarchy is created through the provider.

Every synthetic row that has a JSON/source surface carries `source=synthetic` and `scenario_id=enora_12m_v1`. Shopify rows without a JSON source column use deterministic `syn_*` external IDs and tags such as `synthetic` and `scenario:enora_12m_v1`.

## Meta base and derived metrics

Base metrics generated daily:

- impressions
- reach
- spend
- clicks
- inline/link clicks
- outbound clicks
- landing page views
- add to cart
- initiate checkout
- purchases
- attributed revenue

Derived metrics are calculated from those base values and persisted with formula/version metadata:

- frequency = impressions / reach
- CTR (%) = clicks / impressions * 100
- CPC = spend / clicks
- CPM = spend / impressions * 1000
- CPA = spend / purchases
- ROAS = attributed revenue / spend

## Cross-channel identity

The scenario uses deterministic identifiers so reruns update the same logical records:

- customers: `syn_customer_0001`...
- orders: `syn_order_YYYYMMDD_NNNN`
- Meta UTM: `utm_source=facebook&utm_medium=paid_social&utm_campaign=enora_meta_<campaign>`
- Klaviyo UTM: `utm_source=klaviyo&utm_medium=email&utm_campaign=enora_email_YYYYMM_promo`

Klaviyo purchase events carry the same synthetic Shopify order ID and product/variant identifiers used by the order. Meta is aggregate-only: no fabricated click/user events are written to Meta.

## Scenarios

The 12 months deliberately contain normal, good, bad and anomalous periods:

- baseline
- Black Friday scaling
- creative fatigue
- checkout friction
- email recovery
- tracking anomaly
- profitable scaling
- product stockout
- email deliverability issue
- recovery

## Expected E-NORA surfaces

The data is intended to drive:

- Shopify revenue/orders/AOV and daily sales charts
- Shopify sessions, conversion funnel and journey/UTM attribution
- product sales mix and repeat-customer behavior
- Meta spend, impressions, clicks, CTR, CPC, CPM, CPA, ROAS
- Meta campaign/ad-set/ad performance and funnel ratios
- Klaviyo delivered/open/click/bounce/unsubscribe metrics
- Klaviyo attributed orders/revenue
- cross-channel acquisition vs email vs organic comparisons
- anomaly detection for tracking loss, funnel friction, creative fatigue, stockout and deliverability

## Commands

Validation only:

```bash
npm run test:seed:enora:12m
```

Execution requires an isolated test/dev Supabase project and explicit opt-in:

```bash
ALLOW_ENORA_SYNTHETIC_SEED=true npm run seed:enora:12m
```

Do not run the seed against the production project.
