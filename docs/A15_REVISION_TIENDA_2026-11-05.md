# A15 · Analista de imágenes · 5 de noviembre de 2026

**Terra principal y Sol como segundo modelo/fallback**, aplicados en el código compartido, runtime, caducidad del análisis y Costes de IA. La elección se refiere a descripción visual, OCR y observaciones de diseño. No evalúa generación de imágenes ni demuestra resultados publicitarios.

## Qué hace y dónde aparece

A15 recibe los píxeles del activo, procedencia, tipo de representación, nombre de archivo no fiable, tienda cuando consta y consultor asignado. Describe objetos, colores aproximados, estilo, composición, proporción, texto leído y regiones OCR; separa inferencias y propone usos/mejoras con evidencia. No consulta ventas, no decide campañas ni modifica el producto. No necesita histórico financiero para reconocer lo visible; ese contexto pertenece a otros agentes.

Se ejecuta al subir o solicitar reanálisis de un activo. Cliente y consultor leen la misma ficha guardada. Abrirla no vuelve a ejecutar el modelo. La indexación de conocimiento es una etapa independiente, con costes de embeddings adicionales cuando se habilita.

Las respuestas elegidas se ven en **Marketing → Banco de imágenes**, ruta `/marketing/imagenes`. Hay dos fichas:

| Imagen | ID del banco | Resultado visible |
|---|---|---|
| ejemplo-preventa.png | `bf9cbe4c-bc6f-4a95-b5cd-2bab3fb999dd` | Fondo azul, rectángulo claro y círculo amarillo; sin texto, producto o promoción demostrados. |
| A15 · The Hidden Snowboard · Shopify.jpg | `ab5ba081-a505-4ce9-939a-d132a20ac1c6` | Dos vistas de snowboard; OCR fullstack, <158cm> y S; zoom o encuadre como variantes, sin alterar el producto. |

La primera es un ejemplo abstracto de la organización, vinculado por su procedencia manual a la tienda para la revisión; no se le atribuye un SKU. La segunda procede del medio Shopify `4f4ff555-6c30-4f8a-ab79-441cb70a8b2f` del producto `929a5484-9df1-4b92-989d-6d16201bcf8d`, en E-NORA Demo. Es un catálogo de demostración; no demuestra la existencia comercial o prestaciones de un producto físico. Se conservan ID de producto/medio, checksum y procedencia.

## Comparación

Dos imágenes inspeccionadas por el asistente y enviadas con los mismos bytes a seis modelos, sin Astra. PNG 640×640 de formas y JPEG 1600×1600 de catálogo. SHA-256 de ambas en las capturas privadas. Claude recibe imagen base64 en mensaje multimodal; Codex usa `--image`. No son pruebas basadas solo en URL o texto. Sin herramientas dinámicas ni API pagada.

Se compararon los quince campos del contrato. La UI permite escoger caso y pareja de modelos y expandir la comparación campo a campo. Doce respuestas finales válidas; también se conservan doce respuestas iniciales, sustituidas por la corrección del contrato. Una salida por modelo e imagen: revisión retrospectiva del asistente, sin panel humano independiente ni tasa estadística de precisión. Se verificó el tamaño real de los archivos; los hex de color siguen siendo estimaciones visuales.

| Modelo | USD/imagen, media de ambos casos | USD/20 imágenes | Conclusión de esta muestra |
|---|---:|---:|---|
| Haiku 5.5 | 0,00368865 | 0,073773 | Económico y descriptivo; identifica como inferior la cara con insertos sin demostrarlo y propone retocar el diseño del producto. |
| Sonnet 5.5 | 0,032607 | 0,65214 | Buen detalle, pero más valoraciones de marca/mensaje sin brief. |
| Opus 5.5 | 0,069618 | 1,39236 | Catálogo muy detallado; trata la imagen abstracta como pieza comercial incompleta sin finalidad confirmada. |
| Luna | 0,00233025 | 0,046605 | Correcto en elementos principales; clasifica como vertical el JPEG cuadrado, con confianza alta. |
| Sol | 0,059021 | 1,18042 | Fiel y prudente; formato y OCR correctos. Segundo modelo de mayor capacidad. |
| Terra | 0,028529 | 0,57058 | Cobertura similar a Sol por menor precio: formato, OCR, inferencias separadas y mejoras de encuadre pertinentes. |

