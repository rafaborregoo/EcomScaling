# A15 · auditoría visual en curso

**Actualización: la revisión se completó.** Terra principal, Sol fallback; dos fichas visibles y verificadas por API para ambos roles. Este archivo conserva las notas intermedias y sus pendientes históricos, que quedan sustituidos por [la auditoría final de A15](./A15_REVISION_TIENDA_2026-11-05.md). La revisión visual de UI y la indexación vectorial siguen pendientes y no se presentan como realizadas.

Continuación autorizada tras elegir una cuenta Meta para A14. A14 ya usa Rafael Borrego Reyes; sincronización correcta tras corregir el fallback de ficha básica cuando Meta deniega facturación. Modelo diagnóstico Sol/fallback Terra elegidos con dos tandas de seis. Última respuesta publicada en TEST para ambos roles: run `1d7e3e46-724c-4e96-9b46-6d06dde25635`, output `7fa9af4b-9c1d-49e2-94cc-3cc87e9a7ca6`. Coste actual 0,092646 USD/ejecución, 2,77938 por treinta lecturas. Inversión no habilitada: nueva cuenta sin adquisición y finanzas incompletas. No se necesita seguir pidiendo reconectar esa cuenta. La antigua Rafa Borrego quedó desasignada y deseleccionada, sin borrar datos.

## Estado de A15

- Captura nativa sin API pagada mediante callback `beforeModel` añadido a `analyzeInstagramImage`.
- Fallo real corregido: `service_subscriptions.status` usa `trial`, no `trialing`; la consulta A15 fallaba incluso con suscripción activa. Corregida también la selección del presupuesto de pruebas en memoria.
- Banco actual tenía una imagen de formas geométricas: `bf9cbe4c-bc6f-4a95-b5cd-2bab3fb999dd`, azul/blanco/círculo amarillo, 640×640, sin texto. No es un anuncio ni producto; el nombre «ejemplo-preventa.png» no lo demuestra.
- Segunda imagen real del catálogo de E-NORA Demo: medio `4f4ff555-6c30-4f8a-ab79-441cb70a8b2f`, producto `929a5484-9df1-4b92-989d-6d16201bcf8d` / The Hidden Snowboard. JPEG 1600×1600, dos caras de tabla con bloques de colores; texto `fullstack`, `<158cm>` y S pequeña. Inspeccionadas ambas imágenes visualmente con view_image.
- Harness ampliado a píxeles reales: Codex `--image`; Claude entrada/salida stream-json y mensaje de imagen base64. `scripts/ai-model-lab-images.mts` verifica ruta interna, tamaño, MIME y SHA-256. Prueba de integridad y escape de ruta superada.
- Se ejecutaron doce respuestas iniciales. Detectada divergencia del JSON Schema manual respecto a Zod: Sonnet devolvió nueve colores y el validador solo permite ocho. No atribuir ese fallo solo al modelo. Sustituido el contrato manual por `z.toJSONSchema(instagramImageAnalysisSchema)`, versión de fingerprint v4 en runtime/banco. Test de límites y compatibilidad Anthropic superado.
- Capturadas dos tandas finales con contrato corregido, IDs que terminan `-visual-contract` y `-shopify-contract` (prefijo `a15_analista_imagenes:real-store-runtime-2026-11-05-`). Los tres OpenAI ya completaron ambos casos. Claude está repitiendo después de corregir la eliminación de `$schema` en el adaptador Anthropic, que su CLI rechazaba antes del modelo. No borrar recibos de esos errores: están archivados `pre-vision-fix` y `pre-dialect-fix`, sin tokens. La sesión exec activa al escribir este MD es `19486`.
- Primera revisión orientativa: Sol y Terra separan hechos e inferencias y no exigen CTA a una imagen de catálogo; Luna confundió el formato cuadrado del JPEG con portrait en la primera tanda. Claude tiende a proponer arreglos sin brief o a criticar ausencia de marca/CTA en el gráfico abstracto. Evaluar exclusivamente los casos `-contract` al finalizar; imágenes/mismos bytes en todos, sin Astra.
- `normalizeOutput` ya admite description/design_findings/suggested_use para que las comparaciones no salgan vacías; re-normalizar todas las filas A15 en la revisión.

## Trabajo pendiente

1. Esperar sesión `19486`, revisar las doce respuestas finales completas y costes (incluyen visión), elegir principal y segundo mejor sin asumir cuál gana.
2. Política A15 compartida + perfil de coste y laboratorio fácil de leer con dos casos y límites; marcar tandas iniciales como reemplazadas, conservando originales y consumos.
3. A15 usa directamente `agentVersion.model` al generar fingerprint y llamar al turno. `instagram-image-bank.ts:getActiveA15Fingerprint` usa lo mismo. Ambos deben usar `getAgentModelDecision("a15_analista_imagenes")?.model ?? ...` al fijar política, para que modelo/fingerprint/caché coincidan.
4. Persistir análisis ganador de formas en el banco existente y mostrar también producto Shopify en el banco de la cuenta, conservando procedencia y sin crear una cola que dispare API pagada. Usar schema validado, markdown nativo y fingerprint v4/política correcta. No afirmar indexación RAG si no se generan embeddings; sin API pagada. Se puede dejar `index_status` pendiente y explicarlo.
5. Verificar propietario y consultor por JWT real (generar magiclink + verifyOtp no envía correo), API de banco existente y HTTP200; navegador/host CUA no disponibles en comprobaciones previas, no afirmar revisión visual de UI.
6. Cerrar documentos A14/A15 y tracking, compilar paquetes en orden y tipos API/web; pruebas nativas y relevantes. Evitar pruebas amplias ajenas.

Scripts: `a15-capture-real-image.mts` (`--contract`, `--product --contract`), `a15-retry-cli-transport.mts` y `a15-retry-schema-dialect.mts` (ya ejecutados, no repetir porque conservan archivos con `wx`). Artefactos bajo `.e-nora-test-lab/ai-models/images` y report.json. No hay agente/subagente de desarrollo delegado. Hay cambios concurrentes de A19 y otros; preservarlos.
