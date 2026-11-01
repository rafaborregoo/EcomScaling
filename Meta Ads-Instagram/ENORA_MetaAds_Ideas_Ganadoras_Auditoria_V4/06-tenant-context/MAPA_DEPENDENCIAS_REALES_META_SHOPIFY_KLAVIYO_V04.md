# Mapa de fuentes y límites — NO asumir integraciones habilitadas

| Fuente | Datos deseables | Capacidad por verificar | Riesgo / límite |
|---|---|---|---|
| Meta Ads | cuentas, anuncios, textos, inversión, resultados, insights, media/URLs | scopes, endpoints, ventanas, rate limits, cuentas autorizadas | atribución vs Shopify, acceso a material visual no garantizado |
| Shopify | catálogo, precios, descuentos, pedidos, compradores y márgenes si existen | API, stores, campos de COGS, impuestos/envíos y permisos | datos de producto ≠ margen neto fiable |
| Klaviyo | segmentación comercial y atribución email cuando proceda | flujos, campañas, scopes, ventanas | ventas atribuidas cruzadas, privacidad, base jurídica |
| Contenido orgánico | Reels/TikTok, fecha, alcance, seguidores, texto, audiovisual | **no presumir** que haya conector ni acceso a TikTok | viralidad ≠ conversiones, derechos de terceros |
| Reviews/feedback | objeciones y necesidades | proveedor y permisos específicos | PII, sesgo, opiniones falsas, retención |
| Banco de creativos | media, brief, permisos de assets, versiones | sistema interno real por localizar | copyright y datos privados multi-tenant |

## Separación de fuentes de verdad
- Fórmulas, métricas e ingestión son computación verificable; no deben residir solo en el RAG.
- El RAG global contiene **metodología genérica auditada**.
- Los resultados y aprendizajes del comercio pertenecen a **contexto privado por tenant**.
- Sin evidencia de permisos, devolver limitación; nunca rellenar con datos de otra tienda.

## Validaciones mínimas
Aislamiento, scopes de acceso, consentimiento/bases jurídicas, ventana de datos, fiabilidad de atribución, matching entre creativos y ventas y documentación de promesas de producto.
