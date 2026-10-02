# ADR-0021 - Ingresos atribuidos entre integraciones (Klaviyo, Meta, Shopify)

## Estado

Aprobada.

## Contexto

Los tres modulos de integracion del roadmap (Shopify, Meta Ads, Klaviyo) exponen
"ingresos" que **no son la misma magnitud**:

- **Shopify** es la facturacion real: pedidos que existieron
  (`shopify_sales_summary`, `consultant_orders_by_org`). Fuente de verdad.
- **Klaviyo** devuelve, via su Reporting API (`campaign-values-report` /
  `flow-values-report`, ver `apps/api/src/klaviyo-sync.ts` ->
  `klaviyo_report_values.revenue` / `raw_data.statistics.conversion_value`), los
  ingresos que **Klaviyo se atribuye** a una campana o flow: pedidos de perfiles
  que abrieron/clicaron un email dentro de la ventana de atribucion de Klaviyo
  (por defecto ~5 dias click en email). La atribucion la calcula Klaviyo, no
  nosotros. Depende de que el cliente tenga la integracion nativa Shopify->Klaviyo
  hecha **en su propia cuenta de Klaviyo** y de que haya elegido una metrica de
  conversion (`klaviyo_accounts.conversion_metric_id`, normalmente "Placed
  Order").
- **Meta** devuelve `purchase` / `omni_purchase` action values en
  `meta_insight_action_metrics` (ver `meta_spend_summary`,
  `consultant_meta_by_org`): pedidos que **Meta se atribuye** con su modelo
  (7 dias click / 1 dia view por defecto). Tambien lo calcula Meta.

Klaviyo, Meta y Google se apuntan **los mismos pedidos** bajo modelos distintos.
Sumar "ingresos Klaviyo" + "ingresos Meta" supera la facturacion neta de Shopify
y no representa ingreso incremental. El widget "Email - campanas por cliente" y
la tarjeta "Meta Ads - cartera" del dashboard del consultor ya muestran estas
cifras; cualquier vista o agente futuro que las combine debe respetar las reglas
de abajo.

## Decision

### 1. Nunca sumar ingresos atribuidos entre plataformas

Ninguna vista, KPI, funcion SQL ni contexto de agente suma
`klaviyo revenue + meta purchase_value` (ni con Google cuando exista). Cuando
aparezcan juntos:

- Ancla = facturacion neta de **Shopify** del mismo periodo.
- Cada plataforma se presenta como **cuota de esa facturacion**
  (`dependency_pct`, como ya hace `listConsultantMetaPortfolio`), no como sumando.
- Etiqueta explicita: "atribuido por Klaviyo", "atribuido por Meta". Nunca
  "ingresos generados" a secas ni "incremental".

### 2. Cada cifra atribuida viaja con su modelo

Se guarda y se muestra, por plataforma y cuenta:

- La **metrica de conversion** usada (Klaviyo: `conversion_metric_id` +
  `conversion_metric_name` + `conversion_metric_source`, ya en
  `klaviyo_accounts`).
- La **ventana de atribucion** cuando el proveedor la expone (Klaviyo account
  settings, Meta `action_attribution_windows`). Si el modulo aun no la trae, es
  deuda explicita del modulo, no un dato opcional.

El consultor necesita esto para explicar por que el numero no cuadra ni con
Shopify ni con el panel nativo de la plataforma.

### 3. Stream first-party en paralelo, independiente de cada plataforma

Ademas de consumir la atribucion del proveedor, cada pedido entra crudo desde
**nuestros** webhooks de Shopify (`orders/create` ->
`recordShopifyOrderTracking` -> `klaviyo_tracking_events`, "Placed Order" con
`value = total_price`). Este stream no depende de la API de atribucion de nadie
y es la base de una atribucion first-party futura.

Para que esa atribucion sea posible mas adelante, `recordShopifyOrderTracking`
debe capturar en `properties` los campos de atribucion del pedido **aunque hoy no
se usen**: `landing_site`, `referring_site`, UTMs y `note_attributes`. Capturar
tarde = sin historico.

### 4. Gates de activacion y logs de diagnostico por dependencia externa

Siguiendo ADR-0006 pto. 8, cada modulo delata cuando un supuesto no se cumple:

- **Klaviyo**: si `conversion_metric_id` no esta elegido, `runKlaviyoReport`
  falla con `conversion_metric_not_selected` y la integracion se marca
  **incompleta** (no "rendimiento bajo"). El onboarding fuerza la eleccion.
- **Klaviyo**: si Shopify tiene pedidos en el periodo pero la Reporting API
  devuelve 0 "Placed Order", el cliente no tiene el link Shopify->Klaviyo hecho
  en su Klaviyo; log de diagnostico + aviso, no cifra silenciosa a cero.
- **Meta**: si hay `spend > 0` y `purchases == 0` con dias de datos suficientes,
  probable pixel/CAPI mal configurado en la cuenta del cliente; ya penalizado en
  el score de `consultant_meta_by_org`, mantener el aviso.

### 5. Los agentes reciben el matiz en su contexto

Los agentes de operativa (a12 email, a13 Shopify, a14 Meta) reciben las cifras
como "EUR **atribuidos por** Klaviyo/Meta", con su ventana y metrica, nunca como
"EUR incrementales" ni "EUR generados". Sin ese encuadre aconsejan sobre una
magnitud que no existe (p. ej. recomendar recortar Meta porque "solo aporta el
20%" cuando ese 20% se solapa con el de Klaviyo).

## Consecuencias

- El widget "Email - campanas por cliente" y "Meta Ads - cartera" quedan sujetos
  a estas reglas; una futura vista "mix de canales" nace sabiendo que es un
  reparto de la facturacion de Shopify, no una suma.
- `recordShopifyOrderTracking` gana campos de atribucion en `properties` en la
  proxima iteracion del modulo Shopify.
- Cada modulo (Klaviyo, Meta) incluye la ventana de atribucion en su sync como
  parte del alcance, no como mejora posterior.
- Complementa ADR-0006 (patron de modulo) y ADR-0019 (resiliencia de agentes);
  root `CLAUDE.md` ya referencia `docs/decisions/`.
- Cross-channel attribution: conocimiento en `conocimiento/fase-10/` (10.01
  principios, 10.02 contrato, 10.04 guardrails); contrato en codigo en
  `packages/contracts/src/cross-channel-attribution.ts`. Klaviyo no expone su
  ventana de atribucion por API: viaja como desconocida, no como default.
