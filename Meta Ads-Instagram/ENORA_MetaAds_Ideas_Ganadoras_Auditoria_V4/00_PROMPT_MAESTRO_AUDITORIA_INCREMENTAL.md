# PROMPT MAESTRO PARA CLAUDE CODE — AUDITORÍA INCREMENTAL V04 DE e-NORA

## Rol y alcance
Actúa como auditor senior de e-NORA, SaaS ecommerce que conecta Shopify, Meta y Klaviyo. **No es el CRM inmobiliario NORA.** Este ZIP trata el cuarto vídeo sobre big ideas, patrones creativos y dos rutas de búsqueda de nuevos conceptos. El objetivo es conocer su **valor incremental REAL** respecto a V01, V02, V03 y al código/DB/agentes/RAG actuales. No supongas que ningún ZIP anterior haya sido instalado o indexado.

## RESTRICCIÓN ABSOLUTA: SOLO LECTURA — NO IMPLEMENTAR
No modifiques archivos, no crees MD dentro del repositorio, no hagas commits, migraciones, cambios de esquema, inserts, reindexado ni embeddings, no cambies prompts en producción, no instales dependencias, no generes jobs, no publiques ni cambies presupuestos/campañas, no uses material privado sin autorización y no conectes APIs de terceros por tu cuenta. La tarea es **auditoría y propuesta**; entrega íntegramente tu informe en el chat, sin escribir en el proyecto. Si alguna acción aparentemente de “lectura” desencadenaría efectos secundarios, no la ejecutes. Comprueba `git status` antes y después si el repo está disponible.

## 1. Material y verificación de procedencia
- Leer `README.md`, `MANIFIESTO.md` y `00-corpus-maestro/00_FICHA_FUENTE_Y_TRAZABILIDAD.md`.
- Revisar los 10 MDs `META-CV-001..010` en `01-rag-produccion/`; son **candidatos**, no conocimiento certificado.
- Revisar `02-contratos-IA/`, `03-runtime/`, `04-policies-guardrails/`, `05-experience-learning/`, `06-tenant-context/` y `99-auditoria/`.
- Contrastar las afirmaciones con `00-corpus-maestro/01_TRANSCRIPCION_ORIGINAL.md`; citar minutos y no añadir técnicas que el vídeo no enseña.
- Comparar con paquetes V01 (Meta setup/diagnóstico), V02 (bajo presupuesto) y V03 (research/personas/gaps) **solo cuando estén disponibles**; si faltan, declarar comparación parcial.

## 2. Descubrir el sistema REAL, sin suposiciones
Inventariar repositorios, arquitectura, agentes, tools, prompts/versiones, workflows, flags, RAG, fuentes, chunking, embeddings/index, búsqueda híbrida, dedup/hashing, tests, estados de despliegue y consumers activos. Diferenciar sistemáticamente:
- **Código existente** vs **ruta invocada** vs **función probada** vs **función activa en producción**.
- **MD en repo** vs **fragmento indexado** vs **contexto recuperado por el agente** vs **respuesta demostrada en test**.
- **Conector enlazado** vs **scopes/recursos realmente autorizados** vs **datos disponibles**.
- **Herramienta analítica** vs **herramienta generadora de creativos/vídeo** vs **publicación automática**.

Localizar entidad/tabla de campañas, conjuntos, ads, creativos, assets, insights, contenido orgánico, reviews, catálogo, costes, perfiles comerciales, RAG, experimentos, memorias y tenancies. Usar `rg`/lectura local y consultas **read-only** solo si están autorizadas. Registrar `ruta:línea` y, para DB, nombres de tablas/campos y permisos que se puedan inspeccionar; no exponer secretos ni PII. No asumir permiso de TikTok ni acceso a contenido audiovisual por conectar Meta Ads.

## 3. Auditoría específica de 10 módulos V04
Por CADA `META-CV-001..010` responder:
1. Qué afirmación exacta surge del vídeo (minuto) y qué se añadió como interpretación propuesta.
2. Qué está ya en V01/V02/V03 (indicar MD y sección cuando sean accesibles).
3. Qué existe en repositorio/código/prompts/DB/índice y cuáles son sus consumers; evidencia `ruta:línea`.
4. Cuál es el incremento neto, si existe, y qué se estaría duplicando.
5. Qué datos, scopes, volumen y calidad necesita; ¿son accesibles en realidad?
6. Riesgo: privacidad, RLS, atribución, PII, audio/vídeo, derechos, marketing claims, experimentación, sesgo o costes.
7. Estado: `IMPLEMENTADO_PROBADO | IMPLEMENTADO_NO_CONSUMIDO | DOCUMENTADO_NO_ACTIVO | SOLO_PROPUESTA | DUPLICADO | CONFLICTO | NO_ENCONTRADO | NO_VERIFICABLE | BLOQUEADO_DATOS`.
8. Decisión: `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR`, prioridad P0/P1/P2, evidencia y coste relativo.

Extender matriz a `CONTRATO`, `TAXONOMIA`, `PLAYBOOK`, `GUARDRAILS`, `EXPERIMENTOS`, `TENANT_DATA` e `INGESTA`.

