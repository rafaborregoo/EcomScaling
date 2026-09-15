# Indice de implementacion

Una fila por bloque: que capas de especificacion tiene, en que ola entra y si ya
esta en el software. Es la respuesta a "¿esto ya esta hecho?" sin abrir los 644
artefactos de `conocimiento/fase-XX/`.

Procedimiento, definition of done y criterio de reparto:
**[docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md](../docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md)**.

Este indice dice **que** esta hecho. El **como y por que** de cada bloque va en
la bitacora de su fase, `fase-XX/IMPLEMENTACION.md` — decisiones tomadas,
alternativas descartadas, recortes y despliegue. Abiertas hasta ahora:
[fase-03](fase-03/IMPLEMENTACION.md).

**Se actualiza en el mismo commit que implementa el bloque, nunca despues.**

Se genero una vez desde la estructura de carpetas y **desde aqui se mantiene a
mano**: las columnas `Estado` y `Codigo` son trabajo humano y un regenerado
automatico las borraria.

Columna `Capas`, en orden `CRPET`: **C**ontrato (`02`), **R**untime (`03`),
**P**olicies (`04`), **E**xperience (`05`), **T**enant (`06`). Un `·` es que
ese bloque no genero artefacto en esa capa; si estan los cinco `·`, el bloque
sigue **sin destilar** (solo existe su corpus maestro) y no se puede implementar
hasta pasarlo por el prompt maestro.

Estados: `sin destilar` -> `pendiente` -> `en curso` -> `contrato` -> `hecho`.

`contrato` y `hecho` se separaron el **2026-09-25**, al cerrar la fase 3 y
descubrir que "hecho" se estaba usando para bloques que nadie escribe y nadie ve:

| Estado | Que hay | Que falta |
| --- | --- | --- |
| `contrato` | tablas, tipos e invariantes con test, desplegados | el motor que las escribe, la pantalla que las muestra, o ambos |
| `hecho` | las tres patas: contrato, motor y pixel | nada, salvo los recortes anotados en la fila |

Un bloque solo pasa a `hecho` cuando cumple **los 8 puntos** de la definition of
done — incluidos el punto 2 (existe codigo que escribe esas tablas) y el punto 7
(la vista existe, no solo esta decidida) — y ahi entra el test que falla si se
viola cada invariante de `04-policies`. Los recortes deliberados se anotan en la
fila con su motivo.

**129 bloques**: 18 en la ola 1, 5 sin destilar. **4 en `hecho`** (`D01`, `D02`,
`D03` y `D06`, con las tres patas); los otros 11 de la fase 3 siguen en
`contrato`, a la espera de motor y pantalla.

## fase-03 — Sistema de diagnostico

