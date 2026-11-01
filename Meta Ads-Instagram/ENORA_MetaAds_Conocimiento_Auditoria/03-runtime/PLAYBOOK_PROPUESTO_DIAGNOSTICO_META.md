# Playbook propuesto para el runtime de análisis publicitario

**Estado:** propuesta, NO rutina existente ni orden de integración.

## Secuencia

**Paso 0 — Autorizar alcance.** Identificar tenant autenticado, conexión Meta y posibles permisos Shopify/Klaviyo. No consultar fuentes ajenas.

**Paso 1 — Resolver la pregunta.** Separar: entrega, funnel, rentabilidad, creativo o presupuesto. Definir periodo, comparación, granularidad y objetivo comercial.

**Paso 2 — Evaluar salud de datos.** Comprobar frescura, cobertura, sincronización, moneda, zona horaria, denominadores y ventana de atribución. Clasificar datos como `ok|partial|suspect|unknown`.

**Paso 3 — Consultar datos disponibles.** Métricas por campaña/ad set/anuncio, órdenes reales y estructura de costes de Shopify si existe, eventos/campañas de Klaviyo si procede. No asumir que todos los datos están integrados.

**Paso 4 — Calcular determinísticamente.** ROAS, CPA y ratios con definición única por indicador. Los cálculos viven en código/servicios de métricas; la IA no reimplementa aritmética improvisada en prompts.

**Paso 5 — Recuperar conocimiento.** Buscar módulos aprobados para explicar patrones, reglas y caveats; no traer transcripción íntegra como verdad única.

**Paso 6 — Inferir con límites.** Ordenar hipótesis por evidencia, adjuntar pruebas de contraste. Verificar si la causa es observable o solo sospechada.

**Paso 7 — Responder.** Mostrar resultado, evidencia, incertidumbre, siguiente acción y si se requiere autorización.

**Paso 8 — Telemetría.** Si ya existe observabilidad, registrar versión de reglas, fuentes y rechazos; mantener privacidad, minimización y permisos.

## Tabla de decisión

| Caso | Salida | No realizar |
|---|---|---|
| Sin entrega | Checklist de estado/restricción | Culpar al creativo sin impresiones |
| CTR bajo | Hipótesis creativa + benchmark interno comparable | Declarar hook malo sin ver vídeo |
| Clics sin landing | Revisar medición/UX | Afirmar velocidad lenta sin medir |
| ROAS alto, sin costes | Buen retorno publicitario atribuido; margen desconocido | Declarar beneficios |
| Escalado solicitado | Señales, riesgos, condiciones, aprobación | Modificar campaña sin permiso |

## Auditoría de integración

Buscar si existe flujo similar (agents/services/tools/skills/prompts/rules), nombres de funciones, contratos, métricas, guardrails y tests. Proponer extensión mínima del pipeline existente y coste de cómputo/indexado; evitar un segundo motor paralelo.
