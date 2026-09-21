# Fase 9 — Implementación: aprendizaje continuo

## Estado canónico — 2026-09-21

F9 queda implementada de extremo a extremo con un contrato compartido de
`Experience`/`LearningAssessment` y perfiles de runtime explícitos por bloque.
El bloque `9.21` no se implementa: la normativa canónica lo marca como bloque
inexistente. Los 40 bloques reales sí tienen contrato, perfil runtime,
persistencia, worker, workflow, API, Copiloto y panel de diagnóstico.

La arquitectura deliberadamente separa:

- experiencia observada y su contexto;
- ejecución planificada frente a ejecución real;
- outcome operacional de outcome atribuible;
- clasificación `POSITIVE`, `NEGATIVE`, `NEUTRAL`, `INCONCLUSIVE` y `MIXED`;
- gate de learning, confianza y evidencia pendiente.

Un `SUCCESS` de F8 sin medición, atribución y muestra suficiente no se convierte
en éxito causal: F9 lo conserva como `INCONCLUSIVE` y `WAITING_FOR_EVIDENCE`.
`NEUTRAL` nunca se colapsa con `INCONCLUSIVE`. El motor no ejecuta acciones, no
promociona conocimiento automáticamente y no reescribe cierres históricos.

## Entregables

- Contrato puro y TDD: `packages/contracts/src/continuous-learning.ts` y
  `continuous-learning.test.ts`.
- Runtime tenant-bound: `apps/api/src/continuous-learning-engine.ts`, con
  perfiles de los 40 bloques y entrada real desde `execution_closure_runs` y
  `agent_outputs`.
- Persistencia idempotente y RLS: tabla
  `public.continuous_learning_runs`, migración
  `20260925100000_f9_continuous_learning_runs.sql`.
- Worker `.env.local`: `continuous-learning-once.ts`, scripts `dev:`/`start:` y
  workflow `.github/workflows/continuous-learning-f9.yml`.
- API consultora: `GET /v1/consultant/continuous-learning`.
- Copiloto: bloque F9 en `decision-playbook-chat-context.ts`, con evidencia,
  unknowns, clasificación, confianza y siguiente evidencia; nunca como orden.
- Diagnóstico/UI: `#insight-continuous-learning`, tabla por bloque y feed de
  `InsightsMenu` con navegación exacta.

## RevisiÃ³n Copiloto-first â€” 2026-09-21

- El turno A09 compone ahora vista actual, historial, restricciones crÃ­ticas y
  todos los snapshots estructurados F3â€“F9 mediante
  `buildConsultantChatContextBlocks`; F8/F9 tambiÃ©n llegan al razonamiento del
  Copiloto y no quedan solo disponibles para la pantalla.
- Las tools siguen siendo la capa de lectura/verificaciÃ³n de cifras y
  conectores. Los snapshots de ejecuciÃ³n/aprendizaje son evidencia recuperada,
  no instrucciones ni autoridad para ejecutar; `allowed_tools`, aprobaciÃ³n,
  tenant y gates se mantienen en el Tool Layer existente.
- La migraciÃ³n `20261102120000_ai_a09_copilot_f8_f9_context.sql` publica el
  prompt A09 v6 y la versiÃ³n activa v10, con reglas explÃ­citas para no
  convertir readiness, supervisiÃ³n, cierre u outcome insuficiente en permiso,
  causalidad o aprendizaje reutilizable.
- Si una tabla de snapshots no estÃ¡ disponible, el contexto marca la fuente
  como no disponible en vez de presentarla como una organizaciÃ³n sin datos.
  `InsightsMenu` conserva el acceso separado de notificaciones y navega a las
  cards exactas de F8 y F9.
- El contrato A09 admite `ui_actions` semÃ¡nticas (`open_insight`) para ofrecer
  "Ver evidencia", "Abrir card" o "Revisar datos faltantes". El modelo solo
  propone un `insight_slug`; el backend lo filtra contra el catÃ¡logo compartido
  y la web resuelve la ruta real desde `InsightsMenu`. Las acciones se guardan
  en `ai_messages.metadata`, por lo que sobreviven al recargar la conversaciÃ³n.

## Bloques reales

| Bloque | Estado | Perfil runtime |
| --- | --- | --- |
| 9.00 | hecho | framework universal |
| 9.01 | hecho | unidad de experiencia y contexto |
| 9.03 | hecho | execution fidelity |
| 9.04 | hecho | quality de evidencia |
| 9.05 | hecho | causalidad y atribución |
| 9.06 | hecho | confounders |
| 9.07 | hecho | fuerza de evidencia |
| 9.08 | hecho | madurez de outcome |
| 9.09 | hecho | learning confidence |
| 9.10 | hecho | generalization boundary |
| 9.11 | hecho | contextual learning |
| 9.12 | hecho | clasificación de outcome |
| 9.13 | hecho | incident learning |
| 9.14 | hecho | human override |
| 9.15 | hecho | recommendation learning |
| 9.16 | hecho | prioritization learning |
| 9.17 | hecho | playbook learning |
| 9.18 | hecho | benchmarks y guardrails |
| 9.19 | hecho | autonomy learning |
| 9.20 | hecho | operational friction |
| 9.22 | hecho | contradicciones |
| 9.23 | hecho | decay y drift |
| 9.24 | hecho | exploration vs exploitation |
| 9.25 | hecho | learning loops |
| 9.26 | hecho | knowledge promotion |
| 9.27 | hecho | supersession |
| 9.28 | hecho | anti-learning |
| 9.29 | hecho | dangerous feedback loops |
| 9.30 | hecho | learning governance |
| 9.31 | hecho | explainable learning |
| 9.32 | hecho | traceability |
| 9.33 | hecho | forgetting y withdrawal |
| 9.34 | hecho | transfer learning |
| 9.35 | hecho | cohort learning |
| 9.36 | hecho | global vs tenant learning |
| 9.37 | hecho | privacy e isolation |
| 9.38 | hecho | long-term learning |
| 9.39 | hecho | strategic learning |
| 9.40 | hecho | meta-learning |
| 9.41 | hecho | framework final |

`9.21` queda fuera del conteo: no existe según `conocimiento/IMPLEMENTACION.md`.

## Verificación

- Contratos completos: `831/831` pasando; TDD F9 incluido.
- API y worker compilan; typecheck web pasa.
- Migración aplicada en desarrollo usando `.env.local` y en producción usando
  `.env.production.local`; dry-run de ambos destinos sin pendientes después de
  aplicar.
- Worker real en desarrollo: `6` organizaciones, `240` evaluaciones, `0`
  fallos; una evaluación por organización y bloque, sin duplicados.
- Smoke reversible con un cierre F8 realista `CLOSED/VERIFIED`: produjo `40/40`
  evaluaciones `BLOCKED/INCONCLUSIVE` por ausencia deliberada de evidencia
  causal; las filas y el cierre sembrados se borraron y el cleanup quedó a cero.
- La ausencia de outcomes métricos en los tenants actuales queda visible como
  deuda de evidencia; no se inventan learnings para cerrar la pantalla.
