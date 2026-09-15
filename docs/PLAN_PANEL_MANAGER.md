# Plan: el panel del manager

Del dashboard manual (hoja "Ecom Dashboard" + captura de AceiteCordoba) al producto. La captura
de referencia tiene 27 elementos; hoy el producto cubre 9. Este documento es la cola de ejecución.

**Referencia visual**: KPI primarios con costes desglosados → unit economics por pedido → ratios →
ads → diagnóstico hablado → 4 gráficos.

**Regla de terminado** (memoria "DoD: contrato + motor + pixel"): ningún bloque está hecho sin
migración que escriba/calcule, API que lo exponga y pantalla que lo muestre. Las tres cosas o
ninguna.

---

## F1 · El motor financiero de verdad  ✅ HECHO en desarrollo · pendiente de producción

Migración `20260929093000_panel_motor_financiero_real.sql`. Aplicada en *TEST ES IA*
(`kopcblejsxpkxoykldyh`); **falta `npm run db:push:prod`**.

Golden test reescrito y en verde 4/4 contra Postgres real: el beneficio del escenario baja de
403,80 € a 143,80 € por los dos términos que faltaban — 160 € de IVA que nunca fue tuyo y 100 €
de publicidad que sí pagaste.

Una sola migración, porque los cinco arreglos tocan la misma función
(`shopify_financial_summary`) y partirlos significa reescribirla cinco veces.

### 1.1 Ingresos sin IVA

Hoy `net_sales = current_total_price − refunds`: lleva dentro el IVA y el envío que paga el
cliente. Lo llamamos "facturación neta" y no lo es.

- `net_revenue_ex_tax = current_total_price − refunds − current_total_tax`
- `tax_collected`, `shipping_charged` (`current_shipping_price`) salen como columnas propias.
- `vat_pct` de `organization_financial_settings` **no se usa** para esto: el impuesto real por
  pedido ya viene de Shopify. `vat_pct` queda solo para tiendas sin desglose fiscal (fallback).
- Cuidado documentado: `refunds` es importe total del reembolso, IVA incluido. Se resta entero de
  `current_total_price`, así que el neto sin IVA de un pedido reembolsado queda ligeramente
  infravalorado. Se acepta y se anota; corregirlo exige traer las líneas de reembolso.

### 1.2 Envíos reales, no plano

- Coste: `shipping_cost_rules` (país + tramo de importe) con fallback a `default_shipping_cost`.
  La tabla existe desde DB-03 y nunca se ha leído.
- Ingreso: suma de `current_shipping_price`.
- `shipping_net = shipping_paid − shipping_charged` → la métrica "Envíos netos −1.453 €".

### 1.3 Ads dentro del beneficio  ← el fallo grave

`net_profit` no resta la inversión publicitaria. Con los números de la captura da 4.205 € en vez
de 1.810 €: **+132 %**. Y arrastra margen neto y break-even.

- Función nueva `ads_spend_summary(org, start, end, store)`: gasto real de todas las plataformas
  conectadas. Hoy solo Meta (`meta_insight_rows_daily`, scope por `meta_ad_accounts.store_id`);
  mañana Google entra por aquí sin tocar nada más.
- **ADR-0021 no lo prohíbe**: lo que no se suma entre plataformas es la *atribución*. El *gasto*
  es un coste real facturado, y sumarlo es la única forma de saber lo que ganas.
- `net_profit = net_revenue_ex_tax − COGS − fees − envío_pagado − fijos − ads_spend`.

### 1.4 Clientes nuevos y CAC blended

- `new_customers` se deriva en SQL: primer pedido por `customer_reference_hash` dentro del
  periodo. **No** se usa `is_first_customer_order`, porque el webhook no lo escribe y los pedidos
  que entran por webhook lo tienen a `null`.
- `cac_blended = ads_spend / new_customers` (el CAC de Meta sigue existiendo, etiquetado como
  atribuido — son dos cifras distintas y se muestran como tales).

### 1.5 Unit economics, MBEE y ROAS break-even

Todo por pedido, sobre las cifras ya calculadas:

| Métrica | Fórmula |
|---|---|
| `cogs_per_order` | COGS / pedidos |
| `shipping_per_order` | envío pagado / pedidos |
| `fixed_per_order` | fijos prorrateados / pedidos |
| `fixed_pct_revenue` | fijos / ingresos sin IVA |
| `cac_per_order` | ads / pedidos |
| `contribution_per_order` | AOV − cogs − envío − cac  (el "+8,39 €") |
| `mbee` | margen de contribución tras CAC (el "+1,51 €") |
| `breakeven_roas` | 1 / margen de contribución antes de ads (el "5,38") |

### Cómo se comprueba

`apps/api/src/db-03-financial-engine-golden.test.ts` fija hoy los números exactos del motor. La
migración lo rompe **a propósito**: se actualiza el escenario dorado con los términos nuevos
(IVA, envío cobrado, ads) y los valores recalculados a mano en la cabecera del test. Si el test
no se actualiza conscientemente, la migración no se cierra.

`npm run test:remote -w @ecomscaling/api` contra el proyecto de test.

---

## F2 · Serie mensual

`shopify_financial_monthly(org, months, store)` → una fila por mes con ingresos sin IVA y
beneficio neto. Hoy solo existe `shopify_sales_daily`, que agrupa por día y no devuelve beneficio.

La fórmula de F1 se extrae a una función interna reutilizable: el mes y el periodo tienen que dar
el mismo número o el gráfico contradice al KPI.

