# AI Product & Human Experience Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica y de producto transversal.
- **Ámbito:** SaaS, CRM, agentes, copilotos, RAG, OCR, formularios inteligentes, workflows, aprobaciones, automatizaciones, dashboards, documentos, acciones y sistemas multi-tenant.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** convertir capacidades técnicas de IA en experiencias comprensibles, controlables, auditables, accesibles y adaptadas al riesgo, al rol y al contexto de uso.
- **Audiencia:** Codex, producto, diseño, frontend, backend, IA, QA, accesibilidad, seguridad, privacidad, legal, operaciones y dirección.
- **Prioridad:** crítica.
- **Principio rector:** la IA debe reducir trabajo y aumentar capacidad de decisión sin eliminar el control, la comprensión ni la responsabilidad humana.
- **Estado esperado:** documento vivo, versionado y conectado con Human-in-the-Loop, seguridad, privacidad, gobernanza, observabilidad, evaluación y diseño de producto.

---

# 1. Propósito

Este documento define cómo diseñar e implementar **AI Product & Human Experience Engineering** en una plataforma SaaS con agentes de IA.

La arquitectura debe permitir:

- Seleccionar la superficie de IA correcta.
- Integrar IA dentro del flujo de trabajo.
- Evitar el patrón “chat para todo”.
- Mostrar estados reales de ejecución.
- Mostrar progreso real.
- Mostrar resultados parciales.
- Mostrar incertidumbre de forma accionable.
- Presentar fuentes y evidencias.
- Mostrar impacto antes de ejecutar acciones.
- Solicitar aprobaciones informadas.
- Permitir corregir resultados.
- Permitir rechazar sugerencias.
- Permitir detener workflows.
- Permitir reintentar.
- Permitir revertir cuando sea posible.
- Adaptar la interfaz al riesgo.
- Adaptar la interfaz al rol.
- Adaptar la densidad de información.
- Evitar dark patterns.
- Evitar confianza excesiva.
- Mantener trazabilidad.
- Garantizar accesibilidad.
- Medir comprensión y calidad de supervisión.

---

# 2. Regla obligatoria de análisis previo

Antes de crear componentes de IA, Codex debe analizar el producto real.

Debe identificar:

- Flujos de usuario.
- Roles.
- Entidades.
- Páginas.
- Formularios.
- Tablas.
- Dashboards.
- Documentos.
- Acciones.
- Workflows.
- Tools.
- Estados.
- Aprobaciones.
- Riesgos.
- Fuentes.
- Errores.
- Casos parciales.
- Permisos.
- Dispositivos.
- Accesibilidad.
- Carga cognitiva.
- Tiempo de tarea.
- Patrones UI existentes.
- Design system.
- Componentes reutilizables.
- Analytics.
- Soporte.
- Incidencias.

No debe asumir que la solución correcta es:

```text
añadir un chat flotante
```

---

# 3. Prohibiciones para Codex

Codex no debe:

- Crear una interfaz de chat como única superficie.
- Ocultar acciones dentro de mensajes.
- Ejecutar acciones críticas desde texto libre sin preview.
- Usar un botón genérico “Confirmar”.
- Mostrar progreso falso.
- Mostrar porcentajes inventados.
- Mostrar “pensando” sin estado real.
- Confundir output generado con dato confirmado.
- Guardar campos dudosos automáticamente.
- Ocultar fuentes.
- Ocultar limitaciones.
- Mostrar confianza numérica sin significado.
- Presentar recomendaciones como hechos.
- Presentar hipótesis como conclusiones.
- Mostrar éxito cuando existen fallos parciales.
- Convertir correcciones en memoria automáticamente.
- Diseñar aprobaciones manipulativas.
- Preseleccionar acciones críticas.
- Reducir visibilidad de “Cancelar”.
- Forzar al usuario a usar lenguaje natural para tareas estructuradas.
- Diseñar una UX distinta para cada agente sin sistema común.
- Inventar estados que no existen en backend.
- Exponer chain-of-thought privada.
- Mostrar datos de otro tenant.
- Ignorar accesibilidad.
- Marcar terminado sin pruebas con usuarios o evals de UX.

---

# 4. Entregables previos obligatorios

Antes de modificar código, Codex debe entregar:

1. Inventario de superficies actuales.
2. Inventario de flujos.
3. Inventario de roles.
4. Inventario de decisiones.
5. Inventario de acciones.
6. Inventario de approvals.
7. Inventario de workflows.
8. Inventario de estados.
9. Inventario de errores.
10. Inventario de resultados parciales.
11. Inventario de documentos.
12. Inventario de fuentes.
13. Inventario de correcciones.
14. Inventario de feedback.
15. Inventario de notificaciones.
16. Inventario de componentes.
17. Inventario de accesibilidad.
18. Matriz tarea-superficie.
19. Matriz riesgo-interfaz.
20. Matriz rol-información.
21. Matriz estado-mensaje.
22. Matriz error-recuperación.
23. Matriz acción-preview.
24. Matriz evidencia-presentación.
25. Arquitectura propuesta.
26. Contratos.
27. Componentes.
28. Persistencia.
29. Fases.
30. Tests.
31. Evals.
32. Métricas.
33. Alertas.
34. Decisiones abiertas.

---

# 5. Definición

**AI Product & Human Experience Engineering** diseña la relación entre:

```text
PERSONA
  ↓
OBJETIVO
  ↓
CONTEXTO
  ↓
SUPERFICIE
  ↓
AGENTE
  ↓
TOOLS Y DATOS
  ↓
RESULTADO
  ↓
CONTROL HUMANO
```

No consiste en:

```text
añadir IA a la interfaz
```

Consiste en traducir la complejidad técnica del sistema a:

- Objetivos.
- Decisiones.
- Evidencia.
- Riesgos.
- Acciones.
- Resultados.
- Recuperación.
- Control.

---

# 6. Diferencia con UX tradicional

La UX tradicional diseña interfaces para acciones deterministas.

La UX de IA debe gestionar además:

- Incertidumbre.
- Variabilidad.
- Resultados no idénticos.
- Inferencias.
- Fuentes.
- Autonomía.
- Aprobaciones.
- Correcciones.
- Riesgos.
- Automatizaciones.
- Reversibilidad.
- Evidencia.
- Versiones.
- Límites.

Ejemplo:

```text
Formulario tradicional:
usuario introduce un valor.

Formulario con IA:
el sistema propone un valor,
explica de dónde sale,
muestra confianza,
permite corregir
y no lo convierte en canónico
hasta confirmación.
```

---

# 7. Diferencia con Human-in-the-Loop

Human-in-the-Loop define:

- Cuándo interviene una persona.
- Qué decisión debe tomar.
- Qué autoridad tiene.
- Qué se bloquea.
- Cómo se reanuda.

AI Product & Human Experience Engineering define:

- Cómo se presenta esa decisión.
- Qué evidencia ve.
- Qué impacto comprende.
- Cómo confirma.
- Cómo rechaza.
- Cómo corrige.
- Cómo escala.
- Cómo se evita automatización complaciente.

---

# 8. Diferencia con Observability

Observability registra:

- Run.
- Tools.
- Latencia.
- Tokens.
- Estado.
- Errores.

AI Product UX decide qué parte debe ver el usuario.

Ejemplo:

```text
Observability:
tool_call_id=meta_81
latency=1382ms
status=success

UX:
Campaña pausada correctamente.
Verificado en Meta Ads hace 4 segundos.
```

La UI no debe mostrar ruido técnico salvo que ayude a decidir o diagnosticar.

---

# 9. El problema del chat para todo

Un chat es útil para:

- Preguntas abiertas.
- Exploración.
- Explicaciones.
- Búsqueda.
- Redacción.
- Navegación.

No es la mejor superficie para:

- Confirmar pagos.
- Revisar contratos.
- Corregir OCR.
- Comparar campañas.
- Editar muchos campos.
- Aprobar acciones masivas.
- Auditar workflows.
- Resolver incidencias.
- Gestionar tareas.
- Revisar tablas.

El sistema debe usar chat como una superficie más.

---

# 10. Principios rectores

1. **La IA debe estar dentro del flujo.**
2. **Cada tarea debe usar la superficie adecuada.**
3. **Toda acción debe ser visible.**
4. **Toda acción crítica debe ser comprensible.**
5. **El progreso debe ser real.**
6. **La incertidumbre debe ser accionable.**
7. **Las fuentes deben estar disponibles.**
8. **Los datos generados deben distinguirse de los confirmados.**
9. **La persona debe poder corregir.**
10. **La persona debe poder detener.**
11. **La persona debe poder rechazar.**
12. **La persona debe poder revertir cuando sea posible.**
13. **La interfaz debe adaptarse al riesgo.**
14. **La interfaz debe adaptarse al rol.**
15. **La accesibilidad es obligatoria.**
16. **No deben usarse dark patterns.**
17. **La confianza debe calibrarse.**
18. **La UX debe tener métricas y evals.**

---

# 11. Surface Registry

```ts
export type AISurfaceType =
  | "chat"
  | "inline_suggestion"
  | "smart_form"
  | "review_panel"
  | "action_preview"
  | "approval_dialog"
  | "document_assistant"
  | "dashboard_insight"
  | "notification"
  | "workflow_status"
  | "command_palette"
  | "background_automation"
  | "timeline_event"
  | "review_queue"
  | "comparison_view";

export type AISurfaceDefinition = {
  id: string;

  type: AISurfaceType;

  name: string;

  supportedTaskTypes: string[];

  supportedRiskLevels: string[];

  supportedRoles: string[];

  requiresEvidence: boolean;

  requiresPreview: boolean;

  requiresApproval: boolean;

  supportsCorrection: boolean;

  supportsCancellation: boolean;

  supportsUndo: boolean;

  ownerId: string;

  active: boolean;
};
```

---

# 12. Surface Selection Engine

```ts
export interface AISurfaceSelectionService {
  resolve(input: {
    taskType: string;
    role: string;
    riskLevel: string;
    interactionMode: string;
    resourceType?: string;
    device?: string;
  }): Promise<AISurfaceDefinition>;
}
```

Reglas orientativas:

```text
Pregunta abierta
→ chat.

Extracción documental
→ review panel.

Acción crítica
→ action preview + approval dialog.

Sugerencia simple
→ inline suggestion.

Flujo de muchos pasos
→ workflow status.

Comparación
→ comparison view.

Acción rápida contextual
→ command palette.
```

---

# 13. Chat

Debe incluir:

- Identidad del sistema.
- Tenant activo.
- Contexto activo.
- Fuentes.
- Estado.
- Límites.
- Acciones propuestas.
- Separación entre conversación y ejecución.
- Historial.
- Cancelación.
- Reintento.
- Escalado.

---

# 14. Chat Message Types

```ts
export type AIChatMessageType =
  | "user"
  | "assistant"
  | "system_status"
  | "tool_status"
  | "approval_request"
  | "error"
  | "warning"
  | "source"
  | "partial_result"
  | "final_result";
```

No representar una tool como texto de asistente sin estado explícito.

---

# 15. Inline Suggestion

```ts
export type AIInlineSuggestion = {
  id: string;

  resourceType: string;
  resourceId: string;

  suggestionType: string;

  title: string;
  summary: string;

  rationale: string;

  evidenceIds: string[];

  actionIds: string[];

  dismissible: boolean;

  expiresAt?: string;

  status:
    | "new"
    | "viewed"
    | "accepted"
    | "dismissed"
    | "expired";
};
```

---

# 16. Reglas para sugerencias

- Deben ser relevantes.
- Deben tener motivo.
- Deben caducar.
- Deben poder descartarse.
- No deben repetirse sin nueva evidencia.
- Deben respetar permisos.
- Deben registrar aceptación o rechazo.
- No deben presentarse como obligatorias.
- No deben ocultar consecuencias.

---

# 17. Smart Forms

La IA puede:

- Prellenar.
- Extraer.
- Normalizar.
- Detectar inconsistencias.
- Proponer.
- Validar.
- Explicar.

Debe distinguir:

```text
ORIGINAL
EXTRACTED
SUGGESTED
CONFIRMED
REJECTED
```

---

# 18. Smart Field State

```ts
export type SmartFieldStatus =
  | "empty"
  | "user_entered"
  | "ai_extracted"
  | "ai_suggested"
  | "confirmed"
  | "corrected"
  | "rejected"
  | "conflict"
  | "requires_review";

export type SmartFieldValue = {
  fieldPath: string;

  value: unknown;

  status: SmartFieldStatus;

  sourceIds: string[];

  confidence?: number;

  warning?: string;

  confirmedBy?: string;
  confirmedAt?: string;
};
```

---

# 19. Review Panels

Adecuados para:

- OCR.
- Contratos.
- Facturas.
- Reservas.
- Estudios.
- Acciones masivas.
- Clasificaciones.
- Importaciones.

Debe mostrar:

- Fuente.
- Página.
- Campo.
- Valor.
- Estado.
- Confianza.
- Diferencia.
- Acción.
- Historial.

---

# 20. Review Item Contract

