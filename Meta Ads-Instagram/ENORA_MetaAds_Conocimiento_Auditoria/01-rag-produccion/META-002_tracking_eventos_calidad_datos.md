# META-002 | Tracking, eventos y calidad de medición

**Estado:** candidato. **Fuente:** [VÍDEO] ~06:10–07:51, ~12:54–13:40 y ~25:00–26:10. **Origen de extensiones:** [INFERENCIA] y [PROPUESTA e-NORA] claramente separadas.

## Conocimiento extraído [VÍDEO]

- Confirmar la fuente de eventos (píxel/dataset) y su asociación con la cuenta/tienda correcta.
- Comprobar eventos de navegación, vista de producto, añadir al carrito, inicio de checkout y compra; las señales ausentes pueden invalidar diagnósticos.
- Usar pruebas de eventos para detectar configuraciones incorrectas antes de gastar presupuesto.
- En Shopify la integración con Meta puede facilitar la configuración; no asumir que está automáticamente bien instrumentada.

## Política de calidad [PROPUESTA e-NORA]

Antes de conclusiones sobre campañas, adjuntar `tracking_status` (`ok|partial|suspect|unknown`), periodo, zona horaria, moneda y procedencia de eventos. Distinguir:

1. **Órdenes reales Shopify:** ventas del comercio, idealmente descontando cancelaciones, devoluciones e impuestos según definición elegida.
2. **Conversiones Meta:** eventos/ventas atribuidos bajo una ventana y modelo que requieren identificación.
3. **Eventos de embudo:** pueden faltar, duplicarse o no ser perfectamente comparables entre fuentes.

Una diferencia entre ventas Shopify y Meta NO prueba automáticamente un error: pueden intervenir atribución, ventanas, múltiples campañas/canales, consentimiento, retrasos, deduplicación y definiciones.

## Checks propuestos [INFERENCIA]

- Volumen anormal de Purchase = 0 mientras existen ventas reales (alerta; no prueba).
- Variaciones bruscas en ratio clic saliente → landing page view.
- Cambios de zona horaria, divisa, ventanas de atribución o filtros.
- Posibles eventos duplicados si existen client-side y server-side; verificar configuración de deduplicación según integración disponible.

## No hacer

- Calcular ROAS total desde cifras heterogéneas sin explicar ventana/alcance.
- Prometer que Meta mide toda compra de Shopify.
- Afirmar fallo de píxel por discrepancia aislada.
- Dar instrucciones para saltarse el consentimiento/privacidad.

## Evidencia que necesita el agente

Conector Meta: métricas, niveles, fechas, attribution settings y cobertura real; Shopify: pedidos/ingresos comparables; observabilidad: errores y estado de sincronización. Auditar antes de diseñar checks.