Índice que calce con el predicado de fecha (ADR-0006 pto 6).

---

## F3 · Contrato y API

- `packages/contracts`: los campos nuevos del resumen financiero.
- `apps/api/src/shopify-metrics.ts`: el resumen crece; se añade `financial_monthly` y el bloque
  `unit_economics`. Ojo al `statement_timeout` de 8 s que ya tumbó `/shopify/metrics` una vez
  (ver `20260903160000_shopify_funnel_sessions_only.sql`): las RPC nuevas no se lanzan a lo
  bruto en paralelo con las 10 existentes.
- Objetivos: `organization_metric_targets` (tabla poblada, nunca leída) entra en el payload para
  que cada card pinte su "objetivo 30 % / obj. 40 % / ≤11,37 €".

---

## F4 · El panel  (pixel)

Reordenar `apps/web/src/app/dashboard/page.tsx` a las cuatro bandas de la captura:

1. **KPI primarios** — beneficio neto, ingresos sin IVA, pedidos (+ clientes nuevos), **costes
   totales desglosados**.
2. **Unit economics por pedido** — las 5 cifras de F1.5.
3. **Ratios** — margen neto, conversión, recurrencia, AOV, atribución email. Cada uno con su
   objetivo.
4. **Ads** — ROAS vs break-even ROAS, CAC blended vs objetivo, inversión total desglosada por
   plataforma, MBEE, envíos netos.

Gráficos (Recharts ya está; `apps/web/src/components/ui/chart.tsx` tiene Area y Bar con los
tokens de ADR-0020):

- Barras mensuales ingresos + beneficio, 12 meses, mes actual destacado.
- Waterfall / desglose de costes totales.
- Embudo horizontal con % de caída entre pasos.

Recurrencia, cohortes, atribución por canal, recuperación de carrito, coste de descuentos, valor
de cliente y tiempos de entrega **ya existen en SQL** y hoy solo los leen los agentes
(`apps/api/src/shopify-insights.ts`). Aquí salen a pantalla: cero motor, solo UI.

Estilos: HeroUI v3 nativo, sin tokens legacy (memoria "HeroUI nativo").

---

## F5 · Embudo de 4 pasos

`20260903160000_shopify_funnel_sessions_only.sql` dejó el embudo en sesiones → pedidos por un
problema de coste de consulta, no de datos. Faltan añadir-al-carrito y pago-iniciado, que son
exactamente los dos pasos donde la captura localiza la fuga.

Primer paso: **mirar `shopify_sessions_daily.raw`**. La respuesta cruda de ShopifyQL se guarda
entera (ADR-0006 pto 8) y es probable que las columnas ya estén ahí sin modelar. Si están, es
una migración de tres columnas y un mapper; si no, se amplía la consulta ShopifyQL del bloque
`sessions`.

---

## F6 · YoY

Hoy solo se compara con el periodo anterior del mismo largo. Añadir la ventana del año anterior
como tercera comparación (`previous_year`), reusando el mismo camino que ya existe para
`previous_period`.

---

## F7 · Dinero sobre la mesa

Escenarios cuantificados: "precio/mezcla al 60-70 % de margen → +1.082 €/mes", "email al 40 % →
+640 €/mes".

Esto **no es un dato, es un motor de oportunidad**: cada escenario es una regla explícita
(métrica actual + objetivo de `organization_metric_targets` + volumen del periodo) que se
documenta y se puede auditar. Nada de números redondos que salen de ningún sitio.

Va al final a propósito: depende de F1 (el margen real) y de F3 (los objetivos).

---

## F8 · Google Ads

**Sí es posible.** La API existe, es estable y da lo que necesitamos (gasto, conversiones, coste
por conversión por campaña/día). El trabajo técnico es el de siempre; lo que manda el calendario
son los permisos de Google.

Lo que hace falta antes de escribir código:

1. **Developer token** con acceso *Basic*, pedido desde una cuenta de Google Ads Manager (MCC).
   Google lo revisa a mano: días, a veces semanas, y puede pedir explicación del uso. Con acceso
   *Test* se puede desarrollar contra cuentas de prueba mientras tanto.
2. **Cliente OAuth** en Google Cloud con el scope `adwords`, y verificación de la app (pantalla
   de consentimiento) para que la use gente fuera del equipo.
3. **El cliente concede acceso** a su cuenta, igual que en Shopify/Meta.

Y luego, ADR-0006 desde el primer commit: tablas con upsert in-place, sync por bloques con su
fila en `integration_sync_runs`, import completo + incremental con el mismo código, backoff ante
rate limiting, métricas en SQL `stable`, escrituras con service role.

Encaje: `ads_spend_summary` de F1.3 ya suma por plataforma. Cuando Google entre, la inversión
total y el CAC blended se corrigen solos sin tocar el panel. La atribución de Google **no se
suma** a la de Meta (ADR-0021): cada cifra con su ventana y su fuente.

**Bloqueador externo, no técnico.** Va a `BLOQUEADORES_EXTERNOS_Y_ACTIVACION.md`: el paso 1 se
puede lanzar hoy y correr en paralelo a F1-F7.

---

## Fuera de alcance

- **Horas ahorradas / tareas entregadas** como KPI: no hay dato que lo sostenga. Las tareas sí
  existen (`tasks`), las horas serían inventadas. Si se quiere la banda de valor del servicio,
  primero hay que decidir de dónde sale el número.