```ts
export type AIReviewItem = {
  id: string;

  reviewType: string;

  sourceReference: string;

  fieldPath?: string;

  originalValue?: unknown;

  proposedValue?: unknown;

  confidence?: number;

  issueType?:
    | "missing"
    | "low_confidence"
    | "conflict"
    | "invalid"
    | "sensitive"
    | "unsupported";

  status:
    | "pending"
    | "approved"
    | "corrected"
    | "rejected";

  reviewerId?: string;
};
```

---

# 21. Comparison View

Adecuada para:

- Antes/después.
- Versión antigua/nueva.
- Campañas.
- Escenarios.
- Contratos.
- Datos extraídos.
- Presupuestos.
- Estudios fiscales.

Debe mostrar:

- Cambios.
- Impacto.
- Evidencia.
- Riesgo.
- Reversibilidad.
- Estado.

---

# 22. Action Preview

```ts
export type AIActionPreview = {
  actionId: string;

  actionType: string;

  resourceType: string;
  resourceId: string;

  currentState: unknown;
  proposedState: unknown;

  affectedFields: string[];

  expectedImpact: string[];

  evidenceIds: string[];

  reversible: boolean;

  reversalMethod?: string;

  riskLevel: string;

  requestedBy: string;

  proposedByAgentId?: string;

  expiresAt: string;
};
```

---

# 23. Preview content

Debe responder:

1. ¿Qué ocurrirá?
2. ¿Sobre qué recurso?
3. ¿Qué cambiará?
4. ¿Por qué?
5. ¿Qué impacto tendrá?
6. ¿Puede revertirse?
7. ¿Qué evidencia existe?
8. ¿Quién lo propone?
9. ¿Cuándo caduca?
10. ¿Qué ocurre si se rechaza?

---

# 24. Approval Dialog

No debe ser:

```text
¿Confirmar?
```

Debe incluir:

- Acción.
- Recurso.
- Estado actual.
- Estado propuesto.
- Impacto.
- Riesgo.
- Evidencia.
- Reversibilidad.
- Actor original.
- Agente.
- Caducidad.
- Confirmación explícita.

---

# 25. Approval View Model

```ts
export type ApprovalViewModel = {
  approvalId: string;

  title: string;

  actionSummary: string;

  resourceLabel: string;

  currentStateSummary: string;

  proposedStateSummary: string;

  impactSummary: string[];

  riskSummary: string[];

  evidence: PresentedEvidence[];

  reversible: boolean;

  expirationText: string;

  requiredConfirmation:
    | "single_click"
    | "typed_confirmation"
    | "step_up_auth"
    | "second_approver";
};
```

---

# 26. Approval anti-patterns

Evitar:

- Botón principal ambiguo.
- Acción irreversible preseleccionada.
- Ocultar “Cancelar”.
- Usar color para presionar.
- Mostrar impacto en letra pequeña.
- Cambiar el texto después.
- Combinar varias acciones.
- Aprobar un conjunto desconocido.
- Caducidad no visible.
- Aprobación después de ejecutar.
- Aprobación genérica reutilizable.

---

# 27. Risk-Based Interface Policy

```ts
export type AIRiskInterfacePolicy = {
  riskLevel:
    | "low"
    | "medium"
    | "high"
    | "critical";

  requiredSurfaces: AISurfaceType[];

  previewRequired: boolean;

  evidenceRequired: boolean;

  approvalRequired: boolean;

  stepUpRequired: boolean;

  secondApproverRequired: boolean;

  undoRequired: boolean;

  verificationRequired: boolean;

  chatExecutionAllowed: boolean;
};
```

---

# 28. Riesgo bajo

Ejemplos:

- Redactar un texto.
- Sugerir una tarea.
- Resumir información pública.

UX:

- Inline suggestion.
- One-click accept.
- Undo.
- No modal innecesario.

---

# 29. Riesgo medio

Ejemplos:

- Crear tarea.
- Cambiar una etiqueta.
- Guardar un borrador.

UX:

- Preview.
- Confirmación.
- Estado.
- Undo.
- Verification.

---

# 30. Riesgo alto

Ejemplos:

- Cambiar estado de reserva.
- Enviar comunicación.
- Pausar campaña.
- Exportar datos.

UX:

- Evidencia.
- Impacto.
- Approval explícita.
- Step-up según caso.
- Verification.
- Audit.

---

# 31. Riesgo crítico

Ejemplos:

- Pago.
- Reembolso.
- Cambio de permisos.
- Borrado.
- Operación masiva.
- Acción irreversible.

UX:

- Sin ejecución directa desde chat.
- Double approval.
- Typed confirmation.
- Step-up auth.
- Revisión separada.
- Audit.
- Verification.
- Kill switch.

---

# 32. User-Facing Run Status

```ts
export type AIUserFacingRunStatus =
  | "preparing"
  | "analysing"
  | "waiting_for_data"
  | "waiting_for_approval"
  | "executing"
  | "verifying"
  | "partially_completed"
  | "completed"
  | "failed"
  | "cancelled"
  | "compensating";
```

---

# 33. Internal-to-User Status Mapping

```ts
export type RunStatusPresentation = {
  internalStatus: string;

  userStatus: AIUserFacingRunStatus;

  title: string;

  description: string;

  actionable: boolean;

  actionIds: string[];

  severity:
    | "info"
    | "success"
    | "warning"
    | "error";
};
```

---

# 34. Progreso real

No mostrar porcentajes sin base.

Preferir:

```text
2 de 4 pasos completados.
```

o:

```text
Métricas recuperadas.
Pendiente de aprobación.
```

---

# 35. Workflow Step Presentation

```ts
export type WorkflowStepPresentation = {
  stepId: string;

  label: string;

  status:
    | "pending"
    | "running"
    | "completed"
    | "blocked"
    | "failed"
    | "skipped"
    | "cancelled";

  startedAt?: string;
  completedAt?: string;

  summary?: string;

  actionIds?: string[];
};
```

---

# 36. Background automation

Las automatizaciones de fondo deben tener:

- Nombre.
- Finalidad.
- Trigger.
- Estado.
- Última ejecución.
- Próxima ejecución.
- Resultados.
- Incidencias.
- Pausa.
- Desactivación.
- Historial.

No deben operar de forma invisible.

---

# 37. Background Automation Card

```ts
export type BackgroundAutomationView = {
  automationId: string;

  name: string;

  purpose: string;

  triggerDescription: string;

  status:
    | "active"
    | "paused"
    | "error"
    | "disabled";

  lastRunAt?: string;

  lastResult?: string;

  nextRunAt?: string;

  pendingApprovalCount: number;

  errorCount: number;
};
```

---

# 38. Partial Results

```ts
export type PartialResultSummary = {
  totalItems: number;

  completedItems: number;

  reviewRequiredItems: number;

  failedItems: number;

  skippedItems: number;

  canContinue: boolean;

  nextActions: string[];
};
```

