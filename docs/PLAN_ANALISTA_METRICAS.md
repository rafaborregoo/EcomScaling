# Plan: analista de métricas (web + móvil)

Decisión de arquitectura: [ADR-0027](decisions/ADR-0027-analista-de-metricas.md). Decidido con Rafa
el 2026-10-16: se ejecuta **al pulsar** y es **solo lectura**.

## Fase 1 — Veredicto determinista ✅ (2026-10-16)

| Pieza | Dónde |
|---|---|
| Fichas + motor `assessMetric` + 10 tests | `packages/contracts/src/metric-analyst.ts` |
| Observación de cada métrica y endpoint `GET /v1/organizations/:id/metric-analysis?days=&connectionId=` | `apps/api/src/metric-analysis.ts`, ruta en `server.ts` |
| Web: punto de color + popover con el porqué | `apps/web/src/components/metric-verdict.tsx`; Dashboard (Conversión, CAC combinado), Meta (ROAS atribuido), Klaviyo (Apertura) |
| Móvil: punto en la tarjeta + hoja al tocar | `apps/mobile/components/analista.tsx`; Métricas (Todo, Shopify, Meta, Klaviyo) |

Fichas piloto: `mer`, `cac_new`, `conversion`, `meta_roas`, `email_open_rate`.

Verificado contra la org `prueba-borrego` (TEST): MER bien (holgura frente al equilibrio 4,28; +27 %;
entre los mejores de 11 meses), CAC sin datos suficientes (1 cliente nuevo), conversión bien (+22 %),
ROAS Meta bien (cumple objetivo 3,20), aperturas bien (+17 %).

## Fase 1b — Objetivo sugerido y metodología del RAG ✅ (2026-10-16)

- **Objetivo sugerido** (corpus 7.34 "Target ROAS": se deriva de margen, costes y beneficio objetivo). De cada 100 € quedan `1 / ROAS de equilibrio` antes de publicidad; restando el margen neto objetivo (el de Configuración o un 10 %), lo que queda es lo máximo que puede costar la publicidad y su inverso es el ROAS objetivo. Igual para el CAC: techo del primer pedido menos el margen sobre el ticket. Si a la publicidad le queda menos de un cuarto, no se sugiere número: se avisa de que el margen pedido no deja sitio. Se usa para juzgar cuando no hay objetivo fijado (solo puede dar "vigilar") y aparece en Configuración → Objetivos con "Usar".
- **Metodología del RAG**: por cada ficha, `ragQuery` contra `knowledge_search_hybrid`, solo documentos globales, 2 fragmentos (la sección del chunk con más términos de la consulta), caché de una semana. Solo la ven consultores: es conocimiento interno.

## Fase 2 — A29: la IA explica sobre el veredicto ✅ (2026-10-16)

Hecho: migración `20261226110000_a29_analista_metrica` (TEST y PROD, v1 activa, modelo de su versión como A02), runner `runMetricAnalystAgent` con contrato de solo lectura (`buildReadOnlyOutputContract`: sin `proposed_writes`, que además hacía rechazar a Anthropic el esquema estricto), `GET/POST /metric-analysis/:metric/explanation` (el POST devuelve lo guardado si tiene < 24 h), rúbrica del juez y caso de eval, y la explicación en la hoja del móvil y el popover web. Probado en TEST con el ROAS de Meta: 0,07 $, explicó la subida por CTR (+21 %) y CPM (−7 %), recogió el aviso de A24 (4 días sin eventos Purchase) y la creatividad de A23. Pendiente: desplegar la API para que funcione en PROD.

Diseño original:

1. Migración: `agent_definitions` `a29_analista_metrica` + `agent_versions` v1 **inactiva** + prompt
   estructurado (ADR-0017). Se activa con `promote_agent_version` cuando el prompt esté listo.
2. Runner sobre `runGenericDiagnosticAgent` con `[metric=<id>]` en el objetivo para la caché (mismo patrón
   que `[dashboard_scope=]` de A02). Contexto, por este orden:
   - el `MetricAnalysis` de la fase 1 (veredicto, razones, drivers): el modelo no lo puede cambiar;
   - metodología del RAG global (`knowledge_search_hybrid`, solo conocimiento de plataforma) con la
     consulta `<métrica> + <driver principal>`;
   - memoria de la tienda en el RAG (notas del consultor: estacionalidad, decisiones previas);
   - últimos hallazgos de los `ownerAgents` de la ficha (A21, A14, A12...), si existen.
3. Salida: causa probable con evidencia, 1–2 acciones, qué dato falta. Contrato de `findings` para que
   se pinte con el mismo ✨ de `insights-registry.ts` en la web.
4. Disparo: `POST .../metric-analysis/:metric/explain` al abrir el popover/hoja si no hay caché < 24 h;
   tope diario por organización (reutiliza `enforceManualRefreshCap`).
5. Juez: rúbrica propia (fidelidad al veredicto, evidencia citada, ADR-0021, abstención). Evals con
   las mismas fichas: cada ficha nueva añade casos, no un agente.

**Gate de release quitado** (migración `20261226100000`, TEST y PROD, 2026-10-16, decisión de Rafa): A29 se activa con `promote_agent_version` sin exigir casos gold. Las evaluaciones siguen registrándose.

## Fase 2b — Benchmarks, ✨ y ritmo (2026-10-16)

- **Benchmarks sectoriales** (niveles 5–6 del corpus 6.00): tabla `metric_benchmarks` + `organizations.sector` (migración `20261226130000`, TEST y PROD). Regla `benchmark` en `assessMetric`: solo sin umbral, objetivo ni historial; como mucho "vigilar". Cómo se rellena: [PLANTILLA_BENCHMARKS_SECTORIALES.md](PLANTILLA_BENCHMARKS_SECTORIALES.md). La tabla está vacía hasta cargar fuentes reales.
- **Insights ✨**: `insightSpotsFromMetricAnalyses` en `insights-registry.ts` convierte cada métrica en "vigilar"/"va mal" en una entrada del menú de la IA, con ancla `#insight-metric-<id>` en su Kpi. Sustituye a la maqueta de ROAS que había.
- **Ritmo de A29**: una explicación por métrica y hora. Abrir la métrica dentro de esa hora devuelve la guardada; la pantalla dice a qué hora se renueva.
- **A04 v13** activa en TEST y PROD (migración `20261226120000`).

## Fase 3 — Aprender con el uso

1. **Feedback**: tabla `metric_analysis_feedback` (análisis, útil / incorrecto, corrección del
   consultor). Cada "incorrecto" se convierte en caso del dataset de A29 y en revisión de la ficha.
2. **Resultado de las acciones**: si una acción del análisis acaba en tarea y se completa, medir la
   métrica N días después (bloques de aprendizaje continuo de `continuous-learning.ts`, fase 9).
   Con el tiempo, cada ficha sabe qué acciones movieron de verdad su métrica.
3. **Benchmarks entre tiendas**: con ≥ 10 tiendas por segmento (sector, ticket, tamaño), percentiles
   anonimizados como una regla más (`source: "peer"`). Nunca antes: con 2 tiendas un benchmark es una
   anécdota.
4. **Fine-tuning**: solo según ADR-0017, con dataset etiquetado y evals que demuestren mejora.

## Siguiente ampliación de fichas

Ticket medio, recurrencia, LTV, publicidad sobre ventas, aMER, CTR/CPM de Meta, ingreso por email,
bajas y spam. Cada una: ficha + observación + test.
