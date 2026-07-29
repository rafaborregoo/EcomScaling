# Memory Architecture para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica transversal
- **Ámbito:** SaaS, CRM, plataformas analíticas, copilotos, agentes operativos y sistemas multi-tenant
- **Casos de referencia:** EcomScaling IA y CRM/SaaS
- **Objetivo:** diseñar una arquitectura de memoria reutilizable, segura, verificable y adaptable a distintos productos
- **Audiencia:** Codex, equipo técnico, arquitectura, producto, seguridad, datos y responsables de IA
- **Prioridad:** crítica
- **Idioma:** castellano
- **Principio rector:** antes de crear, modificar o adaptar cualquier memoria, debe analizarse exhaustivamente el producto real, sus fuentes, sus procesos, sus riesgos y sus reglas de negocio

---

# 1. Propósito

Este documento define cómo implementar **Memory Architecture** en una plataforma SaaS con agentes de IA.

La solución debe ser reutilizable entre productos distintos, entre ellos:

- SaaS de analítica y escalado de tiendas.
- CRM/SaaS operativo.
- Plataformas documentales.
- Copilotos internos.
- Agentes especializados.
- Sistemas multiempresa.
- Plataformas con RAG, tools y automatizaciones.

La arquitectura común no debe quedar acoplada a entidades concretas.

Los conceptos específicos del dominio deben implementarse mediante adaptadores.

Ejemplos:

## EcomScaling IA

- Tiendas.
- Campañas.
- Productos.
- Creatividades.
- Pedidos.
- Métricas.
- Recomendaciones.
- Experimentos.

## CRM/SaaS

- Leads.
- Clientes.
- Oportunidades.
- Casos.
- Reservas.
- Pagos.
- Documentos.
- Tareas.

La plataforma común debe trabajar con conceptos transversales:

- Memoria.
- Fuente.
- Actor.
- Tenant.
- Recurso.
- Scope.
- Namespace.
- Vigencia.
- Confianza.
- Evidencia.
- Decisión.
- Evento.
- Política.
- Recuperación.
- Consolidación.
- Supersesión.
- Eliminación.

---

# 2. Regla obligatoria de análisis previo

## 2.1 Principio

Antes de diseñar, adaptar, crear o modificar cualquier memoria, Codex debe realizar un análisis exhaustivo del sistema real.

No debe asumirse que una arquitectura de memoria genérica puede copiarse directamente.

La memoria debe adaptarse a:

- El producto.
- El dominio.
- Los usuarios.
- Los roles.
- Los flujos.
- Los riesgos.
- Las fuentes.
- Los datos existentes.
- Las restricciones legales.
- Las reglas de negocio.
- Las tools.
- El RAG.
- Los agentes.
- Los eventos.
- La observabilidad.
- La política de retención.

## 2.2 Prohibición

Codex no debe:

- Inventar memorias.
- Inventar scopes.
- Inventar tablas.
- Inventar fuentes.
- Inventar reglas de vigencia.
- Inventar permisos.
- Inventar procesos de consolidación.
- Reutilizar directamente una memoria de otro SaaS.
- Copiar estructuras sin comprobar su encaje.
- Crear memoria antes de identificar qué problema resuelve.
- Guardar información solo porque está disponible.

## 2.3 Resultado esperado del análisis

Antes de implementar, Codex debe entregar:

1. Mapa del producto.
2. Mapa del dominio.
3. Mapa de actores.
4. Mapa de fuentes.
5. Mapa de eventos.
6. Mapa de datos vivos.
7. Mapa de decisiones humanas.
8. Mapa de memoria actual.
9. Mapa de riesgos.
10. Mapa de permisos.
11. Mapa de retención.
12. Mapa de casos de uso.
13. Propuesta de scopes.
14. Propuesta de namespaces.
15. Propuesta de tipos de memoria.
16. Propuesta de políticas de escritura.
17. Propuesta de políticas de lectura.
18. Propuesta de adaptación al producto concreto.

No se debe escribir código hasta completar y revisar este análisis.

---

# 3. Definición de Memory Architecture

**Memory Architecture** es la disciplina de diseñar cómo un agente:

- Decide qué información conservar.
- Decide qué información no conservar.
- Determina el ámbito.
- Determina la fuente.
- Determina la vigencia.
- Determina la confianza.
- La almacena.
- La versiona.
- La recupera.
- La actualiza.
- La consolida.
- La invalida.
- La elimina.
- La audita.

Fórmula conceptual:

```text
Memoria fiable =
selección
+ fuente
+ estructura
+ scope
+ vigencia
+ permisos
+ recuperación
+ corrección
+ olvido
```

---

# 4. Memoria, contexto, RAG y datos vivos

## 4.1 Memoria

Información persistente potencialmente útil en futuras tareas.

Ejemplo:

```text
La empresa prioriza margen frente a facturación.
```

## 4.2 Contexto

Información seleccionada para una llamada concreta.

Ejemplo:

```text
Objetivo: evaluar campaña X.
Margen mínimo de la empresa: 25 %.
Margen actual del producto: 18 %.
```

## 4.3 RAG

Conocimiento recuperado desde documentos o fuentes.

Ejemplo:

```text
Manual de análisis de campañas.
Política de cancelación.
Checklist documental.
```

## 4.4 Datos vivos

Estado operativo actual del SaaS.

Ejemplo:

```text
campaign.status = active
reservation.status = pending
payment.status = confirmed
```

## 4.5 Jerarquía

```text
DATOS VIVOS
Fuente de verdad operativa

RAG
Conocimiento documental

MEMORIA
Conocimiento persistente auxiliar

CONTEXTO
Selección actual de todo lo anterior
```

## 4.6 Regla

La memoria nunca debe sustituir una consulta actual.

---

# 5. Problema que resuelve

Sin arquitectura de memoria:

- El agente olvida decisiones.
- Repite preguntas.
- Repite errores.
- No aprende de acciones humanas.
- No conserva preferencias.
- No puede continuar tareas largas.
- No adapta recomendaciones.
- No recuerda políticas aprobadas.

Con una mala arquitectura:

- Guarda basura.
- Guarda inferencias.
- Guarda información obsoleta.
- Cruza tenants.
- Reingiere informes de IA.
- Duplica hechos.
- Propaga errores.
- Genera sesgos.
- Crece sin límites.
- Resulta imposible depurar.

---

# 6. Principio de no reingesta automática

La plataforma no debe reintroducir automáticamente outputs generados por IA como memoria canónica.

Incorrecto:

```text
Datos reales
  ↓
Informe IA
  ↓
Memoria
  ↓
Nuevo informe IA
  ↓
Nueva memoria
```

Correcto:

```text
Evento humano o verificado
  ↓
Candidato de memoria
  ↓
Validación
  ↓
Aprobación
  ↓
Memoria
```

Fuentes permitidas prioritarias:

- Declaración explícita del usuario.
- Acción humana.
- Evento verificado.
- Resultado medido.
- Configuración.
- Documento aprobado.
- Decisión aprobada.

Las inferencias de IA deben:

- Marcarse como inferencias.
- Tener menor confianza.
- Tener menor vigencia.
- No convertirse en políticas.
- No convertirse en verdad organizacional.
- Requerir aprobación cuando su impacto sea relevante.

---

# 7. Análisis de adaptación por producto

Cada producto debe tener su propio análisis de memoria.

## 7.1 EcomScaling IA

Codex debe analizar:

- Qué decisiones humanas existen.
- Qué recomendaciones se aceptan o rechazan.
- Qué resultados pueden medirse.
- Qué métricas ya viven en bases operativas.
- Qué preferencias de negocio son estables.
- Qué información debe permanecer temporal.
- Qué memoria pertenece a tienda.
- Qué memoria pertenece a producto.
- Qué memoria pertenece a campaña.
- Qué memoria pertenece a organización.
- Qué memoria pertenece al usuario.
- Qué memoria puede consolidarse.
- Qué memoria debe caducar.

## 7.2 CRM/SaaS

Codex debe analizar:

- Qué decisiones existen por expediente.
- Qué preferencias pertenecen al cliente.
- Qué reglas pertenecen a la empresa.
- Qué estado ya existe en la base de datos.
- Qué memoria pertenece a recurso.
- Qué memoria pertenece a usuario.
- Qué memoria pertenece a tenant.
- Qué decisiones requieren aprobación.
- Qué información está regulada.
- Qué información debe borrarse.
- Qué información puede compartirse entre agentes.

## 7.3 Regla

No debe asumirse que una memoria válida para EcomScaling es válida para CRM, ni al contrario.

---

# 8. Tipos de memoria

## 8.1 Working Memory

Estado activo de ejecución.

```ts
export type WorkingMemory = {
  runId: string;
  objective: string;
  currentStep: number;
  completedSteps: string[];
  pendingSteps: string[];
  observations: unknown[];
  activeErrors: string[];
};
```

Uso:

- Loops.
- Checkpoints.
- Reanudación.
- Tareas largas.

No es memoria permanente.

---

## 8.2 Thread Memory

Memoria de una conversación.

Puede contener:

- Referencias activas.
- Entidades resueltas.
- Aclaraciones.
- Decisiones.
- Acciones.
- Trabajo pendiente.

Debe analizarse si el producto necesita continuidad por hilo o por recurso.

---

## 8.3 Semantic Memory

Hechos relativamente estables.

Ejemplos:

```text
Margen mínimo aprobado = 25 %.
Idioma preferido = inglés.
Política de descuentos = máximo 20 %.
```

No debe contener estados vivos.

---

## 8.4 Episodic Memory

Experiencias pasadas.

Ejemplos:

```text
La última campaña falló por falta de stock.
Una importación anterior generó duplicados.
```

Debe conservar:

- Evento.
- Resultado.
- Fuente.
- Evidencia.
- Fecha.
- Contexto.

---

## 8.5 Procedural Memory

Cómo debe realizarse una tarea.

Ejemplos:

- Checklist.
- Playbook.
- Workflow.
- Skill.
- Política.
- Procedimiento.

Debe:

- Versionarse.
- Aprobarse.
- Probarse.
- Tener vigencia.
- Tener propietario.

---

## 8.6 Preference Memory

Preferencias estables.

Ejemplos:

```text
Priorizar margen.
Enviar comunicaciones bilingües.
Usar formato ejecutivo.
```

Debe distinguirse entre:

- Preferencia explícita.
- Preferencia inferida.
- Configuración formal.

---

## 8.7 Organizational Memory

Memoria del tenant.

Ejemplos:

- Estrategia.
- Políticas.
- Convenciones.
- Diccionario.
- Lecciones aprobadas.

Debe tener controles de escritura altos.

---

## 8.8 Resource Memory

Memoria vinculada a un recurso.

Ejemplos:

```text
store_123
campaign_18
client_23
reservation_88
```

Puede contener:

- Decisiones.
- Excepciones.
- Incidencias.
- Resultados.
- Feedback.

---

# 9. Scopes

```ts
export type MemoryScope =
  | "run"
  | "thread"
  | "user"
  | "resource"
  | "agent"
  | "tenant"
  | "product"
  | "global";
```

## Regla

A mayor scope, mayor control.

| Scope | Control |
|---|---|
| run | bajo |
| thread | bajo |
| user | medio |
| resource | medio |
| agent | medio |
| tenant | alto |
| product | muy alto |
| global | crítico |

Codex debe justificar cada scope.

---

# 10. Namespaces

```ts
namespace = [
  "tenant",
  tenantId,
  "resource",
  resourceType,
  resourceId
]
```

Otros ejemplos:

```ts
["tenant", tenantId, "user", userId]
```

```ts
["tenant", tenantId, "organization"]
```

```ts
["tenant", tenantId, "agent", agentId]
```

Los namespaces deben derivarse del análisis real.

---

# 11. Contrato de memoria

```ts
export type MemoryRecord = {
  id: string;

  tenantId: string;
  productType: string;

  scope: MemoryScope;
  namespace: string[];

  memoryType:
    | "working"
    | "semantic"
    | "episodic"
    | "procedural"
    | "preference";

  subjectType?: string;
  subjectId?: string;

  key: string;
  value: unknown;
  summary: string;

  source: MemorySource;

  confidence: number;
  verificationStatus:
    | "unverified"
    | "verified"
    | "human_approved";

  validFrom?: string;
  validUntil?: string;
  staleAfter?: string;

  supersedesMemoryId?: string;

  status:
    | "active"
    | "superseded"
    | "expired"
    | "deleted"
    | "quarantined";

  createdAt: string;
  updatedAt: string;
};
```

