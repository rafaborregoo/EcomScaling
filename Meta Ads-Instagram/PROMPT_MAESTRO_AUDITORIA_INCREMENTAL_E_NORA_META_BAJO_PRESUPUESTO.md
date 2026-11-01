# PROMPT MAESTRO — CLAUDE CODE | AUDITORÍA INCREMENTAL DE VÍDEO 02 META ADS (PRESUPUESTO REDUCIDO) EN e-NORA

## Rol y objetivo

Actúa como auditor senior de un SaaS ecommerce con RAG, agentes y conectores **Shopify, Meta y Klaviyo**. Proyecto: **e-NORA**, distinto del CRM inmobiliario NORA. El usuario ha aportado un **segundo vídeo** sobre Meta Ads con pocos recursos. Se entrega este ZIP de material candidato. El objetivo es **identificar lo NUEVO de esta fuente con respecto al primer paquete de Meta Ads y al repositorio**, detectar redundancias, contradicciones y condiciones de implementación, y devolver un informe basado en evidencia.

### Restricción de máxima prioridad: SOLO LECTURA

NO modificar el código/repositorio, no crear ni editar archivos dentro del repo, no actualizar documentación, no crear commits, no instalar paquetes que modifiquen lockfiles, no tocar base de datos ni ejecutar migraciones, **no reingestar, no generar embeddings**, no alterar prompts, no desplegar, no enviar correos ni tocar presupuestos/campañas/anuncios de Meta. No ejecutar operaciones de escritura por los conectores. Entrega únicamente el informe en tu respuesta. Respeta cualquier regla de seguridad del repo, sin violar el modo lectura.

## Material a leer

1. `README.md` y `00-corpus-maestro/00_FICHA_FUENTE_Y_EXTRACCION.md`.
2. Las **9** fichas candidatas de `01-rag-produccion/`, más `02-contratos-IA/`, `03-runtime/`, `04-policies-guardrails/`, `05-experience-learning/`, `06-tenant-context/`.
3. `99-auditoria/MAPA_SOLAPAMIENTO_VIDEO_01_VIDEO_02.md`, `MATRIZ_INCREMENTAL_PENDIENTE.md`, `NOTAS_PROMOCIONALES_Y_LIMITES.md`, `CRITERIOS_DESPUES_DE_LA_AUDITORIA.md`.
4. `00-corpus-maestro/01_TRANSCRIPCION_ORIGINAL.md` solo cuando necesites verificar una frase y su tiempo.
5. Si está disponible, **primer paquete** `ENORA_MetaAds_Conocimiento_Auditoria.zip`, informe de auditoría previo y/o su incorporación real. Si no está, **no asumir** que fue integrado; etiquetar la comparación como parcial.

## Prioridad: detectar estado real y duplicados, no escribir conocimiento nuevo

Comprueba primero en el repo (solo lectura) los paquetes de fuente de verdad, prompts, RAG, reglas, ingestión, embeddings, jobs, workers, conexión Meta/Shopify/Klaviyo, tests, telemetría y despliegues. Inspecciona `git status` al principio y al final. Debes citar rutas y líneas de código, no solo nombres de carpetas. Distingue código activo vs legacy, docs vs runtime, fixture vs datos reales y promesas comerciales vs pruebas.

Búsquedas orientativas (adáptalas a la estructura verdadera): `RAG`, `ingest`, `embedding`, `knowledge`, `document`, `source_id`, `chunk`, `version`, `dedup`, `tenant`, `RLS`, `Meta`, `insights`, `adset`, `learning`, `objective`, `spend`, `CPA`, `CAC`, `contribution`, `ROAS`, `LTV`, `payback`, `organic`, `creative`, `competitor`, `shopify`, `klaviyo`, `retention`, `cohort`, `profit`, `margin`, `attribution`, `statistical`, `confidence`.

### Fase A — Estado actual, incluyendo vídeo 01 si existe

- Identifica los documentos canónicos y sus consumidores actuales. No supongas que el primer ZIP se integró: distingue **pack propuesto / documentos versionados / embeddings persistidos / producción activa**.
- Localiza si hay motor de rentabilidad o de decisión presupuestaria; quién calcula CPA, ROAS, margen, CAC, LTV, beneficio absoluto.
- Determina datos realmente disponibles por tienda y sincronización, límites de permisos/API, timezones, moneda y atribución.
- Revisa si hay logs de cambios recientes en Meta, señales de fase de aprendizaje y posibilidad de leer assets orgánicos: `NO_VERIFICABLE` cuando corresponda.
- Inspecciona el pipeline de ingesta, idempotencia, versionado, deduplicación por ID/huella, reindexación y mecanismos de rollback.

### Fase B — Matriz de 9 módulos

Por cada uno `META-SB-001` a `META-SB-008` y `ECO-SB-001`:

1. ¿Existe el tema en el **primer pack**, en el **repo** y/o en el **índice RAG**? Diferencia cada sitio.
2. ¿Qué parte específica APORTA el vídeo 02? Referenciar minutos de `00_FICHA_FUENTE_Y_EXTRACCION.md`.
3. ¿Hay rutas de código y tests que demuestren uso en runtime? ¿Qué fuente abastece los datos? ¿Qué falta?
4. ¿Hay duplicidad de conceptos, definiciones, prompts o embeddings? ¿Qué fuente de verdad dejarías?
5. ¿Hay riesgo de recomendación causal, económica, estadística o de privacidad sin suficientes datos?
6. Estado `EXISTE_COMPLETO / EXISTE_PARCIAL / SOLO_DOCUMENTADO / DUPLICADO_CONFLICTIVO / NO_ENCONTRADO / OBSOLETO / NO_VERIFICABLE`.
7. Decisión `REUTILIZAR / AMPLIAR / FUSIONAR / CREAR_NUEVO / DESCARTAR / BLOQUEADO` y prioridad P0/P1/P2.

