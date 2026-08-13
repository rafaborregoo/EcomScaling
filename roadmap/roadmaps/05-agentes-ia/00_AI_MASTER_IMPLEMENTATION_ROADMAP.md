# 00 — AI Master Implementation Roadmap

## Estado del documento

- **Nombre canónico:** `00_AI_MASTER_IMPLEMENTATION_ROADMAP.md`
- **Tipo:** archivo maestro de ejecución.
- **Función:** fuente de verdad para la secuencia, el estado, las dependencias, los gates, el alcance y la evidencia de implementación de la arquitectura de IA.
- **Ámbito:** NORA, EcomScaling IA, CRM/SaaS y plataforma compartida.
- **Documentos gobernados:** 22 MD especializados.
- **Audiencia principal:** Codex y responsables de arquitectura, producto, IA, backend, frontend, seguridad, privacidad, legal, operaciones y dirección.
- **Estado inicial:** `not_started`.
- **Fase inicial:** `PHASE-00-DOCUMENTARY-CONTROL`.
- **Última actualización:** 31 de julio de 2026.
- **Regla principal:** Codex no puede elegir libremente qué dominio implementar. Debe ejecutar exclusivamente la fase activa y respetar sus dependencias, límites y criterios de salida.
- **Regla de detalle:** este archivo no sustituye los MD especializados. Los referencia, ordena y gobierna.
- **Regla de evidencia:** ninguna fase puede marcarse `done` por una descripción, una carpeta o una implementación parcial. Debe existir evidencia verificable.
- **Regla de producto:** no deben desplegarse simultáneamente adaptadores profundos de NORA, EcomScaling IA y CRM salvo que existan equipos independientes, owners distintos y capacidad demostrada.

---

# 1. Misión

Convertir los 22 dominios de arquitectura de IA en un programa de implementación:

- Secuenciado.
- Trazable.
- Incremental.
- Seguro.
- Compatible con el sistema actual.
- Basado en evidencia.
- Adaptado al repositorio real.
- Gobernado por dependencias.
- Ejecutable por Codex sin perder contexto.
- Dividido en cambios pequeños y verificables.
- Capaz de detenerse cuando falten datos o decisiones.
- Capaz de reanudarse después de un cambio de sesión.
- Capaz de evolucionar sin reescribir toda la documentación.

La secuencia maestra es:

```text
INVENTARIAR
  ↓
ESTABILIZAR CONTRATOS
  ↓
MEDIR
  ↓
CONTROLAR ACCIONES
  ↓
ORQUESTAR
  ↓
HACER DURABLE
  ↓
GOBERNAR MODELOS Y CONOCIMIENTO
  ↓
ENDURECER CONFIANZA
  ↓
DISEÑAR EXPERIENCIA HUMANA
  ↓
CONSOLIDAR PLATAFORMA
  ↓
DESPLEGAR POR PRODUCTO
  ↓
MEDIR ECONOMÍA Y MADUREZ
  ↓
MEJORAR CONTINUAMENTE
```

---

# 2. Autoridad documental

## 2.1 Fuente de verdad para la secuencia

Este archivo:

```text
00_AI_MASTER_IMPLEMENTATION_ROADMAP.md
```

es la fuente de verdad para:

- Fase activa.
- Orden de implementación.
- Dependencias.
- Alcance permitido.
- Cambios prohibidos.
- Gates.
- Estado.
- Próximo paso.
- Evidencia necesaria.
- MD que debe leer Codex.
- Producto que puede modificarse.
- Criterios para avanzar.

## 2.2 Fuente de verdad técnica

Los MD especializados son la fuente de verdad para:

- Contratos.
- Arquitectura detallada.
- Interfaces.
- Servicios.
- Tablas orientativas.
- Tests.
- Evals.
- Métricas.
- Alertas.
- Acceptance criteria.
- Definition of Done.
- Restricciones específicas del dominio.

## 2.3 Fuente de verdad para decisiones

```text
ADR_LOG.md
```

debe contener:

- Decisiones aceptadas.
- Decisiones rechazadas.
- Alternativas.
- Motivos.
- Consecuencias.
- Fecha.
- Owner.
- Estado.

## 2.4 Fuente de verdad para el estado ejecutivo

```text
ESTADO_GLOBAL.md
```

debe contener:

- Fase activa.
- Milestone activo.
- Último milestone completado.
- Próximo milestone.
- Bloqueadores.
- Riesgos principales.
- Última evidencia.
- Último commit.
- Entorno validado.

## 2.5 Fuente de verdad para la evidencia

```text
ESTADOS_Y_EVIDENCIA.md
```

debe contener:

- Entregable.
- Archivo.
- Test.
- Eval.
- Migración.
- Commit.
- Trace.
- Screenshot cuando proceda.
- Resultado.
- Limitación.
- Nivel de evidencia.
- Fecha.
- Verificador.

## 2.6 Fuente de verdad para riesgos

```text
RIESGOS.md
```

debe contener:

- Riesgo.
- Severidad.
- Probabilidad.
- Impacto.
- Owner.
- Mitigación.
- Riesgo residual.
- Estado.
- Fecha de revisión.
- Aceptación temporal cuando exista.

## 2.7 Fuente de verdad para incertidumbres

```text
PREGUNTAS_ABIERTAS.md
```

debe contener:

- Pregunta.
- Por qué importa.
- Fase bloqueada.
- Opciones.
- Información faltante.
- Owner.
- Fecha objetivo.
- Decisión final cuando se resuelva.

---

# 3. Jerarquía documental recomendada

```text
docs/
  ai-architecture/
    00_AI_MASTER_IMPLEMENTATION_ROADMAP.md
    00_AI_ARCHITECTURE_INDEX.md

    01_HARNESS_ENGINEERING_AGENTES_CRM.md
    02_CONTEXT_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    03_TOOL_DESIGN_SAAS_MULTI_PRODUCTO.md
    04_LOOP_ENGINEERING_CRM_CODEX.md
    05_ORCHESTRATION_PATTERNS_SAAS_MULTI_PRODUCTO.md
    06_MEMORY_ARCHITECTURE_SAAS_MULTI_PRODUCTO.md
    07_EVALS_FOR_AGENTS_SAAS_MULTI_PRODUCTO.md
    08_HUMAN_IN_THE_LOOP_AI_ACT_UE_SAAS.md
    09_GUARDRAILS_PERMISSIONS_SAAS_MULTI_PRODUCTO.md
    10_OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md
    11_RELIABILITY_RECOVERY_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    12_DURABLE_STATE_EXECUTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    13_MODEL_INFERENCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    14_DATA_KNOWLEDGE_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    15_SECURITY_ADVERSARIAL_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    16_PRIVACY_DATA_PROTECTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    17_AI_GOVERNANCE_REGULATORY_COMPLIANCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    18_AI_PRODUCT_HUMAN_EXPERIENCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    19_AI_PLATFORM_INFRASTRUCTURE_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    20_AI_ECONOMICS_FINOPS_UNIT_ECONOMICS_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    21_AI_OPERATING_MODEL_ORGANIZATION_TALENT_ENGINEERING_SAAS_MULTI_PRODUCTO.md
    22_AI_STRATEGY_PORTFOLIO_MATURITY_CONTINUOUS_IMPROVEMENT_ENGINEERING.md

    governance/
      ADR_LOG.md
      ESTADO_GLOBAL.md
      ESTADOS_Y_EVIDENCIA.md
      RIESGOS.md
      PREGUNTAS_ABIERTAS.md
      CHANGELOG_AI_ARCHITECTURE.md
```

No renombrar ni mover todos los documentos en el mismo cambio que modifica arquitectura.

La normalización documental debe realizarse en un cambio exclusivamente documental.

---

# 4. Registro canónico de los 22 dominios

| Nº | Dominio | Archivo actual |
|---:|---|---|
| 01 | Harness Engineering | `HARNESS_ENGINEERING_AGENTES_CRM.md` |
| 02 | Context Engineering | `CONTEXT_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 03 | Tool Design | `TOOL_DESIGN_SAAS_MULTI_PRODUCTO.md` |
| 04 | Loop Engineering | `LOOP_ENGINEERING_CRM_CODEX.md` |
| 05 | Orchestration Patterns | `ORCHESTRATION_PATTERNS_SAAS_MULTI_PRODUCTO.md` |
| 06 | Memory & State Architecture | `MEMORY_ARCHITECTURE_SAAS_MULTI_PRODUCTO.md` |
| 07 | Evals for Agents | `EVALS_FOR_AGENTS_SAAS_MULTI_PRODUCTO.md` |
| 08 | Human-in-the-Loop | `HUMAN_IN_THE_LOOP_AI_ACT_UE_SAAS.md` |
| 09 | Guardrails & Permissions | `GUARDRAILS_PERMISSIONS_SAAS_MULTI_PRODUCTO.md` |
| 10 | Observability & Tracing | `OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md` |
| 11 | Reliability & Recovery | `RELIABILITY_RECOVERY_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 12 | Durable State & Execution | `DURABLE_STATE_EXECUTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 13 | Model & Inference Engineering | `MODEL_INFERENCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 14 | Data & Knowledge Engineering | `DATA_KNOWLEDGE_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 15 | Security & Adversarial Engineering | `SECURITY_ADVERSARIAL_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 16 | Privacy & Data Protection Engineering | `PRIVACY_DATA_PROTECTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 17 | AI Governance & Regulatory Compliance | `AI_GOVERNANCE_REGULATORY_COMPLIANCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 18 | AI Product & Human Experience | `AI_PRODUCT_HUMAN_EXPERIENCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 19 | AI Platform & Infrastructure | `AI_PLATFORM_INFRASTRUCTURE_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 20 | AI Economics, FinOps & Unit Economics | `AI_ECONOMICS_FINOPS_UNIT_ECONOMICS_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 21 | AI Operating Model, Organization & Talent | `AI_OPERATING_MODEL_ORGANIZATION_TALENT_ENGINEERING_SAAS_MULTI_PRODUCTO.md` |
| 22 | AI Strategy, Portfolio, Maturity & Continuous Improvement | `AI_STRATEGY_PORTFOLIO_MATURITY_CONTINUOUS_IMPROVEMENT_ENGINEERING.md` |

---

# 5. Regla de lectura para Codex

Codex debe leer en este orden:

```text
1. Este Master Roadmap.
2. ESTADO_GLOBAL.md.
3. La ficha de la fase activa.
4. El MD principal de la fase.
5. Los MD secundarios indicados.
6. ADR relevantes.
7. RIESGOS.md.
8. PREGUNTAS_ABIERTAS.md.
9. Código y esquema real.
10. ESTADOS_Y_EVIDENCIA.md.
```

Codex no debe leer los 22 MD completos para cada tarea.

Debe leer únicamente:

- El MD principal.
- Los MD dependientes.
- Las secciones expresamente indicadas.
- Los archivos reales del repositorio afectados.

Excepción:

```text
PHASE-00
```

requiere indexar los 22 MD.

---

# 6. Regla de contexto mínimo

Cada tarea debe proporcionar a Codex:

- Fase.
- Milestone.
- Producto.
- Objetivo.
- MD principal.
- MD secundarios.
- Archivos que debe inspeccionar.
- Archivos que puede modificar.
- Archivos que no puede modificar.
- Tests obligatorios.
- Evidencia requerida.
- Preguntas abiertas.
- Riesgos activos.

Formato:

```yaml
phase: PHASE-03-TOOLS-PERMISSIONS
milestone: M03-02
product: shared
primary_md:
  - TOOL_DESIGN_SAAS_MULTI_PRODUCTO.md
