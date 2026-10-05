# E-NORA synthetic 12-month seed

Scenario: `enora_12m_v1`  
Source marker: `source=synthetic`  
Window: 2025-10-04 through 2026-10-03 (365 complete days)  
Normalized currency: EUR  
Normalized timezone: Europe/Madrid

## Target

The seed reuses the existing connected test tenant and provider accounts:

- Supabase project: `TEST ES IA`
- organization: `prueba-borrego`
- Shopify store: `e-nora-demo.myshopify.com`
- Meta account: `act_946548861093802`
- Klaviyo account: `WjvTcC`

It does **not** create another Shopify store, another integration connection, or another provider account. The user who owns `prueba-borrego` keeps the existing access model.

## Safety contract

- The seed refuses the configured production Supabase project.
- The target organization, Shopify store, Meta account and Klaviyo account must already exist.
- All three provider connections must already be in `connected` state.
- The exact eight E-NORA Demo products and variants must already be synced from Shopify.
- The seed refuses to overwrite any non-synthetic Shopify session row inside the 12-month seed window.
- The seed never calls Shopify, Klaviyo or Meta provider APIs.
- No provider connection is created by the seed.
- Klaviyo synthetic campaigns remain `draft`; no messages are sent.
- Meta synthetic campaign/ad-set/ad database rows remain `PAUSED`.
- No synthetic clicks, conversions, impressions or spend are inserted into Meta itself.
- With `META_TEST_MODE=true`, backend safe mutations block activation/publication and transitions to `ACTIVE`.

## Provider facts vs synthetic facts

Provider facts reused from the existing integrations:

- the real E-NORA Demo Shopify store row and connection
- the eight current E-NORA products/variants, IDs and prices
- the existing Meta ad account row for `act_946548861093802`
- the existing Klaviyo account row for `WjvTcC`
- provider currency/timezone values, retained in synthetic metadata where available

Synthetic facts:

- customers, sessions, carts, checkouts, orders and UTM journeys
- Meta historical performance
- Klaviyo historical delivery/performance
- synthetic Meta child rows used only by E-NORA analytics
- synthetic Klaviyo draft campaign rows and sampled profile-level event trails

Every synthetic row with a JSON/source surface carries `source=synthetic` and `scenario_id=enora_12m_v1`. Shopify rows without a JSON source column use deterministic `syn_*` external IDs and tags such as `synthetic` and `scenario:enora_12m_v1`.

## Cross-channel source of truth

Synthetic Shopify orders are the conversion truth for the scenario.

Meta purchases/revenue correspond to the same orders with:

`utm_source=facebook&utm_medium=paid_social`

Klaviyo purchases/revenue correspond to the same orders with:

`utm_source=klaviyo&utm_medium=email`

This makes cross-channel reconciliation deterministic instead of generating three independent histories.

## Meta base and derived metrics

Daily base metrics:

- impressions
- reach
- spend
- clicks
- link clicks
- outbound clicks
- landing page views
- add to cart
- initiate checkout
- purchases
- attributed revenue

Derived metrics:

- frequency = impressions / reach
- CTR (%) = clicks / impressions * 100
- CPC = spend / clicks
- CPM = spend / impressions * 1000
- CPA = spend / purchases
- ROAS = attributed revenue / spend

Derived values retain formula and formula-version metadata.

## Klaviyo metrics

Daily aggregates include:

- recipients
- delivered
- opens
- clicks
- bounces
- unsubscribes
- purchases
- attributed revenue

Synthetic profiles and sampled click/purchase events use the same Shopify customer/order/product IDs and the same email UTMs.

## Scenarios

The year intentionally contains:

- baseline
- Black Friday
- creative fatigue
- checkout friction
- email recovery
- tracking anomaly
- profitable scaling
- stockout
- email deliverability issue
- recovery

## Idempotency

The scenario uses deterministic customer/order IDs and provider-child external IDs. Natural unique constraints are used where the existing schema already supplies them.

Klaviyo daily synthetic metrics are replaced only for `scenario_id=enora_12m_v1`, then recreated, so a rerun does not double-count them.

## Expected E-NORA surfaces

The dataset supports:

- Shopify revenue, orders, AOV and sales trend
- Shopify sessions and conversion funnel
- product sales mix and customer recurrence
- UTM/channel attribution
- Meta spend, impressions, reach, frequency, CTR, CPC, CPM, CPA and ROAS
- Meta campaign/ad-set/ad funnel performance
- Klaviyo delivery, open, click, bounce and unsubscribe performance
- Klaviyo attributed orders and revenue
- channel comparison and anomaly detection
- diagnostic scenarios for checkout friction, tracking loss, creative fatigue, stockout and deliverability

## Commands

Validation:

```bash
npm run test:seed:enora:12m
```

Execution is opt-in and must point to the isolated test Supabase project:

```bash
ALLOW_ENORA_SYNTHETIC_SEED=true npm run seed:enora:12m
```

Never run the seed against production.
