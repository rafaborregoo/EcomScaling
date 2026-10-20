# Auditoría transversal estática de E-NORA

Fecha de corte: **19-10-2026**. Alcance: lectura focal del código y configuración actuales, descubrimiento mediante grafo MCP y confirmación en archivos. Complementa los anexos de Shopify, Meta, Klaviyo y stock; no los sustituye. No se han cambiado funcionalidades, ejecutado migraciones, instalado paquetes ni realizado escrituras remotas.

## Dictamen

Hay una base sustancial de producto: autenticación por token validado, roles y acceso por organización/tienda, RLS en migraciones, guardas de escritura, flujos de aprobación, trabajos con reintentos, observabilidad, mensajería, tareas, conocimiento y facturación. El problema no se resuelve creando más pantallas aisladas: debe cerrarse cada flujo de recurso, permiso, dato fresco, propuesta, acción y resultado.

Esta revisión encuentra **tres incidencias P1 concretas** —recuperación de webhooks de facturación, web con error de tipado fuera del gate CI y mensajes infundados de fiabilidad de margen— y varias brechas de madurez P2. No se ha demostrado una vulnerabilidad crítica ni un incidente en producción. La existencia de controles en código tampoco certifica su funcionamiento en todas las rutas o en la base desplegada.

Severidades: **P1** = priorizar antes de ampliar publicación/automatización o dar por cerrada la entrega; **P2** = resolver dentro de la consolidación y exigir criterio de aceptación. No se usa P0 sin prueba de un fallo crítico.

## 1. Hallazgos verificables

### T-01 · P1 · Un webhook fallido de Stripe se convierte en duplicado sin recuperar el efecto pendiente

**Evidencia:** `apps/api/src/stripe-webhook-handler.ts:248` consulta solo `id` cuando encuentra un evento previo y devuelve `200 duplicate` sin evaluar su estado; para `invoice.paid`, `:257` reintenta únicamente el email. El procesamiento de factura/rectificativa marca fallos `503` como reintentables en `:339` y `:424`, persiste `failed` en `:432` y devuelve `503` en `:449`. `apps/api/src/invoicing.ts:669` devuelve `billing_settings_not_configured` antes de crear factura. `:979` busca una factura ya existente para reenviar email y `:1000` termina con `skipped` cuando falta.

**Recorrido reproducible por lectura del código, sin ejecutar un cobro:**

1. Llega `invoice.paid` válido, con emisor/configuración de facturación todavía ausente.
2. Se inserta el evento en `private.webhook_events`.
3. La creación de factura falla con `503`; el evento queda `failed` y el handler responde `503`, indicando que merece reintentarse.
4. Tras completar la configuración, se reentrega **el mismo ID de evento**.
5. El insert choca con el evento ya persistido; la rama duplicada no distingue `failed` de `processed`.
6. Solo se busca una factura existente para enviar su email. Como la primera entrega no la creó, termina `skipped` y el handler devuelve `200 duplicate`.

**Consecuencia:** ese reintento no recupera automáticamente la factura faltante. Las rectificativas tampoco se reaplican en la rama duplicada. Adicionalmente, errores transitorios de base de datos en `applyStripeSubscription` no se clasifican como `retryable`, de modo que también terminan `200 failed`; esto requiere una política explícita de recuperación de acceso/suscripción.

**Límite:** no se afirma que haya pagos afectados en producción. La revisión no encontró un drenador Stripe que compensase esta rama; el drenador revisado en `shopify-webhook-handler.ts:1614` filtra expresamente `provider = shopify`.

**Cierre exigido:** distinguir recibido/en proceso/procesado/fallo reintentable/fallo definitivo; reclamar el evento de forma atómica antes de reaplicar, preservar la idempotencia del efecto y comprobar recuperación del mismo ID tras un fallo transitorio. Añadir un caso específico de factura ausente y otro de rectificativa pendiente. Mantener separado reenviar email de emitir la factura.

