# A16 y la creación de mailings y creativos · auditoría 06/11/2026

> Actualización: los ocho hallazgos siguientes describen el estado anterior a la corrección. Las correcciones de código y TEST/local están recogidas en «Implementación posterior» al final. La selección comparativa de modelos se debe volver a medir con este contexto nuevo.

## Veredicto

**A16 tiene modelo elegido, pero su integración en la creación completa de marketing está pendiente.** Hoy se invoca manualmente desde el editor de texto sobre imagen. A11 no lo llama al generar un mailing o un creativo. La comparación previa de seis modelos evaluó el copy y sus coordenadas sobre dos originales; no acredita el resultado renderizado de una campaña completa.

A16 debe ser una etapa opcional para una imagen que necesite texto sobreimpreso. En anuncios, historias y carruseles puede aportar el titular y su colocación. En un mailing solo debe intervenir si se pide una imagen o cabecera compuesta; el resto del email puede mantener su texto editable en HTML.

## Recorrido actual comprobado

| Paso | Estado actual |
|---|---|
| A15 analiza la imagen | Produce la ficha visual que A16 recibe como contexto |
| Editor de imagen → botón «Borrador de texto (IA)» | POST `instagram/overlays/:overlayId/ai-draft` → `draftInstagramOverlayText` → `draftInstagramOverlay` |
| Entrada A16 | Píxeles originales, ficha, producto Shopify vinculado cuando existe, objetivo, formato e índice/número de slides |
| Salida A16 | Bloques de texto, coordenadas y paleta; el editor los mantiene localmente hasta Guardar |
| Generar caption/texto de anuncio | Otro botón llama a A11 con las fichas y el texto guardado del overlay |
| Generar email o creativo desde A11 | No llama a A16 ni genera automáticamente el PNG del overlay |
| Equipo narración/diseño/revisión | `runMarketingCreativePipeline` se usa en el script piloto y sus pruebas; no está conectado al runtime de A11 ni incluye A16 |
| Exportar imagen | Ruta PNG sin persistencia; actualmente restringida al bucket público antiguo |

## Hallazgos

### 1. Alta · exportación incompatible con las imágenes privadas del banco

`apps/web/src/app/marketing/imagenes/render/route.tsx:85` solo admite `storage/v1/object/public/marketing-assets/`. El banco firma previsualizaciones de `marketing-source-assets` privado. El editor usa esa URL como `src` de exportación, por lo que ese tipo de activo se rechaza antes de renderizar.

Se ejecutó una petición HTTP a la ruta local con una URL controlada de la forma `storage/v1/object/sign/marketing-source-assets/audit.jpg?token=audit-placeholder`, formato 1:1 y cero bloques: **HTTP 400**. El token era ficticio; no se accedió a un archivo privado. La prueba comprueba la incompatibilidad de la guarda de URL, no la calidad del PNG de un activo real. No conviene resolverlo haciendo público el banco: el render debe resolver el activo autorizado por ID y mantener su control de acceso.

### 2. Alta · falta unión entre la composición y el borrador A11

`generatePublicationCaption` entrega a A11 `brief`, canal y clave de idempotencia. No entrega el PNG compuesto, un vínculo explícito al overlay/revisión ni el `store_id` de su imagen. El render tampoco persiste un archivo. Un caption creado no acredita que el borrador conserve o publique esa composición visual junto a su texto. Para mailings ni siquiera hay una llamada automática a A16.

### 3. Media · el caption puede leer texto anterior

`aiDraft` y las ediciones cambian el estado local. `generateCaption` no guarda esos cambios ni los envía en su petición; el backend lee `slides` de la base. El botón sigue disponible con cambios sin guardar. Secuencia afectada: generar texto A16 → editar → Generar caption sin Guardar. El caption recibe la versión anterior. Debe trabajar sobre una revisión guardada y explícita.

### 4. Media · se analiza el original, pero se diseña sobre un recorte diferente

A16 recibe la imagen original y el ratio solicitado. Editor y exportador aplican `object-cover`. Al pasar de una foto cuadrada a 4:5 o 9:16 cambia el contenido visible y el espacio disponible; A16 no recibe el recorte renderizado. Sus coordenadas no garantizan que el producto y el texto sigan separados en el resultado final.

