# ADR-0027: Analista de métricas — reglas deciden, la IA explica

## Estado

Aceptada — 2026-10-16. Fase 1 (capa determinista) implementada; fases 2 y 3 planificadas en
[PLAN_ANALISTA_METRICAS.md](../PLAN_ANALISTA_METRICAS.md).

## Contexto

Rafa quiere "un agente específico para cada métrica": que cada cifra del panel (web y móvil) diga si va
bien o mal, por qué y qué hacer. Tenemos 26 agentes; cada uno exige prompt, rúbrica del juez, dataset y
gate de release (`agent_version_has_release_evidence`: 10 casos gold + 3 holdout de producción). Un
agente por métrica (~40) no saldría nunca del gate y multiplicaría el mantenimiento.

## Decisión

1. **Un analista, una ficha por métrica.** `METRIC_SPECS` en `packages/contracts/src/metric-analyst.ts`:
   definición, fórmula, dirección, drivers (qué la mueve), muestra mínima, agentes de área que la cubren
   y plataforma que se la atribuye. Añadir una métrica = añadir una ficha y su observación en
   `apps/api/src/metric-analysis.ts`.
2. **El veredicto lo deciden reglas con fuente, no el modelo.** `assessMetric` aplica, por orden de
   peso: umbral económico de la tienda (MER/ROAS de equilibrio, CAC máximo por pedido — solo con costes
   completos), objetivo fijado por el consultor (`organization_metric_targets`), tendencia frente al
   periodo anterior (±15 % vigilar, ±30 % mal) e historial de 12 meses (cuartiles). Antes de todo, un
   guardarraíl de muestra mínima: sin volumen no hay veredicto. Cada razón lleva su fuente y la confianza
   sale de ellas (económica = alta; objetivo/historial = media; solo tendencia = baja).
3. **La IA explica, no juzga** (fase 2, A29 `a29_analista_metrica`): recibe el veredicto, los drivers,
   la metodología del RAG global y los hallazgos de los agentes de área de la ficha, y redacta causa
   probable y una o dos acciones. Solo lectura, generación al pulsar, caché 24 h por
   tienda+métrica+periodo. Pasa por el juez (el gate de release se quitó el 2026-10-16, migración `20261226100000`).
4. **Aprender = calibrar, no reentrenar** (fase 3, ADR-0017): feedback del consultor por análisis,
   resultado medido de las acciones tomadas y, con suficientes tiendas, benchmarks anonimizados por
   segmento. Ajustan umbrales y fichas versionadas; nada se aprende en silencio.
5. **ADR-0021 se respeta en la ficha**: métricas atribuidas llevan `attributedBy` y su etiqueta lo dice;
   las métricas unidas (MER, CAC de cliente nuevo) usan ventas propias de Shopify y gasto real.

6. **Sin objetivo fijado, E-NORA sugiere uno** con la economía de la tienda (corpus 7.34): el cliente no
   suele saber su ROAS objetivo. El sugerido solo puede dar "vigilar"; el fijado manda.
7. **El RAG aporta la metodología**, no el veredicto: fragmentos del corpus global por métrica, solo
   para consultores.

## Consecuencias

- El veredicto es reproducible, gratis y testeable (`metric-analyst.test.ts`); se puede explicar
  línea a línea al cliente.
- Una métrica sin umbral, objetivo ni historial solo puede juzgarse por tendencia: confianza baja, y la
  pantalla lo dice. Fijar objetivos en Configuración mejora directamente la calidad del análisis.
- El periodo anterior de las sumas (gasto, clientes nuevos, compras de Meta, recuentos del embudo) se
  obtiene pidiendo 2N días y restando N; si algún servicio empieza a devolverlo, se sustituye.