### T-02 · P1 · La web tiene un error de TypeScript que el gate de CI actual no ejecuta

**Evidencia:** el chequeo realizado durante esta auditoría devuelve `TS2322` en `apps/web/src/app/marketing/studio/content-studio.tsx:883:43`: `string | null` no es asignable a `string`. Log conservado en `evidencias/typecheck-web.txt`.

`.github/workflows/quality-gates.yml:29` ejecuta `npm run verify`; `:34` construye paquetes compartidos y API; después ejecuta tests AI/API y el preflight de migraciones. No llama al typecheck/build/tests/lint de web ni a checks de worker/mobile. `scripts/verify.mjs:13` recorre guardas `assert-*` y `auditar-columnas-motores.mjs`; no reemplaza esos chequeos. Los comandos web existen en `apps/web/package.json:5`.

**Consecuencia:** el workflow puede pasar sin detectar un error de tipado presente en una superficie de creación de contenido. El fallo de TypeScript por sí solo no demuestra el síntoma concreto que verá un usuario en el navegador.

**Cierre exigido:** corregir el contrato nullable y añadir al CI typecheck web y build de las superficies desplegables pertinentes. Ejecutar tests web/worker de contratos y navegación; el móvil debe tener al menos typecheck y un smoke de los flujos admitidos. No sustituirlos por contar archivos de test.

### T-03 · P1 · Se afirma una dirección y fiabilidad del margen que los datos disponibles no justifican

**Evidencia:** `apps/web/src/app/shopify/page.tsx:230` muestra «El margen real es mejor que el mostrado» cuando hay productos sin coste. `:231` muestra «Margen fiable» cuando ese contador es cero. La condición solo evalúa `metrics.margin.items_without_cost`.

**Consecuencia:** no conocer el coste de ciertos productos no permite inferir la dirección del margen real. Tener ese contador a cero tampoco acredita por sí solo que estén completos devoluciones, impuestos, gastos, portes, descuentos, periodo y frescura. El usuario puede leer una certeza financiera mayor de la que ofrece la evidencia.

**Cierre exigido:** sustituir por mensajes de completitud neutrales, por ejemplo «Falta coste en X productos; margen provisional», y derivar cualquier estado de fiabilidad de un contrato explícito de calidad, cobertura y fuentes.

### T-04 · P2 · El ejecutor genérico de mutaciones seguras existe, pero no está conectado al runtime revisado

**Evidencia:** `packages/integrations/src/safe-mutation.ts:103` define comprobación de objetivo, autoridad, dependencias, drift, campos y duplicados. `:290` define `executeSafeMutation`, que exige aprobación y relee tras escribir. El trazado inbound del grafo devolvió cero callers; la búsqueda confirmatoria en TypeScript actual solo encontró definición, invocación interna y tests, sin llamadas desde `apps/`.

**Interpretación correcta:** es una base de biblioteca, no evidencia de que todas las escrituras externas pasen por ella. Esto **no significa que las escrituras existentes estén desprotegidas**: hay guardas y aprobaciones específicas en otros servicios. `ai-runtime.ts:790` impide autoaprobar propuestas con escrituras; `:4919` describe `dry_run_write` como propuesta sin efectos.

**Cierre exigido:** inventariar cada mutación externa efectiva, guardas que realmente ejecuta, autorización, idempotencia, drift, verificación posterior y recuperación. Adoptar el helper donde encaje o acreditar controles equivalentes. Publicar una matriz de cobertura verificable por acción; no marcar F8 como capacidad universal a partir de tests puros del helper.

### T-05 · P2 · La auditoría de operaciones es best effort y puede faltar aunque la operación tenga éxito

**Evidencia:** `apps/api/src/audit-log.ts:6` documenta que fallar al auditar no debe romper la operación; `:38` registra `audit_log_insert_failed` pero no propaga el fallo.

**Implicación:** esta es una decisión de disponibilidad, no una vulnerabilidad demostrada. Para futuras publicaciones externas, ajustes de stock o cambios sensibles, un éxito del endpoint no garantiza la presencia de su fila de auditoría.

