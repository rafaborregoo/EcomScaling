# ECO-SB-001 | Economía de adquisición, ROAS, contribución, LTV y escala

**Estado:** candidato · **Fuente:** [FUENTE] ~20:17–25:50.

## Qué aporta la fuente

El ponente cuestiona objetivos de ROAS arbitrariamente altos. Argumenta que un ROAS menor puede ser rentable con buenos márgenes, que conviene comparar gasto por adquisición con valor económico del cliente y que al escalar interesa el **beneficio absoluto**, no solo la eficiencia porcentual. Añade que algunas empresas toleran pérdida en la primera transacción por recurrencia futura, sujeto a caja y retención.

## Separar rigurosamente las métricas [PROPUESTA e-NORA]

- `ROAS_atribuido = ingresos_atribuidos_por_Meta / gasto_ads_Meta` para la misma ventana, moneda y regla de atribución; **no representa beneficio**. (Aquí «Meta» debe ser el nombre canónico del campo en el código.)
- `CPA_compra_atribuida = gasto_ads / compras_atribuidas`, **no necesariamente** `CAC_nuevo_cliente`.
- `CAC_nuevo_cliente = coste_adquisicion_asignado / clientes_nuevos_adquiridos` solo con metodología de atribución y costes consistente.
- `contribucion_por_pedido_antes_ads = ingreso_neto_del_pedido − COGS − fulfillment − envíos_pagados_por_tienda − comisiones − otros_costes_variables`.
- `CPA_break_even_primera_compra ≈ contribucion_por_pedido_antes_ads` si una compra adquirida representa un pedido, no hay otros costes de adquisición omitidos y el objetivo es equilibrio de contribución de primera compra.
- `LTV` debe tener **horizonte y base**: ingresos LTV ≠ margen de contribución LTV. No usar ingresos históricos como dinero libre disponible para marketing.
- `beneficio_absoluto` debe calcularse con costes reales y periodo definido; **no se deriva únicamente de ROAS**.

## Ejemplo hipotético (NO procede del vídeo)

Pedido neto 80 €, costes variables previos a publicidad 45 € → contribución 35 €. Si el objetivo de contribución posterior a publicidad es 15 €, el CPA de compra objetivo máximo bajo las hipótesis anteriores es 20 € y el ROAS objetivo orientativo es 80/20 = 4x. El break-even de primera compra sería ROAS ≈ 80/35 = 2,29x. Cifras ilustrativas, sin costes fijos ni devoluciones futuras.

## Decisión de escalado [PROPUESTA e-NORA]

Requerir contribución/beneficio incremental esperado, coste de capital/caja, días de recuperación del CAC, dispersión de resultados, atribución, retención demostrada, límite de riesgo y saturación. Una reducción del ROAS al crecer **es posible, no inevitable**; analizar el retorno marginal del nuevo gasto.

## Retención y Klaviyo

Si se dispone de datos fiables, estudiar recompra, cohortes, tasa de retención y contribución acumulada, evitando sumar la atribución de Klaviyo al ingreso atribuido de Meta como si fueran ventas independientes. El valor de clientes futuros es previsión, no caja obtenida.

## Respuestas prohibidas

- «Tienes ROAS 5, por tanto eres rentable» sin costos.
- «Puedes adquirir un cliente con pérdidas indefinidamente porque hay LTV» sin evidencia de retención/caja.
- «El cliente vale 2.000 €, por tanto puedes gastar 500 €» sin contribución, horizonte, churn y financiación.

## Solapamiento

**Muy alto** con primer pack `ECO-001_roas_cpa_margenes_rentabilidad.md`, `META-006` y fuente de verdad económica existente. Aporta ampliar con **beneficio absoluto vs ratio, CAC recuperable, recurrencia y disciplina de caja**; no crear segundo motor de cálculo.