---

# 12. Fuente

```ts
export type MemorySource = {
  sourceType:
    | "explicit_user_statement"
    | "human_action"
    | "verified_event"
    | "approved_document"
    | "measured_outcome"
    | "system_configuration"
    | "model_inference";

  sourceId: string;
  actorId?: string;
  occurredAt: string;
};
```

Toda memoria debe tener fuente.

---

# 13. Memory Candidate

Antes de escribir, debe existir una memoria candidata.

```ts
export type MemoryCandidate = {
  proposedType: MemoryRecord["memoryType"];
  proposedScope: MemoryScope;
  proposedNamespace: string[];

  key: string;
  value: unknown;
  summary: string;

  source: MemorySource;
  confidence: number;

  reasonToStore: string;
  expectedFutureUse: string;

  requiresApproval: boolean;
};
```

---

# 14. Memory Candidate Extractor

Responsabilidad:

- Identificar posibles memorias.
- No guardarlas automáticamente.
- Explicar por qué podrían ser útiles.
- Proponer scope.
- Proponer vigencia.
- Proponer fuente.
- Detectar duplicados.

No debe convertir cualquier conversación en memoria.

---

# 15. Política de escritura

```ts
export type MemoryWritePolicy = {
  allowedSourceTypes: MemorySource["sourceType"][];

  minimumConfidence: number;
  requiresHumanApproval: boolean;
  allowModelInferences: boolean;

  allowedScopes: MemoryScope[];

  defaultTtlSeconds?: number;
  maximumTtlSeconds?: number;

  sensitiveDataAllowed: boolean;
};
```

## Reglas

- Políticas organizacionales requieren aprobación.
- Inferencias no se almacenan como hechos.
- Datos vivos no se duplican.
- Secretos no se almacenan.
- Memoria de tenant debe comprobar autoridad.
- Memoria de recurso debe comprobar acceso.
- Memoria procedimental debe versionarse.

---

# 16. Política de lectura

```ts
export type MemoryReadPolicy = {
  allowedScopes: MemoryScope[];
  allowedMemoryTypes: MemoryRecord["memoryType"][];
  requireActiveStatus: boolean;
  requireFreshness: boolean;
  minimumConfidence: number;
};
```

Debe depender de:

- Actor.
- Tenant.
- Producto.
- Tarea.
- Recurso.
- Riesgo.
- Tool.
- Loop.

---

# 17. Qué recordar

Guardar si:

- Es estable.
- Es reutilizable.
- Tiene fuente.
- Tiene utilidad futura clara.
- No existe mejor como dato vivo.
- El actor tiene autoridad.
- Tiene vigencia.
- No es innecesariamente sensible.
- No duplica información.
- Puede recuperarse de forma útil.

---

# 18. Qué no recordar

No guardar:

- Todo el historial.
- Cada mensaje.
- Cada informe.
- Métricas temporales.
- Estados vivos.
- Datos disponibles en DB.
- Respuestas completas de IA.
- Razonamientos internos.
- Hipótesis.
- Secretos.
- Tokens.
- Contraseñas.
- Datos de otro tenant.
- Datos sin fuente.
- Contenido malicioso.
- Inferencias no aprobadas.

---

# 19. Adaptación basada en análisis

Cada memoria propuesta debe responder:

1. ¿Qué problema resuelve?
2. ¿Quién la utilizará?
3. ¿En qué tareas?
4. ¿Qué fuente tiene?
5. ¿Qué scope necesita?
6. ¿Qué vigencia necesita?
7. ¿Qué permisos necesita?
8. ¿Qué riesgo tiene?
9. ¿Cómo se corrige?
10. ¿Cómo se elimina?
11. ¿Cómo se mide su utilidad?
12. ¿Existe ya en otra fuente?

Si no puede responderse, no debe crearse.

