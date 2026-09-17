# Indice de implementacion

Una fila por bloque: que capas de especificacion tiene, en que ola entra y si ya
esta en el software. Es la respuesta a "Ã‚Â¿esto ya esta hecho?" sin abrir los 644
artefactos de `conocimiento/fase-XX/`.

Procedimiento, definition of done y criterio de reparto:
**[docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md](../docs/PLAN_MAESTRO_CONOCIMIENTO_A_SOFTWARE.md)**.

Este indice dice **que** esta hecho. El **como y por que** de cada bloque va en
la bitacora de su fase, `fase-XX/IMPLEMENTACION.md` Ã¢â‚¬â€ decisiones tomadas,
alternativas descartadas, recortes y despliegue. Abiertas hasta ahora:
[fase-03](fase-03/IMPLEMENTACION.md).

**Se actualiza en el mismo commit que implementa el bloque, nunca despues.**

Se genero una vez desde la estructura de carpetas y **desde aqui se mantiene a
mano**: las columnas `Estado` y `Codigo` son trabajo humano y un regenerado
automatico las borraria.

Columna `Capas`, en orden `CRPET`: **C**ontrato (`02`), **R**untime (`03`),
**P**olicies (`04`), **E**xperience (`05`), **T**enant (`06`). Un `Ã‚Â·` es que
ese bloque no genero artefacto en esa capa; si estan los cinco `Ã‚Â·`, el bloque
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
done Ã¢â‚¬â€ incluidos el punto 2 (existe codigo que escribe esas tablas) y el punto 7
(la vista existe, no solo esta decidida) Ã¢â‚¬â€ y ahi entra el test que falla si se
viola cada invariante de `04-policies`. Los recortes deliberados se anotan en la
fila con su motivo.

**129 bloques**: 18 en la ola 1, 5 sin destilar. **11 en `hecho`** (`D01`, `D02`,
`D03`, `D04`, `D05`, `D06`, `D07`, `D08`, `D09`, `D10` y `D11`, con las tres
patas); los otros 4 de la fase 3 siguen en `contrato`, a la espera de motor y pantalla.

## fase-03 Ã¢â‚¬â€ Sistema de diagnostico

