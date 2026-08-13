# AI-11 - Generador de contenido de marketing (email/flows/pop-ups) para Klaviyo

> Aclaracion vigente 2026-08-02: INT-03/DB-09/BE-06 ya tienen el vertical slice de lectura
> preparado y el reporting expuesto; las menciones historicas que los describen como inexistentes o
> `planned` quedan supersedidas. La dependencia real de la Fase B es disponer de una cuenta Klaviyo
> conectada y validar resultados externos, no rehacer la interfaz.

## Estado

> **Estado vigente 2026-08-02:** `implemented_partial`. La Fase A está implementada con agente A11,
> persistencia de drafts, edición/versionado, aprobación humana, preview seguro y UI `/marketing`.
> La Fase B continúa pendiente porque requiere credenciales, Reporting API y datos reales de Klaviyo.

> **Correccion documental 2026-08-02:** el contrato de salida de la Fase A ya existe en
> `packages/ai/src/index.ts` (`klaviyoEmailOutputSchema`, JSON Schema equivalente y
> `sanitizeGeneratedEmailHtml`), con tests de validación y sanitización. La fase sigue
> La nota histórica que declaraba `planned` y ausencia de agente, persistencia, aprobación, preview
> y UI queda supersedida por la implementación de la Fase A descrita arriba.

- **Estado real:** `implemented_partial` (la Fase A ya tiene agente, persistencia, edición/versionado, aprobación, preview y UI; el contrato de salida y sanitización ya existen. Este documento fija el contrato
  antes de escribir la primera linea, siguiendo la misma disciplina que INT-03/DB-09/BE-06, de los que esta
  fase depende para su mitad de aprendizaje).
- **Responsable:** sin asignar

> **Corrección de estado:** la descripción histórica inmediatamente anterior que habla de una fase
> sin agente, persistencia ni UI queda supersedida. La Fase A vigente es `implemented_partial`; solo
> la publicación/envío y el aprendizaje con resultados reales pertenecen a la Fase B pendiente.
- **Ultima validacion:** 2026-08-02
- **Dependencias:** AI-00 (runtime/contratos comunes), INT-03/DB-09/BE-06 (Klaviyo — solo para la Fase B,
  ver abajo), AI-10 (envolvente comun de salida, si ya existe cuando se implemente este agente)
- **Bloqueador:** ninguno para la Fase A (generador). La Fase B (aprendizaje de resultados reales) esta
  bloqueada por que INT-03/DB-09/BE-06 no tienen ni una linea de codigo hoy (confirmado:
  `grep -rl klaviyo apps/api/src` no devuelve nada salvo referencias de categoria).

> **Implementacion parcial 2026-08-02:** la Fase A ya incluye el agente A11, persistencia de
> drafts, aprobacion, preview seguro y UI en `/marketing`. Sigue sin publicar ni enviar contenido
> a Klaviyo; la Fase B depende de datos reales y Reporting API.

## Objetivo

Un agente que redacta el contenido de campañas/broadcasts, flows y pop-ups de Klaviyo, y devuelve HTML
listo para pegar manualmente en el editor de Klaviyo — no para enviarlo via API. Con el tiempo, que el
agente aprenda de que campañas funcionaron mejor (aperturas, clics, revenue real via Reporting API de
Klaviyo) para mejorar las sugerencias siguientes, en vez de generar contenido a ciegas cada vez.

## Por que se divide en dos fases, no una

El generador de HTML no necesita ningun dato de Klaviyo para funcionar — es generacion de contenido a
partir de contexto que da el consultor (producto, oferta, tono, audiencia). El aprendizaje de resultados
si necesita datos reales de rendimiento, que hoy no existen en ningun sitio del sistema porque la
integracion de lectura de Klaviyo (INT-03) sigue `planned`. Tratarlo como una sola fase generaria la
tentacion de construir el generador y despues bloquearlo esperando la integracion — mejor declarar
explicitamente que son entregables independientes con una dependencia de una via.

### Fase A — Generador (sin integracion Klaviyo, se puede construir ya)

- Agente nuevo (`agent_code` a decidir, p. ej. `A11` siguiendo la numeracion de AI-05) con contrato de
  entrada/salida en `packages/ai/src/index.ts`, igual que `callSummaryOutputSchema`/`chatOutputSchema`.
- Input: tipo de contenido (`campaign` | `flow_step` | `popup`), producto/oferta, tono, audiencia,
  objetivo (venta, reactivacion, bienvenida, etc.), y opcionalmente contenido previo del cliente como
  referencia de estilo.
- Output: HTML de email (inline styles, compatible con clientes de correo — nunca CSS externo ni Flexbox/
  Grid, que la mayoria de clientes de email no soportan) para `campaign`/`flow_step`; snippet HTML mas
  ligero para `popup` (el formato que Klaviyo espera en su editor de formularios es distinto de un email
  completo — confirmar contra la guia de referencia `Klaviyo/EcomScaling_IA_Guia_Klaviyo_API.md` antes de
  fijar el contrato exacto).