---

# 20. Recuperación

```ts
export type MemoryQuery = {
  tenantId: string;
  productType: string;
  actorId: string;

  taskType: string;
  resourceRefs: ResourceReference[];

  memoryTypes: MemoryRecord["memoryType"][];
  scopes: MemoryScope[];

  maxResults: number;
  minimumConfidence: number;
};
```

No recuperar toda la memoria.

---

# 21. Ranking

```ts
export type RankedMemory = {
  memory: MemoryRecord;

  relevanceScore: number;
  authorityScore: number;
  freshnessScore: number;
  scopeScore: number;
  finalScore: number;
};
```

Factores:

- Relevancia.
- Recurso.
- Fuente.
- Vigencia.
- Confianza.
- Scope.
- Permisos.
- Recencia.
- Historial de utilidad.
- Riesgo.

---

# 22. Recuperación híbrida

Combinar:

- Namespace.
- Key.
- Filtros.
- Búsqueda exacta.
- Búsqueda semántica.
- Recencia.
- Autoridad.
- Resource ID.
- Task type.

No depender solo de embeddings.

---

# 23. Memory Store

```ts
export interface MemoryStore {
  put(memory: MemoryRecord): Promise<void>;

  get(input: {
    tenantId: string;
    memoryId: string;
  }): Promise<MemoryRecord | null>;

  search(
    query: MemoryQuery
  ): Promise<MemoryRecord[]>;

  supersede(input: {
    oldMemoryId: string;
    newMemory: MemoryRecord;
  }): Promise<void>;

  expire(memoryId: string): Promise<void>;

  quarantine(memoryId: string): Promise<void>;

  delete(memoryId: string): Promise<void>;
}
```

---

# 24. Arquitectura técnica

```text
src/
  ai/
    memory/
      memory.types.ts
      memory.service.ts
      memory.store.ts

      memory-candidate-extractor.ts
      memory-analyzer.ts
      memory-validator.ts
      memory-deduplicator.ts

      memory-write-policy.ts
      memory-read-policy.ts

      memory-ranker.ts
      memory-retriever.ts
      memory-consolidator.ts

      memory-expiration.ts
      memory-conflict-resolver.ts
      memory-audit.ts

      adapters/
        ecommerce/
        crm/

      observability/
      evals/
      tests/
```

---

# 25. Adaptadores de producto

## 25.1 Ecommerce Memory Adapter

Debe decidir cómo adaptar:

- Store memory.
- Campaign memory.
- Product memory.
- Experiment memory.
- Recommendation feedback.
- Business preferences.
- Growth policies.

## 25.2 CRM Memory Adapter

Debe decidir cómo adaptar:

- Client memory.
- Case memory.
- Opportunity memory.
- Reservation memory.
- Procedural memory.
- Communication preferences.
- Organizational policies.

Los adaptadores deben basarse en análisis real.

---

# 26. Memory Packs

Un Memory Pack define qué memoria necesita una familia de tareas.

```ts
export type MemoryPackDefinition = {
  id: string;
  productType: string;
  taskTypes: string[];

  allowedScopes: MemoryScope[];
  memoryTypes: MemoryRecord["memoryType"][];

  namespaces: string[][];
  readPolicyId: string;
  writePolicyId: string;

  maxRetrievedMemories: number;
};
```

Ejemplos:

```text
campaign_analysis_memory
store_strategy_memory
client_preferences_memory
case_history_memory
```

---

# 27. Consolidación

La consolidación debe analizar:

- Duplicados.
- Patrones.
- Repeticiones.
- Contradicciones.
- Vigencia.
- Autoridad.
- Fuente.
- Contexto.

No debe crear reglas automáticamente.

Ejemplo:

```text
3 eventos indican problemas de stock.
```

No convertir automáticamente en:

```text
Nunca escalar este producto.
```

Debe:

- Proponer.
- Mostrar evidencia.
- Requerir decisión humana.

---

# 28. Actualización y supersesión

No sobrescribir.

Proceso:

```text
Memoria antigua
  ↓
Nueva memoria
  ↓
Supersede
  ↓
Trazabilidad
```

Ejemplo:

```ts
{
  supersedesMemoryId: "memory_1",
  status: "active"
}
```

La anterior:

```ts
{
  status: "superseded"
}
```

---

# 29. Vigencia

```ts
export type MemoryFreshnessPolicy = {
  defaultTtlSeconds?: number;
  staleAfterSeconds?: number;
  requireReviewAfter?: string;
};
```

No todas las memorias son permanentes.

Ejemplos:

- Preferencia explícita: larga duración.
- Resultado de experimento: larga duración.
- Hipótesis: corta duración.
- Configuración de campaña: no memoria.
- Estado de reserva: no memoria.
- Política: hasta nueva versión.

---

# 30. Conflictos

```ts
export type MemoryConflict = {
  key: string;
  subjectType?: string;
  subjectId?: string;

  memories: MemoryRecord[];

  resolution:
    | "canonical_source"
    | "latest_approved"
    | "human_required"
    | "unresolved";
};
```

No mezclar contradicciones silenciosamente.

---

# 31. Olvido

La arquitectura debe soportar:

- Expiración.
- Supersesión.
- Eliminación.
- Borrado por usuario.
- Borrado legal.
- Quarantine.
- Retención.

Regla:

```text
Una memoria que no puede olvidarse está mal diseñada.
```

---

# 32. Memoria para agentes múltiples

Separar:

## Memoria privada del agente

```ts
["tenant", tenantId, "agent", agentId]
```

## Memoria compartida de recurso

```ts
["tenant", tenantId, "shared", resourceType, resourceId]
```

## Memoria organizacional

```ts
["tenant", tenantId, "organization"]
```

Cada una debe tener permisos diferentes.

---

# 33. Memoria en tareas largas

Debe conservar:

- Objetivo.
- Plan.
- Pasos completados.
- Evidencias.
- Artefactos.
- Errores.
- Bloqueos.
- Próximo paso.
- Checkpoint.

No basta un resumen vago.

---

# 34. Seguridad

## 34.1 Multi-tenant

Toda memoria debe estar ligada a tenant.

## 34.2 Permisos

Lectura y escritura deben separarse.

## 34.3 Prompt injection

Contenido externo no puede crear memoria automáticamente.

## 34.4 Datos sensibles

Aplicar:

- Minimización.
- Redacción.
- Retención.
- Cifrado.
- Auditoría.
- Borrado.

---

# 35. Observabilidad

Registrar:

- Memoria recuperada.
- Motivo.
- Score.
- Fuente.
- Uso.
- Escritura.
- Actor.
- Aprobación.
- Conflicto.
- Corrección.
- Expiración.
- Eliminación.
- Impacto.

---

# 36. Métricas

- Memorias creadas.
- Memorias recuperadas.
- Memorias utilizadas.
- Memorias ignoradas.
- Duplicados.
- Conflictos.
- Correcciones.
- Expiraciones.
- Memorias obsoletas.
- Errores causados por memoria.
- Mejora de resultados.
- Coste.
- Latencia.
- Incidentes multi-tenant.
- Incidentes de permisos.

---

# 37. Evals

Evaluar:

- Qué guardar.
- Qué no guardar.
- Scope.
- Fuente.
- Vigencia.
- Recuperación.
- Conflictos.
- Olvido.
- Adaptación al producto.
- Multi-tenant.
- Inferencias.
- Reingesta IA.
- Privacidad.

---

# 38. Tests

## Unitarios

- Candidate extractor.
- Write policy.
- Read policy.
- Ranking.
- Dedupe.
- Vigencia.
- Conflictos.
- Supersesión.
- Eliminación.

## Integración

- Memory Store.
- Context Builder.
- RAG.
- Tools.
- Adaptadores.
- Observabilidad.

## Seguridad

- Tenant mismatch.
- Permission bypass.
- Prompt injection.
- Context poisoning.
- Memoria maliciosa.
- Borrado.
- Datos sensibles.

---

# 39. Antipatrones prohibidos