Los 15 bloques tienen su contrato en test y en produccion, y **`D01`, `D02`,
`D03`, `D04`, `D05`, `D06`, `D07`, `D08`, `D09`, `D10` y `D11` estan `hecho`**:
falta el motor de 4 de ellos y la pantalla de 4. El detalle, en
[`fase-03/IMPLEMENTACION.md`](fase-03/IMPLEMENTACION.md).

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `D00` | Contrato de diagnostico | `CÃ‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | Ã¢â‚¬â€ | **contrato** | migracion `20260914110000` + `packages/contracts/src/diagnostics.ts` |
| `D01` | Calidad y fiabilidad de los datos | `CRPÃ‚Â·T` | **1** | **hecho** | migraciones `20260914160000` y `20260926090000` + `packages/contracts/src/data-quality.ts` + motor `apps/api/src/data-quality-engine.ts` + pantalla `apps/web/src/app/integraciones/data-quality-panel.tsx`. Recorte: falta el agregado de cartera de platform_admin, que se hara una vez para varios bloques en `/admin/observabilidad` |
| `D02` | Contextualizacion | `CRPET` | Ã¢â‚¬â€ | **hecho** | migraciones `20260914190000`, `20260927090000` y `20260927093000` + `packages/contracts/src/context.ts` + motor `apps/api/src/context-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/context-readings.tsx`. Recortes: la edicion del contexto declarado por el cliente y la apertura de casos (provisional aqui hasta que exista `D06`) |
| `D03` | Deteccion de etapa de madurez | `CRPET` | Ã¢â‚¬â€ | **hecho** | migraciones `20260915090000` y `20260930090000` + `packages/contracts/src/maturity.ts` + motor `apps/api/src/maturity-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/maturity-panel.tsx`. Recorte grande y deliberado: **no calcula `required_level` ni hallazgos de brecha**, porque el apartado 19 del artefacto dice que los umbrales no estan definidos e inventarlos seria fabricar la respuesta |
| `D04` | Diagnostico de salud por capacidad | `CÃ‚Â·PET` | Ã¢â‚¬â€ | **hecho** | migracion `20260915140000` + `packages/contracts/src/health.ts` + motor `apps/api/src/health-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/capability-health.tsx`. Recorte grande y deliberado: **no tiene un solo umbral propio**. Sin `health_references` declaradas (hoy vacia) toda capacidad sale `not_assessable` diciendo que falta, porque el guardrail 11 prohibe el umbral universal |
| `D05` | Motor de senales y anomalias | `CRPET` | **1** | **hecho** | migraciones `20260916090000` y `20260916120000` + `packages/contracts/src/signals.ts` + motor `apps/api/src/signal-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/signal-list.tsx`. Recorte: la lista se ve vacia hasta que alguien ejecute el motor, que no esta programado |
| `D06` | Motor de sintomas | `CRPET` | **1** | **hecho** | migraciones `20260917090000` y `20260928090000` + `packages/contracts/src/symptoms.ts` + motor `apps/api/src/symptom-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/symptom-map.tsx`. Recortes: la libreria de patrones tiene 4 entradas (las metricas que `D05` sabe emitir), no hay evidencia cualitativa y la composicion de sintomas superiores queda para cuando haya mas de una clase de relacion declarada |
| `D07` | Grafo causal del ecommerce | `CRPET` | **1** | **hecho** | migraciones `20260918090000` y `20261017090000` + `packages/contracts/src/causal.ts` + motor `apps/api/src/causal-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/causal-paths.tsx`. Recorte grande y deliberado: **el grafo global trae seis nodos y cinco aristas**, cuatro de ellas aritmetica pura. Es lo que se sostiene con las metricas que la plataforma lee hoy; el resto lo declara el consultor desde la pantalla y entra como heuristica con techo. Ninguna ruta llega a `supported`, porque nadie ha revisado los confusores de D02 |
| `D08` | Generador y contraste de hipotesis | `CRPET` | **1** | **hecho** | migraciones `20260919090000` y `20261021090000` + `packages/contracts/src/hypotheses.ts` + motor `apps/api/src/hypothesis-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/hypotheses.tsx`. Recorte: **no elige ninguna** (guardrail 1) y el techo es `under_test`. Lo que si hace y nadie hacia: guardar las descartadas con su motivo, y escribir sola la hipotesis de que no haya pasado nada y solo se haya roto la medida |
| `D09` | Root cause constraint engine | `CRPET` | **1** | **hecho** | migracion `20260920090000` + `packages/contracts/src/root-cause.ts` + motor `apps/api/src/root-cause-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/root-cause.tsx`. Recorte grande y deliberado: **casi todo sale `unresolved` o `latent`**, porque la evidencia de D07-D08 es siempre correlacion y la plataforma no mide capacidad ni demanda de ninguna capacidad. `probable`/`confirmed`/`binding` quedan fuera de alcance hasta que eso cambie |
| `D10` | Severidad e impacto | `CRPET` | **1** | **hecho** | migracion `20260921090000` + `packages/contracts/src/severity.ts` + motor `apps/api/src/severity-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/severity-panel.tsx`. Recorte grande y deliberado: **no pone ninguna severidad**, las cinco salen `unknown`. El apartado 29 dice que la fuente no define formula ni umbral; lo que si hace es medir el impacto con su denominador razonado |
| `D11` | Confianza e incertidumbre | `CRPET` | **1** | **hecho** | migracion `20260922090000` + `packages/contracts/src/confidence.ts` + motor `apps/api/src/confidence-engine.ts` + pantalla `apps/web/src/app/shopify/diagnostico/confidence-panel.tsx`. Recorte: las capas causales (`why`, `root_cause`, `constraint`) salen siempre desconocidas porque `D07` a `D09` no tienen motor Ã¢â‚¬â€ y escribirlo es justo lo que impide leer un caso descrito como un caso explicado |
| `D12` | Contrato de confusores y falsos diagnosticos | `CÃ‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | **1** | **contrato** | migracion `20260923090000` + `packages/contracts/src/adversarial.ts` |
| `D13` | Contrato de diagnostico temporal y regresion | `CÃ‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | **1** | **contrato** | migracion `20260924090000` + `packages/contracts/src/temporal.ts` |
| `D14` | Contrato de salida diagnostica trazabilidad y validacion | `CÃ‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | **1** | **contrato** | migracion `20260925090000` + `packages/contracts/src/output.ts` |