**Cierre exigido:** decidir qué operaciones toleran esa pérdida y cuáles necesitan evidencia durable/outbox vinculada al efecto. Alertar los fallos de auditoría y verificar reconciliación. No convertir cada acción de bajo impacto en una transacción compleja sin necesidad.

### T-06 · P2 · La cobertura automatizada está repartida y el móvil carece de suite de tests inventariada

**Evidencia:** `evidencias/inventario-superficies.json` cuenta 116 archivos test web, 323 API, 5 worker, 122 packages y 0 en `apps/mobile`. `apps/mobile/package.json:6` declara typecheck y comandos Expo, sin script test. Son conteos estáticos, no porcentaje de cobertura ni resultados.

**Cierre exigido:** seleccionar flujos de alto valor —login, selector de organización/tienda, aprobar/rechazar, mensaje, push y acceso denegado— y verificar el contrato compartido web/móvil. `apps/mobile/lib/api.ts:24` conserva un tipo Bootstrap copiado con un comentario de deuda: conviene llevarlo a contratos cuando se consolide el selector y las capacidades.

### T-07 · P2 · Un workflow de uptime verde puede representar un monitor no configurado

**Evidencia:** `.github/workflows/external-uptime.yml:21` detecta ausencia de URL/token y termina con `exit 0` en `:23`; `:69` también permite omitir el webhook de alertas.

**Interpretación:** no se ha comprobado si faltan secretos en la instalación actual. El hallazgo es que el estado verde del workflow no acredita por sí solo una sonda activa ni entrega de alertas.

**Cierre exigido:** distinguir monitor activo, configuración ausente y sonda fallida en el panel operativo; realizar una prueba controlada de alerta y recuperación. Vigilar API, worker y frescura por fuente como señales distintas.

## 2. Controles y fortalezas realmente presentes

| Área | Evidencia actual | Qué acredita y qué no |
| --- | --- | --- |
| Autenticación | `apps/api/src/auth-context.ts:414` resuelve contexto con `supabase.auth.getUser(token)`; `:226` usa cliente con JWT de usuario | Validación de identidad y RLS para consultas con ese cliente. No acredita rutas que usan service role sin revisar sus guardas. |
| Acceso por organización/tienda | `auth-context.ts:53`, `:128` y `:155` distinguen tienda, acceso propio, asignación y organización operativa | Hay modelo explícito de autoridad. Las nuevas páginas deben conservarlo al navegar y filtrar. |
| Solo lectura, permisos del consultor y MFA | `org-access-guard.ts:111` decide acceso; `organization-settings.ts:465` registra preHandler; `server.ts:1050` lo instala | No es solo un banner de frontend: hay control servidor. Su cobertura se basa en patrones de ruta y debe extenderse junto a nuevas acciones. |
| RLS | `supabase/migrations/20260715123333_db_02_auth_multitenant_rls.sql:333` habilita RLS para entidades base; `scripts/assert-rls-coverage.mjs:22` inventaría tablas y políticas | Existe defensa en base y una guarda estática. No prueba las políticas finales realmente desplegadas ni aislamiento de todas las RPC. |
| Pruebas de aislamiento | `apps/api/src/rls-tenant-isolation.test.ts:1`, `be-01-cross-tenant-write-endpoints.test.ts:1`; `scripts/run-remote-tests.mjs:14` requiere entorno distinto de producción | Hay pruebas remotas y protección para ejecutarlas. No se han ejecutado aquí; no confundir tests unitarios con esos tests de RLS. |
| Aprobación IA | `ai-runtime.ts:790` y `:6384` determinan aprobación; `:4919` separa dry run y escritura | Una propuesta no equivale a una ejecución. El siguiente paso es probar la acción real y el estado final. |
| Webhooks Shopify | `shopify-webhook-handler.ts:1544` contempla eventos fallidos; `:1633` reclama por CAS | Hay reintentos y control de concurrencia específicos. No extrapolar esta fortaleza al handler Stripe. |
| Worker y observabilidad | `apps/worker/src/worker.ts:416`, `:499`, `:548`; `worker-http.ts:29` ofrece timeout/backoff | Se registran resultados de jobs y heartbeat Redis con TTL. No prueba cron instalado ni que cada dataset esté fresco. |
| Logs y telemetría | `packages/observability/src/index.ts:31`, `:95` redactan credenciales y acotan payloads | Minimización y redacción implementadas. El propio código aclara que no es un clasificador de toda PII. |
| Mensajería | `consultant-messages.ts:56` verifica actor en workspace; `:622` inicia escritura con control; `:650` filtra prefijo de adjuntos | Hay conversación real, organización y URLs firmadas. Falta validar entrega, adjuntos y revocación en runtime. |
| Conocimiento | `knowledge.ts:159` restringe metodología global a platform admin y gestión de organización a roles; `:298` valida tienda | Existe separación global/organización/tienda. No certifica cada resultado de retrieval o su utilidad para el agente. |
| Tareas y avisos | `operations.ts:29` exige organización operativa; `:159` usa alertas/tareas; `notify.ts:37` centraliza notificación | Ya hay base de ejecución interna. Las nuevas recomendaciones deben abrir y actualizar esos objetos compartidos. |
| Facturación | `stripe-webhook-handler.ts:196` valida firma; `:233` persiste evento; `invoicing.ts:650` crea factura | Hay controles de autenticidad e idempotencia. Debe cerrarse la recuperación T-01; no se certifica cumplimiento fiscal ni conciliación real. |