No mostrar éxito completo si hay errores.

---

# 39. Partial success message

Ejemplo:

```text
Se procesaron 24 documentos.

21 completados.
2 requieren revisión.
1 no pudo abrirse.
```

---

# 40. Uncertainty Taxonomy

```ts
export type AIUncertaintyType =
  | "missing_data"
  | "conflicting_sources"
  | "low_extraction_confidence"
  | "estimated_result"
  | "model_uncertainty"
  | "out_of_scope"
  | "stale_data"
  | "unsupported_claim"
  | "ambiguous_request";
```

---

# 41. Uncertainty Presentation

```ts
export type UncertaintyPresentation = {
  type: AIUncertaintyType;

  title: string;

  explanation: string;

  affectedFields: string[];

  recommendedAction: string;

  blocking: boolean;

  evidenceIds: string[];
};
```

---

# 42. Reglas de incertidumbre

No mostrar solo:

```text
72 % confianza.
```

Mostrar:

- Qué no está claro.
- Por qué.
- Qué parte afecta.
- Qué debe revisar el usuario.
- Si bloquea.
- Qué fuente falta.
- Qué ocurrirá si continúa.

---

# 43. Trust Calibration

Objetivo:

```text
confianza proporcional a la evidencia
```

No:

```text
máxima confianza del usuario
```

La UX debe evitar:

- Tono absoluto.
- Humanización excesiva.
- Avatar engañoso.
- Falsa precisión.
- Confianza sin contexto.
- Fuentes ocultas.
- Automatización silenciosa.
- Resultados desactualizados.
- Lenguaje de certeza para hipótesis.

---

# 44. Epistemic Labels

```ts
export type EpistemicStatus =
  | "confirmed_fact"
  | "source_based_fact"
  | "inference"
  | "hypothesis"
  | "recommendation"
  | "estimate"
  | "unknown";
```

La UI debe etiquetar resultados.

---

# 45. Evidencia

```ts
export type PresentedEvidence = {
  id: string;

  sourceType: string;

  title: string;

  sourceReference: string;

  page?: number;

  section?: string;

  date?: string;

  freshnessText?: string;

  authorityLabel?: string;

  excerpt?: string;

  limitations?: string[];
};
```

---

# 46. Evidence Presentation Levels

## Nivel 1

- Resultado.
- Acción.
- Warning.

## Nivel 2

- Motivo.
- Evidencia.
- Limitaciones.

## Nivel 3

- Fuente.
- Página.
- Versión.
- Cálculo.
- Trace reference.

---

# 47. Progressive Disclosure

```ts
export type InformationDensityLevel =
  | "summary"
  | "standard"
  | "expert"
  | "audit";
```

Cada rol puede tener un nivel por defecto.

---

# 48. Role-Based Experience

```ts
export type RoleExperiencePolicy = {
  roleId: string;

  defaultDensity: InformationDensityLevel;

  allowedSurfaces: AISurfaceType[];

  visibleEvidenceLevel: InformationDensityLevel;

  allowedActions: string[];

  requiredWarnings: string[];

  approvalPresentationLevel: string;
};
```

---

# 49. Dirección

Debe ver:

- Resultado.
- Tendencia.
- Riesgo.
- Decisión pendiente.
- Impacto.
- Evidencia resumida.

No necesita ruido técnico por defecto.

---

# 50. Comercial

Debe ver:

- Próxima acción.
- Cliente.
- Follow-up.
- Documentos.
- Bloqueos.
- Borradores.

---

# 51. Administración

Debe ver:

- Pagos.
- Documentos.
- Incidencias.
- Validaciones.
- Estados.
- Tareas.

---

# 52. Legal

Debe ver:

- Fuente.
- Cláusula.
- Página.
- Diferencia.
- Hecho.
- Inferencia.
- Riesgo.
- Historial.

---

# 53. Cliente

Debe ver:

- Estado.
- Próximo paso.
- Qué falta.
- Explicación clara.
- Acciones permitidas.
- Contacto humano.
- Límites.

---

# 54. Human Corrections

```ts
export type HumanCorrection = {
  id: string;

  aiSystemId: string;

  outputId: string;

  fieldPath?: string;

  originalValue: unknown;

  correctedValue: unknown;

  correctionReason?: string;

  correctedBy: string;

  correctedAt: string;

  promotionStatus:
    | "local_only"
    | "eval_candidate"
    | "knowledge_candidate"
    | "memory_candidate";
};
```

---

# 55. Correction Workflow

```text
CORRECT
  ↓
VALIDATE
  ↓
APPLY LOCALLY
  ↓
RECALCULATE DEPENDENCIES
  ↓
SHOW IMPACT
  ↓
OPTIONALLY PROMOTE
```

No promover automáticamente.

---

# 56. Correction Scope

Una corrección puede ser:

- Local al campo.
- Local al documento.
- Local al caso.
- Local al tenant.
- Candidata a regla global.

Cada scope requiere revisión diferente.

---

# 57. Feedback Taxonomy

```ts
export type AIFeedbackType =
  | "incorrect"
  | "incomplete"
  | "wrong_source"
  | "stale_data"
  | "inappropriate_action"
  | "unclear_explanation"
  | "too_long"
  | "too_short"
  | "permission_issue"
  | "helpful"
  | "other";
```

---

# 58. Feedback Record

```ts
export type AIFeedbackRecord = {
  id: string;

  aiSystemId: string;

  outputId?: string;

  actionId?: string;

  feedbackType: AIFeedbackType;

  comment?: string;

  actorId: string;

  tenantId: string;

  createdAt: string;

  triageStatus:
    | "new"
    | "reviewed"
    | "eval_candidate"
    | "product_issue"
    | "resolved";
};
```

---

# 59. Contestability

Debe permitir:

- Preguntar “por qué”.
- Solicitar revisión.
- Rechazar.
- Corregir.
- Escalar.
- Detener.
- Revertir.
- Reportar.
- Comparar.
- Ver fuente.

---

# 60. Contest Action

```ts
export type AIContestAction =
  | "request_explanation"
  | "request_human_review"
  | "reject_output"
  | "correct_output"
  | "stop_action"
  | "reverse_action"
  | "report_issue";
```

---

# 61. Cancellation

La UI debe distinguir:

- Cancelar antes de ejecutar.
- Cancelar paso actual.
- Detener después del paso.
- Cancelar pendiente.
- Compensar efectos.
- No reversible.

---

# 62. Cancellation View

