# Datos requeridos y huecos por auditar | Meta, Shopify y Klaviyo

**Objetivo:** listar capacidades hipotéticas necesarias; **NO afirma** que el repo ni los conectores actuales proporcionen estos campos.

| Necesidad | Fuente posible | Campos/criterios | Riesgo |
|---|---|---|---|
| Inversión/meta objetivos | Meta Ads | `campaign_id`, `adset_id`, `ad_id`, `spend`, objetivo, fechas, moneda | permisos, límites API, retraso |
| Señal de resultado | Meta Ads | compras atribuidas, valor, clics, impresiones, periodo, atribución | discrepancias contra Shopify |
| Densidad de señal | Meta Ads | eventos por periodo y unidad, observación de aprendizaje si accesible | señal parcial, optimización no observable |
| Cambios históricos | Meta Ads / logs propios | cambios de presupuesto/estructura, timestamps | puede no haber historial completo |
| Valor económico | Shopify + costes internos | net sales, descuentos, devoluciones, COGS y costes variables | COGS/fulfillment pueden faltar |
| Cohortes/retención | Shopify | cliente pseudonimizado, first order, repeat orders, fechas | privacidad, atribución de clientes nuevos |
| Recompra y flujos | Klaviyo/Shopify | señales de campañas/flujos, ventas y retención coherentes | doble atribución, no es incrementalidad |
| Activos orgánicos | Meta/Instagram con permisos | impresiones, alcance, interacción, asset, fecha | permisos/endpoint/no acceso al asset |
| Competencia | Fuente pública autorizada | copy/formato/fecha inicio visibles | no acceso a ingresos de competidores |
| Seguridad | Sistema e-NORA | aislamiento por tenant, RLS, permisos y borrado | fuga entre clientes |

## Unidades y definiciones

- Distinguir moneda de cuenta Meta y moneda de tienda. No sumar sin conversión fiable y registro de tipo de cambio.
- Igualar ventanas temporales y husos horarios; conservar regla de atribución de Meta cuando se compare.
- `purchase Meta` (atribuida) ≠ `order Shopify` (transacción). No realizar reconciliación uno a uno si la fuente no lo garantiza.
- `revenue Klaviyo` puede compartir pedidos con ventas atribuidas a Meta. No sumar como ingresos independientes.
- `LTV` de ingresos ≠ `contribution LTV`; indicar periodo de cohorte.
- En tráfico orgánico, distinguir impresiones de visualizaciones y alcance; acceso a métricas o asset puede estar restringido.

## Preguntas para auditoría

¿Cuáles son los endpoints/syncs activos? ¿Hay historical change logs? ¿Se guardan objetivos por nivel? ¿Se puede leer un estado learning real o no? ¿Existe campo COGS neto? ¿Hay imputación de shipping, devoluciones y impuestos? ¿El agente usa tools fiables o solo extractos RAG? ¿Se guardan PII/embeddings por tenant o compartidos? ¿Cómo se deduplican pedidos y resultados atribuidos?

## Condición de aceptación

Por cada métrica usada en una recomendación, declarar fuente, versión de sync, fiabilidad, ventana, unidad, nivel de agrupación y método de cálculo. Sin datos suficientes, declarar «No verificable con las integraciones actuales».