## 3. Frescura, jobs y salud: cierre operativo necesario

La programación está versionada: `apps/worker/src/repeatable-jobs.ts:1` define reconciliaciones de fuentes; `:19` define el diagnóstico dos veces al día; `ops/vps/e-nora.crontab` encadena motores nocturnos y otras tareas. El crontab documenta `flock` por job y el worker emite heartbeat. Esto es una base operativa concreta, pero no demuestra que los procesos estén activos en el VPS ni que la última sincronización haya sido completa.

`apps/api/src/server.ts:1191` define readiness por Supabase y Redis. Esa comprobación responde a disponibilidad del API; la UI de negocio necesita además edad y completitud por tienda, conexión y bloque. Para stock, una API saludable puede estar sirviendo una foto antigua. El objetivo del roadmap debe ser que la alerta lleve su propia frescura y que una sincronización parcial no se anuncie como catálogo completo.

Gates de aceptación operativos: job registrado y ejecutado; fallo visible; reintento acotado; ausencia de doble programación; recuperación tras reinicio; reconciliación de eventos perdidos; última ejecución correcta por bloque; umbral de datos antiguos por caso de uso; alerta entregada y recuperada. Verificarlos en un entorno controlado sin inferirlos del archivo cron.

## 4. Superficies y consistencia del producto

El inventario estático encuentra **90 páginas** y **1 route handler Next**, distribuidas entre administración, dashboard, canales, marketing, tareas, propuestas, planificación, mensajes, llamadas, informes, conocimiento, integraciones y facturación. Gran parte del backend está en el API dedicado; contar un solo route handler de Next no implica que falten endpoints.

El inventario no encontró `href` literales sin página correspondiente. Por tanto, esta revisión no respalda afirmar que existan 404 generalizados. Los problemas de navegación pueden ser de **destino semántico, permisos, tienda seleccionada, filtros, query params o anclas**, que esa comprobación no cubre. El contrato de navegación del plan principal debe incluir todos ellos.

La coexistencia de `/dashboard?tab=...`, páginas de canal y páginas de recursos exige definir una función única para cada destino: resumen ejecutivo, analítica por fuente, gestión del recurso y detalle. Reutilizar componentes es positivo; mostrar el mismo contenido bajo varios destinos sin un propósito claro produce confusión y métricas con contexto distinto.

