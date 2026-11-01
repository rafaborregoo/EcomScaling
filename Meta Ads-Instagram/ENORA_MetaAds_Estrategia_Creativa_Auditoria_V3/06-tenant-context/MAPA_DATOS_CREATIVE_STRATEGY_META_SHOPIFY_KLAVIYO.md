# Mapa de datos candidato — Creative Strategy multi-fuente

| Necesidad analítica | Origen probable | Advertencia de disponibilidad |
|---|---|---|
| Catálogo y precio/ofertas | Shopify | Verificar permisos, productos/variantes, contexto de descuentos |
| Ventas, pedidos, AOV y recurrencia | Shopify | Revisar devoluciones, impuestos, cambios y cohortes |
| Costes, margen por pedido/producto | Shopify / app / datos del comerciante | **No asumir disponibilidad ni completitud de COGS** |
| Activos, creativos, entrega, resultados | Meta | Verificar scopes API y versiones; vídeo/audio/texto de asset no siempre accesible |
| Comentarios de anuncios | Meta u otra herramienta | Disponibilidad/permisos **NO VERIFICADOS** |
| Reseñas propias | App de reviews, export CSV, soporte, fichero autorizado | **No es una capacidad garantizada por Shopify** |
| Campañas/email/repetición | Klaviyo | Cuidado con eventos duplicados y atribución superpuesta |
| Reputación pública | Web/Reddit/YouTube/Amazon | No existe conector garantizado; TOS y sesgos |
| Historia de marca y prueba de claims | Documentos autorizados del comerciante | Requiere revisión documental y licencias |
| Calendario comercial/stock | Shopify / comerciante | No asumir previsión, fechas ni disponibilidad futura |

## Especificación mínima de calidad

`tenant_id`, `source_system`, `source_record_id`, `permission`, `observed_at`, `period`, `currency`, `timezone`, `attribution_model`, `sample_size`, `data_freshness`, `provenance`, `PII_handling`, `source_status`.

### Restricciones

- No sumar ingresos atribuidos por Meta y Klaviyo como si fueran transacciones disjuntas.
- No comparar resultados de anuncios sin normalizar período, objetivo, atribución, inversión y restricciones de datos.
- No afirmar que review mining, escucha social o scraping existe en el runtime solo porque la ficha conceptual lo mencione.