## 4. Preguntas funcionales decisivas
- ¿Existe una representación canónica de `big_idea`, `angle`, `hook`, `concept`, `format`, `persona_need`, `family_id` y `evidence_source`? Si existe, ¿dónde y quién la usa? **No construir otra taxonomía.**
- ¿Puede el agente distinguir **texto del anuncio** de **contenido visual o audio** realmente accesible? ¿Tiene permisos y código para analizar activos? ¿Cita fuente de cada etiqueta?
- ¿Puede obtener de Meta histórico de ads + métricas comparables con atribución y rendimiento económico? ¿Puede unirlo a órdenes/márgenes Shopify sin doble contabilización?
- ¿Existe una biblioteca de creativos ganadores? ¿Qué significa “ganador” en código: gasto, ROAS, beneficio, compras, significancia o algo diferente?
- ¿Tiene memoria de hipótesis/experimentos por tenant, metadatos de cambios y resultados negativos? ¿Está separada del corpus RAG global?
- ¿Tiene acceso autorizado a contenidos orgánicos de Instagram/TikTok y a sus métricas? ¿Qué parte sería investigación humana o aporte manual?
- ¿Ya hay funciones de buyer persona, brecha de cobertura, creative brief, estrategia mensual/trimestral, propuestas de hooks, vídeo/UGC o formatos estáticos? ¿Cuál está invocada por agentes reales?
- ¿Hay un motor de priorización de oportunidades basado en coste de producción, tiempo a información, evidencia y rentabilidad? ¿Pueden conocerse sus entradas?
- ¿Puede producir vídeo, editarlo o publicarlo? **El vídeo V04 NO enseña los pasos técnicos**. Distinguir capacidades y backlog.

## 5. Resolver tensiones V01–V04
Analiza expresamente al menos:
- V02 “modelar competidores” frente a V03/V04 “no copiar”. **Investigación de patrón ≠ plagio; antigüedad e impresiones ≠ ROI.**
- V01/V02 volumen de variaciones frente a V03 estrategia primero y V04 big idea + test económico.
- V02 contenido orgánico como test frente a V04 orgánico externo como hipótesis; no confundir interacción/viralidad con conversiones.
- V03 persona × angle × awareness × format frente a V04 big idea como unidad y `family_id`. Diseñar **una sola taxonomía**.
- V02 periodos de aprendizaje y presupuestos bajos frente a V04 validaciones mínimas: cuánto dato se requiere antes de etiquetar ganador.
- V01/02 ROAS/CPA/LTV y V03 bundle/AOV frente a V04 alto gasto/escala. **Gasto y ROAS solos no prueban beneficio**.
- V03 encontrar gaps en clientes/reviews vs V04 público nuevo desde orgánico; evitar personas sensibles y sesgos del marketing actual.
- Afirmación V04 “siete exposiciones antes de compra”, ejemplos de inversión elevada, partnership ads que escalan y probabilidades de éxito: **NO tratarlas como reglas validadas**.

## 6. Seguridad, cumplimiento y observabilidad
Verificar `tenant_id`, RLS/scoping de DB, secretos y scopes, límites de retención, tratamiento de PII en comentarios/reseñas, transferencia a proveedores IA realmente utilizados, prompts injection, copyright, licencias UGC, música, marcas ajenas, testimonio auténtico, claims de producto y políticas de anuncios. Prohibir inferencia de atributos sensibles y uso de medios ajenos sin permiso. Identificar bloqueos P0 con rutas relevantes. No manipular datos personales reales para esta auditoría.

## 7. Validación económica y estadística
Auditar definiciones de ganador, comparabilidad de ventanas, evento de conversión, objetivos, atribución, cambios de campaña, volumen de ventas, márgenes, costes variables, sesgo de selección por algoritmo y experimentos. Diferenciar `señal observacional`, `hipótesis` y `resultado validado`. Nunca recomendar automatizar ajuste/presupuesto/publicación sobre señales débiles.

## 8. Qué debe entregar la auditoría (SOLO INFORME EN CHAT)
**A. Resumen ejecutivo:** 5–10 hallazgos, mayor novedad de V04, material repetido, bloqueos de datos y riesgos.

**B. Arquitectura comprobada:** mapa de agentes, rutas, prompts, fuentes, índices, tablas, conectores, permisos y estado operativo; citar `ruta:línea`.

**C. Matriz completa:** 10 filas V04 + contratos, runtime, guardrails, experiencia, datos e ingesta con: `ID | minutos | V01–V03 | evidencia repo | runtime | indexado verificado | datos/scopes | estado | decisión | prioridad | causa`.

**D. Comparación de cuatro vídeos:** duplicados semánticos, contradicciones y política única para big ideas, presupuesto, personas, pruebas y producción.

**E. Diagnóstico de creative intelligence:** ejecución real de route propio vs orgánico, big idea y familias, asignación de hipótesis, experimentación y aprendizaje aislado.

**F. Plan FUTURO P0/P1/P2 (NO EJECUTADO):** por cada acción especificar problema, rutas, propuesta mínima, datos, seguridad, pruebas, DoD, dependencias y coste relativo; indicar para cada uno de los **10 MD** `CONSERVAR | FUSIONAR | AMPLIAR | DESCARTAR | BLOQUEAR`.

**G. Estrategia futura de RAG:** documentos canónicos, IDs, diffs, dedup/hash por chunk, minimización PII, prueba retrieval, versionado, rollback, reindexación selectiva y separación corpus global/tenant. **No ejecutar ingesta ni generar embeddings**.

**H. Lagunas/limitaciones:** qué repositorio, ZIP previos, herramientas, scopes, assets o datos no se pudieron observar; usar `NO_VERIFICABLE` sin adivinar.

**I. Confirmación de solo lectura:** `git status` antes/después cuando proceda; indicar qué se inspeccionó y confirmar sólo lo que puedas acreditar sobre escrituras, embeddings, DB y campañas.

## Política final
El resultado no es “integrar los diez MD porque están escritos”. Es descubrir si aportan conocimiento NUEVO, reutilizar el contrato canónico, bloquear riesgos y definir el siguiente paso mínimo implementable. **Detente al terminar la auditoría; espera autorización explícita para integrar.**