Los 15 bloques tienen su contrato en test y en produccion, y **`D01`, `D02`,
`D03` y `D06` estan `hecho`**: falta el motor de 10 de ellos (`D05` escribe
filas pero no se ve) y la pantalla de 11. El detalle, en
[`fase-03/IMPLEMENTACION.md`](fase-03/IMPLEMENTACION.md).

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `D00` | Contrato de diagnostico | `C····` | — | **contrato** | migracion `20260914110000` + `packages/contracts/src/diagnostics.ts` |
| `D01` | Calidad y fiabilidad de los datos | `CRP·T` | **1** | **hecho** | migraciones `20260914160000` y `20260926090000` + `packages/contracts/src/data-quality.ts` + motor `apps/api/src/data-quality-engine.ts` + pantalla `apps/web/src/app/integraciones/data-quality-panel.tsx`. Recorte: falta el agregado de cartera de platform_admin, que se hara una vez para varios bloques en `/admin/observabilidad` |
| `D02` | Contextualizacion | `CRPET` | — | **hecho** | migraciones `20260914190000`, `20260927090000` y `20260927093000` + `packages/contracts/src/context.ts` + motor `apps/api/src/context-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/context-readings.tsx`. Recortes: la edicion del contexto declarado por el cliente y la apertura de casos (provisional aqui hasta que exista `D06`) |
| `D03` | Deteccion de etapa de madurez | `CRPET` | — | **hecho** | migraciones `20260915090000` y `20260930090000` + `packages/contracts/src/maturity.ts` + motor `apps/api/src/maturity-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/maturity-panel.tsx`. Recorte grande y deliberado: **no calcula `required_level` ni hallazgos de brecha**, porque el apartado 19 del artefacto dice que los umbrales no estan definidos e inventarlos seria fabricar la respuesta |
| `D04` | Diagnostico de salud por capacidad | `C·PET` | — | **contrato** | migracion `20260915140000` + `packages/contracts/src/health.ts` |
| `D05` | Motor de senales y anomalias | `CRPET` | **1** | **contrato + motor** | migraciones `20260916090000` y `20260916120000` + `packages/contracts/src/signals.ts` + `apps/api/src/signal-engine.ts` |
| `D06` | Motor de sintomas | `CRPET` | **1** | **hecho** | migraciones `20260917090000` y `20260928090000` + `packages/contracts/src/symptoms.ts` + motor `apps/api/src/symptom-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/symptom-map.tsx`. Recortes: la libreria de patrones tiene 4 entradas (las metricas que `D05` sabe emitir), no hay evidencia cualitativa y la composicion de sintomas superiores queda para cuando haya mas de una clase de relacion declarada |
| `D07` | Grafo causal del ecommerce | `CRPET` | **1** | **contrato** | migracion `20260918090000` + `packages/contracts/src/causal.ts` |
| `D08` | Generador y contraste de hipotesis | `CRPET` | **1** | **contrato** | migracion `20260919090000` + `packages/contracts/src/hypotheses.ts` (amplia `diagnostic_hypotheses` de `D00`) |
| `D09` | Root cause constraint engine | `CRPET` | **1** | **contrato** | migracion `20260920090000` + `packages/contracts/src/root-cause.ts` |
| `D10` | Severidad e impacto | `CRPET` | **1** | **contrato** | migracion `20260921090000` + `packages/contracts/src/severity.ts` |
| `D11` | Confianza e incertidumbre | `CRPET` | **1** | **contrato** | migracion `20260922090000` + `packages/contracts/src/confidence.ts` |
| `D12` | Contrato de confusores y falsos diagnosticos | `C····` | **1** | **contrato** | migracion `20260923090000` + `packages/contracts/src/adversarial.ts` |
| `D13` | Contrato de diagnostico temporal y regresion | `C····` | **1** | **contrato** | migracion `20260924090000` + `packages/contracts/src/temporal.ts` |
| `D14` | Contrato de salida diagnostica trazabilidad y validacion | `C····` | **1** | **contrato** | migracion `20260925090000` + `packages/contracts/src/output.ts` |

## fase-04 — Priorizacion y decision

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `4.00` | Contrato de priorizacion y decision | `CRPET` | — | pendiente | — |
| `4.01` | Contexto de decision y objetivos | `CRPET` | — | pendiente | — |
| `4.03` | Urgencia y sensibilidad temporal | `CRPE·` | — | pendiente | — |
| `4.04` | Impacto decisional y valor en juego | `CRPET` | **1** | pendiente | — |
| `4.05` | Constraints y dependencias | `CRPET` | — | pendiente | — |
| `4.06` | Esfuerzo recursos y factibilidad | `CRPET` | **1** | pendiente | — |
| `4.07` | Riesgo reversibilidad y coste del error | `CRPET` | — | pendiente | — |
| `4.08` | Expected value opportunity cost y asignacion de recursos | `CRPET` | — | pendiente | — |
| `4.09` | Strategic fit madurez y coherencia con el sistema | `CRPET` | — | pendiente | — |
| `4.10` | Motor de ranking y sintesis de prioridad | `CRPET` | **1** | pendiente | — |
| `4.11` | Conflictos portfolio y concurrencia de prioridades | `CRPET` | — | pendiente | — |
| `4.12` | Salida explicabilidad trazabilidad y validacion decisional | `CRPET` | **1** | pendiente | — |

