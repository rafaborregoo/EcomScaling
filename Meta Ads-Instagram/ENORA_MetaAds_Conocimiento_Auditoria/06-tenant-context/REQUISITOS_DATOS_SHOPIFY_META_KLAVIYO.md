# Contrato de datos deseables por tenant (para auditar, no para asumir)

**Estado:** inventario conceptual. No presupone disponibilidad API, permisos, sincronizaciones o esquema del proyecto.

## Meta Ads

- Identificadores negocio/cuenta/campaña/conjunto/anuncio; estado y objetivo.
- Gasto, impresiones, alcance, CPM, clics salientes, CTR saliente, CPC, landing page views.
- AddToCart, InitiateCheckout, Purchase, valor de compra, CPA y ROAS cuando estén disponibles y sean comparables.
- Ventana y definición de atribución, divisa, fechas, granularidad, frescura y errores de sincronización.
- Datos de creativos (texto, tipo, assets, vídeo) **solo si la integración los obtiene legalmente**.

## Shopify

- Ventas/pedidos, descuentos, impuestos, envío, devolución, reembolso, cancelación, moneda y fechas.
- Productos/variantes, precio, AOV, clientes nuevos/recurrentes; coste producto solo si existe y tiene calidad suficiente.
- Datos de checkout/carrito según disponibilidad real; no asumir que toda fase está en la API de la tienda.

## Klaviyo

- Métricas de campañas/flows, envíos, clics, ingresos atribuidos, segmentos/cohortes cuando estén disponibles.
- Definición de atribución propia de Klaviyo y riesgo de doble contar ventas ya presentes en Shopify.
- No transformar datos de personas en información de otros tenants ni adjuntar PII innecesaria a prompts.

## Capa común

Cada serie debería exponer, si procede: `tenant_id`, `source`, `source_id`, `metric`, `period_start`, `period_end`, `timezone`, `currency`, `attribution`, `synced_at`, `is_partial`, `definition_version`.

No crear columnas ni migraciones a partir de este documento sin inspeccionar el esquema real.

## Calidad / consistencia

Comprobar reconciliación de definiciones (p. ej., gross sales vs net sales; gastos publicitarios frente a valor de compras atribuidas), retrasos, duplicaciones, datos incompletos, límites de consulta y posibles superposiciones entre Meta/Klaviyo.

## Preguntas para el auditor

¿Qué entidades y campos existen realmente? ¿Qué conecta OAuth y qué sincroniza? ¿Hay tablas por día, agregados, caches, tests de RLS, estado de conectores, telemetría de ingesta, umbrales de calidad? Contestar con rutas/esquema/consultas en **solo lectura**.