## fase-04 Ã¢â‚¬â€ Priorizacion y decision

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `4.00` | Contrato de priorizacion y decision | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261027090000` + contrato, motor, worker, workflow y pantalla; verificado con `.env.local` y cleanup confirmado |
| `4.01` | Contexto de decision y objetivos | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261027093000` + contrato, motor, worker, API y pantalla; verificado con `.env.local` y cleanup confirmado |
| `4.03` | Urgencia y sensibilidad temporal | `CRPEÃ‚Â·` | Ã¢â‚¬â€ | **hecho** | migracion `20261027100000` + contrato, motor, worker, workflow, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.04` | Impacto decisional y valor en juego | `CRPET` | **1** | **hecho** | migracion `20261027103000` + contrato, motor, worker, workflow, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.05` | Constraints y dependencias | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261027110000` + contrato, motor, worker, workflow, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.06` | Esfuerzo recursos y factibilidad | `CRPET` | **1** | **hecho** | migracion `20261027120000` + `packages/contracts/src/feasibility.ts` + motor, worker, workflow, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.07` | Riesgo reversibilidad y coste del error | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261027130000` + `packages/contracts/src/risk.ts` + motor, worker, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.08` | Expected value opportunity cost y asignacion de recursos | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261027130000` + `packages/contracts/src/allocation.ts` + motor, worker, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.09` | Strategic fit madurez y coherencia con el sistema | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261027130000` + `packages/contracts/src/strategic-fit.ts` + motor, worker, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.10` | Motor de ranking y sintesis de prioridad | `CRPET` | **1** | **hecho** | migracion `20261027130000` + `packages/contracts/src/ranking.ts` + motor, worker, API y pantalla; sin politica del tenant conserva `ABSTAIN`; cleanup confirmado |
| `4.11` | Conflictos portfolio y concurrencia de prioridades | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261027130000` + `packages/contracts/src/portfolio.ts` + motor, worker, API y pantalla; cinco organizaciones sin fallos y cleanup confirmado |
| `4.12` | Salida explicabilidad trazabilidad y validacion decisional | `CRPET` | **1** | **hecho** | migracion `20261027130000` + `packages/contracts/src/decision-output.ts` + motor, worker, API y pantalla; sin evidencia suficiente conserva `ABSTAIN`; cleanup confirmado |