## fase-05 — Estrategias y playbooks

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `5.00` | Framework universal de estrategias y playbooks ecommerce | `CRPET` | — | pendiente | — |
| `5.01` | Adquisicion y generacion de demanda | `CRPET` | — | pendiente | — |
| `5.02` | Paid media y eficiencia de trafico | `CRPET` | — | pendiente | — |
| `5.03` | Conversion y cro | `CRPET` | — | pendiente | — |
| `5.04` | Oferta pricing merchandising y aov | `CRPET` | — | pendiente | — |
| `5.05` | Retencion crm lifecycle y ltv | `CRPET` | — | pendiente | — |
| `5.06` | Unit economics y rentabilidad | `CRPET` | — | pendiente | — |
| `5.07` | Producto catalogo e inventario | `CRPET` | — | pendiente | — |
| `5.08` | Operaciones fulfillment y customer experience | `CRPET` | — | pendiente | — |
| `5.09` | Datos tracking y experimentacion | `CRPET` | — | pendiente | — |
| `5.10` | Escalabilidad y eliminacion de constraints | `CRPET` | — | pendiente | — |
| `5.11` | Recovery crisis y playbooks transversales | `CRPET` | — | pendiente | — |

## fase-06 — Benchmarks y guardrails

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `6.00` | Framework universal de benchmarks y guardrails | `CRPET` | — | pendiente | — |
| `6.01` | Contextualizacion y cohortes comparables | `CRPET` | — | pendiente | — |
| `6.02` | Calidad suficiencia y fiabilidad de los datos | `CRPET` | — | pendiente | — |
| `6.03` | Benchmarks y guardrails de adquisicion y generacion de deman | `CRPET` | — | pendiente | — |
| `6.04` | Benchmarks y guardrails de paid media y eficiencia de trafic | `·····` | — | **sin destilar** | — |
| `6.05` | Benchmarks y guardrails de conversion y cro | `CRPET` | — | pendiente | — |
| `6.06` | Benchmarks y guardrails de oferta pricing merchandising y ao | `CRPET` | — | pendiente | — |
| `6.07` | Benchmarks y guardrails de retencion crm y ltv | `CRPET` | — | pendiente | — |
| `6.08` | Benchmarks y guardrails de unit economics y rentabilidad | `CRPET` | — | pendiente | — |
| `6.09` | Benchmarks y guardrails de operaciones y experiencia de clie | `CRPET` | — | pendiente | — |
| `6.10` | Benchmarks y guardrails de inventario y salud comercial | `CRPET` | — | pendiente | — |
| `6.11` | Benchmarks y guardrails de escalabilidad y limites de crecim | `CRPET` | — | pendiente | — |
| `6.12` | Anomalias red flags y combinaciones peligrosas | `CRPET` | — | pendiente | — |
| `6.13` | Confianza incertidumbre y comunicacion del benchmark | `CRPET` | — | pendiente | — |

## fase-07 — Motor de recomendaciones

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `7.01` | Elegibilidad de una intervencion | `CRPET` | **1** | pendiente | — |
| `7.02` | Matching problema intervencion | `CRPET` | **1** | pendiente | — |
| `7.03` | Priorizacion entre intervenciones | `CRPET` | — | pendiente | — |
| `7.04` | Impacto esperado | `CRPET` | — | pendiente | — |
| `7.05` | Esfuerzo coste y recursos | `CRPET` | — | pendiente | — |
| `7.06` | Riesgo reversibilidad y coste del error | `CRPET` | — | pendiente | — |
| `7.07` | Secuenciacion y dependencias | `CRPET` | — | pendiente | — |
| `7.08` | Experimentar vs ejecutar directamente | `CRPET` | — | pendiente | — |
| `7.09` | Intensidad y tamano de la intervencion | `CRPET` | — | pendiente | — |
| `7.10` | Recomendaciones por madurez | `CRPET` | — | pendiente | — |
| `7.11` | Recomendaciones bajo restricciones | `CRPET` | — | pendiente | — |
| `7.12` | Portafolio de recomendaciones | `CRPET` | — | pendiente | — |
| `7.13` | Stop continue scale rollback | `CRPET` | — | pendiente | — |
| `7.14` | No action wait gather evidence | `CRPET` | — | pendiente | — |
| `7.15` | Expected outcome y success criteria | `·····` | **1** | **sin destilar** | — |
| `7.17` | Confianza de la recomendacion | `·····` | **1** | **sin destilar** | — |
| `7.18` | Comunicacion de recomendaciones | `·····` | **1** | **sin destilar** | — |