La app móvil es deliberadamente selectiva: `apps/mobile/README.md:5` define que no replica la web y detalla excepciones aceptadas. Usa el mismo API en `lib/api.ts:6` y guarda la sesión con SecureStore en `lib/supabase.ts:5`. El plan de navegación no debe exigir paridad visual completa: debe preservar identidad de recurso, tienda, permiso y resultado de acciones, con acceso a la web para trabajo complejo.

## 5. Áreas que no se han certificado en runtime

- Estado real del esquema, grants, políticas RLS, funciones SECURITY DEFINER y migraciones aplicadas. Un nombre de migración fechado después del corte no demuestra cuándo fue desplegada: se ha leído el repositorio actual, no reconstruido su historial de producción.
- Denegación con dos tenants y varios roles reales; revocación de acceso, invitaciones, MFA y cambios de tienda durante una sesión. El contexto tiene caché de 30 segundos (`auth-context.ts:613`); las rutas con service role requieren comprobar expresamente cómo revalidan autoridad, sin asumir que RLS las cubre.
- Cobertura de guardas sobre **todas** las rutas, endpoints administrativos, uploads y RPC. La inspección focal no demuestra ausencia de vulnerabilidades en los restantes archivos.
- Estado de las conexiones reales, scopes efectivamente concedidos, datos antiguos, cron/Redis/VPS, dead letters y recepción de alertas.
- Entrega real de mensajes, push, emails, informes programados, resúmenes de llamadas y persistencia de adjuntos.
- Conciliación de cobros, acceso derivado de suscripción, eventos fuera de orden, bajas y reembolsos; validez fiscal del flujo de facturas.
- Aislamiento de retrieval, vigencia de metodología, calidad de respuestas y conexión entre propuestas aprobadas, tareas y resultados observados.
- Rendimiento con carga, accesibilidad, navegación en navegador y dispositivos reales, tamaño de builds y experiencia móvil sin red.

## 6. Criterios transversales para dar por terminada la reorganización

1. Cada recurso tiene identidad, proveedor, organización y tienda; sus alertas abren el destino exacto con contexto conservado.
2. Cada pantalla distingue lectura, edición, propuesta y publicación según capacidad efectiva; una capacidad no disponible se explica con siguiente paso.
3. Cada dato decisivo enseña cobertura y frescura; no hay falsas garantías de margen, atribución o previsión.
4. Cada mutación externa identifica quién autoriza, qué se cambia, idempotencia, estado previo y resultado remoto; fallo o resultado desconocido no se presenta como éxito.
5. Los eventos fallidos se recuperan sin duplicar el efecto, especialmente facturación y acciones de marketing.
6. CI comprueba las superficies que se entregan. Los tests de contrato no sustituyen un flujo real y los tests remotos se ejecutan solo contra proyecto aislado.
7. Web y móvil comparten contrato de acciones, permisos y contexto; la móvil implementa solo su alcance aprobado.
8. La validación final recorre login → conexión → sync → recurso → recomendación → aprobación → acción → verificación → auditoría/alerta, con pruebas negativas de rol y tenant.

## 7. Validación realizada y evidencia

- Descubrimiento de funciones/relaciones mediante MCP y lectura confirmatoria de código local.
- Inventario de superficies y tests en `evidencias/inventario-superficies.json`, con los límites metodológicos que declara.
- Selección de conectores y navegación ejecutada por el proceso principal: **69/69 tests pasaron**. Esto no es el total de la suite del software ni valida navegación en navegador.
- Typecheck web ejecutado por el proceso principal: **falló** por el TS2322 documentado en `evidencias/typecheck-web.txt`.
- No se han ejecutado aquí suites remotas, tests de mutación, pruebas de producción ni un chequeo completo de seguridad/performance. Los recorridos de T-01 son evidencia estática suficiente para priorizar y diseñar su prueba; no se hizo un cobro de reproducción.
