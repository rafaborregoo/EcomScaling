# Informes PDF nativos del copiloto

## Objetivo

El copiloto selecciona una plantilla versionada, obtiene métricas con consultas deterministas y genera un PDF nativo en backend. Las definiciones y el diseño no se repiten en cada prompt: el agente envía un ID corto y recibe metadatos y un enlace privado temporal.

## Decisiones

- PDFKit dibuja directamente los documentos; no hay HTML ni captura de navegador.
- Métricas y consultas viven en código. No se rellenan vacíos con datos inventados.
- Cada consulta queda limitada a la organización y a la tienda elegida. Se bloquean agregados ambiguos entre tiendas o monedas.
- Los informes multicanal separan las ventas observadas de Shopify de las conversiones atribuidas por Meta y Klaviyo.
- Las plantillas son estáticas, versionadas y reutilizables. Los datos de muestra de Platform Admin recorren el mismo constructor de documentos y renderer que los informes reales.
- El PDF no se envía al modelo: se almacena en un bucket privado y el modelo recibe una URL firmada por 60 minutos.

## Catálogo inicial

| ID | Plantilla | Fuentes | Alcance |
|---|---|---|---|
| `shopify_comercial` | Ventas y producto | Shopify | Ventas, pedidos, ticket medio, promociones y productos destacados |
| `shopify_rentabilidad` | Rentabilidad y costes | Shopify | Ingresos sin IVA, COGS, margen, costes y beneficio estimado |
| `shopify_clientes` | Clientes y recompra | Shopify | Valor histórico, pedidos identificados e invitados, cohortes y retención |
| `meta_publicidad` | Publicidad de Meta | Meta Ads | Inversión y conversiones atribuidas, ROAS y campañas; protege totales con monedas mezcladas |
| `klaviyo_email` | Email y automatizaciones | Klaviyo | Ingresos y conversiones atribuidos, entregas, tasas y campañas/flows |
| `adquisicion_multicanal` | Adquisición y atribución | Shopify, Meta Ads, Klaviyo | Señales por plataforma en bloques separados |
| `resumen_multicanal` | Resumen ejecutivo de negocio | Shopify, Meta Ads, Klaviyo | Ventas, margen, publicidad y email con cautelas de cobertura y atribución |

## Seguimiento por fases

Marcar una tarea completa cuando esté implementada y revisada. Registrar bloqueos de entorno y migraciones no aplicadas para distinguir código local de activación.

### Fase 0 — Alcance y contratos

- [x] Definir generación PDF nativa, fuentes deterministas y aislamiento por organización/tienda.
- [x] Definir un contrato común para métricas, tablas, notas, procedencia, estados de fuente y versión de plantilla.
- [x] Definir IDs y selector compacto del agente.
- [x] Establecer comparación contra el periodo anterior para métricas comerciales.
- [x] Diferenciar fuente disponible, parcial y no disponible; no sumar atribuciones entre proveedores.

### Fase 1 — Renderer y biblioteca de plantillas

- [x] Integrar PDFKit y renderizado vectorial A4, cabeceras, KPIs, tablas, notas, paginación y pie con páginas.
- [x] Implementar los siete IDs de plantilla en `apps/api/src/report-templates.ts`.
- [x] Usar el mismo constructor de documento y renderer para informes reales y muestras de administrador.
- [ ] Reinspeccionar visualmente los PDF después de ampliar gráficos y tablas; el entorno requiere un renderizador PNG para completar esta revisión.
- [x] Añadir gráficos vectoriales de barras para producto, rentabilidad, cohortes, ROAS e ingresos atribuidos; admitir moneda, porcentaje, ratio y valores negativos.
- [x] Ampliar tablas con desgloses financieros, cohortes, CTR/clics e indicadores de entregabilidad por campaña o flow.
- [ ] Añadir tendencias diarias cuando su cobertura y moneda estén disponibles y validadas en todas las fuentes.

### Fase 2 — Adaptadores de datos

- [x] Shopify comercial: resumen de ventas del periodo y anterior, productos destacados.
- [x] Shopify financiero: motor financiero existente, COGS, márgenes, costes y cobertura de costes.
- [x] Shopify clientes: valor histórico y cohortes; etiqueta explícita de alcance histórico.
- [x] Meta Ads: resumen y campañas; ocultar importes agregados si no hay una moneda única confirmada.
- [x] Klaviyo: agregación de filas del informe y tasas de apertura, clic y baja calculadas sobre entregas.
- [x] Reutilizar en tablas y gráficos los conteos de impresiones, clics, rebotes y entregas ya entregados por las RPC existentes.
- [x] Informes multicanal con secciones independientes por fuente y límites explícitos de atribución.
- [ ] Contrastar los nombres/semántica de todas las métricas con datos reales de cada integración y completar casos sin cobertura.

### Fase 3 — Tool, almacenamiento y acceso