Precios del catálogo del laboratorio, documentado a 28/10/2026. Son equivalentes API de los tokens CLI, incluyendo visión y sobrecarga de la CLI; no factura ni medición directa del endpoint de producción. Perfil medio Terra: entrada 25.604 y salida 585 tokens, sin descuento de caché. Veinte imágenes/mes es un escenario, no una cadencia automática. El coste de producción debe volver a medirse con uso real; fallback, reintentos, juez y embeddings se suman. El fallback Terra→Sol no cubre una caída completa de OpenAI.

## Fallos corregidos

1. **A15 no llegaba al modelo:** filtraba `service_subscriptions` por `trialing`, valor que no existe en el enum de DB. Corregido a `trial`. La selección del plan/presupuesto en memoria se alinea también con ese estado.
2. **Contrato de generación distinto del validador:** el JSON Schema manual no comunicaba todos los límites de Zod. Sonnet produjo nueve colores cuando solo se admiten ocho. Ahora el contrato se deriva de `instagramImageAnalysisSchema`; el adaptador Anthropic elimina el identificador de dialecto `$schema`, manteniendo las restricciones como instrucciones compatibles cuando procede. El fingerprint pasa a `a15-visual-schema-v4`.
3. **Modelo/fingerprint coherentes:** generación y comprobación de vigencia usan la política compartida de A15; preferencias antiguas no desvían el principal. Los runs guardan el store_id recibido.
4. **Comparaciones visuales vacías o genéricas:** normalización ampliada a description, design_findings y suggested_use, y tabla explícita para todos los campos visuales del par seleccionado.
5. **Ficha antigua de prueba reutilizada como conocimiento:** el banco tenía checksum de semilla `seed-agentes-demo` y un documento visual ya indexado. Se guardó copia de su estado, se sustituyó el checksum por el hash real y se archivó el documento obsoleto `ff9aa36b-9c3a-46e1-aa05-f790508683b8`, conservando sus datos. Las fichas nuevas están `analyzed` e `index_status=pending`; no se presentan como indexadas ni se pagan embeddings durante esta prueba.

Los fallos iniciales de transporte Claude (entrada/salida stream-json y dialecto JSON Schema) ocurrieron antes de generar: recibos sin tokens conservados con `pre-vision-fix` y `pre-dialect-fix`. Sus repeticiones están registradas, no se cuentan como evidencia de mala calidad del modelo.

## Verificación y límites

Capturas finales:

- `a15_analista_imagenes:real-store-runtime-2026-11-05-visual-contract`.
- `a15_analista_imagenes:real-store-runtime-2026-11-05-shopify-contract`.

Runs publicados de simulación: `8507c52c-56b9-4b6a-b31d-ce862ff84b52` y `c6368f76-faa8-432a-86b1-b9f4069d02ae`. No se crean tareas, anuncios o compras. La imagen Shopify está en almacenamiento privado; la API entrega una previsualización temporal tras comprobar acceso.

Contratos/AI compilados, tipos API/web y pruebas de política A15, límites de contrato, integridad de píxeles/rutas y contrato de migración superados. Ambas sesiones reales reciben por API las dos fichas Terra, también filtradas por tienda, y preview privado HTTP 200. La API devuelve 401 sin sesión y 404 para conexión de tienda ajena/no disponible. El fingerprint v4 coincide con la política actual y el documento de semilla consta archivado. `/marketing/imagenes` devuelve HTTP 200.

Se inspeccionaron las dos imágenes originales con view_image. **No se completó revisión visual de la UI**: tanto el navegador como el canal nativo de CUA estaban indisponibles. La indexación vectorial queda pendiente. No se han probado OCR degradado, vídeo, carruseles, todos los tamaños, inferencia de marca exacta, resistencia completa a instrucciones maliciosas dentro de imágenes ni calidad de diseños generados; no se presume que dos muestras lo demuestren.

Artefactos privados: `.e-nora-test-lab/a15-real-2026-11-05/{review,published,visibility}.json` y copias `before-*`. Scripts reproducibles: `a15-capture-real-image.mts`, `a15-review-real-images.mts`, `a15-share-real-images.mts`, `a15-verify-ui-data.mts`; los scripts de reintento preservan originales con creación exclusiva y no deben repetirse sin revisar su estado.