## fase-08 — Ejecucion y supervision

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `8.00` | Framework universal de ejecucion supervisada | `CRPET` | — | pendiente | — |
| `8.01` | Ejecutabilidad y autorizacion | `CRPET` | — | pendiente | — |
| `8.02` | Human in the loop y niveles de aprobacion | `CRPET` | **1** | pendiente | — |
| `8.03` | Descomposicion recommendation execution plan | `CRPET` | — | pendiente | — |
| `8.04` | Precondiciones y readiness | `CRPET` | — | pendiente | — |
| `8.05` | Scope limites y action envelope | `CRPET` | — | pendiente | — |
| `8.06` | Herramientas capacidades y permisos | `CRPET` | — | pendiente | — |
| `8.07` | Ejecucion segura y control de cambios | `CRPET` | — | pendiente | — |
| `8.08` | Supervision durante la ejecucion | `CRPET` | — | pendiente | — |
| `8.09` | Guardrails y condiciones de intervencion | `CRPET` | — | pendiente | — |
| `8.10` | Lifecycle de una ejecucion | `CRPET` | — | pendiente | — |
| `8.11` | Fallos excepciones e incidentes | `CRPET` | — | pendiente | — |
| `8.12` | Rollback recovery y compensacion | `·····` | — | **sin destilar** | — |
| `8.13` | Human override y escalado | `CRPET` | — | pendiente | — |
| `8.14` | Concurrencia y coordinacion de intervenciones | `CRPET` | — | pendiente | — |
| `8.15` | Verificacion de ejecucion | `CRPET` | — | pendiente | — |
| `8.16` | Cierre handoff y captura del resultado | `CRPET` | **1** | pendiente | — |
| `8.17` | Comunicacion y reporting de ejecucion | `CRPET` | — | pendiente | — |

## fase-09 — Aprendizaje continuo

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `9.00` | Framework universal de aprendizaje continuo | `CRPET` | — | pendiente | — |
| `9.01` | Unidad de experiencia y contexto | `CRPET` | **1** | pendiente | — |
| `9.03` | Calidad de ejecucion y execution fidelity | `CRPET` | — | pendiente | — |
| `9.04` | Calidad de evidencia | `CRPET` | — | pendiente | — |
| `9.05` | Causalidad correlacion atribucion maestro | `CRPET` | — | pendiente | — |
| `9.06` | Confounders intervenciones concurrentes maestro | `·RPET` | — | pendiente | — |
| `9.07` | Experimentacion fuerza evidencia maestro | `CRPET` | — | pendiente | — |
| `9.08` | Ventanas temporales madurez resultado maestro | `CRPET` | — | pendiente | — |
| `9.09` | Learning confidence maestro | `C·P·T` | — | pendiente | — |
| `9.10` | Generalizacion limites aplicabilidad maestro | `CRPET` | — | pendiente | — |
| `9.11` | Contextual learning maestro | `CRPET` | — | pendiente | — |
| `9.12` | Positive negative neutral inconclusive outcomes maestro | `CRPET` | **1** | pendiente | — |
| `9.13` | Aprendizaje fallos incidentes maestro | `CRPET` | — | pendiente | — |
| `9.14` | Human override decisiones humanas maestro | `CRPET` | — | pendiente | — |
| `9.15` | Aprendizaje recomendaciones maestro | `·RP·T` | — | pendiente | — |
| `9.16` | Aprendizaje priorizacion maestro | `CRPE·` | — | pendiente | — |
| `9.17` | Aprendizaje playbooks maestro | `CRPET` | — | pendiente | — |
| `9.18` | Benchmarks guardrails maestro | `CRPET` | — | pendiente | — |
| `9.19` | Aprendizaje sobre autonomia | `CRPET` | — | pendiente | — |
| `9.20` | Aprendizaje infraestructura friccion operacional | `CRPET` | — | pendiente | — |
| `9.21` | Requisitos contrato patterns | `CRPET` | — | pendiente | — |
| `9.22` | Contradicciones entre aprendizajes | `CRPET` | — | pendiente | — |
| `9.23` | Decay obsolescencia drift | `CRPET` | — | pendiente | — |
| `9.24` | Exploration vs exploitation | `CRPET` | — | pendiente | — |
| `9.25` | Learning loops | `CRPET` | — | pendiente | — |
| `9.26` | Knowledge promotion | `CRPET` | — | pendiente | — |
| `9.27` | Knowledge contradiction supersession | `CRPET` | — | pendiente | — |
| `9.28` | Anti learning proteccion conclusiones erroneas | `CRPET` | — | pendiente | — |
| `9.29` | Feedback loops peligrosos | `CRPET` | — | pendiente | — |
| `9.30` | Learning governance | `CRPET` | — | pendiente | — |
| `9.31` | Explainable learning | `CRPET` | — | pendiente | — |
| `9.32` | Learning traceability | `CRPET` | — | pendiente | — |
| `9.33` | Forgetting invalidation retirada aprendizajes | `CRPET` | — | pendiente | — |
| `9.34` | Transfer learning entre tiendas | `CRPET` | — | pendiente | — |
| `9.35` | Cohort learning | `CRPET` | — | pendiente | — |
| `9.36` | Global knowledge vs tenant specific learning | `CRPET` | — | pendiente | — |
| `9.37` | Privacidad aislamiento aprendizaje | `CRPET` | — | pendiente | — |
| `9.38` | Aprendizaje largo plazo | `CRPET` | — | pendiente | — |
| `9.39` | Strategic learning | `CRPET` | — | pendiente | — |
| `9.40` | Meta learning | `CRPET` | — | pendiente | — |
| `9.41` | Framework final learning engine | `CRPET` | — | pendiente | — |