```ts
export type CancellationViewModel = {
  runId: string;

  canCancel: boolean;

  cancellationMode:
    | "immediate"
    | "after_current_step"
    | "compensating"
    | "not_available";

  completedEffects: string[];

  pendingEffects: string[];

  irreversibleEffects: string[];

  confirmationRequired: boolean;
};
```

---

# 63. Error Taxonomy

```ts
export type UserFacingAIErrorType =
  | "input_error"
  | "permission_error"
  | "data_unavailable"
  | "provider_error"
  | "tool_error"
  | "validation_error"
  | "partial_failure"
  | "timeout"
  | "cancelled"
  | "unknown";
```

---

# 64. Error Presentation

```ts
export type AIErrorPresentation = {
  errorType: UserFacingAIErrorType;

  title: string;

  whatFailed: string;

  whatCompleted: string[];

  whatDidNotRun: string[];

  retryAvailable: boolean;

  retryActionId?: string;

  supportReference?: string;

  technicalReference?: string;

  userActionRequired?: string;
};
```

---

# 65. Retry UX

Debe explicar:

- Qué se reintentará.
- Qué no se repetirá.
- Si existe riesgo de duplicación.
- Si se usará idempotencia.
- Si requiere nueva aprobación.
- Si hay coste.
- Si los datos siguen vigentes.

---

# 66. Undo and Reversal

```ts
export type AIUndoCapability = {
  actionType: string;

  undoSupported: boolean;

  undoWindowMs?: number;

  compensationActionId?: string;

  verificationRequired: boolean;

  userMessage: string;
};
```

No mostrar “Deshacer” si solo crea una acción compensatoria sin explicar.

---

# 67. Accessibility

Toda superficie debe cumplir:

- Navegación por teclado.
- Lectores de pantalla.
- Focus visible.
- Labels.
- Estados anunciados.
- No depender solo de color.
- Contraste.
- Tamaño de target.
- Reducción de movimiento.
- Lenguaje claro.
- Timeouts controlables.
- Tablas accesibles.
- Dialogs accesibles.

---

# 68. Accessible AI Status

```ts
export type AccessibleAIStatus = {
  visibleText: string;

  ariaLiveText: string;

  politeness:
    | "polite"
    | "assertive";

  focusTargetId?: string;

  keyboardActionIds: string[];
};
```

---

# 69. Announcing Progress

No anunciar cada token.

Anunciar:

- Inicio.
- Cambio de estado.
- Approval requerida.
- Error.
- Completion.
- Partial completion.
- Cancellation.

---

# 70. Mobile UX

En móvil:

- Evitar modales enormes.
- Evitar tablas ilegibles.
- Usar drawers.
- Usar steps.
- Priorizar resumen.
- Mantener acceso a evidencia.
- Evitar approval accidental.
- Mantener CTA separados.
- Usar confirmación reforzada para riesgo alto.

---

# 71. Localization

La experiencia debe soportar:

- Idioma.
- Fechas.
- Horas.
- Moneda.
- Números.
- Terminología jurídica.
- Terminología del producto.
- Texto de transparencia.
- Mensajes de error.

No traducir automáticamente nombres legales sin control.

---

# 72. Notifications

Una notificación de IA debe indicar:

- Qué ocurrió.
- Qué sistema.
- Qué recurso.
- Qué acción necesita.
- Urgencia.
- Caducidad.
- Evidencia.
- Link directo.

No enviar:

```text
La IA tiene una actualización.
```

---

# 73. Notification Contract

```ts
export type AINotificationView = {
  id: string;

  title: string;

  summary: string;

  aiSystemId: string;

  resourceType?: string;
  resourceId?: string;

  priority:
    | "low"
    | "normal"
    | "high"
    | "urgent";

  actionRequired: boolean;

  actionLabel?: string;

  actionUrl?: string;

  expiresAt?: string;
};
```

---

# 74. Review Queue

Debe permitir:

- Priorizar por riesgo.
- Filtrar por tipo.
- Filtrar por tenant.
- Ver caducidad.
- Ver impacto.
- Asignar revisor.
- Completar en lote solo cuando sea seguro.
- Escalar.
- Auditar.

---

# 75. Review Queue Item

```ts
export type AIReviewQueueItem = {
  id: string;

  reviewType: string;

  riskLevel: string;

  title: string;

  resourceLabel: string;

  assignedTo?: string;

  dueAt?: string;

  evidenceCount: number;

  status:
    | "pending"
    | "in_review"
    | "approved"
    | "rejected"
    | "expired";
};
```

---

# 76. Command Palette

Adecuada para:

- Navegar.
- Buscar.
- Crear tareas.
- Abrir recursos.
- Acciones de bajo riesgo.

No para:

- Pagos.
- Reembolsos.
- Borrado.
- Cambios administrativos.
- Acciones financieras críticas.

---

# 77. Dashboard Insights

Debe mostrar:

```text
DATO
→ INTERPRETACIÓN
→ RIESGO
→ RECOMENDACIÓN
→ ACCIÓN
```

No mostrar cards genéricas como:

```text
La IA ha detectado oportunidades.
```

---

# 78. Dashboard Insight Contract

```ts
export type DashboardAIInsight = {
  id: string;

  title: string;

  metricSummary: string;

  interpretation: string;

  evidenceIds: string[];

  confidenceOrLimitation?: string;

  recommendation?: string;

  actionIds: string[];

  freshnessText: string;

  status:
    | "new"
    | "acknowledged"
    | "acted"
    | "dismissed"
    | "expired";
};
```

---

# 79. NORA: estudio fiscal

Debe separar visualmente:

- Inputs.
- Cálculo.
- Beneficios.
- Totales.
- Fuentes.
- Explicación.
- Advertencias.
- Escenarios.

Regla:

```text
AI explanation
≠
canonical calculation
```

---

# 80. NORA: Playbook

Debe mostrar:

- Libro.
- Capítulo.
- Recurso.
- Fuente.
- Página.
- Vigencia.
- Autoridad.
- Respuesta.
- Limitación.

---

# 81. NORA: CRM Copilot

Superficies:

- Cliente.
- Lead.
- Oportunidad.
- Reserva.
- Documento.
- Tarea.
- Dashboard.
- Global chat.
- Command palette.
- Review queue.
- Approval inbox.

---

# 82. NORA: Legal Assistant

Debe diferenciar:

```text
HECHO
FUENTE
INTERPRETACIÓN
RIESGO
RECOMENDACIÓN
DECISIÓN HUMANA
```

No presentar la recomendación como decisión definitiva.

---

# 83. NORA: OCR

Review panel:

```text
DOCUMENTO
  |
  ├── campo
  ├── valor
  ├── confianza
  ├── fuente
  ├── corrección
  └── confirmación
```

---

# 84. EcomScaling IA

Debe diferenciar:

