# Propuesta: grafo de capacidades (D03) y relaciones entre métricas (D06)

**Estado: borrador para validar.** Nada de esto se ha insertado en la base de
datos. Cuando lo valides (tachando, cambiando o añadiendo filas), se convierte en
una migración idempotente y los motores lo leen en la siguiente pasada nocturna
sin tocar código.

Por qué hace falta tu validación: el artefacto de D03 escribe solo 7 aristas, y
D06 solo tiene la relación aritmética ventas = pedidos × ticket. El resto es
conocimiento de ecommerce, no del documento, y ponerlo a ojo sin revisar es
inventar umbrales.

## 1. Grafo de capacidades (`capability_dependencies`)

Ya existen (del artefacto, apartados 13 y 14):

| Capacidad | Depende de | Tipo |
|---|---|---|
| acquisition | inventory | requires |
| acquisition | finance | requires |
| acquisition | creative | requires |
| acquisition | conversion | requires |
| acquisition | operations | requires |
| acquisition | data | requires |
| acquisition | creative | ceiling |

`requires`: no se puede escalar A por encima de lo que necesita sin que B llegue
a lo suyo (guardrail 24). `ceiling`: B por debajo de A pone techo al crecimiento
de A (apartado 14).

Propuestas nuevas:

| # | Capacidad | Depende de | Tipo | Por qué |
|---|---|---|---|---|
| C1 | retention | data | requires | Sin identidad de cliente ni eventos no hay segmentación ni flujos que midan nada. |
| C2 | retention | product | requires | La recompra depende de que el producto merezca volver; el CRM no la crea. |
| C3 | retention | operations | requires | Una mala entrega anula cualquier flujo de post-compra. |
| C4 | conversion | technology | requires | La conversión no se optimiza sobre una tienda lenta o inestable. |
| C5 | conversion | offer | requires | El CRO no compensa una oferta que no convence. |
| C6 | conversion | data | requires | Optimizar conversión exige medir el embudo. |
| C7 | offer | unit_economics | requires | Descuentos y precios sin margen conocido regalan dinero. |
| C8 | unit_economics | finance | requires | La economía unitaria necesita costes registrados. |
| C9 | inventory | finance | requires | Comprar stock exige caja y previsión. |
| C10 | inventory | data | requires | Reponer sin ventas por referencia es adivinar. |
| C11 | operations | inventory | requires | No se puede cumplir lo que no está en stock. |
| C12 | creative | product | requires | La creatividad comunica un producto; no lo sustituye. |
| C13 | strategy | data | requires | Decidir la dirección exige saber qué funciona. |
| C14 | acquisition | unit_economics | ceiling | El CAC que se puede pagar lo fija el margen: por encima, crecer destruye valor. |
| C15 | retention | team | ceiling | Los flujos y campañas necesitan quien los mantenga. |
| C16 | acquisition | technology | ceiling | El tracking y la velocidad de la web limitan cuánto se puede escalar en pago. |
| C17 | operations | team | ceiling | El volumen que se puede preparar lo pone el equipo o el 3PL. |

## 2. Relaciones entre métricas (`metric_dependencies`)

Ya existe: `net_sales` → `orders_count` (component).

Tipos que admite la tabla: `component` (A se calcula a partir de B),
`derived_from` (A se obtiene de B por una fórmula) y `shares_input` (A y B
comparten un dato de entrada, así que se mueven juntas sin que una cause la otra).

Propuestas nuevas, limitadas a métricas que ya calculamos:

| # | Métrica | Depende de | Tipo | Por qué |
|---|---|---|---|---|
| M1 | net_sales | average_order_value | component | Ventas = pedidos × ticket medio: la otra mitad de la relación que ya existe. |
| M2 | orders_count | sessions | component | Pedidos = sesiones × conversión. |
| M3 | orders_count | conversion_rate | component | La otra mitad de M2. |
| M4 | conversion_rate | sessions | shares_input | Comparten denominador: si cambia el tráfico (más frío), baja la conversión sin que nada se rompa. |
| M5 | average_order_value | discount_rate | derived_from | Más descuento baja el ticket neto. |
| M6 | contribution_per_order | average_order_value | component | Contribución = ticket − coste de producto − envío − comisión. |
| M7 | contribution_per_order | shipping_cost_per_order | component | Lo mismo, por el lado del envío. |
| M8 | cac_blended | meta_spend | component | CAC = gasto ÷ clientes nuevos. |
| M9 | cac_blended | new_customers | component | La otra mitad de M8. |
| M10 | roas_attributed | meta_spend | shares_input | Comparten el gasto: subir presupuesto baja el ROAS marginal sin que la campaña empeore. |
| M11 | repeat_order_rate | orders_count | shares_input | Una ola de clientes nuevos baja la tasa de recompra sin que se pierda a nadie. |
| M12 | refund_rate | orders_count | shares_input | Las devoluciones llegan con retraso respecto al pedido: comparten base pero no ventana. |

**Para validar:**

- Tacha las filas que no quieras.
- Cambia `requires` por `ceiling` donde creas que es techo y no requisito.
- Dime si falta alguna relación que veas en tus clientes.

Aviso: D05 solo emite señales de `net_sales` y `orders_count`. Las filas con
otras métricas se quedan preparadas y empiezan a servir cuando D05 emita señales
de ellas.