### 5. Media · carrusel sin contexto conjunto y con pérdida parcial al fallar

«Borrador de toda la pieza» llama al modelo una vez por slide. Cada llamada conoce índice y cantidad, pero no las imágenes ni los textos de los demás slides; por tanto, no hay una narrativa conjunta verificada. Además, `aiDraftAll` aplica `mutateSlides(next)` solo al terminar: si un slide falla, las respuestas anteriores de esa tanda no se aplican al editor, aunque sus llamadas ya se hayan efectuado. Falta guardar progreso por slide y reintentar solo el fallido.

### 6. Media · trazabilidad incompleta para otros agentes

El run A16 no recibe/persiste `store_id`, `overlay_id`, revisión ni `slide_index` como identidades. Devuelve la propuesta al navegador sin crear un `agent_output` en este recorrido. A23 busca runs por tienda y con `agent_outputs!inner`; esa consulta no puede incorporar así el A16 actual. Guardar manualmente los bloques en el overlay no resuelve esa relación entre agentes.

### 7. Media · contexto de marca y campaña parcial

El runtime sí adjunta los píxeles y puede cargar datos Shopify verificados. Su contexto A16 no carga la guía de marca ni la narrativa A11 aprobada. La única instrucción editorial específica de la pieza es el objetivo/brief. Para una campaña coordinada se necesitan tipografía, colores de marca, destino/CTA verificado, público y copy acordado; no basta con repetir datos del producto.

### 8. Media · tiempo de espera y coste por slide

El navegador espera 120 segundos; la política A16 permite 180 segundos y un reintento. Una espera agotada del navegador no acredita que el backend haya detenido la generación. La petición A16 no lleva clave de idempotencia y volver a pulsar puede repetir consumo.

Una pieza de diez slides puede requerir diez llamadas, no una. Referencia del catálogo guardado del laboratorio: Opus ~$0,05376 por imagen/llamada y ~$0,5376 por diez slides, antes de A15, A11, revisiones, fallbacks, render/almacenamiento. Son estimaciones equivalentes de API sobre uso CLI, no tarifas revalidadas ni factura.

## Uso que debe tener en las próximas comparaciones

1. Preparar un único encargo con tienda, productos, imágenes, marca, oferta y destino verificados.
2. A11 define la narrativa y el texto; A15 describe los activos. A16 interviene solo en las imágenes que requieren sobreimpresión, respetando ese encargo.
3. Evaluar en el formato final: composición, tamaño, recorte y variantes de móvil/escritorio cuando corresponda.
4. Guardar cada imagen compuesta como activo privado versionado y vincularla al borrador real de marketing. Guardar también coste/modelo/run por etapa y slide.
5. Revisar el resultado renderizado: legibilidad, producto sin tapar, jerarquía, coherencia entre slides, hechos y CTA. Las salidas JSON no bastan para decidir el mejor diseño.
6. Comparar modelos usando los mismos activos, encargo y renderizador. Mantener fija la composición restante al evaluar una etapa; después comprobar el conjunto elegido.

Orden de trabajo recomendado: arreglar render privado y vinculación del activo; corregir guardado/revisión para captions; añadir trazabilidad y reintentos por slide; conectar opcionalmente A16 a A11; repetir la comparación visual completa.

## Alcance de esta auditoría

Lectura de grafo y código actual, revisión de ADR-0025, comprobación de callers y prueba HTTP de la guarda de exportación. No se generaron nuevas respuestas de modelos ni se realizaron llamadas pagadas, envíos o publicaciones. No se modificó el runtime durante esta auditoría. La selección previa Opus/Sol se conserva como selección de modelo de la muestra; no constituye cierre del flujo completo de diseño.

## Implementación posterior