secondary_md:
  - GUARDRAILS_PERMISSIONS_SAAS_MULTI_PRODUCTO.md
allowed_scope:
  - packages/ai-tools/**
  - src/domain/**/services/**
forbidden_scope:
  - billing/**
  - auth schema
required_tests:
  - tool registry unit tests
  - cross-tenant authorization tests
required_evidence:
  - test output
  - changed file list
  - ADR if contract changed
```

---

# 7. Estados globales permitidos

```ts
export type MasterRoadmapStatus =
  | "not_started"
  | "analysis"
  | "design_review"
  | "ready"
  | "in_progress"
  | "verification"
  | "blocked"
  | "done"
  | "deprecated";
```

---

# 8. Estado de una fase

```ts
export type MasterPhaseState = {
  phaseId: string;

  status: MasterRoadmapStatus;

  activeMilestoneId?: string;

  completedMilestoneIds: string[];

  blockedBy: string[];

  primaryMdReferences: string[];

  secondaryMdReferences: string[];

  ownerId?: string;

  startedAt?: string;

  completedAt?: string;

  evidenceIds: string[];

  nextAction: string;
};
```

---

# 9. Estados de milestone

```ts
export type MilestoneStatus =
  | "not_started"
  | "analysis"
  | "design_approved"
  | "implementation"
  | "tests"
  | "validation"
  | "done"
  | "blocked"
  | "cancelled";
```

---

# 10. Transiciones permitidas

```text
not_started
  ↓
analysis
  ↓
design_review
  ↓
ready
  ↓
in_progress
  ↓
verification
  ↓
done
```

Transiciones excepcionales:

```text
cualquier estado
  → blocked

blocked
  → analysis
  → ready
  → cancelled

done
  → analysis
```

Una fase `done` solo puede reabrirse por:

- Regresión.
- Cambio material.
- Incidente.
- Cambio normativo.
- Cambio de arquitectura.
- Nueva evidencia que invalida el gate.

---

# 11. Niveles de evidencia

```ts
export type EvidenceLevel =
  | "E0_CLAIM"
  | "E1_ARTIFACT"
  | "E2_UNIT_TESTED"
  | "E3_INTEGRATION_TESTED"
  | "E4_ENVIRONMENT_VALIDATED"
  | "E5_OUTCOME_MEASURED";
```

## E0 — Claim

Existe una afirmación.

No es evidencia suficiente.

## E1 — Artifact

Existe:

- Archivo.
- Tabla.
- Servicio.
- Documento.
- Migración.

No demuestra funcionamiento.

## E2 — Unit Tested

Existen tests unitarios relevantes.

## E3 — Integration Tested

Existen tests que validan interacción real entre capas.

## E4 — Environment Validated

Validado en:

- Staging.
- Pilot.
- Synthetic tenant equivalente.
- Entorno real controlado.

## E5 — Outcome Measured

Existe evidencia de:

- Uso.
- Calidad.
- Valor.
- Coste.
- Fiabilidad.
- Beneficio.

---

# 12. Evidencia mínima por tipo de cambio

| Tipo de cambio | Evidencia mínima |
|---|---|
| Documentación | E1 |
| Contrato TypeScript | E2 |
| Domain service | E3 |
| Tool de lectura | E3 |
| Tool de escritura | E4 |
| Cambio de permisos | E4 |
| Workflow durable | E4 |
| Integración de provider | E4 |
| RAG | E4 |
| Memoria | E4 |
| Acción financiera o jurídica | E4 + aprobación humana |
| Feature escalada | E5 |
| Cambio de pricing | E5 + aprobación de negocio |

---

# 13. Registro de evidencia

```ts
export type RoadmapEvidenceRecord = {
  id: string;

  phaseId: string;

  milestoneId: string;

  evidenceLevel: EvidenceLevel;

  evidenceType:
    | "file"
    | "test"
    | "eval"
    | "migration"
    | "trace"
    | "screenshot"
    | "deployment"
    | "metric"
    | "approval"
    | "incident";

  reference: string;

  description: string;

  result:
    | "pass"
    | "partial"
    | "fail";

  limitations: string[];

  verifiedBy?: string;

  verifiedAt: string;
};
```

---

# 14. Principios maestros de implementación

1. **Analizar antes de implementar.**
2. **Preservar comportamiento existente.**
3. **No inventar columnas, tablas o servicios.**
4. **Leer schema y tipos reales.**
5. **Aplicar TDD cuando se cambia comportamiento.**
6. **Usar contratos antes que lógica dispersa.**
7. **Usar domain services antes que acceso directo.**
8. **No permitir acceso directo del modelo a DB.**
9. **No mezclar decisión probabilística y autorización.**
10. **No desplegar sin observabilidad.**
11. **No escalar sin evals.**
12. **No ejecutar acciones críticas sin aprobación y verificación.**
13. **No introducir memoria sin privacy scope.**
14. **No introducir RAG sin Knowledge Owner.**
15. **No introducir un provider sin ADR, security, privacy y economics.**
16. **No crear plataforma antes de detectar repetición.**
17. **No reescribir todos los documentos en cada cambio.**
18. **No marcar done sin evidencia.**
19. **No implementar tres productos en paralelo sin capacidad.**
20. **No degradar calidad silenciosamente por plan.**

---

# 15. Regla de cambios pequeños

Cada milestone debe buscar:

- Un contrato.
- Un servicio.
- Una migración.
- Un adapter.
- Una policy.
- Una eval suite.
- Un flujo.

No debe mezclar en el mismo cambio:

- Refactor masivo.
- Nueva feature.
- Migración destructiva.
- Cambio de provider.
- Rediseño UI.
- Cambio de permisos.
- Nuevo pricing.

Excepción:

- Cambio atómico técnicamente inseparable y documentado mediante ADR.

---

# 16. Presupuesto de cambio

Objetivo orientativo por milestone:

```text
1–3 objetivos técnicos.
1 contrato principal.
1 área de dominio.
1 conjunto de tests.
1 gate.
```

Codex debe detenerse y dividir la tarea si:

- El patch afecta demasiados dominios.
- Cambia auth, billing, workflows y UI simultáneamente.
- Requiere múltiples migraciones no relacionadas.
- No puede explicar el rollback.
- No puede enumerar los invariantes.

---

# 17. Protocolo de inicio de tarea

Antes de editar:

1. Leer estado.
2. Confirmar fase.
3. Leer MD principal.
4. Leer dependencias.
5. Inspeccionar código real.
6. Identificar comportamiento actual.
7. Identificar invariantes.
8. Identificar riesgos.
9. Identificar tests existentes.
10. Proponer patch.
11. Enumerar archivos.
12. Enumerar migraciones.
13. Enumerar tests.
14. Esperar aprobación cuando la tarea esté configurada como `design_review_required`.

---

# 18. Protocolo de implementación

Durante la implementación:

1. Crear o actualizar tests.
2. Aplicar cambio mínimo.
3. Mantener compatibilidad.
4. Ejecutar tests focalizados.
5. Ejecutar tests transversales.
6. Ejecutar typecheck.
7. Ejecutar lint.
8. Ejecutar build.
9. Ejecutar evals cuando proceda.
10. Revisar RLS.
11. Revisar tenant isolation.
12. Revisar logs.
13. Revisar costes.
14. Revisar rollback.
15. Documentar desviaciones.

---

# 19. Protocolo de cierre

Después de implementar:

1. Enumerar archivos modificados.
2. Enumerar migraciones.
3. Enumerar tests.
4. Enumerar evals.
5. Registrar limitaciones.
6. Actualizar evidencia.
7. Actualizar estado.
8. Actualizar riesgos.
9. Crear ADR cuando proceda.
10. Actualizar preguntas abiertas.
11. Indicar siguiente milestone.
12. No iniciar automáticamente el siguiente milestone.

---

# 20. Condiciones de parada obligatoria

Codex debe detener la implementación si:

- Falta un dato canónico.
- Falta el esquema real.
- Existe contradicción entre código y MD.
- Existe contradicción entre dos MD.
- Falta decisión legal material.
- Falta owner para una acción crítica.
- Falta política de permisos.
- Falta tenant binding.
- No existe rollback.
- La migración sería destructiva sin plan.
- No puede garantizar idempotencia.
- No puede verificar un side effect.
- El cambio aumenta autonomía sin gate.
- El cambio introduce datos sensibles sin assessment.
- El cambio requiere provider no aprobado.
- El cambio puede degradar producción sin canary.

En estos casos debe:

```text
1. Marcar milestone blocked.
2. Añadir pregunta abierta.
3. Añadir riesgo.
4. Proponer opciones.
5. No inventar una respuesta.
```

---

# 21. Política de migraciones

## 21.1 Expand-contract

Preferir:

```text
ADD
  ↓
DUAL READ / DUAL WRITE
  ↓
BACKFILL
  ↓
SWITCH
  ↓
REMOVE OLD
```

## 21.2 Migraciones prohibidas sin fase específica

- Drop de columnas activas.
- Cambio irreversible de significado.
- Rename sin compatibilidad.
- Backfill sin estimación.
- RLS desactivada.
- Eliminación de datos sin retention assessment.
- Cambio de identificadores externos.
- Cambio de tenant ownership.
- Cambio de roles sin migration matrix.

## 21.3 Evidencia de migración

- SQL.
- Rollback o estrategia de forward fix.
- Test.
- Datos de ejemplo.
- Tiempo estimado.
- Lock analysis.
- RLS review.
- Backfill verification.

---

# 22. Política de ramas y commits

Recomendación:

```text
branch:
ai/<phase-id>/<milestone-id>-<slug>
```

Ejemplo:

```text
ai/phase-03/m03-02-tool-registry
```

Commits:

```text
docs:
test:
feat:
refactor:
fix:
chore:
migration:
```

Cada commit debe representar una unidad lógica.

No mezclar:

- Documentación masiva.
- Refactor.
- Feature.
- Migración.
- Formatting global.

---

# 23. Tracks transversales

Aunque exista una fase principal, estos tracks están activos desde PHASE-00:

## Track A — Seguridad

- Threat model.
- Tenant isolation.
- Secrets.
- Egress.
- Prompt injection.
- Tool abuse.

## Track B — Privacidad

- Purpose.
- Data categories.
- Retention.
- Providers.
- Rights.
- Logs.

## Track C — Evaluación

- Baselines.
- Regression cases.
- Golden sets.
- Incident-to-eval.

## Track D — Observabilidad

- Trace IDs.
- Run IDs.
- Version IDs.
- Cost.
- Error.

## Track E — Economía

- Basic cost attribution.
- Budget.
- Cost anomalies.

## Track F — Organización

- Owners.
- Backups.
- Decision rights.
- Support.

Los dominios 15–17 y 20–21 se formalizan en fases posteriores, pero sus invariantes críticos no se posponen.

---

# 24. Resumen de fases

| Fase | Nombre | Objetivo |
|---|---|---|
| 00 | Documentary Control | Consolidar documentación y estado real |
| 01 | Canonical Foundations | Contratos, identity, tenancy y execution envelope |
| 02 | Evaluation & Observability Baseline | Medir antes de refactorizar |
| 03 | Tools & Permissions | Crear frontera segura de acciones |
| 04 | Loops & Orchestration | Controlar cómo razonan y colaboran agentes |
| 05 | Memory & State | Definir qué estado persiste y con qué autoridad |
| 06 | Reliability & Durable Execution | Hacer workflows recuperables e idempotentes |
| 07 | Models & Inference | Centralizar routing, prompts, schemas y budgets |
| 08 | Data & Knowledge | Construir datos, RAG y knowledge governance |
| 09 | Security, Privacy & Governance | Endurecer confianza y cumplimiento |
| 10 | HITL & Human Experience | Diseñar control humano y UX |
| 11 | Shared Platform | Consolidar plataforma reutilizable |
| 12 | NORA Vertical | Implantar capacidades en NORA |
| 13 | EcomScaling Vertical | Implantar capacidades en EcomScaling IA |
| 14 | CRM Vertical | Implantar capacidades en CRM/SaaS |
| 15 | Economics, Organization & Strategy | Medir, operar, madurar y mejorar |

---

# 25. PHASE-00 — Documentary Control & Repository Baseline

## Estado inicial

```yaml
id: PHASE-00-DOCUMENTARY-CONTROL
status: not_started
```

## Objetivo

Crear una representación fiable del estado real antes de implementar.

## MD principal

- `AI_STRATEGY_PORTFOLIO_MATURITY_CONTINUOUS_IMPROVEMENT_ENGINEERING.md`

## MD secundarios

- Los 21 MD restantes.
- Documentos existentes del repositorio.
- ADR.
- Roadmaps actuales.
- Schema.
- Types.
- CI/CD.

## Alcance

- Indexar documentos.
- Normalizar nombres.
- Crear `00_AI_ARCHITECTURE_INDEX.md`.
- Crear archivos de gobierno.
- Inventariar sistemas.
- Inventariar agents.
- Inventariar tools.
- Inventariar prompts.
- Inventariar workflows.
- Inventariar providers.
- Inventariar datos.
- Inventariar owners.
- Identificar duplicidades.
- Identificar contradicciones.
- Identificar gaps.
- Crear dependency graph inicial.
- Crear maturity baseline.
- Identificar el producto vertical inicial.

## No permitido

- Crear nueva plataforma.
- Cambiar runtime.
- Crear nuevas tablas de IA.
- Cambiar proveedores.
- Reescribir auth.
- Rediseñar UI.
- Implementar todos los MD.

## Entregables

1. `00_AI_ARCHITECTURE_INDEX.md`.
2. `ADR_LOG.md`.
3. `ESTADO_GLOBAL.md`.
4. `ESTADOS_Y_EVIDENCIA.md`.
5. `RIESGOS.md`.
6. `PREGUNTAS_ABIERTAS.md`.
7. Inventario de sistemas.
8. Inventario de agents.
9. Inventario de tools.
10. Inventario de prompts.
11. Inventario de providers.
12. Dependency graph.
13. Maturity baseline.
14. Contradiction report.
15. Proposed phase activation.

## Gate de salida

- Los 22 MD están localizados.
- Sus nombres son inequívocos.
- Existe índice.
- Existe estado.
- Existen riesgos.
- Existen preguntas.
- Existe inventario real.
- Se ha elegido el primer producto vertical.
- No existen contradicciones críticas sin registrar.

## Evidencia mínima

```text
E1_ARTIFACT
```

más validación humana del índice.

## Prompt de Codex

```text
Ejecuta PHASE-00-DOCUMENTARY-CONTROL.

No implementes features ni cambies runtime.

Lee los 22 MD, el repositorio, los roadmaps actuales,
el schema y los tipos generados.

Crea:

- índice canónico,
- inventario de sistemas,
- inventario de agents,
- inventario de tools,
- inventario de prompts,
- inventario de providers,
- dependency graph,
- maturity baseline,
- contradictions report,
- ADR_LOG,
- ESTADO_GLOBAL,
- ESTADOS_Y_EVIDENCIA,
- RIESGOS,
- PREGUNTAS_ABIERTAS.

No inventes componentes.
Marca cualquier duda como pregunta abierta.
```

---

# 26. PHASE-01 — Canonical Foundations

## Objetivo

Crear contratos comunes de identidad, tenant, actor, task, run, context y resultado.

## MD principal

- `HARNESS_ENGINEERING_AGENTES_CRM.md`
- `CONTEXT_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `GUARDRAILS_PERMISSIONS_SAAS_MULTI_PRODUCTO.md`
- `OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md`
- `PRIVACY_DATA_PROTECTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- PHASE-00 done.
- Inventario aprobado.
- Schema real analizado.
- Auth real analizado.
- Tenant model analizado.

## Alcance

- Canonical tenant context.
- Canonical actor context.
- Canonical task envelope.
- Canonical run envelope.
- Canonical trace context.
- Canonical context references.
- Canonical result envelope.
- Error taxonomy inicial.
- Correlation IDs.
- Boundary adapters para código legacy.

## No permitido

- Cambiar modelo de auth sin ADR.
- Crear acceso directo del agente a DB.
- Añadir memoria.
- Añadir tools de escritura.
- Crear orquestación multi-agent.
- Cambiar pricing.
- Cambiar RLS global.

## Entregables

- `AIExecutionContext`.
- `AITaskEnvelope`.
- `AIResultEnvelope`.
- `AIErrorEnvelope`.
- `TraceContext`.
- Normalizers.
- Legacy adapters.
- Tests de tenant binding.
- Tests de actor binding.
- Tests de serialization.

## Gate de salida

- Todo run nuevo tiene tenant.
- Todo run nuevo tiene actor.
- Todo run nuevo tiene task type.
- Todo run nuevo tiene trace ID.
- Los contratos están versionados.
- Legacy puede adaptarse.
- No hay regresiones críticas.

## Evidencia mínima

```text
E3_INTEGRATION_TESTED
```

---

# 27. PHASE-02 — Evaluation & Observability Baseline

## Objetivo

Medir el comportamiento actual antes de introducir refactors profundos.

## MD principal

- `EVALS_FOR_AGENTS_SAAS_MULTI_PRODUCTO.md`
- `OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `HARNESS_ENGINEERING_AGENTES_CRM.md`
- `AI_ECONOMICS_FINOPS_UNIT_ECONOMICS_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `SECURITY_ADVERSARIAL_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Contratos de PHASE-01.
- Run IDs y trace IDs.

## Alcance

- Trace model.
- Run spans.
- Model spans.
- Tool spans.
- Error events.
- Token/cost fields.
- Golden eval cases.
- Regression suite inicial.
- Baseline de calidad.
- Baseline de latencia.
- Baseline de coste.
- Trace sampling.
- Redaction.

## No permitido

- Exponer chain-of-thought.
- Registrar secretos.
- Registrar documentos completos sin policy.
- Crear dashboards sin fuentes.
- Sustituir tests tradicionales por evals.
- Marcar un output como correcto sin criteria.

## Entregables

- Trace contracts.
- Trace repository o adapter.
- Eval case schema.
- Eval runner inicial.
- Baseline report.
- Cost attribution básica.
- Redaction tests.
- Trace coverage tests.

## Gate de salida

- Runs críticos trazables.
- Versiones registradas.
- Errores clasificables.
- Baseline disponible.
- Eval suite reproducible.
- Datos sensibles redactados.
- Coste básico atribuible.

## Evidencia mínima

```text
E3_INTEGRATION_TESTED
```

---

# 28. PHASE-03 — Tools & Permissions

## Objetivo

Crear una frontera segura entre razonamiento probabilístico y acciones reales.

## MD principal

- `TOOL_DESIGN_SAAS_MULTI_PRODUCTO.md`
- `GUARDRAILS_PERMISSIONS_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `SECURITY_ADVERSARIAL_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `HUMAN_IN_THE_LOOP_AI_ACT_UE_SAAS.md`
- `OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- PHASE-01.
- PHASE-02.
- Domain services existentes o planificados.
- Permission model real analizado.

## Alcance

- Tool Registry.
- Tool schemas.
- Tool risk levels.
- Tool grants.
- Purpose binding.
- Tenant binding.
- Actor binding.
- Idempotency keys.
- Approval binding.
- Verification contract.
- Read tools primero.
- Una tool de escritura piloto después.

## No permitido

- SQL directo desde modelo.
- Service role key en runtime de agente.
- Tool genérica de mutación.
- Aprobación reutilizable.
- Cross-tenant access.
- Side effect sin verification.
- Tool crítica sin rollback o compensation.

## Entregables

- Tool contracts.
- Registry.
- Grant resolver.
- Authorization middleware.
- Domain service adapter.
- Tool audit.
- Read tool pilot.
- Write tool pilot.
- Tests de permisos.
- Tests cross-tenant.
- Tests de idempotencia.
- Tests de approval binding.

## Gate de salida

- El modelo no toca DB.
- Todas las tools están registradas.
- Las tools de escritura pasan authorization.
- Existe tenant binding.
- Existe audit.
- Existe verification.
- Existe al menos un pilot E4.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

para tools de escritura.

---

# 29. PHASE-04 — Loops & Orchestration

## Objetivo

Definir cómo se selecciona, ejecuta y termina cada patrón de razonamiento.

## MD principal

- `LOOP_ENGINEERING_CRM_CODEX.md`
- `ORCHESTRATION_PATTERNS_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `HARNESS_ENGINEERING_AGENTES_CRM.md`
- `TOOL_DESIGN_SAAS_MULTI_PRODUCTO.md`
- `EVALS_FOR_AGENTS_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Tool boundary estable.
- Tracing.
- Eval baseline.
- Task contracts.

## Alcance

- Loop Router.
- Direct answer loop.
- RAG loop.
- Tool loop.
- Review loop.
- Planner-executor cuando sea necesario.
- Termination policies.
- Budget policies.
- Multi-agent solo para casos justificados.
- Handoff contracts.
- Partial result handling.

## No permitido

- Loop universal.
- Delegación circular.
- Agent-to-agent chat sin contracts.
- Planner con tools críticas.
- Unlimited iterations.
- Multi-agent por marketing.
- Orquestación antes de domain boundaries.

## Entregables

- Loop Registry.
- Router.
- Termination policies.
- Budget policies.
- Handoff schemas.
- One-agent workflows.
- Multi-agent decision ADR.
- Loop evals.
- Infinite-loop tests.
- Budget exhaustion tests.

## Gate de salida

- Cada task type selecciona loop explícito.
- Existe termination.
- Existen budgets.
- Existen partial results.
- No hay loops ilimitados.
- Evals muestran no regresión.

## Evidencia mínima

```text
E3_INTEGRATION_TESTED
```

---

# 30. PHASE-05 — Memory & State Architecture

## Objetivo

Separar estado operacional, memoria de usuario, memoria empresarial y conocimiento.

## MD principal

- `MEMORY_ARCHITECTURE_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `CONTEXT_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `PRIVACY_DATA_PROTECTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `DATA_KNOWLEDGE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Canonical context.
- Loop contracts.
- Tenant boundaries.
- Privacy baseline.

## Alcance

- Memory taxonomy.
- Working state.
- Session state.
- User preferences.
- Tenant memory.
- Candidate memory.
- Promotion workflow.
- Expiration.
- Deletion.
- Authority.
- Provenance.
- Retrieval policy.
- No automatic memory from model output.

## No permitido

- Guardar conversaciones completas por defecto.
- Reingerir informes de IA como verdad.
- Global memory sin tenant.
- Sensitive memory sin assessment.
- Memory sin deletion.
- Memory sin owner.
- Memoria que sustituye datos canónicos.

## Entregables

- Memory contracts.
- Memory scopes.
- Candidate workflow.
- Promotion policy.
- Retention.
- Deletion.
- Retrieval.
- Tenant isolation tests.
- Privacy tests.
- Stale-memory tests.

## Gate de salida

- Cada memoria tiene scope.
- Cada memoria tiene source.
- Cada memoria tiene authority.
- Existe deletion.
- Existe expiration.
- No existe auto-promotion.
- Cross-tenant tests pasan.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

si persiste datos reales.

---

# 31. PHASE-06 — Reliability & Durable Execution

## Objetivo

Hacer los workflows reanudables, verificables y recuperables.

## MD principal

- `RELIABILITY_RECOVERY_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `DURABLE_STATE_EXECUTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md`
- `TOOL_DESIGN_SAAS_MULTI_PRODUCTO.md`
- `HUMAN_IN_THE_LOOP_AI_ACT_UE_SAAS.md`

## Dependencias

- Loop contracts.
- Tool idempotency.
- State taxonomy.
- Tracing.

## Alcance

- Workflow state machine.
- Checkpoints.
- Events.
- Timers.
- Retry policies.
- Circuit breakers.
- DLQ.
- Compensation.
- Replay.
- Cancellation.
- Approval waits.
- Outbox/inbox cuando proceda.
- Recovery runbooks.
- SLO inicial.

## No permitido

- Retry ciego.
- Replay de side effects.
- Cron como única durabilidad.
- Estado crítico solo en memoria.
- Approval wait bloqueando un proceso web.
- Compensation asumida como rollback perfecto.
- Workflow incompatible sin migration plan.

## Entregables

- Durable workflow contract.
- State persistence.
- Idempotency store.
- Event model.
- Retry policies.
- DLQ.
- Recovery service.
- One critical workflow pilot.
- Chaos tests.
- Recovery tests.
- Runbook.

## Gate de salida

- Workflow piloto sobrevive a restart.
- No duplica side effects.
- Puede reanudarse.
- Puede cancelarse.
- Puede compensarse cuando proceda.
- Existe DLQ.
- Existe runbook.
- SLO medido.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

---

# 32. PHASE-07 — Models & Inference

## Objetivo

Centralizar y gobernar la selección, configuración y uso de modelos.

## MD principal

- `MODEL_INFERENCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `AI_PLATFORM_INFRASTRUCTURE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `EVALS_FOR_AGENTS_SAAS_MULTI_PRODUCTO.md`
- `AI_ECONOMICS_FINOPS_UNIT_ECONOMICS_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `PRIVACY_DATA_PROTECTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Eval baseline.
- Trace model.
- Canonical request/result.
- Cost attribution básica.

## Alcance

- Model Registry.
- Model policy.
- Provider adapter.
- Prompt Registry.
- Schema Registry.
- Snapshot/version pinning.
- Routing.
- Fallback policy.
- Budget.
- Structured output.
- Migration evals.
- Provider health.

## No permitido

- SDK directo en nuevas features.
- Latest model implícito.
- Fallback a provider no aprobado.
- Prompt sin version.
- Schema sin version.
- Modelo diferente por plan si degrada calidad pactada.
- Provider change sin eval.

## Entregables

- Gateway inicial.
- One provider adapter.
- Model policies.
- Prompt Registry.
- Schema Registry.
- Cost and latency metrics.
- Model migration eval.
- Fallback tests.
- Budget tests.

## Gate de salida

- Nuevas llamadas pasan gateway.
- Modelo y prompt versionados.
- Output validado.
- Coste atribuido.
- Fallback controlado.
- Migration eval reproducible.
- Rollback disponible.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

---

# 33. PHASE-08 — Data & Knowledge

## Objetivo

Construir fuentes de verdad, pipelines y RAG gobernado.

## MD principal

- `DATA_KNOWLEDGE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `CONTEXT_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `MEMORY_ARCHITECTURE_SAAS_MULTI_PRODUCTO.md`
- `PRIVACY_DATA_PROTECTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `SECURITY_ADVERSARIAL_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Model gateway.
- Tenant context.
- Privacy scopes.
- Observability.
- Knowledge owner assignment.

## Alcance

- Source Registry.
- Data contracts.
- Knowledge ownership.
- Ingestion.
- OCR boundaries.
- Chunking.
- Embeddings.
- Index versions.
- Retrieval.
- Reranking.
- Citations.
- Freshness.
- Deletion.
- Reindex.
- Data quality.
- Retrieval evals.

## No permitido

- Un índice global sin tenant.
- Ingesta sin owner.
- Ingesta sin source authority.
- RAG sin citations.
- Reindex destructivo sin blue-green.
- AI-generated reports como canonical knowledge.
- Documentos obsoletos sin vigencia.
- Datos sensibles sin policy.

## Entregables

- Source Registry.
- Knowledge Base Registry.
- Ingestion pipeline.
- Index versioning.
- Retrieval service.
- Citation model.
- Freshness model.
- Deletion workflow.
- Retrieval eval suite.
- One product knowledge pilot.

## Gate de salida

- Sources tienen authority.
- Knowledge tiene owner.
- Index tiene version.
- Tenant isolation verificada.
- Citations disponibles.
- Deletion funciona.
- Retrieval evals pasan.
- Stale source se detecta.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

---

# 34. PHASE-09 — Security, Privacy & Governance

## Objetivo

Convertir requisitos transversales en controles, registros y gates formales.

## MD principal

- `SECURITY_ADVERSARIAL_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `PRIVACY_DATA_PROTECTION_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `AI_GOVERNANCE_REGULATORY_COMPLIANCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `GUARDRAILS_PERMISSIONS_SAAS_MULTI_PRODUCTO.md`
- `OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md`
- `AI_OPERATING_MODEL_ORGANIZATION_TALENT_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Inventarios reales.
- Tool Registry.
- Model Registry.
- Data/Knowledge Registry.
- Owners.
- Tracing.

## Alcance

- Threat models.
- Security controls.
- Privacy data maps.
- Purpose Registry.
- Retention.
- Provider governance.
- AI System Registry.
- Intended Purpose.
- Role assessment.
- Risk classification.
- Obligation mapping.
- Control library.
- Evidence packs.
- Regulatory calendar.
- Release governance.

## No permitido

- Declarar cumplimiento global.
- Clasificación jurídica automática definitiva.
- Logs completos como default.
- Security by prompt.
- Privacy by notice only.
- Owner colectivo.
- Risk acceptance indefinido.
- Tenant control disabling mandatory safeguards.

## Entregables

- Threat model.
- Privacy map.
- AI System Registry.
- Intended Purpose Registry.
- Risk Register.
- Controls.
- Evidence model.
- Release gate.
- Incident taxonomy.
- Transparency policy.
- Review calendar.

## Gate de salida

- Production systems registrados.
- Purpose definido.
- Owners definidos.
- Security review.
- Privacy review.
- Governance review.
- Required transparency.
- Evidence pack.
- Critical risks closed or approved.
- Release gate activo.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

más aprobaciones requeridas.

---

# 35. PHASE-10 — Human-in-the-Loop & Human Experience

## Objetivo

Traducir riesgo, evidencia y acciones a una experiencia humana efectiva.

## MD principal

- `HUMAN_IN_THE_LOOP_AI_ACT_UE_SAAS.md`
- `AI_PRODUCT_HUMAN_EXPERIENCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- `TOOL_DESIGN_SAAS_MULTI_PRODUCTO.md`
- `AI_GOVERNANCE_REGULATORY_COMPLIANCE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `OBSERVABILITY_TRACING_AGENTS_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Action risk levels.
- Approval binding.
- Evidence presentation.
- Governance policy.
- Durable waits.

## Alcance

- Surface Registry.
- Action preview.
- Approval UI.
- Human review queue.
- Correction workflow.
- Uncertainty presentation.
- Evidence UX.
- Status UX.
- Partial success.
- Cancellation.
- Undo/compensation messaging.
- Accessibility.
- Training-linked approvals.

## No permitido

- Chat para todo.
- Generic confirm.
- Fake progress.
- Hidden source.
- Hidden uncertainty.
- Critical action from chat.
- Approval after execution.
- Dark patterns.
- Chain-of-thought exposure.
- Auto-promotion of corrections.

## Entregables

- Surface policies.
- Preview contracts.
- Approval views.
- Review queue.
- Correction model.
- Error recovery UX.
- Accessibility tests.
- Trust calibration eval.
- One end-to-end approval flow.

## Gate de salida

- Usuario entiende acción.
- Usuario ve impacto.
- Usuario puede reject.
- Usuario puede correct.
- Usuario puede cancel.
- Accessibility tests pass.
- Approval is bound.
- One high-risk flow E4.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

---

# 36. PHASE-11 — Shared AI Platform

## Objetivo

Consolidar capacidades repetidas en una plataforma común sin borrar lógica de producto.

## MD principal

- `AI_PLATFORM_INFRASTRUCTURE_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## MD secundarios

- Todos los MD 01–18 según el servicio compartido.
- `AI_ECONOMICS_FINOPS_UNIT_ECONOMICS_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `AI_OPERATING_MODEL_ORGANIZATION_TALENT_ENGINEERING_SAAS_MULTI_PRODUCTO.md`

## Dependencias

- Al menos dos casos reales repiten la capacidad.
- Contracts estables.
- Tool and model gateways probados.
- Observability.
- Security.
- Privacy.
- Governance.
- Economics baseline.

## Alcance

- Service Catalog.
- Control Plane.
- Data Plane.
- Developer Plane.
- SDK.
- CLI.
- Registries.
- Queues.
- Worker pools.
- Tenant fairness.
- Feature flags.
- Config.
- Deployment manifests.
- Shadow.
- Canary.
- Rollback.
- SLO.
- Runbooks.
- Cost attribution.

## No permitido

- Plataforma por anticipación.
- Abstracción sin consumidores.
- Reescribir productos enteros.
- Un worker pool.
- Cache global.
- Provider lock-in oculto.
- Config manual.
- Production as test.
- Big-bang migration.

## Entregables

- Platform service catalog.
- Shared SDK.
- Gateway packages.
- Registries.
- Deployment manifest.
- Worker policies.
- Local runtime.
- Synthetic tenant.
- Golden path.
- Platform SLO.
- Adoption metrics.

## Gate de salida

- Dos capacidades reales usan plataforma.
- No hay regresión.
- Existe rollback.
- Existe runbook.
- Existe SLO.
- Existe cost attribution.
- Developer path documentado.
- Direct provider calls decrecen.

## Evidencia mínima

```text
E4_ENVIRONMENT_VALIDATED
```

---

# 37. PHASE-12 — NORA Vertical

## Objetivo

Implantar el stack aprobado en NORA, preservando el motor fiscal como fuente determinista.

## MD principales

- Los MD relevantes según la capacidad concreta.
- `AI_STRATEGY_PORTFOLIO_MATURITY_CONTINUOUS_IMPROVEMENT_ENGINEERING.md`

## Prioridad recomendada interna

1. Motor fiscal y snapshot canónico.
2. AI Summary ligado a TAX_RESULT.
3. Playbook.
4. OCR.
5. CRM Copilot.
6. Legal Assistant.
7. Workflows de servicio.
8. Servicios NIE/licencia turística.

## Invariantes NORA

- LLM no calcula impuestos.
- TAX_RESULT es canónico.
- PDF consume snapshot aprobado.
- Legal output requiere source y review.
- Playbook respeta tenant y vigencia.
- CRM tools heredan permisos.
- No inventar normativa.
- No mezclar dato fiscal y explicación.

## No permitido

- Sustituir motor fiscal.
- Recalcular con LLM.
- Crear asesor jurídico autónomo.
- CRUD sin tool gateway.
- RAG sin Knowledge Owner.
- OCR sin review de baja confianza.

## Gate de salida

- Un workflow de NORA end-to-end.
- Eval suite NORA.
- Security/privacy/governance.
- Cost per successful outcome.
- Support runbook.
- Owner and backup.
- Pilot tenant.
- Benefits baseline.

## Evidencia mínima

```text
E5_OUTCOME_MEASURED
```

para escalar.

---

# 38. PHASE-13 — EcomScaling IA Vertical

## Objetivo

Implantar análisis, recomendaciones y ejecución controlada sobre datos multicanal.

## Prioridad recomendada interna

1. Data contracts.
2. Shopify sync.
3. Meta sync.
4. Metric definitions.
5. Analyst agent.
6. Recommendation agent.
7. Monitoring.
8. Alerts.
9. Approval flows.
10. Campaign executor.
11. Store memory.
12. Multi-store scale.

## Invariantes EcomScaling

- Growth y Scale no degradan calidad.
- Datos y periodo visibles.
- Recommendation no equivale a action.
- Campaign action requiere approval.
- Budget impact visible.
- Store isolation.
- Provider credentials tenant-scoped.
- No person-level profiling no aprobado.

## No permitido

- Ejecutar antes de tener data quality.
- Pausar campaña sin verification.
- Alertas repetitivas.
- Métricas no definidas.
- Fallback que cambia semántica.
- Calidad inferior por plan.
- Conectar Meta con credenciales globales.

## Gate de salida

- Una tienda piloto.
- Data freshness medible.
- Recommendations evaluadas.
- Approval flow.
- One controlled action.
- Cost per store.
- Actionable alert rate.
- Support runbook.
- Owner and backup.

## Evidencia mínima

```text
E5_OUTCOME_MEASURED
```

para escalar.

---

# 39. PHASE-14 — CRM/SaaS Vertical

## Objetivo

Implantar copiloto contextual, RAG, tools CRUD y workflows durables en el CRM.

## Prioridad recomendada interna

1. Domain services.
2. Permission model.
3. Tool Registry.
4. Read tools.
5. Intent router.
6. RAG.
7. Contextual copilot.
8. Write tools.
9. Approval inbox.
10. Durable workflows.
11. Notifications.
12. Analytics.

## Invariantes CRM

- RLS es autoridad.
- Modelo no deriva permisos.
- Tools usan domain services.
- Side effects auditados.
- Sensitive documents protegidos.
- Employee analytics requiere review.
- Lead scoring no se reutiliza para otra finalidad.
- Notifications no spam.

## No permitido

- CRUD directo.
- Generic database tool.
- Service role in agent.
- Cross-tenant retrieval.
- Scoring sin intended purpose.
- Action without preview.
- Bulk action sin scope.
- Chat como única interfaz.

## Gate de salida

- One end-to-end CRM workflow.
- RLS tests.
- Tool tests.
- Approval flow.
- Durable execution.
- UX review.
- Cost per successful action.
- Support runbook.
- Owner and backup.

## Evidencia mínima

```text
E5_OUTCOME_MEASURED
```

para escalar.

---

# 40. PHASE-15 — Economics, Organization, Strategy & Continuous Improvement

## Objetivo

Convertir las capacidades implementadas en un sistema operable, sostenible y adaptativo.

## MD principal

- `AI_ECONOMICS_FINOPS_UNIT_ECONOMICS_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `AI_OPERATING_MODEL_ORGANIZATION_TALENT_ENGINEERING_SAAS_MULTI_PRODUCTO.md`
- `AI_STRATEGY_PORTFOLIO_MATURITY_CONTINUOUS_IMPROVEMENT_ENGINEERING.md`

## Dependencias

- Al menos un vertical pilotado.
- Cost attribution.
- Owners.
- Evals.
- Production metrics.

## Alcance

- Cost Ledger.
- Units.
- Outcomes.
- Cost-to-serve.
- Human review cost.
- Margins.
- Budgets.
- Forecast.
- Plan economics.
- Operating model.
- Team topology.
- Decision rights.
- Training.
- Bus factor.
- Portfolio.
- Maturity.
- Benefits.
- Continuous improvement.
- Technology radar.
- Retirement.

## No permitido

- Inventar valor.
- Inventar plan intermedio.
- Cambiar pricing automáticamente.
- Medir solo tokens.
- Owner colectivo.
- Formación genérica.
- Portfolio sin capacity.
- Mantener pilots sin review.
- Mantener systems por sunk cost.

## Entregables

- Cost Ledger.
- Unit Registry.
- Margin dashboards.
- Budgets.
- Forecast.
- Operating model.
- Ownership coverage.
- Training matrix.
- Bus factor.
- Capability map.
- Maturity assessment.
- Portfolio.
- Strategy scorecard.
- Improvement loop.
- Retirement process.

## Gate de salida

- Cost per success conocido.
- Owners and backups.
- Budgets.
- Margins.
- Target maturity.
- Active portfolio.
- Benefits measured.
- Improvement loop active.
- Systems can be retired.
- Roadmap re-prioritizable.

## Evidencia mínima

```text
E5_OUTCOME_MEASURED
```

---

# 41. Dependencias maestras

```text
PHASE-00
  ↓
PHASE-01
  ↓
PHASE-02
  ↓
PHASE-03
  ↓
PHASE-04
  ↓
PHASE-05
  ↓
PHASE-06
  ↓
PHASE-07
  ↓
PHASE-08
  ↓
PHASE-09
  ↓
PHASE-10
  ↓
PHASE-11
  ↓
PHASE-12 / PHASE-13 / PHASE-14
  ↓
PHASE-15
```

Los verticales 12–14 pueden ejecutarse:

- Secuencialmente.
- En paralelo solo con equipos independientes.
- Con shared platform estable.
- Con owners separados.
- Con budgets separados.
- Con gates propios.

---

# 42. Orden recomendado de verticales

Orden por defecto:

```text
1. NORA.
2. EcomScaling IA.
3. CRM/SaaS.
```

Razón:

- NORA contiene motores deterministas y casos jurídicos que fuerzan contratos fuertes.
- EcomScaling valida integraciones externas, datos multicanal y acciones económicas.
- CRM valida CRUD amplio, workflows y adopción transversal.

Este orden no es obligatorio.

PHASE-00 debe confirmar:

- Repositorio más maduro.
- Mayor valor inmediato.
- Menor riesgo de bloqueo.
- Capacidad disponible.
- Demanda comercial.
- Dependencias.

---

# 43. Regla para ejecución paralela

Se permite paralelizar únicamente si:

- Las fases comparten contracts estables.
- No tocan las mismas migraciones.
- No compiten por el mismo owner.
- No compiten por el mismo worker pool.
- No cambian el mismo provider policy.
- No cambian auth simultáneamente.
- Cada track tiene tests y rollback.
- Existe integración programada.

---

# 44. Gates transversales obligatorios

Cada fase debe superar:

## Gate A — Arquitectura

- Contracts.
- Boundaries.
- Dependencies.
- ADR.

## Gate B — Testing

- Unit.
- Integration.
- Evals.
- Regression.

## Gate C — Seguridad

- Threat review.
- Tenant isolation.
- Secrets.
- Permissions.

## Gate D — Privacidad

- Purpose.
- Data categories.
- Retention.
- Provider.
- Logging.

## Gate E — Gobernanza

- Owner.
- Intended purpose.
- Risk.
- Evidence.

## Gate F — Operaciones

- Observability.
- SLO.
- Runbook.
- Rollback.
- Support.

## Gate G — Economía

- Budget.
- Cost attribution.
- Cost anomaly.
- Unit of value.

---

# 45. Matriz de MD por fase

| MD | Fases principales |
|---|---|
| Harness | 01, 04 |
| Context | 01, 05, 08, 10 |
| Tools | 03, 04, 10 |
| Loops | 04 |
| Orchestration | 04 |
| Memory | 05 |
| Evals | 02 y todas |
| HITL | 03, 06, 10 |
| Guardrails | 01, 03, 09 |
| Observability | 02, 06, 11 |
| Reliability | 06 |
| Durable Execution | 06 |
| Models | 07 |
| Data & Knowledge | 08 |
| Security | todas; formal 09 |
| Privacy | todas; formal 09 |
| Governance | 09, 15 |
| Human Experience | 10 y verticales |
| Platform | 11 |
| Economics | transversal; formal 15 |
| Operating Model | transversal; formal 15 |
| Strategy | 00, 15 |

---

# 46. Regla de source-of-truth por dominio

Cuando existe contradicción:

1. Código real describe el estado actual.
2. ADR aprobado describe la decisión objetivo.
3. Master Roadmap describe la secuencia.
4. MD especializado describe el diseño objetivo.
5. ESTADO_GLOBAL describe el progreso.
6. Evidencia determina si se cumplió.

Una contradicción no debe resolverse silenciosamente.

Debe registrarse como:

```text
CONTRADICTION-<id>
```

en `PREGUNTAS_ABIERTAS.md` o `ADR_LOG.md`.

---

# 47. Regla de compatibilidad legacy

Toda fase debe elegir una estrategia:

```ts
export type LegacyMigrationStrategy =
  | "adapter"
  | "strangler"
  | "dual_run"
  | "expand_contract"
  | "replacement"
  | "retirement";
```

Preferencias:

1. Adapter.
2. Strangler.
3. Dual run.
4. Expand-contract.
5. Replacement solo con evidencia.

---

# 48. Definition of Ready de milestone

Un milestone está `ready` cuando:

- Fase activa.
- Objetivo definido.
- Owner definido.
- MD identificado.
- Scope identificado.
- Dependencias satisfechas.
- Schema inspeccionado.
- Tests identificados.
- Risks identificados.
- Rollback identificado.
- Preguntas materiales resueltas.
- Evidencia esperada definida.

---

# 49. Definition of Done de milestone

Un milestone está `done` cuando:

1. Código implementado.
2. Tests pasan.
3. Typecheck pasa.
4. Lint pasa.
5. Build pasa.
6. Evals pasan cuando proceda.
7. Security review completada.
8. Privacy review completada.
9. Tenant isolation validada.
10. Observability activa.
11. Cost attribution activa.
12. Rollback documentado.
13. Evidence registrada.
14. Estado actualizado.
15. Riesgos actualizados.
16. Preguntas actualizadas.
17. ADR creado si cambió arquitectura.
18. Limitaciones documentadas.
19. No existe deuda crítica oculta.
20. Siguiente milestone no iniciado automáticamente.

---

# 50. Definition of Done de fase

Una fase está `done` cuando:

- Todos los milestones obligatorios están done.
- Gate de salida superado.
- Evidence mínima alcanzada.
- Tests transversales pasan.
- No existen blockers críticos.
- Riesgos residuales están aprobados.
- Runbook existe.
- Rollback existe.
- Estado global actualizado.
- Maturity assessment actualizado.
- La siguiente fase puede comenzar sin asumir trabajo oculto.

---

# 51. Estado global inicial sugerido

```yaml
program:
  name: AI Architecture Transformation
  status: not_started

active_phase:
  id: PHASE-00-DOCUMENTARY-CONTROL
  status: not_started

active_milestone:
  id: M00-01
  name: Indexar los 22 MD
  status: not_started

next_action:
  - Ejecutar análisis documental.
  - Crear índice canónico.
  - Crear archivos de gobierno.
  - Inventariar repositorio.
  - No implementar código.

vertical_priority:
  status: pending_assessment

critical_open_questions:
  - Ubicación real de los 22 MD en el repositorio.
  - Producto vertical inicial.
  - Repositorio único o repositorios separados.
  - Owners actuales.
  - Estado de plataforma compartida.
```

---

# 52. Milestones sugeridos por fase

## PHASE-00

- M00-01 — Indexar los 22 MD.
- M00-02 — Crear archivos de gobierno.
- M00-03 — Inventariar sistemas y repositorio.
- M00-04 — Crear dependency graph.
- M00-05 — Crear maturity baseline.
- M00-06 — Seleccionar vertical inicial.

## PHASE-01

- M01-01 — Tenant and actor contracts.
- M01-02 — Task and run envelopes.
- M01-03 — Result and error contracts.
- M01-04 — Legacy adapters.
- M01-05 — Integration tests.

## PHASE-02

- M02-01 — Trace context.
- M02-02 — Run and span model.
- M02-03 — Eval schemas.
- M02-04 — Baseline datasets.
- M02-05 — Cost baseline.
- M02-06 — Redaction.

## PHASE-03

- M03-01 — Tool Registry.
- M03-02 — Tool schemas.
- M03-03 — Grants and authorization.
- M03-04 — Read tool pilot.
- M03-05 — Write tool pilot.
- M03-06 — Verification and idempotency.

## PHASE-04

- M04-01 — Loop Registry.
- M04-02 — Loop Router.
- M04-03 — Termination and budgets.
- M04-04 — Handoffs.
- M04-05 — Orchestration pilot.

## PHASE-05

- M05-01 — Memory taxonomy.
- M05-02 — Candidate memory.
- M05-03 — Promotion workflow.
- M05-04 — Retrieval.
- M05-05 — Deletion and retention.
- M05-06 — Isolation tests.

## PHASE-06

- M06-01 — Workflow state machine.
- M06-02 — Checkpoints.
- M06-03 — Retry and circuit breaker.
- M06-04 — DLQ.
- M06-05 — Cancellation and compensation.
- M06-06 — Recovery pilot.

## PHASE-07

- M07-01 — Model Registry.
- M07-02 — Provider adapter.
- M07-03 — Model policy.
- M07-04 — Prompt Registry.
- M07-05 — Schema Registry.
- M07-06 — Migration eval.

## PHASE-08

- M08-01 — Source Registry.
- M08-02 — Knowledge Registry.
- M08-03 — Ingestion.
- M08-04 — Index versioning.
- M08-05 — Retrieval and citations.
- M08-06 — Deletion.
- M08-07 — Retrieval eval.

## PHASE-09

- M09-01 — Threat model.
- M09-02 — Privacy map.
- M09-03 — AI System Registry.
- M09-04 — Risk Register.
- M09-05 — Controls and evidence.
- M09-06 — Release gate.
- M09-07 — Incident governance.

## PHASE-10

- M10-01 — Surface Registry.
- M10-02 — Action preview.
- M10-03 — Approval UI.
- M10-04 — Review queue.
- M10-05 — Correction workflow.
- M10-06 — Accessibility.
- M10-07 — End-to-end UX pilot.

## PHASE-11

- M11-01 — Service Catalog.
- M11-02 — SDK.
- M11-03 — Control plane.
- M11-04 — Worker and queue policies.
- M11-05 — Feature flags.
- M11-06 — Deployment manifest.
- M11-07 — Shadow and canary.
- M11-08 — Golden path.

## PHASE-12

- M12-01 — NORA contracts.
- M12-02 — AI Summary.
- M12-03 — Playbook.
- M12-04 — OCR.
- M12-05 — CRM Copilot.
- M12-06 — Legal Assistant.
- M12-07 — Service workflow.
- M12-08 — Pilot and benefits.

## PHASE-13

- M13-01 — Data contracts.
- M13-02 — Connectors.
- M13-03 — Analyst.
- M13-04 — Recommendations.
- M13-05 — Alerts.
- M13-06 — Approval.
- M13-07 — Campaign executor.
- M13-08 — Pilot and benefits.

## PHASE-14

- M14-01 — Domain services.
- M14-02 — Permissions.
- M14-03 — Read tools.
- M14-04 — Intent router.
- M14-05 — RAG.
- M14-06 — Write tools.
- M14-07 — Durable workflow.
- M14-08 — Pilot and benefits.

## PHASE-15

- M15-01 — Cost Ledger.
- M15-02 — Unit economics.
- M15-03 — Margins and budgets.
- M15-04 — Operating model.
- M15-05 — Training and continuity.
- M15-06 — Capability map.
- M15-07 — Maturity and portfolio.
- M15-08 — Continuous improvement.
- M15-09 — Retirement.

---

# 53. Archivo `ESTADO_GLOBAL.md` — plantilla

```md
# Estado global de la arquitectura de IA

## Estado ejecutivo

- Programa:
- Estado:
- Fase activa:
- Milestone activo:
- Producto activo:
- Owner:
- Última actualización:

## Último resultado completado

- Milestone:
- Evidencia:
- Commit:
- Entorno:
- Limitaciones:

## Próximo paso

- Objetivo:
- MD principal:
- MD secundarios:
- Scope permitido:
- Gate esperado:

## Bloqueadores

- Ninguno / listado.

## Riesgos críticos

- Ninguno / listado.

## Preguntas abiertas críticas

- Ninguna / listado.
```

---

# 54. Archivo `ESTADOS_Y_EVIDENCIA.md` — plantilla

```md
# Estados y evidencia

## <PHASE-ID> / <MILESTONE-ID>

- Estado:
- Owner:
- Fecha:
- Evidence level:
- Código:
- Migración:
- Tests:
- Evals:
- Trace:
- Deployment:
- Resultado:
- Limitaciones:
- Verificado por:
- Próximo paso:
```

---

# 55. Archivo `ADR_LOG.md` — plantilla

```md
# ADR Log

## ADR-XXX — Título

- Estado:
- Fecha:
- Owner:
- Fase:
- Contexto:
- Decisión:
- Alternativas:
- Motivos:
- Consecuencias:
- Riesgos:
- Rollback:
- MD relacionados:
- Archivos relacionados:
```

---

# 56. Archivo `RIESGOS.md` — plantilla

```md
# Riesgos

## RISK-XXX — Título

- Estado:
- Fase:
- Sistema:
- Descripción:
- Probabilidad:
- Impacto:
- Severidad:
- Owner:
- Mitigación:
- Riesgo residual:
- Aceptado por:
- Expira:
- Evidencia:
```

---

# 57. Archivo `PREGUNTAS_ABIERTAS.md` — plantilla

```md
# Preguntas abiertas

## QUESTION-XXX — Pregunta

- Estado:
- Fase bloqueada:
- Por qué importa:
- Información faltante:
- Opciones:
- Owner:
- Fecha objetivo:
- Decisión:
- ADR resultante:
```

---

# 58. Registro de contradicciones

```ts
export type ArchitectureContradiction = {
  id: string;

  sourceA: string;

  sourceB: string;

  description: string;

  severity:
    | "low"
    | "medium"
    | "high"
    | "critical";

  blocksPhaseIds: string[];

  resolution:
    | "pending"
    | "source_a"
    | "source_b"
    | "new_adr"
    | "code_as_current_state";

  ownerId?: string;
};
```

---

# 59. Registro de referencias MD

```ts
export type MDReferenceRecord = {
  id: string;

  documentNumber: number;

  domain: string;

  filename: string;

  canonicalPath: string;

  primaryPhaseIds: string[];

  dependentPhaseIds: string[];

  sourceOfTruthFor: string[];

  lastReviewedAt?: string;

  status:
    | "active"
    | "needs_review"
    | "superseded";
};
```

---

# 60. Prompt maestro de arranque para Codex

```text
Actúa como implementador de la arquitectura de IA gobernada por
00_AI_MASTER_IMPLEMENTATION_ROADMAP.md.

Reglas obligatorias:

1. Lee primero el Master Roadmap.
2. Lee ESTADO_GLOBAL.md.
3. Identifica la fase y milestone activos.
4. Lee únicamente los MD indicados.
5. Inspecciona el código, schema y tests reales.
6. No implementes fuera del scope.
7. No inventes tablas, columnas, roles, owners ni providers.
8. Antes de editar, entrega diagnóstico, invariantes, archivos,
   riesgos, tests y plan de patch.
9. Usa TDD para cambios de comportamiento.
10. Mantén tenant isolation.
11. Mantén backward compatibility.
12. No accedas directamente a DB desde modelos o agentes.
13. No marques done sin evidencia.
14. Actualiza estado, evidencia, riesgos y ADR al cerrar.
15. No inicies el siguiente milestone automáticamente.

Tarea actual:

- Fase: <PHASE-ID>
- Milestone: <MILESTONE-ID>
- Producto: <PRODUCT>
- Objetivo: <OBJECTIVE>
- MD principal: <PRIMARY-MD>
- MD secundarios: <SECONDARY-MDS>
- Scope permitido: <ALLOWED-SCOPE>
- Scope prohibido: <FORBIDDEN-SCOPE>
- Tests obligatorios: <TESTS>
- Evidence mínima: <EVIDENCE-LEVEL>

Primero realiza solo el análisis.
No modifiques código hasta entregar el diagnóstico requerido.
```

---

# 61. Prompt maestro para implementación de milestone

```text
Implementa únicamente el milestone <MILESTONE-ID>
de la fase <PHASE-ID>.

Utiliza:

- 00_AI_MASTER_IMPLEMENTATION_ROADMAP.md
- ESTADO_GLOBAL.md
- <PRIMARY-MD>
- <SECONDARY-MDS>
- ADR relevantes
- RIESGOS.md
- PREGUNTAS_ABIERTAS.md
- código y schema real

Scope permitido:

<ALLOWED-SCOPE>

No permitido:

<FORBIDDEN-SCOPE>

Entregables:

<DELIVERABLES>

Tests obligatorios:

<TESTS>

Evidence mínima:

<EVIDENCE-LEVEL>

Reglas:

1. Cambios pequeños.
2. No inventar.
3. No reescribir módulos no relacionados.
4. No modificar contratos fuera del milestone.
5. Mantener compatibilidad.
6. Añadir tests antes o junto al cambio.
7. Ejecutar typecheck, lint y build.
8. Documentar desviaciones.
9. Actualizar evidencia.
10. No iniciar el siguiente milestone.
```

---

# 62. Prompt de reanudación tras pérdida de contexto

```text
Reanuda la implementación de la arquitectura de IA.

No confíes en memoria conversacional.

Lee:

1. 00_AI_MASTER_IMPLEMENTATION_ROADMAP.md.
2. ESTADO_GLOBAL.md.
3. ESTADOS_Y_EVIDENCIA.md.
4. ADR_LOG.md.
5. RIESGOS.md.
6. PREGUNTAS_ABIERTAS.md.
7. MD de la fase activa.
8. Código y git diff.

Determina:

- fase activa,
- milestone activo,
- último cambio confirmado,
- tests ejecutados,
- evidencia existente,
- cambios sin cerrar,
- siguiente acción exacta.

No modifiques código hasta presentar el estado reconstruido.
```

---

# 63. Prompt de auditoría de fase

```text
Audita la fase <PHASE-ID> sin implementar nuevas features.

Comprueba:

- milestones,
- contracts,
- tests,
- evals,
- security,
- privacy,
- governance,
- tenant isolation,
- observability,
- cost attribution,
- runbooks,
- rollback,
- evidence,
- open risks,
- open questions.

Clasifica cada requisito como:

- verified,
- partial,
- missing,
- contradicted,
- not_applicable.

No marques la fase done si falta evidencia mínima.
```

---

# 64. Prompt de transición de fase

```text
Evalúa si <CURRENT-PHASE> puede cerrarse
y <NEXT-PHASE> puede activarse.

No implementes código.

Verifica:

- exit criteria de la fase actual,
- evidence level,
- blockers,
- risks,
- dependencies,
- readiness de la fase siguiente,
- owners,
- capacity,
- required MD,
- environment.

Entrega:

1. decisión go / conditional go / no-go,
2. evidencia,
3. condiciones,
4. risks,
5. primer milestone de la siguiente fase.

Actualiza documentos solo después de aprobación.
```

---

# 65. Reglas específicas para Codex

Codex debe:

- Mostrar siempre qué fase está ejecutando.
- Mostrar qué MD está usando.
- Indicar qué contrato es source of truth.
- Diferenciar análisis y ejecución.
- Diferenciar current state y target state.
- Mantener cambios idempotentes.
- Evitar archivos gigantes.
- Reutilizar tipos existentes.
- No generar types manuales si existe generación oficial.
- No modificar generated files salvo proceso oficial.
- No ejecutar migraciones destructivas.
- No crear seeds con datos reales.
- No exponer secrets.
- No falsear tests.
- No comentar tests para pasarlos.
- No degradar RLS.
- No añadir bypass temporales sin expiración.
- No asumir que una UI demuestra backend correcto.
- No asumir que un test unitario demuestra tenant isolation.
- No asumir que un trace demuestra compliance.
- No asumir que una policy demuestra efectividad.

---

# 66. Regla de revisión humana

Se requiere revisión humana previa a merge para:

- Auth.
- RLS.
- Billing.
- Payments.
- Legal outputs.
- Tax engine.
- Provider contracts.
- Sensitive data.
- Tool permissions.
- Critical workflows.
- Regulatory classifications.
- Pricing.
- Deletion.
- Production migrations.

---

# 67. Regla de rollbacks

Todo milestone con impacto productivo debe definir:

- Trigger.
- Target version.
- Data compatibility.
- Workflow compatibility.
- Feature flag.
- Provider fallback.
- Communication.
- Owner.
- Maximum rollback time.

No aceptar:

```text
se puede revertir con git
```

como único plan.

---

# 68. Regla de feature flags

Feature flags deben tener:

- Owner.
- Environment.
- Tenant targeting.
- Default.
- Start.
- End.
- Cleanup.
- Rollback.
- Audit.

No usar flags permanentes como sustituto de arquitectura.

---

# 69. Regla de pruebas

Orden:

```text
UNIT
  ↓
INTEGRATION
  ↓
SECURITY
  ↓
PRIVACY
  ↓
EVAL
  ↓
E2E
  ↓
STAGING
  ↓
PILOT
```

No todos los milestones requieren todos los niveles.

El gate de la fase define el mínimo.

---

# 70. Regla de evals

Toda regresión detectada debe convertirse en:

- Eval case.
- Test.
- Policy.
- Data correction.
- Prompt correction.
- Tool correction.
- Training.
- Roadmap item.

No cerrar incidentes de IA solo con prompt patch.

---

# 71. Regla de observabilidad

Todo run productivo debe poder reconstruir:

- Tenant.
- Actor.
- Product.
- Task.
- Agent.
- Model.
- Prompt.
- Tool.
- Workflow.
- Approval.
- Cost.
- Outcome.
- Error.
- Release.

Sin exponer:

- Secrets.
- Chain-of-thought.
- Datos completos no necesarios.
- Cross-tenant context.

---

# 72. Regla de economía

Desde PHASE-02 debe registrarse:

- Provider.
- Model.
- Tokens.
- Cost.
- Task.
- Tenant cuando proceda.
- Outcome cuando esté disponible.

Desde PHASE-12 debe medirse:

```text
cost per successful outcome
```

No solo coste por run.

---

# 73. Regla de ownership

Toda capacidad productiva debe tener:

- Accountable owner.
- Technical maintainer.
- Domain owner.
- Evaluation owner.
- Operations owner.
- Backup owner.

Una persona puede acumular roles.

Los roles no desaparecen.

---

# 74. Regla de mantenimiento documental

No reescribir los 22 MD tras cada cambio.

Actualizar:

- Master Roadmap.
- Estado.
- Evidencia.
- ADR.
- Riesgos.
- Preguntas.

Modificar un MD especializado solo si:

- Cambia diseño.
- Cambia contrato.
- Cambia gate.
- Se detecta contradicción.
- Se reemplaza una decisión.

---

# 75. Regla de versionado del Master Roadmap

```ts
export type MasterRoadmapVersion = {
  version: string;

  effectiveFrom: string;

  changedSections: string[];

  changedBy: string;

  reason: string;

  approvedBy: string;

  previousVersionReference?: string;
};
```

Cambios materiales:

- Reordenar fases.
- Eliminar gate.
- Cambiar evidencia mínima.
- Cambiar vertical priority.
- Cambiar source of truth.
- Cambiar definition of done.

Requieren ADR.

---

# 76. Maturity targets recomendados

Antes de escalar verticales:

| Dominio | Nivel mínimo |
|---|---:|
| Harness | 2 |
| Context | 2 |
| Tools | 3 |
| Evals | 3 |
| Permissions | 3 |
| Observability | 3 |
| Reliability | 3 |
| Durable Execution | 3 para workflows críticos |
| Models | 2 |
| Data & Knowledge | 2 |
| Security | 3 |
| Privacy | 3 |
| Governance | 3 |
| Human Experience | 2 |
| Platform | 2 |
| Economics | 2 |
| Operating Model | 2 |

Para escala enterprise:

- Dominios críticos: nivel 4.
- Resto: nivel 3.
- Ningún dominio crítico en nivel 1.

---

# 77. Criterios para no construir una capacidad

No construir si:

- No existe problema.
- No existe usuario.
- No existe owner.
- No existe dato.
- No existe value hypothesis.
- Existe alternativa determinista mejor.
- No existe capacidad operativa.
- No existe budget.
- Riesgo no controlable.
- Dependencia crítica ausente.
- Feature ya existe en plataforma.
- Provider managed service resuelve mejor.
- No puede evaluarse.
- No puede retirarse.

---

# 78. Criterios para retirar

Retirar si:

- No tiene uso.
- No crea valor.
- Coste insostenible.
- Riesgo excesivo.
- Provider obsoleto.
- Duplicada.
- Reemplazada.
- Sin owner.
- Sin soporte.
- Sin evals.
- Sin compliance.
- Deuda supera valor.
- Alternativa determinista mejor.

---

# 79. Criterios para escalar

Escalar si:

- E5 outcome measured.
- Calidad estable.
- Coste sostenible.
- Support ready.
- Owners ready.
- Capacity ready.
- Security approved.
- Privacy approved.
- Governance approved.
- SLO met.
- Incident rate acceptable.
- Rollback tested.
- Benefits demonstrated.

---

# 80. Índice de productos y adapters

## Shared

- Contracts.
- Gateways.
- Registries.
- Observability.
- Evaluation.
- Security.
- Privacy.
- Governance.
- Economics.

## NORA

- Tax Engine adapter.
- Fiscal Summary adapter.
- Playbook adapter.
- OCR adapter.
- CRM adapter.
- Legal Service adapter.

## EcomScaling IA

- Shopify adapter.
- Meta adapter.
- Klaviyo adapter.
- Metrics adapter.
- Recommendation adapter.
- Campaign action adapter.

## CRM/SaaS

- Lead adapter.
- Client adapter.
- Property adapter.
- Opportunity adapter.
- Reservation adapter.
- Document adapter.
- Task adapter.
- Billing adapter.
- Notification adapter.

---

# 81. No duplicación entre productos

Antes de crear código específico:

1. Comprobar platform capability.
2. Comprobar shared contract.
3. Comprobar existing adapter.
4. Comprobar domain service.
5. Comprobar whether configuration is sufficient.
6. Crear product code solo para lógica de dominio.

---

# 82. Registro de deuda

```ts
export type RoadmapDebtItem = {
  id: string;

  phaseId: string;

  milestoneId?: string;

  debtType:
    | "technical"
    | "documentation"
    | "test"
    | "evaluation"
    | "security"
    | "privacy"
    | "governance"
    | "operations"
    | "economics"
    | "organization";

  description: string;

  severity: string;

  ownerId: string;

  acceptedUntil?: string;

  targetPhaseId?: string;

  status: string;
};
```

No ocultar deuda bajo:

```text
future improvement
```

sin owner ni fecha.

---

# 83. Registro de excepciones

```ts
export type RoadmapException = {
  id: string;

  requirement: string;

  scope: string;

  rationale: string;

  compensatingControls: string[];

  approvedBy: string;

  expiresAt: string;

  reviewAt: string;

  status:
    | "active"
    | "expired"
    | "revoked"
    | "closed";
};
```

No existen excepciones permanentes.

---

# 84. Checklist de revisión de pull request

- [ ] Fase y milestone indicados.
- [ ] Scope respetado.
- [ ] MD leído.
- [ ] Invariantes enumerados.
- [ ] Tests añadidos.
- [ ] Tests ejecutados.
- [ ] Tenant isolation.
- [ ] Auth.
- [ ] Privacy.
- [ ] Security.
- [ ] Observability.
- [ ] Cost attribution.
- [ ] Rollback.
- [ ] Migration.
- [ ] ADR.
- [ ] Evidence.
- [ ] Risks.
- [ ] Questions.
- [ ] No unrelated changes.

---

# 85. Checklist de release

- [ ] Manifest.
- [ ] Versiones.
- [ ] Feature flag.
- [ ] Eval report.
- [ ] Security approval.
- [ ] Privacy approval.
- [ ] Governance approval.
- [ ] Migration plan.
- [ ] Rollback.
- [ ] SLO.
- [ ] Alerts.
- [ ] Runbook.
- [ ] Support handoff.
- [ ] Owner.
- [ ] Backup.
- [ ] Budget.
- [ ] Evidence pack.
- [ ] Canary.
- [ ] Stop conditions.

---

# 86. Checklist de cierre de fase

- [ ] Milestones obligatorios done.
- [ ] Exit criteria.
- [ ] Evidence mínima.
- [ ] Tests transversales.
- [ ] No critical blockers.
- [ ] Risk residual approved.
- [ ] Runbook.
- [ ] Rollback.
- [ ] State updated.
- [ ] Evidence updated.
- [ ] ADR updated.
- [ ] Risks updated.
- [ ] Questions updated.
- [ ] Maturity updated.
- [ ] Next phase ready.

---

# 87. Primer paso real después de añadir este archivo

No empezar PHASE-01.

Ejecutar:

```text
PHASE-00
M00-01
Indexar y localizar los 22 MD dentro del repositorio.
```

Después:

```text
M00-02
Crear los archivos de gobierno.
```

Después:

```text
M00-03
Analizar el repositorio real.
```

Solo entonces:

```text
seleccionar el primer milestone técnico.
```

---

# 88. Resultado esperado de PHASE-00

Codex debe terminar PHASE-00 pudiendo responder:

- Qué sistemas existen.
- Qué agents existen.
- Qué tools existen.
- Qué modelos existen.
- Qué prompts existen.
- Qué workflows existen.
- Qué providers existen.
- Qué datos existen.
- Qué productos existen.
- Qué se comparte.
- Qué está duplicado.
- Qué está incompleto.
- Qué está en producción.
- Qué tiene owner.
- Qué tiene tests.
- Qué tiene evals.
- Qué tiene tracing.
- Qué tiene coste.
- Qué tiene riesgos.
- Qué fase debe activarse.

---

# 89. Gobernanza del propio roadmap

Owner recomendado:

```text
AI Architecture / Program Owner
```

Consultados:

- Product owners.
- Platform owner.
- Security.
- Privacy.
- Legal.
- Operations.
- FinOps.
- Domain owners.

Revisión:

- Mensual durante implementación.
- Trimestral después.
- Event-driven por incidente o cambio material.

---

# 90. Definition of Done del programa completo

El programa está completo cuando:

1. Los 22 dominios están mapeados.
2. Los dominios críticos alcanzan madurez objetivo.
3. Los sistemas productivos están inventariados.
4. Cada sistema tiene owner.
5. Cada sistema tiene evals.
6. Cada sistema tiene observability.
7. Cada acción tiene authorization.
8. Los workflows críticos son durables.
9. Los datos tienen ownership.
10. La knowledge tiene governance.
11. Security está probada.
12. Privacy está operativa.
13. Governance tiene evidencia.
14. HITL es efectivo.
15. UX es comprensible.
16. Platform tiene adopción.
17. Cost per success está medido.
18. Operating model funciona.
19. Portfolio está activo.
20. Continuous improvement está operativo.
21. Los sistemas pueden escalarse.
22. Los sistemas pueden retirarse.

---

# 91. Regla final para Codex

```text
Este Master Roadmap decide:

- qué toca,
- cuándo toca,
- qué depende de qué,
- qué evidencia se exige,
- y cuándo debe detenerse.

Los MD especializados deciden:

- cómo se diseña cada dominio.

El código real decide:

- cuál es el estado actual.

Los ADR deciden:

- qué arquitectura ha sido aprobada.

La evidencia decide:

- qué está realmente terminado.
```

---

# 92. Resumen ejecutivo

El archivo guía debe utilizarse así:

```text
MASTER ROADMAP
  ↓
ESTADO GLOBAL
  ↓
FASE ACTIVA
  ↓
MILESTONE
  ↓
MD PRINCIPAL
  ↓
CÓDIGO REAL
  ↓
TESTS Y EVIDENCIA
  ↓
GATE
  ↓
SIGUIENTE MILESTONE
```

La primera acción no es programar.

La primera acción es:

```text
construir una representación fiable
del estado actual
y activar una única fase
```

El éxito del programa no se mide por:

- Número de agentes.
- Número de prompts.
- Número de herramientas.
- Número de documentos.

Se mide por:

- Resultados correctos.
- Fiabilidad.
- Seguridad.
- Control.
- Valor.
- Coste sostenible.
- Capacidad de operación.
- Capacidad de aprendizaje.
