# META-004 | Diagnóstico del embudo anuncio → tienda → compra

**Estado:** candidato prioritario. **Fuente:** [VÍDEO] ~25:34–27:15. **Ampliaciones a Shopify/Klaviyo:** [PROPUESTA e-NORA].

## Secuencia observacional

Entrega/impresiones → clics salientes → visitas reales de landing → vistas de producto → añadidos al carrito → checkout iniciado → compras → margen. El vídeo enumera gran parte de estas fases y propone diagnosticar el punto donde se pierden usuarios. La separación explícita de vistas de producto y checkout en una cadena única es organización analítica de esta ficha.

| Patrón observado | Hipótesis a investigar, no conclusión | Datos de contraste |
|---|---|---|
| Impresiones con clic saliente muy bajo | Ángulo, oferta, audiencia, mensaje o formato | CTR saliente, CPM, creativo, oferta, comparables |
| Clics salientes sin landing views equivalentes | Página lenta, redirecciones, tracking, clics de baja calidad | Sesiones/landing views, tiempos de carga si existen, errores |
| Visitas con pocos carritos | Ajuste producto/audiencia, precio, confianza, contenido | Ficha de producto, precio, ATC, cohortes, histórico |
| Carritos con checkouts bajos | Fricción, costes visibles, UX del carrito | Carritos, checkout, envío/condiciones, histórico |
| Checkouts con pocas compras | Pagos, costes finales, errores, confianza | Checkout, transacciones, medios de pago si existen |
| Ventas con resultado económico malo | Margen insuficiente, CPA, descuento, logística, devoluciones | Shopify + Meta + costes reales |

## Reglas mínimas de análisis

1. Comparar mismo periodo, zona horaria y definiciones.
2. Calcular ratios solo con denominadores compatibles, distintos de cero y suficientes.
3. Evaluar cambios frente a histórico comparable, no con un umbral universal inventado.
4. Identificar fuente de cada métrica; Meta puede atribuir más/menos conversiones que Shopify.
5. Etiquetar `observado`, `hipótesis`, `confianza`, `datos_faltantes`, `siguiente_comprobación`.
6. No atribuir causas técnicas, problemas de UX o saturación de audiencia sin evidencia corroborativa.

## Ejemplo [PROPUESTA e-NORA]

“En los últimos 14 días el porcentaje de clics salientes que se convierte en visita de destino cayó frente al periodo comparable. Hipótesis principales: degradación del rendimiento de la página o incidencia de medición. Antes de intervenir la campaña, contrastar eventos y rendimiento web; no dispongo de tiempos de carga medidos.”

## Contraste repo

Identificar si existen métricas de funnel en Meta, Shopify y tracking, agregaciones fiables, diagnóstico de caídas, comparadores temporales y agentes que consumen dichas señales. Si Klaviyo participa, no imputarle directamente ventas sin resolver reglas de atribución.