- **Exportación privada:** el editor descarga mediante un GET autenticado del overlay/slide. La API comprueba organización, tienda y origen del archivo; descarga desde Storage y compone el PNG. No acepta una URL arbitraria. El antiguo endpoint público no se amplió a archivos privados.
- **Render y visión:** el recorte centrado de 1080 px de ancho es común a la entrada visual A16 y a la exportación 1:1, 4:5 o 9:16. Se incluye Geist con licencia OFL para una fuente reproducible. El botón «Ver imagen final» muestra los mismos bytes que se descargan; un texto que excede el lienzo bloquea la descarga con un mensaje accionable.
- **Contexto:** A16 recibe la marca de la tienda, con fallback al perfil de organización, catálogo vinculado, descripciones/textos guardados de los demás slides y píxeles de los vecinos inmediatos. Se conservan checksum/revisión y ratio del origen. No se deduce de ello rendimiento publicitario.
- **Persistencia e idempotencia:** cada slide guarda su respuesta nativa en `agent_outputs`, run por tienda, snapshot de composición/marca y referencia `generation_run_id` en el layout. Una clave repetida recupera la salida; un encargo modificado con esa misma clave se rechaza. Se conserva consumo medido si falla la persistencia posterior al modelo. Los runs abandonados pueden expirar tras el límite de ejecución más margen y permiten un nuevo intento explícito.
- **Carruseles:** la UI aplica y conserva cada slide terminado. Una tanda interrumpida continúa por los pendientes. La espera por llamada cubre el timeout/reintento del backend. La creación de borradores desde la UI prepara los slides vacíos en peticiones independientes para evitar agrupar todas las llamadas del carrusel en una sola espera.
- **Caption actualizado:** guardar, generar y descargar usan la misma composición persistida. Si se completa texto con A16, se termina ese paso antes de ensamblar el brief de A11. La clave de A11 se calcula después de preparar los slides y su fingerprint usa la revisión de composición, no tokens de URL temporales.
- **A11 real:** `overlay_id` permite adjuntar una composición autorizada; `compose_overlay` completa opcionalmente slides sin texto. El editor ofrece caption/anuncio y «Crear mailing con esta pieza», además de una opción explícita para completar texto faltante. A11 recibe los PNG compuestos; el borrador conserva manifiesto privado, hashes, tienda, revisión, slides y runs de origen. Los previews de Contenido y del Estudio muestran las imágenes vinculadas.
- **URLs y entrega:** las previsualizaciones privadas se renuevan al leer los borradores. Para Klaviyo, la exportación ya aprobada verifica hashes y promueve copias de entrega antes de enviar HTML al proveedor; no deja enlaces temporales en el email entregado. Esta rama se comprobó con un doble de almacenamiento, sin exportar a Klaviyo. El piloto separado de narración/diseño/revisión A11 no se activó como flujo productivo por esta corrección.

### Verificación

17 pruebas focalizadas de composición/recorte, overflow, regeneración de URLs privadas, aprobación de entrega, aislamiento, continuación de carrusel, brief, idempotencia y avisos de diseño. Typechecks de API y web. ESLint dirigido sin errores; persiste un aviso anterior de carga por efecto en el editor.

`scripts/a16-verify-composition.mts` reproduce la exportación y preparación de activos en TEST: PNG HTTP 200 para cliente y consultor; 401 sin sesión y rechazo de organización ajena; asset privado accesible con URL firmada e inaccesible mediante la ruta pública. Conserva un borrador técnico, `10475151-bfef-4cae-800e-eb7002672cec`, con la composición de la respuesta Opus anterior. El caption de esa ficha está identificado como fixture técnico, no como nueva respuesta A11.

`scripts/a16-verify-recovery.mts` captura el contexto antes del proveedor, corta deliberadamente sin llamada LLM, carga como fixture la respuesta CLI anterior de Opus y comprueba recuperación sin otra llamada, tienda/marca/snapshot y rechazo de cambios con la misma clave. Los runs de prueba se marcan shadow con coste cero.

Se inspeccionó el PNG exportado en archivo. La inspección visual autenticada del navegador sigue pendiente: CUA no pudo verificar la URL de Chrome. No se han repetido las seis generaciones con el contexto ampliado ni se ha realizado una nueva llamada API de A11/A16, publicación, envío o despliegue de producción. No hay cambios de esquema ni migraciones nuevas. El coste previo por imagen sirve solo de referencia: vecinos, A15, A11, revisiones y número de slides deben sumarse al medir el próximo flujo completo.