## Bloqueos de contenido

5 bloques tienen corpus maestro pero ninguna capa de
especificacion. Tres de ellos (`7.15`, `7.17`, `7.18`) entran en la ola 1: la
ola no puede cerrarse sin destilarlos antes. `8.12` (rollback) hace falta en la
ola 2, y `6.04` cuando se ensanche a benchmarks.

## Recortes anotados

Lo que un artefacto pedia y se decidio no implementar, con el motivo, se escribe
en la bitacora de su fase. Un bloque a medias con su recorte escrito es honesto;
uno a medias en silencio es deuda invisible.

- `D00` — tres recortes (§58 correlacion/causalidad, §25 transiciones de estado,
  §61 reconstruccion desde el panel): [fase-03](fase-03/IMPLEMENTACION.md).
- `D01` — cinco recortes (guardrails 5/25/26 los cubre ADR-0021, guardrail 15 es
  de `D05`, guardrail 7 es criterio de diseno, el flujo de 19 pasos no tiene
  consumidor, y el lineage de metricas derivadas no tiene registro):
  [fase-03](fase-03/IMPLEMENTACION.md).
- `D02` — cinco recortes (guardrails 1/2/5/10-14 son criterio y viven en el RAG,
  guardrail 9 exigiria un umbral inventado, guardrails 33-35 esperan a `D05`, el
  flujo de 16 pasos no tiene consumidor, y la economia ya vive en las
  integraciones): [fase-03](fase-03/IMPLEMENTACION.md).
- `D03` — cuatro recortes (el guardrail 25 en su forma fuerte necesita un
  algoritmo de scoring que el artefacto declara no definido, el guardrail 22 es
  sobre el origen del contenido, el flujo de runtime no tiene consumidor, y el
  mapping ladder <-> E0..E12 el propio artefacto lo deja abierto):
  [fase-03](fase-03/IMPLEMENTACION.md).
- `D04` — tres recortes (la politica de agregacion y los umbrales de estado los
  declara indefinidos el propio artefacto, y el aprendizaje sobre el historico
  de salud lo remite a F9): [fase-03](fase-03/IMPLEMENTACION.md).
- `D05` — **el recorte mayor de la fase**: de los 30 pasos del runtime se
  implementan 8. Falta el ajuste estacional (sin el, agosto generara senales),
  los change points, el drilldown por segmento, la corroboracion entre fuentes y
  el lazo de vuelta a `D04`. Y solo lee Shopify: [fase-03](fase-03/IMPLEMENTACION.md).

## Fuera del indice

- `fase-01` y `fase-02` no aparecen: su corpus esta indexado en RAG pero no
  tienen capas de especificacion, asi que no hay nada que implementar de ellas.
- Quedan ficheros del lote antiguo sin codigo de bloque en `02-contratos-IA`:
  `fase-04` (13), `fase-06` (17). Los contratos por bloque si estan clasificados y son los que cuentan
  aqui. Decision 2026-09-14: `fase-04` se queda como esta.
- Bloques que no existen y no se buscan: `4.02`, `7.16`, `9.02`, `9.21`.