- Aprobacion humana antes de mostrar el HTML final como "listo para copiar" (mismo patron que A01: borrador
  -> revision -> aprobado), no porque el agente escriba en el dominio (no escribe, solo genera texto/HTML)
  sino porque un email mal redactado que se copia directo a Klaviyo y se envia a la lista completa de un
  cliente es dificil de deshacer.
- UI: nueva superficie en `/conocimiento` o una pagina propia (a decidir, ver Fuera de alcance) con
  selector de tipo de contenido, formulario de contexto, preview del HTML renderizado, boton "copiar HTML".

### Fase B — Aprendizaje de resultados reales (bloqueada por INT-03/DB-09/BE-06)

- Depende de que exista `klaviyo_report_runs`/`klaviyo_report_values` (DB-09, tablas ya nombradas en el
  documento de esa fase) con datos reales de la Reporting API de Klaviyo, usando el
  `conversion_metric_id` configurable por cuenta que INT-03 ya decidio como requisito.
- El agente recibe como contexto adicional el rendimiento de campañas/flows anteriores del mismo cliente
  (asunto, tipo de oferta, dia/hora de envio, tasa de apertura/clic/conversion) para sugerir mejoras
  concretas, no genericas ("prueba asuntos mas cortos" sin datos que lo respalden).
- Sin Fase A funcionando primero, no hay contenido generado por el sistema que correlacionar con
  resultados — por eso Fase B no puede empezar antes que Fase A, independientemente de cuando este lista
  la integracion Klaviyo.

## Tipos de contenido cubiertos (decidido 2026-07-22)

- Campañas/broadcasts (email puntual: promociones, lanzamientos, newsletters).
- Flows (secuencias automatizadas: bienvenida, carrito abandonado, post-compra, etc.) — el agente genera
  el HTML de cada email de la secuencia, no la logica de disparo/temporizacion del flow (eso se configura
  en Klaviyo directamente, fuera de alcance de este agente).
- Pop-ups/formularios de captura — contenido y copy del pop-up, no el editor visual de posicionamiento/
  disparo (eso tambien vive en Klaviyo).

## Decisiones que hay que cerrar antes de escribir codigo

- Que motor de plantillas/HTML usa el agente para garantizar compatibilidad con clientes de correo
  (tablas HTML + inline styles es el estandar de la industria; librerias tipo MJML podrian generarlo, a
  evaluar).
- Si el HTML generado incluye variables de personalizacion de Klaviyo (`{{ first_name|default:'ahi' }}`)
  o si eso lo añade el consultor manualmente despues de pegar — afecta si el agente necesita conocer la
  sintaxis de shortcodes de Klaviyo.
- Formato exacto del snippet de pop-up (Klaviyo tiene su propio editor de formularios con bloques, no
  siempre acepta HTML libre pegado) — verificar contra la guia de referencia antes de fijar el contrato de
  `content` para `popup`.
- Si la Fase A necesita su propia tabla (`marketing_content_drafts` o similar) para guardar borradores/
  aprobados con historial, o si vive solo como `agent_outputs` generico (AI-00) sin tabla de dominio nueva
  — decidir antes de la primera migracion, no despues.

## Fuera de alcance (no implementar sin pedirlo explicitamente)

- Enviar contenido directamente via la API de Klaviyo (`campaigns:write`, no listado en los scopes MVP de
  INT-03) — el flujo v1 es siempre copiar-pegar manual, nunca envio automatico.
- Editor visual drag-and-drop de emails — la salida es HTML, no un builder interactivo.
- Fase B antes de que INT-03/DB-09/BE-06 tengan datos reales de Reporting API funcionando — no simular
  metricas de rendimiento para adelantar el aprendizaje.

## Criterios de cierre (Fase A)

- El agente genera HTML valido (renderiza correctamente en al menos Gmail y Outlook, los dos motores de
  render mas restrictivos) para los 3 tipos de contenido.
- Aprobacion humana requerida antes de marcar un borrador como "listo para copiar".
- Test de guarda de calidad estructural (mismo patron que `checkOutputSanity`, AI-00) que rechace HTML
  vacio, roto o sin las secciones minimas esperadas.

## Dependencia de Tool Layer

Antes de activar la infraestructura IA de este agente debe completarse [AI-00A — Fundación del Tool Layer](./AI-00A-tool-layer-foundation.md). El generador de Klaviyo utilizará `propose_content`, `knowledge_search`, `data_coverage`, `cite_source` y `report_confidence`.

La generación de emails y plantillas debe persistir el borrador, HTML sanitizado, bloques reutilizables, asunto, preheader, tokens de personalización, variantes, fuentes, warnings y aprobación. `klaviyo_create_flow` y `klaviyo_send_campaign` quedan fuera del camino automático hasta tener conexión, scopes, dry-run, idempotencia, rollback y aprobación explícita.

## Criterios de cierre (Fase B)

- El contexto de rendimiento pasado se construye desde datos reales de `klaviyo_report_values` (INT-03),
  nunca desde una suposicion o un promedio generico de la industria.
- El agente puede citar el dato concreto que respalda una sugerencia ("las ultimas 3 campañas con asunto
  de menos de 40 caracteres tuvieron 12% mas apertura"), no solo dar el consejo sin evidencia.