```text
DATO
INSIGHT
HIPÓTESIS
RECOMENDACIÓN
ACCIÓN
RESULTADO
```

Ejemplo:

```text
Dato:
ROAS 1,42.

Insight:
Caída del 21 %.

Hipótesis:
Frecuencia alta y CTR bajo.

Recomendación:
Reducir presupuesto un 15 %.

Acción:
Pendiente.

Resultado:
No ejecutado.
```

---

# 85. EcomScaling: action preview

Debe mostrar:

- Campaña.
- Presupuesto.
- Estado.
- Periodo.
- Métricas.
- Cambio.
- Impacto.
- Reversibilidad.
- Approval.

---

# 86. EcomScaling: Monitor

Debe evitar alert fatigue.

Controles UX:

- Agrupar.
- Priorizar.
- Caducar.
- Silenciar.
- Explicar.
- Mostrar tendencia.
- No repetir.
- Permitir threshold.

---

# 87. CRM

El copiloto debe operar mediante:

- Context panel.
- Smart form.
- Timeline.
- Review queue.
- Approval inbox.
- Command palette.
- Global chat.
- Inline actions.

---

# 88. CRM Example Flow

```text
Usuario abre reserva
  ↓
Sistema detecta documentos pendientes
  ↓
Muestra checklist
  ↓
Prepara solicitud
  ↓
Usuario revisa
  ↓
Envía
  ↓
Sistema verifica
  ↓
Timeline actualizada
```

---

# 89. Arquitectura técnica propuesta

```text
src/
  ai/
    experience/
      experience.types.ts
      experience.config.ts

      surfaces/
        ai-surface.registry.ts
        surface-policy.service.ts
        surface-selection.service.ts
        contextual-surface.service.ts

      chat/
        chat-message.presenter.ts
        chat-action.service.ts
        chat-context.presenter.ts

      forms/
        smart-field.types.ts
        smart-form.service.ts
        field-provenance.presenter.ts

      reviews/
        review-panel.service.ts
        review-queue.service.ts
        comparison-view.service.ts

      actions/
        action-preview.service.ts
        action-impact.service.ts
        approval-view-model.service.ts
        undo-capability.service.ts

      runs/
        run-status.presenter.ts
        progress.presenter.ts
        partial-result.presenter.ts
        background-automation.presenter.ts

      evidence/
        evidence-presenter.ts
        citation-presenter.ts
        freshness-presenter.ts
        progressive-disclosure.service.ts

      uncertainty/
        uncertainty-presenter.ts
        epistemic-status.service.ts
        confidence-policy.ts
        limitation-presenter.ts

      corrections/
        human-correction.service.ts
        correction-scope.service.ts
        correction-promotion.service.ts

      feedback/
        feedback.service.ts
        issue-taxonomy.ts
        feedback-triage.service.ts

      roles/
        role-experience.policy.ts
        density-policy.ts

      notifications/
        ai-notification.presenter.ts

      transparency/
        ai-disclosure.component.ts
        generated-content-label.ts

      accessibility/
        accessible-ai-status.ts
        keyboard-actions.ts
        screen-reader-events.ts

      recovery/
        error-presenter.ts
        retry-presenter.ts
        cancellation-presenter.ts

      localization/
        ai-locale.service.ts

      evaluation/
        ux-eval.service.ts
        trust-calibration-eval.ts
        oversight-usability-eval.ts
        accessibility-eval.ts

      observability/
        experience.metrics.ts
        experience.tracing.ts

      tests/
      evals/

      adapters/
        nora/
        ecommerce/
        crm/
```

Adaptar al repositorio real.

---

# 90. Persistencia orientativa

Posibles tablas:

```text
ai_experience_surfaces
ai_experience_surface_policies
ai_experience_suggestions
ai_experience_review_items
ai_experience_action_previews
ai_experience_approval_views
ai_experience_user_corrections
ai_experience_feedback
ai_experience_user_preferences
ai_experience_notifications
ai_experience_dismissals
ai_experience_ux_eval_cases
ai_experience_ux_eval_results
```

No crear sin revisar el esquema real.

---

# 91. Surface Table orientativa

```sql
CREATE TABLE ai_experience_surfaces (
  id uuid PRIMARY KEY,

  surface_key text NOT NULL,

  type text NOT NULL,

  name text NOT NULL,

  supported_task_types jsonb NOT NULL,

  supported_risk_levels jsonb NOT NULL,

  supported_roles jsonb NOT NULL,

  requires_evidence boolean NOT NULL,

  requires_preview boolean NOT NULL,

  requires_approval boolean NOT NULL,

  supports_correction boolean NOT NULL,

  supports_cancellation boolean NOT NULL,

  supports_undo boolean NOT NULL,

  active boolean NOT NULL DEFAULT true,

  UNIQUE (surface_key)
);
```

---

# 92. Suggestion Table orientativa