## fase-05 Ã¢â‚¬â€ Estrategias y playbooks

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `5.00` | Framework universal de estrategias y playbooks ecommerce | `CRPET` | — | **hecho** | migración `20261028090000` + `packages/contracts/src/playbook.ts` + motor `apps/api/src/playbook-engine.ts` + worker + API/pantalla; verificado con `.env.local`: cinco organizaciones sin fallos, `NO_APPLICABLE_PLAYBOOK` honesto y cleanup confirmado |
| `5.01` | Adquisicion y generacion de demanda | `CRPET` | Ã¢â‚¬â€ | **hecho** | extension `packages/contracts/src/acquisition.ts` + migration `20261028100000` + motor `apps/api/src/acquisition-engine.ts` + worker + API/pantalla; verificado con `.env.local`: cinco organizaciones sin fallos y cleanup confirmado |
| `5.02` | Paid media y eficiencia de trafico | `CRPET` | Ã¢â‚¬â€ | **hecho** | migracion `20261028110000` + reutiliza contrato/motor universal `packages/contracts/src/playbook.ts` y `apps/api/src/playbook-engine.ts` + `apps/api/src/paid-media-engine.ts` + worker + API/pantalla; verificado con `.env.local`: cinco organizaciones en `VALIDATION_REQUIRED` por evidencia desconocida, worker 5/5/0 y cleanup confirmado |
| `5.03` | Conversion y cro | `CRPET` | Ã¢â‚¬â€ | **hecho** | contrato `packages/contracts/src/conversion-cro.ts` + migracion `20261028120000` + motor `apps/api/src/conversion-engine.ts` + worker + API/pantalla; verificado con `.env.local`: cinco organizaciones en `VALIDATION_REQUIRED`, cleanup confirmado |
| `5.04` | Oferta pricing merchandising y aov | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `5.05` | Retencion crm lifecycle y ltv | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `5.06` | Unit economics y rentabilidad | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `5.07` | Producto catalogo e inventario | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `5.08` | Operaciones fulfillment y customer experience | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `5.09` | Datos tracking y experimentacion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `5.10` | Escalabilidad y eliminacion de constraints | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `5.11` | Recovery crisis y playbooks transversales | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |

## fase-06 Ã¢â‚¬â€ Benchmarks y guardrails

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `6.00` | Framework universal de benchmarks y guardrails | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.01` | Contextualizacion y cohortes comparables | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.02` | Calidad suficiencia y fiabilidad de los datos | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.03` | Benchmarks y guardrails de adquisicion y generacion de deman | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.04` | Benchmarks y guardrails de paid media y eficiencia de trafic | `Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | Ã¢â‚¬â€ | **sin destilar** | Ã¢â‚¬â€ |
| `6.05` | Benchmarks y guardrails de conversion y cro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.06` | Benchmarks y guardrails de oferta pricing merchandising y ao | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.07` | Benchmarks y guardrails de retencion crm y ltv | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.08` | Benchmarks y guardrails de unit economics y rentabilidad | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.09` | Benchmarks y guardrails de operaciones y experiencia de clie | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.10` | Benchmarks y guardrails de inventario y salud comercial | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.11` | Benchmarks y guardrails de escalabilidad y limites de crecim | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.12` | Anomalias red flags y combinaciones peligrosas | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `6.13` | Confianza incertidumbre y comunicacion del benchmark | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |

## fase-07 Ã¢â‚¬â€ Motor de recomendaciones

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `7.01` | Elegibilidad de una intervencion | `CRPET` | **1** | pendiente | Ã¢â‚¬â€ |
| `7.02` | Matching problema intervencion | `CRPET` | **1** | pendiente | Ã¢â‚¬â€ |
| `7.03` | Priorizacion entre intervenciones | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.04` | Impacto esperado | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.05` | Esfuerzo coste y recursos | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.06` | Riesgo reversibilidad y coste del error | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.07` | Secuenciacion y dependencias | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.08` | Experimentar vs ejecutar directamente | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.09` | Intensidad y tamano de la intervencion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.10` | Recomendaciones por madurez | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.11` | Recomendaciones bajo restricciones | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.12` | Portafolio de recomendaciones | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.13` | Stop continue scale rollback | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.14` | No action wait gather evidence | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `7.15` | Expected outcome y success criteria | `Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | **1** | **sin destilar** | Ã¢â‚¬â€ |
| `7.17` | Confianza de la recomendacion | `Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | **1** | **sin destilar** | Ã¢â‚¬â€ |
| `7.18` | Comunicacion de recomendaciones | `Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | **1** | **sin destilar** | Ã¢â‚¬â€ |