### Fase C — Resolver tensiones reales entre vídeos

Evalúa explícitamente, sin elegir una heurística como dogma:

- Primer vídeo: revisión tras ~3 días y posibles escalados 10-20 %. Segundo: 7-10 días o más. **Decisión depende de número de conversiones, calidad, riesgo, seguimiento y horizonte**.
- Primer vídeo: 3-5 o muchos anuncios creativos. Segundo: consolidar en una campaña/ad set. **Diferenciar ad de ad set de campaign**.
- Primer vídeo: targeting amplio. Segundo: especialización en nicho. **Separar audiencia configurada de mensaje publicitario**.
- Primer vídeo: ROAS breakeven por compra. Segundo: CAC mayor por valor del cliente y beneficio absoluto. **Separar primera compra de contribución LTV / caja / rentabilidad incremental**.
- Meta Ads Library: permanencia de 6 meses es un proxy; prohibido afirmar ROAS/beneficio de competidor.
- Orgánico exitoso: no demuestra performance de pago.
- Herramienta Holo y curso: contenido patrocinado, **no convertir en recomendación técnica ni conocimiento probado**.

### Fase D — Analizar calidad de datos y límites de IA

- Comprueba capacidad de comparar Meta/Shopify/Klaviyo **sin doble contabilización**, y disponibilidad de margen, devoluciones, costes, cohortes y cash payback.
- Si no hay tamaño de muestra suficiente, nunca recomendar resultados concluyentes o umbrales estadísticos arbitrarios.
- Verifica si «learning state» está disponible o solo se infiere.
- Seguridad: multi-tenant, PII, privacidad, mínimos permisos, observabilidad. No solicitar datos personales reales innecesarios.
- Separar descripción de un anuncio, análisis visual de assets y generación audiovisual: **el vídeo no explica cómo producir vídeos paso a paso**.
- Si los agentes usan OpenAI/Claude, revisar dónde se envían datos de clientes y control de contexto, sin realizar cambios.

### Fase E — Hoja de ruta postauditoría (solo propuesta)

Agrupa recomendaciones como:

- **P0:** errores reales de métricas, atribución, privacidad, duplicidad conflictiva o automatización insegura.
- **P1:** conocimiento incremental y lógica útil con datos disponibles.
- **P2:** experimentación avanzada, biblioteca de creativos, análisis orgánico y estudio de producción audiovisual con fuentes adicionales.

Cada iniciativa: `hallazgo`, `evidencia`, `impacto`, `reutilizar/fusionar/crear/descartar`, `rutas objetivo`, `dependencias`, `tests de regresión`, `esfuerzo relativo`, `criterios de aceptación`. **NO IMPLEMENTAR**.

## Entrega obligatoria en tu respuesta

### 1. Resumen ejecutivo
Estado de e-NORA y valor incremental del vídeo 02: qué suma, qué repite, qué descartar. Confirmar si primer ZIP está incorporado realmente o solo propuesto.

### 2. Arquitectura real con evidencias
Fuentes + sync + almacenamiento + ingestión/RAG + retrieval + agentes + motor de cálculo + permisos, con rutas:líneas y distinción de fase.

### 3. Matriz exhaustiva
`ID | Ya en vídeo 01 | Ya en repo | Runtime probado | Datos disponibles | Gap incremental | Evidencia | Decisión | Prioridad | Riesgo` para los 9 módulos y `CONTRACT`, `RUNTIME`, `GUARD`, `DATA`, `LEARNING`, `INGEST`.

### 4. Tensiones/resoluciones
Comparar *3 días vs 7-10*, *broad vs nicho*, *muchos anuncios vs consolidar*, *ROAS break-even vs LTV*, *Ads Library ≠ ROAS*, *orgánico ≠ conversión*. Distinguir claims de cada vídeo y criterios finales seguros.

### 5. Duplicados reales y estrategia de fusión
Lista de documentos/prompt/chunks/índices duplicados con origen, destino canónico real si se puede probar, política de IDs y versionado. **No reindexar**.

### 6. Plan priorizado NO EJECUTADO
P0/P1/P2 con tests y DoD, estimación relativa y dependencias. Especificar qué Markdown del nuevo pack se conservaría, fusionaría o descartaría. Plan para futuro ZIP de integración si procede.

### 7. Supuestos y no verificables
Por ejemplo: falta acceso al repo, primer ZIP no presente, no hay estadísticas reales, API sin acceso, fecha de vídeo no identificada.

### 8. Comprobación de solo lectura
Reportar `git status` inicio/fin y confirmar si puede verificarse: **0 escrituras, 0 migraciones, 0 embeddings, 0 cambios de anuncios, 0 despliegues**; no inventar cifras ni pruebas inexistentes.

## Regla final

**No amplíes el RAG por ampliar.** El éxito es identificar el mínimo conocimiento NUEVO capaz de mejorar decisiones reales, con política de evidencia, y conservar una única fuente de verdad aprobada para cada concepto. Si el repositorio ya cubre todo, recomienda **NO INTEGRAR NADA** y justifícalo.