```sql
CREATE TABLE ai_experience_suggestions (
  id uuid PRIMARY KEY,

  tenant_id uuid NOT NULL,

  ai_system_id text NOT NULL,

  resource_type text NOT NULL,
  resource_id uuid NOT NULL,

  suggestion_type text NOT NULL,

  title text NOT NULL,

  summary text NOT NULL,

  rationale text NOT NULL,

  evidence_ids jsonb NOT NULL,

  action_ids jsonb NOT NULL,

  status text NOT NULL,

  expires_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

# 93. Correction Table orientativa

```sql
CREATE TABLE ai_experience_user_corrections (
  id uuid PRIMARY KEY,

  tenant_id uuid NOT NULL,

  ai_system_id text NOT NULL,

  output_id text NOT NULL,

  field_path text,

  original_value jsonb,

  corrected_value jsonb,

  correction_reason text,

  corrected_by uuid NOT NULL,

  corrected_at timestamptz NOT NULL DEFAULT now(),

  promotion_status text NOT NULL
);
```

---

# 94. Feedback Table orientativa

```sql
CREATE TABLE ai_experience_feedback (
  id uuid PRIMARY KEY,

  tenant_id uuid NOT NULL,

  ai_system_id text NOT NULL,

  output_id text,

  action_id text,

  feedback_type text NOT NULL,

  comment text,

  actor_id uuid NOT NULL,

  triage_status text NOT NULL DEFAULT 'new',

  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

# 95. User Preferences

Preferencias posibles:

- Density.
- Auto-expand sources.
- Notification level.
- Language.
- Reduced motion.
- Preferred surface.
- Review mode.
- Accessibility.

No permitir preferencias que desactiven controles obligatorios.

---

# 96. Metrics

```text
ai_suggestion_acceptance_rate
ai_suggestion_rejection_rate
ai_suggestion_dismissal_rate
ai_correction_rate
ai_action_cancel_rate
ai_action_undo_rate
ai_approval_time_ms
ai_review_duration_ms
ai_source_open_rate
ai_explanation_expand_rate
ai_error_recovery_rate
ai_user_override_rate
ai_feedback_rate
ai_repeat_question_rate
ai_partial_completion_rate
ai_accessibility_issue_rate
```

---

# 97. Interpretación de métricas

No optimizar solo aceptación.

Alta aceptación puede indicar:

- Buenas recomendaciones.
- Confianza excesiva.
- Aprobación mecánica.
- UI manipulativa.
- Falta de tiempo.
- Falta de alternativa.

Se necesitan métricas combinadas.

---

# 98. Trust Calibration Metrics

```text
correct_acceptance_rate
correct_rejection_rate
incorrect_acceptance_rate
incorrect_rejection_rate
source_verification_rate
override_quality_rate
human_review_effectiveness
```

---

# 99. UX Evals

Evaluar:

- Comprensión.
- Tarea completada.
- Tiempo.
- Errores.
- Detección de limitaciones.
- Detección de incertidumbre.
- Capacidad para corregir.
- Capacidad para cancelar.
- Capacidad para identificar impacto.
- Calidad de aprobación.
- Accesibilidad.
- Trust calibration.

---

# 100. UX Eval Case

```ts
export type AIUXEvalCase = {
  id: string;

  role: string;

  taskType: string;

  riskLevel: string;

  surfaceType: AISurfaceType;

  scenario: string;

  expectedUserUnderstanding: string[];

  expectedActions: string[];

  prohibitedMisunderstandings: string[];

  maximumCompletionTimeMs?: number;
};
```

---

# 101. Approval UX Eval

Debe comprobar:

- El usuario identifica la acción.
- Identifica el recurso.
- Identifica el impacto.
- Identifica reversibilidad.
- Identifica riesgo.
- No confirma por error.
- Puede rechazar.
- Puede abrir evidencia.
- Comprende caducidad.

---

# 102. Trust Calibration Eval

Escenarios:

- Recomendación correcta.
- Recomendación incorrecta.
- Evidencia contradictoria.
- Dato obsoleto.
- Baja confianza.
- Fuente ausente.
- Fuente oficial.
- Acción irreversible.

Medir si el usuario confía de forma adecuada.

---

# 103. Accessibility Eval

- Keyboard.
- Screen reader.
- Focus.
- Live region.
- Contrast.
- Zoom.
- Reduced motion.
- Touch targets.
- Errors.
- Forms.
- Dialogs.
- Tables.
- Progress.

---

# 104. Unit Tests

- Surface selection.
- Risk interface policy.
- Status mapping.
- Progress mapping.
- Evidence levels.
- Uncertainty mapping.
- Role density.
- Approval view.
- Correction scope.
- Error presentation.
- Cancellation mode.
- Undo.
- Localization.

---

# 105. Integration Tests

- Chat to action preview.
- Review panel to correction.
- Approval to execution.
- Execution to verification.
- Partial results.
- Cancellation.
- Retry.
- Source opening.
- Notification to resource.
- Accessibility states.
- Role-specific view.
- Tenant isolation.

---

# 106. End-to-End Tests

- NORA fiscal study.
- NORA OCR review.
- NORA CRM suggestion.
- Ecom recommendation.
- Ecom campaign approval.
- CRM document request.
- CRM reservation status change.
- Error and retry.
- Partial completion.
- Human correction.
- Escalation.

---

# 107. Quality Gates

Bloquear release si:

- No existe surface policy.
- Acción de riesgo sin preview.
- Approval genérica.
- Progreso falso.
- Estados no sincronizados.
- Fuentes inaccesibles.
- Incertidumbre no presentada.
- Error sin recuperación.
- Corrección no soportada cuando procede.
- Cancelación no visible.
- Accesibilidad falla.
- Datos generados se muestran como confirmados.
- Tenant context no visible cuando es relevante.
- Métricas no instrumentadas.
- UX eval crítica falla.

---

# 108. Fase 0 — Análisis

Analizar:

- Flujos.
- Roles.
- Riesgos.
- Superficies.
- Estados.
- Errores.
- Approval.
- Evidence.
- Correcciones.
- Accesibilidad.
- Metrics.

Entregables:

- Inventarios.
- Matrices.
- User journeys.
- Surface map.
- State map.
- Error map.
- Arquitectura.
- Componentes.
- Tests.
- Evals.

No implementar todavía.

---

# 109. Fase 1 — Experience Contracts

Implementar:

- AISurfaceType.
- AIUserFacingRunStatus.
- AIActionPreview.
- ApprovalViewModel.
- PresentedEvidence.
- UncertaintyPresentation.
- HumanCorrection.

---

# 110. Fase 2 — Surface Registry

Implementar:

- Registry.
- Selection.
- Risk policies.
- Role policies.
- Tests.

---

# 111. Fase 3 — Run Status

Implementar:

- State mapping.
- Progress.
- Partial results.
- Background automation.
- Accessibility announcements.

---

# 112. Fase 4 — Evidence and Uncertainty

Implementar:

- Evidence presenter.
- Freshness.
- Limitations.
- Epistemic labels.
- Progressive disclosure.

---

# 113. Fase 5 — Action Preview

Implementar:

- Current/proposed state.
- Impact.
- Risk.
- Reversibility.
- Approval UI.

---

# 114. Fase 6 — Review Panels

Implementar:

- OCR review.
- Document review.
- Smart fields.
- Corrections.
- History.

---

# 115. Fase 7 — Error and Recovery

Implementar:

- Error taxonomy.
- Retry.
- Cancellation.
- Undo.
- Partial failure.

---

# 116. Fase 8 — Feedback

Implementar:

- Feedback taxonomy.
- Triage.
- Eval candidate.
- Product issue.

---

# 117. Fase 9 — Accessibility

Implementar:

- Keyboard.
- Screen readers.
- Focus.
- Live regions.
- Reduced motion.
- Tests.

---

# 118. Fase 10 — Role Adaptation

Implementar:

- Density.
- Role views.
- Permissions.
- Expert/audit view.

---

# 119. Fase 11 — Metrics and Evals

Implementar:

- UX metrics.
- Trust calibration.
- Approval evals.
- Accessibility evals.
- Regression gates.

---

# 120. Fase 12 — Product Adapters

Implementar:

- NORA.
- EcomScaling.
- CRM.

Reutilizar núcleo.

---

# 121. Direct instructions for Codex

## Mission

Design and integrate an AI Product & Human Experience Engineering architecture adapted to the actual SaaS.

## Mandatory rule

Before implementation, analyze:

- User flows.
- Roles.
- Resources.
- Actions.
- Risks.
- Workflows.
- Approvals.
- Errors.
- Evidence.
- Corrections.
- Accessibility.
- Design system.
- Metrics.

## Restrictions

1. Do not implement before analysis.
2. Do not use chat for everything.
3. Do not execute high-risk actions without preview.
4. Do not use generic approval dialogs.
5. Do not invent progress.
6. Do not hide partial failures.
7. Do not show AI output as confirmed data.
8. Do not hide uncertainty.
9. Do not hide sources.
10. Do not promote corrections automatically.
11. Do not use dark patterns.
12. Do not ignore accessibility.
13. Do not create fake confidence.
14. Do not mark complete without UX evals.
15. Adapt to the actual design system.

---

# 122. First recommended Codex task

```text
Analyze the repository and product exhaustively to design an
AI Product & Human Experience Engineering architecture.

Do not implement new UI components yet.

Objectives:

1. Identify user roles.
2. Identify user journeys.
3. Identify current AI surfaces.
4. Identify chats.
5. Identify inline suggestions.
6. Identify forms.
7. Identify review panels.
8. Identify dashboards.
9. Identify notifications.
10. Identify workflows.
11. Identify run statuses.
12. Identify approvals.
13. Identify action previews.
14. Identify evidence sources.
15. Identify uncertainty states.
16. Identify partial results.
17. Identify errors.
18. Identify retries.
19. Identify cancellation.
20. Identify undo.
21. Identify corrections.
22. Identify feedback.
23. Identify accessibility.
24. Identify design-system components.
25. Identify analytics.
26. Create task-surface matrix.
27. Create risk-interface matrix.
28. Create role-information matrix.
29. Create status-message matrix.
30. Create error-recovery matrix.
31. Propose Surface Registry.
32. Propose Surface Selection.
33. Propose Action Preview.
34. Propose Approval UX.
35. Propose Run Status presentation.
36. Propose Evidence UX.
37. Propose Uncertainty UX.
38. Propose Corrections.
39. Propose Feedback.
40. Propose Accessibility.
41. Propose architecture.
42. Propose persistence.
43. Propose files.
44. Propose phases.
45. Propose tests.
46. Propose evals.
47. Propose metrics.

Before modifying code, deliver:

a) diagnosis,
b) surface inventory,
c) user journey map,
d) task-surface matrix,
e) risk-interface matrix,
f) role-information matrix,
g) state map,
h) error-recovery matrix,
i) architecture,
j) exact components,
k) exact files.

Restrictions:

- Do not implement yet.
- Do not create a generic AI chat.
- Do not invent states.
- Do not rewrite the whole design system.
- Do not mark complete without validation.
```

---

# 123. Subsequent implementation prompt

```text
Use the approved analysis to implement the first phase of
AI Product & Human Experience Engineering.

Implement only:

1. Common types.
2. Surface Registry.
3. Risk Interface Policy.
4. Run Status Presenter.
5. Evidence Presenter.
6. Uncertainty Presenter.
7. Action Preview for one medium-risk action.
8. Approval View Model.
9. Accessibility announcements.
10. Unit and integration tests.

Do not implement yet:

- Global redesign.
- All product adapters.
- Critical financial approvals.
- Full review queue.
- Full analytics.
- Autonomous background UX.

Reuse the current design system.
Document every deviation.
```

---

# 124. ADR recommended

- ADR: AI surface registry.
- ADR: chat boundaries.
- ADR: contextual AI.
- ADR: risk-based interfaces.
- ADR: action preview.
- ADR: approval UX.
- ADR: run states.
- ADR: progress.
- ADR: partial results.
- ADR: uncertainty.
- ADR: evidence UX.
- ADR: epistemic labels.
- ADR: human corrections.
- ADR: feedback.
- ADR: cancellation.
- ADR: undo.
- ADR: accessibility.
- ADR: role-adaptive density.
- ADR: background automation UX.
- ADR: UX evals.
- ADR: trust calibration.

---

# 125. Acceptance criteria

- [ ] Surface Registry exists.
- [ ] Tasks map to surfaces.
- [ ] Risk maps to interface policy.
- [ ] Chat is not the only surface.
- [ ] Run statuses are real.
- [ ] Progress is real.
- [ ] Partial results are visible.
- [ ] Evidence is accessible.
- [ ] Uncertainty is actionable.
- [ ] AI-generated data is labeled.
- [ ] Action previews exist.
- [ ] Approvals are informed.
- [ ] Corrections are supported.
- [ ] Cancellation is supported.
- [ ] Undo or compensation is explained.
- [ ] Errors explain what happened.
- [ ] Role adaptation exists.
- [ ] Accessibility tests pass.
- [ ] Metrics exist.
- [ ] UX evals exist.
- [ ] Product adapters are validated.

---

# 126. Definition of Done

An AI experience is finished when:

1. It has a defined task.
2. It has a selected surface.
3. It has a risk policy.
4. It has visible states.
5. It has real progress.
6. It has evidence.
7. It has uncertainty handling.
8. It distinguishes fact and inference.
9. It supports correction.
10. It supports rejection.
11. It supports cancellation.
12. It supports recovery.
13. It presents impact.
14. It presents reversibility.
15. It has accessible interaction.
16. It adapts to role.
17. It has metrics.
18. It has UX evals.
19. It passes trust calibration.
20. It is validated in the real product.

---

# 127. Executive summary

Correct sequence:

```text
UNDERSTAND TASK
  ↓
SELECT SURFACE
  ↓
SHOW CONTEXT
  ↓
SHOW EVIDENCE
  ↓
SHOW UNCERTAINTY
  ↓
PREVIEW ACTION
  ↓
REQUEST INFORMED APPROVAL
  ↓
EXECUTE
  ↓
VERIFY
  ↓
SHOW RESULT
  ↓
ALLOW CORRECTION OR RECOVERY
```

The common platform must provide:

- Surface Registry.
- Surface Selection.
- Smart Forms.
- Review Panels.
- Action Previews.
- Approval UX.
- Run Status.
- Progress.
- Partial Results.
- Evidence UX.
- Uncertainty UX.
- Corrections.
- Feedback.
- Cancellation.
- Undo.
- Error Recovery.
- Role Adaptation.
- Accessibility.
- Metrics.
- UX Evals.

Each product must provide:

- Product-specific journeys.
- Product-specific actions.
- Product-specific evidence.
- Product-specific risks.
- Product-specific role views.
- Product-specific evals.

AI Product & Human Experience Engineering is not:

```text
a chat added to a SaaS
```

It is:

```text
a human control layer
that translates agents, tools,
risk and evidence into
understandable decisions and actions
```