## fase-08 Ã¢â‚¬â€ Ejecucion y supervision

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `8.00` | Framework universal de ejecucion supervisada | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.01` | Ejecutabilidad y autorizacion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.02` | Human in the loop y niveles de aprobacion | `CRPET` | **1** | pendiente | Ã¢â‚¬â€ |
| `8.03` | Descomposicion recommendation execution plan | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.04` | Precondiciones y readiness | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.05` | Scope limites y action envelope | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.06` | Herramientas capacidades y permisos | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.07` | Ejecucion segura y control de cambios | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.08` | Supervision durante la ejecucion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.09` | Guardrails y condiciones de intervencion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.10` | Lifecycle de una ejecucion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.11` | Fallos excepciones e incidentes | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.12` | Rollback recovery y compensacion | `Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·Ã‚Â·` | Ã¢â‚¬â€ | **sin destilar** | Ã¢â‚¬â€ |
| `8.13` | Human override y escalado | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.14` | Concurrencia y coordinacion de intervenciones | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.15` | Verificacion de ejecucion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `8.16` | Cierre handoff y captura del resultado | `CRPET` | **1** | pendiente | Ã¢â‚¬â€ |
| `8.17` | Comunicacion y reporting de ejecucion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |

## fase-09 Ã¢â‚¬â€ Aprendizaje continuo

| Bloque | Tema | Capas | Ola | Estado | Codigo |
| --- | --- | --- | --- | --- | --- |
| `9.00` | Framework universal de aprendizaje continuo | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.01` | Unidad de experiencia y contexto | `CRPET` | **1** | pendiente | Ã¢â‚¬â€ |
| `9.03` | Calidad de ejecucion y execution fidelity | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.04` | Calidad de evidencia | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.05` | Causalidad correlacion atribucion maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.06` | Confounders intervenciones concurrentes maestro | `Ã‚Â·RPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.07` | Experimentacion fuerza evidencia maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.08` | Ventanas temporales madurez resultado maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.09` | Learning confidence maestro | `CÃ‚Â·PÃ‚Â·T` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.10` | Generalizacion limites aplicabilidad maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.11` | Contextual learning maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.12` | Positive negative neutral inconclusive outcomes maestro | `CRPET` | **1** | pendiente | Ã¢â‚¬â€ |
| `9.13` | Aprendizaje fallos incidentes maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.14` | Human override decisiones humanas maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.15` | Aprendizaje recomendaciones maestro | `Ã‚Â·RPÃ‚Â·T` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.16` | Aprendizaje priorizacion maestro | `CRPEÃ‚Â·` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.17` | Aprendizaje playbooks maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.18` | Benchmarks guardrails maestro | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.19` | Aprendizaje sobre autonomia | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.20` | Aprendizaje infraestructura friccion operacional | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.21` | Requisitos contrato patterns | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.22` | Contradicciones entre aprendizajes | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.23` | Decay obsolescencia drift | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.24` | Exploration vs exploitation | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.25` | Learning loops | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.26` | Knowledge promotion | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.27` | Knowledge contradiction supersession | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.28` | Anti learning proteccion conclusiones erroneas | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.29` | Feedback loops peligrosos | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.30` | Learning governance | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.31` | Explainable learning | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.32` | Learning traceability | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.33` | Forgetting invalidation retirada aprendizajes | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.34` | Transfer learning entre tiendas | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.35` | Cohort learning | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.36` | Global knowledge vs tenant specific learning | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.37` | Privacidad aislamiento aprendizaje | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.38` | Aprendizaje largo plazo | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.39` | Strategic learning | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.40` | Meta learning | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |
| `9.41` | Framework final learning engine | `CRPET` | Ã¢â‚¬â€ | pendiente | Ã¢â‚¬â€ |

## Bloqueos de contenido

5 bloques tienen corpus maestro pero ninguna capa de
especificacion. Tres de ellos (`7.15`, `7.17`, `7.18`) entran en la ola 1: la
ola no puede cerrarse sin destilarlos antes. `8.12` (rollback) hace falta en la
ola 2, y `6.04` cuando se ensanche a benchmarks.

## Recortes anotados

Lo que un artefacto pedia y se decidio no implementar, con el motivo, se escribe
en la bitacora de su fase. Un bloque a medias con su recorte escrito es honesto;
uno a medias en silencio es deuda invisible.

- `D00` Ã¢â‚¬â€ tres recortes (Ã‚Â§58 correlacion/causalidad, Ã‚Â§25 transiciones de estado,
  Ã‚Â§61 reconstruccion desde el panel): [fase-03](fase-03/IMPLEMENTACION.md).
- `D01` Ã¢â‚¬â€ cinco recortes (guardrails 5/25/26 los cubre ADR-0021, guardrail 15 es
  de `D05`, guardrail 7 es criterio de diseno, el flujo de 19 pasos no tiene
  consumidor, y el lineage de metricas derivadas no tiene registro):
  [fase-03](fase-03/IMPLEMENTACION.md).
- `D02` Ã¢â‚¬â€ cinco recortes (guardrails 1/2/5/10-14 son criterio y viven en el RAG,
  guardrail 9 exigiria un umbral inventado, guardrails 33-35 esperan a `D05`, el
  flujo de 16 pasos no tiene consumidor, y la economia ya vive en las
  integraciones): [fase-03](fase-03/IMPLEMENTACION.md).
- `D03` Ã¢â‚¬â€ cuatro recortes (el guardrail 25 en su forma fuerte necesita un
  algoritmo de scoring que el artefacto declara no definido, el guardrail 22 es
  sobre el origen del contenido, el flujo de runtime no tiene consumidor, y el
  mapping ladder <-> E0..E12 el propio artefacto lo deja abierto):
  [fase-03](fase-03/IMPLEMENTACION.md).
- `D04` Ã¢â‚¬â€ tres recortes (la politica de agregacion y los umbrales de estado los
  declara indefinidos el propio artefacto, y el aprendizaje sobre el historico
  de salud lo remite a F9): [fase-03](fase-03/IMPLEMENTACION.md).
- `D05` Ã¢â‚¬â€ **el recorte mayor de la fase**: de los 30 pasos del runtime se
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
### Addendum de cierre F3 Ã¢â‚¬â€ 2026-09-16

D13 y D14 estÃƒÂ¡n hechos y F3 queda cerrada. La integraciÃƒÂ³n de D11 con D07,
D08 y D09 tambiÃƒÂ©n estÃƒÂ¡ verificada con `.env.local`; D00 permanece como contrato
puro por diseÃƒÂ±o.

### Addendum de cierre F4 Ã¢â‚¬â€ 2026-09-16

F4 estÃƒÂ¡ cerrada: P00, P01, P03, P04, P05 y P06Ã¢â‚¬â€œP12 tienen contrato,
tests, persistencia, runtime, worker, API y pantalla. Las migraciones
20261027090000, 20261027093000, 20261027100000, 20261027103000,
20261027110000, 20261027120000 y 20261027130000 estÃƒÂ¡n aplicadas en el proyecto
de desarrollo de `.env.local` (`kopcblejsxpkxoykldyh`).

La verificaciÃƒÂ³n real recorriÃƒÂ³ las cinco organizaciones activas/onboarding en
P06Ã¢â‚¬â€œP12: 35 evaluaciones correctas, cero fallos, cinco filas temporales por
bloque y cleanup a cero. Ranking no fuerza una salida sin polÃƒÂ­tica declarada;
las dimensiones restantes conservan `UNKNOWN`, y P12 exige abstenciÃƒÂ³n o
validaciÃƒÂ³n cuando no hay evidencia suficiente. La siguiente fase habilitada
por el ÃƒÂ­ndice es F5.