- [x] Registrar `generate_report` con selección por enum y fechas opcionales validadas.
- [x] Añadir instrucciones compactas para que el agente mapee la petición al ID de plantilla.
- [x] Mantener la ejecución y selección de plantilla dentro de `apps/api/src/ai-runtime.ts`.
- [x] Crear migración de bucket privado y activación A09 v15: `supabase/migrations/20261130000000_ai_31_copilot_report_pdf.sql`.
- [x] Guardar PDFs en ruta tenant-scoped, firmar descarga por 60 minutos y no registrar la URL en telemetría.
- [x] Exponer catálogo y PDF de muestra solo a Platform Admin.
- [ ] Aplicar la migración en el entorno previsto y validar bucket/activación con sus permisos reales.
- [ ] Definir y ejecutar retención/eliminación de documentos caducados.

### Fase 4 — Experiencia de Platform Admin y chat

- [x] Añadir `/admin/informes` con catálogo, categorías, fuentes, finalidad, secciones y descarga.
- [x] Marcar todas las vistas previas como sintéticas; usar el renderer de producción con fixtures.
- [x] Añadir visor PDF nativo embebido y adaptación a móvil.
- [x] Devolver desde la tool nombre de archivo, periodo, moneda, versión y URL firmada.
- [x] Presentar una tarjeta de descarga estructurada en el chat y estado de generación.
- [x] Añadir acciones WhatsApp (archivo nativo si el navegador admite compartir archivos; enlace temporal como alternativa) y email con el PDF adjunto.
- [x] Renovar el enlace de descarga desde una ruta autenticada y validar organización, UUID y nombre del archivo.
- [x] Guardar los metadatos estructurados del informe en el historial del chat.
- [ ] Pedir aclaración conversacional cuando falte una tienda entre varias, en lugar de limitarse al error de la tool.

### Fase 5 — Revisión funcional y lanzamiento

- [ ] Revisar visualmente las siete muestras PDF actualizadas, incluidas las dos composiciones multicanal.
- [x] Añadir pruebas de las siete plantillas, cálculo de tasas de Klaviyo, separación multicanal, destinatarios y nombre/ruta de adjunto.
- [x] Ejecutar `npm run test:copilot-reports --workspace=@e-nora/api`: 10 pruebas pasan.
- [x] Ejecutar `npm run typecheck --workspace=@e-nora/api`: correcto.
- [x] Validar con PDF.js las siete salidas: 0 elementos de texto fuera del A4 y 0 caracteres con codificación corrupta.
- [ ] Revisar el breakpoint móvil del panel con una sesión Platform Admin.
- [ ] Verificar aislamiento tenant/store, errores de RPC, datos vacíos, cobertura parcial, monedas mixtas y caducidad del enlace.
- [ ] Medir coste, tiempo y tamaño con datos de muestra y datos reales controlados.
- [ ] Actualizar catálogo operativo de tools y guías de soporte tras aplicar la migración.

## Registro de progreso

| Fecha | Fases | Cambio y evidencia | Pendiente |
|---|---|---|---|
| 2026-10-05 | 0–3 | Contrato común, renderer PDFKit, siete plantillas, consultas por fuente y tool `generate_report` integrada en `ai-runtime.ts`. Bucketing privado y A09 v15 descritos en migración nueva. | La migración no está aplicada; inspección con datos reales y retención siguen pendientes. |
| 2026-10-05 | 4–5 | Galería administrativa, rutas protegidas, PDF de muestra sintético con el mismo constructor/renderer. Revisadas las siete muestras. Tarjeta estructurada en chat, descarga con enlace renovable, WhatsApp mediante compartir archivo y email con PDF adjunto. Ocho pruebas focalizadas pasan; la batería API completa ejecuta 919 pruebas: 917 pasan y fallan dos comprobaciones ajenas al cambio (A23 vídeo y A22 comparación por tienda). | Falta validar el flujo en una sesión admin, probar el envío SMTP y el selector WhatsApp en dispositivos reales, y resolver un fallo de typecheck preexistente en un test de Mi Camino no relacionado. |
| 2026-10-05 | 1–2, 5 | Las siete plantillas ahora incluyen gráficos y tablas ampliadas por fuente. Diez pruebas focalizadas y typecheck API pasan. PDF.js confirma texto dentro de los límites de página y codificación correcta en las siete muestras. | No hay Poppler/renderizador raster en el entorno para inspección visual; siguen pendientes las pruebas reales de sesión, envío, monedas/cobertura y migración. |

## Criterio para dar por terminada la primera entrega

El copiloto escoge uno de los siete IDs sin cargar plantillas completas en el prompt; el backend obtiene solo las fuentes requeridas, muestra límites de moneda/cobertura, genera PDF nativo y devuelve una descarga privada temporal. Platform Admin puede previsualizar cada diseño con datos claramente ficticios. Para lanzar, además hay que aplicar la migración, revisar el panel en una sesión autorizada y completar la tarjeta de descarga del chat.
