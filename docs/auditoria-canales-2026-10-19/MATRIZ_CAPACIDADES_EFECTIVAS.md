# Matriz inicial de capacidades efectivas

Fecha de revisión: 19-10-2026. Esta matriz separa lo que implementa el repositorio de lo que permite una cuenta conectada. Una pantalla, un scope declarado o un borrador local no acreditan una escritura remota. Las operaciones externas se consideran habilitadas solo tras comprobar cuenta, permiso, ejecución y lectura del resultado.

| Proveedor / operación | Estado en E-NORA | Estado de cuenta externa | Qué puede afirmarse hoy |
| --- | --- | --- | --- |
| Shopify · catálogo y variantes (lectura) | API de listado y ficha implementadas; UI local en `/shopify/productos`. | `read_products` está declarado; scopes efectivos por instalación no verificados en esta fase. | Lectura implementada. Escritura de producto no se ofrece como capacidad efectiva. |
| Shopify · inventario por variante y ubicación (lectura) | API y tabla local implementadas; la RPC y el historial de migración están en test y producción. La pantalla aún espera el despliegue de código. | `read_inventory` y `read_locations` están declarados; frescura depende de la sincronización de cada tienda. | Lectura disponible tras desplegar la app. Un dato ausente permanece desconocido y una lectura de más de 24 h se identifica como antigua. |
| Shopify · ajustar existencias, transferir o reponer | No hay flujo de escritura completo ni motor de compra por proveedor/campaña. | La configuración actual no declara `write_inventory`. | No disponible. Una propuesta futura de compra no debe cambiar el stock de Shopify. |
| Shopify · descuentos y códigos | Listado y detalle de descuentos implementados; no hay flujo completo de creación/aprobación/ejecución. | `read_discounts` declarado; `write_discounts` no declarado en la configuración revisada. | Solo lectura. No afirmar que E-NORA crea o modifica promociones/códigos. |
| Meta · campañas, anuncios, métricas y creatividades (lectura) | Hay conectores, sincronización y superficies de campañas/insights; el detalle depende de los recursos y campos sincronizados. | Requiere cuenta/activo accesible y `ads_read`; permisos concedidos y revisión de la app no comprobados aquí. | Lectura implementada en código, acceso efectivo por cuenta pendiente de verificación. |
| Meta · crear, editar, activar o publicar anuncios | Hay preparación de propuestas y herramientas de diagnóstico; el plan mantiene la publicación en pausa. | Requiere `ads_management`, acceso al activo y revisión/capacidad correspondiente. | No disponible como publicación efectiva hasta probar escritura en cuenta de ensayo y releer el estado remoto. |
| Klaviyo · informes, campañas y emails (lectura) | API, analítica e inspección de recursos implementadas en las áreas existentes. | Requiere autorización y scopes concedidos por cada cuenta; no comprobados en esta fase. | Lectura implementada en código; no se certifica cobertura de cada cuenta. |
| Klaviyo · flows, campañas y formularios (escritura) | Hay diseño y preparación de contenido/flows; las operaciones remotas varían por recurso y no equivalen a un editor/publicador universal. | Scopes y revisión dependen de la acción. | No ofrecer envío, publicación ni edición arbitraria hasta probar cada operación soportada y confirmar su resultado remoto. |
| Web de Shopify · vista visual y revisión por agente | No existe aún un servicio completo de navegación aislada, capturas y hallazgos ligados a evidencia. | La tienda pública puede revisarse cuando se construya el servicio; previews protegidas requieren autorización separada. | Pendiente de F7; un iframe no equivale a una revisión del sitio. |

## Evidencia del repositorio

- [Auditoría y diseño objetivo del agente de stock](./AUDITORIA_AGENTE_STOCK.md).
- [Shopify: capacidades, permisos y límites](./SHOPIFY_CAPACIDADES_Y_LIMITES.md).
- [Meta y Klaviyo: capacidades, permisos y límites](./META_KLAVIYO_CAPACIDADES_Y_LIMITES.md).
- `shopify.app.toml`: scopes declarados por la aplicación Shopify.
- `apps/api/src/shopify-catalog.ts` y `apps/api/src/server.ts`: lecturas Shopify del catálogo, descuentos e inventario.
- `apps/api/src/meta-campaigns.ts`, `apps/api/src/meta-insights.ts` y `apps/api/src/klaviyo.ts`: conectores de lectura/sincronización; no certifican permisos de una cuenta.

## Criterio para cambiar un estado

Para declarar una escritura disponible, registrar en la propia ficha: proveedor y cuenta; scope solicitado y concedido; rol; objeto remoto; estado previo; propuesta y aprobación; operación ejecutada; ID/estado devueltos; lectura posterior que confirma el efecto; y comportamiento ante timeout, duplicado o rechazo. Las pruebas de permisos de Meta/Klaviyo/Shopify en cuentas reales se programarán en la fase de ese proveedor, no se sustituyen por esta matriz estática.