- Guardar todo.
- Reingerir informes IA.
- Memoria sin fuente.
- Memoria sin scope.
- Memoria sin vigencia.
- Sobrescribir silenciosamente.
- Usar memoria como DB.
- Recuperar toda.
- Políticas sin aprobación.
- Inferencias como hechos.
- Vector store único.
- Sin olvido.
- Copiar memoria entre productos.
- Diseñar sin analizar.
- Implementar antes de auditar.

---

# 40. Arquitectura por capas

```text
PLATAFORMA COMÚN
  Memory Store
  Policies
  Ranking
  Retrieval
  Consolidation
  Expiration
  Security
  Observability

PRODUCTO
  Memory Packs
  Configuración
  Capacidades
  Reglas

DOMINIO
  Tiendas y campañas
  o
  Clientes y reservas
```

---

# 41. Fases de implementación

## Fase 0. Análisis exhaustivo obligatorio

Antes de implementar:

- Auditar producto.
- Auditar dominio.
- Auditar agentes.
- Auditar RAG.
- Auditar tools.
- Auditar eventos.
- Auditar DB.
- Auditar permisos.
- Auditar tenants.
- Auditar retención.
- Auditar memoria existente.
- Auditar riesgos.

Entregables:

- Diagnóstico.
- Mapa de fuentes.
- Mapa de casos.
- Mapa de memoria.
- Riesgos.
- Propuesta de adaptación.
- Archivos a modificar.

No implementar todavía.

## Fase 1. Contratos

Crear tipos comunes.

## Fase 2. Memory Store

Implementar almacenamiento base.

## Fase 3. Policies

Implementar lectura y escritura.

## Fase 4. Retrieval

Añadir ranking y filtros.

## Fase 5. Primer adaptador

Implementar un caso simple.

## Fase 6. Consolidación

Añadir dedupe y supersesión.

## Fase 7. Seguridad

Añadir tenant y permisos.

## Fase 8. Segundo producto

Reutilizar núcleo.

## Fase 9. Evals

Medir calidad.

---

# 42. Criterios de aceptación

- [ ] Se realizó análisis previo.
- [ ] Se documentó la adaptación.
- [ ] Existe Memory Store común.
- [ ] Existen adaptadores.
- [ ] Toda memoria tiene fuente.
- [ ] Toda memoria tiene scope.
- [ ] Toda memoria tiene vigencia.
- [ ] Toda memoria tiene tenant.
- [ ] Existen políticas.
- [ ] Existen permisos.
- [ ] Existen conflictos.
- [ ] Existe supersesión.
- [ ] Existe olvido.
- [ ] No se reingieren informes.
- [ ] No se duplican datos vivos.
- [ ] Existen evals.
- [ ] Existen tests.
- [ ] Existe observabilidad.
- [ ] La arquitectura sirve para varios productos.
- [ ] La adaptación está justificada.

---

# 43. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura transversal de memoria adaptada al producto real.

## Regla obligatoria

Antes de proponer memoria, debes analizar exhaustivamente:

- Repositorio.
- Producto.
- Dominio.
- Datos.
- Eventos.
- Tools.
- RAG.
- Agentes.
- Roles.
- Permisos.
- Multi-tenancy.
- Casos de uso.
- Fuentes.
- Riesgos.
- Retención.
- Flujos humanos.

## Restricciones

1. No implementar antes del análisis.
2. No inventar memoria.
3. No copiar memoria entre productos.
4. No reingerir informes IA.
5. No duplicar datos vivos.
6. No guardar inferencias como hechos.
7. No guardar sin fuente.
8. No guardar sin scope.
9. No guardar sin vigencia.
10. No cruzar tenants.
11. No usar vector store como única solución.
12. No crear políticas sin aprobación.
13. No almacenar secretos.
14. No sobreescribir.
15. No eliminar trazabilidad.
16. No marcar como completado con tests fallando.
17. No introducir abstracciones sin necesidad.
18. Documentar toda adaptación.
19. Medir utilidad.
20. Mantener capacidad de olvido.

---

# 44. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
Memory Architecture adaptada al sistema real.

No implementes todavía ninguna memoria.

Objetivos:

1. Identificar todos los agentes existentes.
2. Identificar todos los loops.
3. Identificar todas las tools.
4. Identificar RAG y fuentes documentales.
5. Identificar datos vivos.
6. Identificar eventos humanos.
7. Identificar decisiones humanas.
8. Identificar configuraciones.
9. Identificar tenants.
10. Identificar roles y permisos.
11. Identificar memoria actual.
12. Identificar riesgos.
13. Identificar retención y privacidad.
14. Clasificar información en:
    - datos vivos
    - conocimiento RAG
    - working memory
    - thread memory
    - semantic memory
    - episodic memory
    - procedural memory
    - preference memory
15. Proponer scopes.
16. Proponer namespaces.
17. Proponer políticas de escritura.
18. Proponer políticas de lectura.
19. Proponer adaptación por producto.
20. Proponer contratos:
    - MemoryRecord
    - MemorySource
    - MemoryCandidate
    - MemoryWritePolicy
    - MemoryReadPolicy
    - MemoryQuery
    - MemoryConflict
    - MemoryPackDefinition
21. Proponer arquitectura.
22. Proponer archivos.
23. Proponer fases.
24. Proponer tests.
25. Proponer evals.

Antes de modificar código, entrega:

a) diagnóstico completo,
b) mapa de producto,
c) mapa de dominio,
d) mapa de fuentes,
e) mapa de memoria,
f) riesgos,
g) adaptación propuesta,
h) archivos exactos,
i) criterios de aceptación.

Restricciones:

- No inventes datos.
- No inventes tablas.
- No inventes memoria.
- No implementes todavía.
- No copies una arquitectura sin adaptarla.
- No reingieras outputs de IA.
- No dupliques datos vivos.
- No marques como terminado sin validación.
```

---

# 45. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de Memory
Architecture.

Implementa solo:

1. Contratos comunes.
2. Memory Store.
3. Write Policy.
4. Read Policy.
5. Un Memory Pack.
6. Un adaptador de producto.
7. Una única fuente autorizada.
8. Un caso de recuperación.
9. Auditoría.
10. Tests.

No implementes:

- Consolidación automática.
- Políticas organizacionales automáticas.
- Memoria procedimental automática.
- Inferencias como memoria.
- Reingesta de informes.
- Segundo producto.

Reutiliza el análisis previo y documenta cualquier desviación.
```

---

# 46. ADR recomendados

- ADR: análisis previo.
- ADR: scopes.
- ADR: namespaces.
- ADR: fuentes.
- ADR: escritura.
- ADR: lectura.
- ADR: no reingesta IA.
- ADR: datos vivos vs memoria.
- ADR: consolidación.
- ADR: supersesión.
- ADR: retención.
- ADR: multi-tenant.
- ADR: adaptadores.
- ADR: Memory Packs.
- ADR: vector store.
- ADR: privacidad.

---

# 47. Definición de terminado

Una memoria está terminada cuando:

1. Se analizó el producto.
2. Se justificó la necesidad.
3. Se identificó la fuente.
4. Se definió el scope.
5. Se definió el namespace.
6. Se definió la vigencia.
7. Se definió la confianza.
8. Se definió el permiso.
9. Se definió la escritura.
10. Se definió la lectura.
11. Se definió la recuperación.
12. Se definió la corrección.
13. Se definió la eliminación.
14. Se definió la observabilidad.
15. Se definieron tests.
16. Se definieron evals.
17. Se evitó duplicar datos vivos.
18. Se evitó reingesta IA.
19. Se documentó adaptación.
20. Se validó en el producto real.

---

# 48. Resumen ejecutivo

La memoria no debe diseñarse antes de entender el producto.

La secuencia correcta es:

```text
ANALIZAR
  ↓
CLASIFICAR
  ↓
JUSTIFICAR
  ↓
DISEÑAR
  ↓
VALIDAR
  ↓
IMPLEMENTAR
  ↓
MEDIR
```

La arquitectura común debe proporcionar:

- Memory Store.
- Policies.
- Ranking.
- Retrieval.
- Consolidation.
- Security.
- Observability.

Cada producto debe aportar:

- Adaptadores.
- Memory Packs.
- Fuentes.
- Scopes.
- Reglas.
- Casos de uso.

La memoria debe adaptarse al producto.

El producto nunca debe deformarse para encajar en una memoria genérica.
