# ECO-001 | ROAS, CPA y rentabilidad de ecommerce

**Estado:** candidato prioritario. **Fuente:** [VÍDEO] ~27:55–29:30. **Fórmulas:** [INFERENCIA] formalizada del ejemplo económico del vídeo, no código existente de e-NORA.

## Fundamentos

- `ROAS = ingresos_atribuidos_a_anuncios / gasto_publicitario` cuando ambos utilizan criterio de atribución compatible.
- `CPA_compra_atribuida = gasto_publicitario / número_de_compras_atribuidas` (no equivale necesariamente a CAC de cliente nuevo).
- **Contribución antes de anuncios** (por pedido) = ingresos netos comerciales del pedido − costes variables atribuibles excluyendo anuncios.
- **CPA break-even** por primera compra ≈ contribución antes de anuncios por pedido, si cada adquisición corresponde a un pedido comparable y no se contabiliza recompra/LTV.
- **ROAS break-even simplificado** = AOV comparable / contribución antes de publicidad por pedido, si hay contribución positiva y definiciones consistentes.
- **CPA máximo con objetivo de beneficio** = contribución antes de anuncios − beneficio deseado por pedido.
- **ROAS objetivo simplificado** = AOV / CPA máximo, si CPA máximo > 0.

## Ejemplo didáctico, NO dato de cliente

Venta media 100 €, costes variables sin publicidad 60 €, contribución antes de anuncios 40 €: break-even CPA 40 €, ROAS break-even 2,5x. Si se pretende retener 20 € de beneficio por pedido después de publicidad, CPA máximo 20 € y ROAS objetivo 5x. Este ejemplo no incorpora costes fijos, impuestos corporativos ni LTV.

## Datos económicos requeridos

AOV, unidades/pedido, costes de producto, descuentos, embalaje, preparación, transporte, comisiones de pasarela, incidencias, devoluciones, impuestos y cualquier coste variable relevante. Documentar si gastos de envío pagados por cliente se incluyen en ingresos netos y si el IVA se excluye en las comparaciones. Especificar periodo y moneda.

## Guardrails económicos

- Si costes no están disponibles o no son fiables, etiquetar “ROAS observado, rentabilidad desconocida”; **prohibido** decir “campaña rentable”.
- ROAS Meta es atribuido, no venta incremental probada. Pedidos Shopify = ingresos reales bajo sus propios filtros; no se pueden sumar ingresos atribuidos por plataformas como si fueran ventas independientes.
- Considerar devoluciones, márgenes por SKU, mix de productos y costes de adquisición de clientes nuevos.
- No usar LTV para justificar pérdidas sin modelo de cohortes y evidencia de recurrencia.
- Cálculos financieros deben ser deterministas; la IA interpreta, no inventa cifras ni reemplaza el motor matemático.

## Tests mínimos sugeridos

Margen positivo y negativo, margen cero, gasto cero, compras cero, divisa mixta, ingresos atribuidos > ingresos reales, cancelaciones/devoluciones, coste ausente, una compra por cliente versus recompras y diferencias de ventana temporal.
