# Privacy & Data Protection Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnico-jurídica transversal.
- **Ámbito:** SaaS, CRM, agentes, copilotos, RAG, memoria, herramientas, workflows, analítica, observabilidad, integraciones, proveedores de IA y sistemas multi-tenant.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** convertir los principios, obligaciones y derechos de protección de datos en controles técnicos, modelos de datos, políticas, workflows y evidencias verificables.
- **Audiencia:** Codex, arquitectura, backend, IA, seguridad, legal, DPO/DPD, QA, DevOps, datos, producto y operaciones.
- **Prioridad:** crítica.
- **Jurisdicción de referencia:** Unión Europea y España.
- **Fecha de referencia:** julio de 2026.
- **Principio rector:** el hecho de que un dato sea técnicamente accesible no significa que pueda utilizarse para cualquier finalidad, por cualquier agente, mediante cualquier proveedor o durante cualquier plazo.
- **Estado esperado:** documento vivo, versionado, vinculado al Registro de Actividades de Tratamiento, evaluaciones de riesgo, EIPD, contratos de encargado, inventario de proveedores, ADR, tests y evidencias.

---

# 1. Advertencia de alcance

Este documento define una arquitectura de cumplimiento y controles técnicos.

No sustituye:

- El análisis jurídico de cada tratamiento.
- La determinación formal de responsable, encargado o corresponsable.
- La selección de la base jurídica.
- La evaluación de compatibilidad de finalidades.
- La evaluación de impacto.
- El asesoramiento del Delegado de Protección de Datos cuando proceda.
- La revisión contractual de proveedores y subencargados.
- La valoración de transferencias internacionales.
- La respuesta jurídica ante una brecha.

Codex no debe resolver por sí mismo cuestiones jurídicas abiertas.

Debe:

1. Detectarlas.
2. Representarlas como requisitos o decisiones pendientes.
3. Bloquear implementaciones que dependan de una respuesta no aprobada.
4. Solicitar o reutilizar la decisión jurídica documentada.
5. Mantener trazabilidad de la decisión aplicada.

---

# 2. Propósito

Este documento define cómo implementar **Privacy & Data Protection Engineering** en una plataforma SaaS con agentes de IA.

La arquitectura debe permitir:

- Definir finalidades.
- Vincular datos a finalidades.
- Documentar bases jurídicas.
- Diferenciar responsables y encargados.
- Clasificar datos.
- Minimizar.
- Pseudonimizar.
- Redactar.
- Controlar proveedores.
- Controlar subencargados.
- Controlar transferencias internacionales.
- Aplicar políticas de retención.
- Ejecutar borrados.
- Gestionar bloqueos y legal holds.
- Atender derechos.
- Controlar decisiones automatizadas.
- Gestionar consentimiento.
- Mantener avisos de privacidad versionados.
- Controlar RAG.
- Controlar embeddings.
- Controlar memoria.
- Controlar logs.
- Controlar cachés.
- Controlar datasets de evaluación.
- Ejecutar evaluaciones de riesgo.
- Ejecutar EIPD.
- Reabrir análisis cuando cambia el sistema.
- Gestionar brechas de datos personales.
- Mantener accountability.
- Producir evidencias auditables.

---

# 3. Marco jurídico de referencia

La implementación debe contrastarse con:

- Reglamento (UE) 2016/679, Reglamento General de Protección de Datos.
- Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales.
- Reglamento (UE) 2024/1689, Reglamento de Inteligencia Artificial, cuando resulte aplicable.
- Directrices y dictámenes del Comité Europeo de Protección de Datos.
- Orientaciones y guías de la Agencia Española de Protección de Datos.
- Normativa sectorial aplicable.
- Obligaciones contractuales con clientes y proveedores.
- Normativa laboral cuando el tratamiento afecte a empleados.
- Normativa de consumidores cuando corresponda.
- Normativa fiscal, mercantil y de prevención de blanqueo cuando proceda.

El Reglamento de IA no sustituye las obligaciones derivadas de la normativa de protección de datos.

Una funcionalidad puede:

- No ser de alto riesgo conforme al Reglamento de IA.
- Y requerir una EIPD conforme al RGPD.

También puede:

- Cumplir obligaciones del Reglamento de IA.
- Y carecer de base jurídica suficiente para tratar datos personales.

---

# 4. Principios del tratamiento convertidos en controles

Los principios del artículo 5 RGPD deben traducirse en controles de producto.

## 4.1 Licitud, lealtad y transparencia

Controles:

- Purpose Registry.
- Lawful Basis Registry.
- Privacy Notice Registry.
- Consent Evidence.
- Legitimate Interests Assessment.
- Provider disclosure.
- Automated-decision disclosure.
- Audit evidence.

## 4.2 Limitación de la finalidad

Controles:

- Purpose binding.
- Prohibición de reutilización no aprobada.
- Secondary-purpose review.
- Purpose-aware authorization.
- Cache partitioning por finalidad.
- Retention por finalidad.
- Model routing por finalidad.

## 4.3 Minimización

Controles:

- Field projections.
- Record limits.
- Redaction.
- Pseudonymization.
- Aggregation.
- Context budgets.
- Tool-specific responses.

## 4.4 Exactitud

Controles:

- Source of truth.
- Corrección de inferencias.
- Data freshness.
- Rectification propagation.
- Verification.
- Estado `unverified` para inferencias.

## 4.5 Limitación del plazo de conservación

Controles:

- Retention policies.
- Deletion jobs.
- Legal hold.
- Archive rules.
- Backup deletion.
- Provider deletion.
- Tombstones.

## 4.6 Integridad y confidencialidad

Controles:

- Security architecture.
- Tenant isolation.
- Encryption.
- Access control.
- Logging.
- Incident response.
- Breach management.

## 4.7 Responsabilidad proactiva

Controles:

- Registro de actividades.
- Evidencias.
- Versionado.
- EIPD.
- Risk assessments.
- Tests.
- Audit.
- Owners.
- Approvals.
- Change reviews.

---

# 5. Diferencia entre seguridad y privacidad

## Seguridad

Pregunta:

```text
¿Puede un actor no autorizado acceder al pasaporte?
```

## Privacidad

Pregunta:

```text
¿Necesitamos el pasaporte para esta tarea?
¿Con qué finalidad?
¿Con qué base jurídica?
¿Qué campos son necesarios?
¿Qué proveedor puede recibirlo?
¿Cuándo debe eliminarse?
```

Un sistema puede estar cifrado y seguir incumpliendo porque:

- Recoge más datos de los necesarios.
- Reutiliza datos para otra finalidad.
- Conserva datos indefinidamente.
- Envía datos a un proveedor no aprobado.
- No permite ejercer derechos.
- Usa información para entrenar o evaluar sin cobertura.
- Toma decisiones automatizadas sin garantías.

---

# 6. Diferencia con Data & Knowledge Engineering

## Data & Knowledge Engineering

Gestiona:

- Fuentes.
- Documentos.
- Versiones.
- Chunking.
- Embeddings.
- Retrieval.
- Vigencia.
- Citación.

## Privacy Engineering

Determina:

- Si el dato puede tratarse.
- Para qué finalidad.
- Qué campos pueden usarse.
- Qué actor puede acceder.
- Qué proveedor puede recibirlo.
- Qué retención se aplica.
- Cómo se rectifica o elimina.
- Qué derechos corresponden.

Un documento correctamente indexado puede seguir estando prohibido para una consulta determinada.

---

# 7. Diferencia con AI Governance

## AI Governance

Gestiona:

- Inventario de sistemas.
- Riesgo de IA.
- Roles.
- Evals.
- Supervisión.
- Normativa de IA.
- Incidentes algorítmicos.

## Privacy Engineering

Gestiona:

- Tratamientos de datos personales.
- Bases jurídicas.
- Finalidades.
- Derechos.
- Retención.
- Proveedores.
- Transferencias.
- EIPD.
- Brechas de datos.

Ambas disciplinas deben integrarse.

No deben confundirse.

---

# 8. Regla obligatoria de análisis previo

Antes de implementar controles de privacidad, Codex debe analizar el sistema real.

No debe limitarse a:

- Añadir una tabla de consentimientos.
- Crear un botón de borrado.
- Ocultar algunos campos.
- Cifrar la base de datos.
- Copiar un aviso de privacidad.
- Marcar un proveedor como “RGPD”.

Debe inspeccionar:

- Productos.
- Features.
- Tenants.
- Roles.
- Usuarios.
- Datos.
- Campos.
- Tablas.
- Storage.
- Documentos.
- Logs.
- Traces.
- Cachés.
- RAG.
- Embeddings.
- Memoria.
- Evals.
- Tools.
- Workflows.
- Model providers.
- MCP.
- Integraciones.
- Webhooks.
- Backups.
- Data warehouses.
- Analytics.
- Exportaciones.
- Entornos.
- Procesos de soporte.
- Contratos.
- Avisos.
- Consentimientos.
- Retención.
- Derechos.
- Brechas.
- EIPD existentes.

---

# 9. Prohibiciones para Codex

Codex no debe:

- Inventar una base jurídica.
- Suponer que existe consentimiento.
- Suponer que el consentimiento cubre todas las finalidades.
- Suponer que NORA es siempre encargado.
- Suponer que el cliente es siempre responsable.
- Suponer que un proveedor es compatible por defecto.
- Suponer que embeddings son anónimos.
- Suponer que pseudonimización equivale a anonimización.
- Enviar datos completos cuando bastan agregados.
- Guardar datos personales en logs por defecto.
- Guardar conversaciones en memoria permanente por defecto.
- Crear cachés sin tenant, actor y finalidad.
- Implementar borrado solo en la tabla principal.
- Ignorar backups.
- Ignorar datos derivados.
- Ignorar proveedores externos.
- Ignorar datos de terceros contenidos en documentos.
- Ignorar datos inferidos.
- Implementar una decisión automatizada sensible sin revisión.
- Activar una nueva finalidad sin análisis.
- Marcar una EIPD como no necesaria sin evidencia.
- Crear un workflow de derechos sin verificación de identidad.
- Mostrar datos de terceros en una solicitud de acceso.
- Eliminar datos sujetos a obligación legal o legal hold.
- Bloquear permanentemente derechos por razones técnicas.
- Marcar terminado sin tests de propagación.

---

# 10. Entregables previos obligatorios

Antes de modificar código, Codex debe entregar:

1. Inventario de productos.
2. Inventario de features.
3. Inventario de tratamientos.
4. Inventario de finalidades.
5. Inventario de bases jurídicas documentadas.
6. Inventario de responsables.
7. Inventario de encargados.
8. Inventario de corresponsables.
9. Inventario de subencargados.
10. Inventario de categorías de interesados.
11. Inventario de categorías de datos.
12. Inventario de campos.
13. Inventario de inferencias.
14. Inventario de documentos.
15. Inventario de logs.
16. Inventario de memorias.
17. Inventario de embeddings.
18. Inventario de cachés.
19. Inventario de datasets.
20. Inventario de proveedores.
21. Inventario de regiones.
22. Inventario de transferencias.
23. Inventario de retenciones.
24. Inventario de derechos.
25. Inventario de decisiones automatizadas.
26. Inventario de EIPD.
27. Inventario de brechas.
28. Data-flow diagrams.
29. Matriz finalidad-dato.
30. Matriz finalidad-base jurídica.
31. Matriz actor-campo-finalidad.
32. Matriz proveedor-dato-región.
33. Matriz de retención.
34. Matriz de derechos.
35. Matriz de riesgos.
36. Gaps.
37. Arquitectura propuesta.
38. Persistencia propuesta.
39. Archivos exactos.
40. Fases.
41. Tests.
42. Evals.
43. Métricas.
44. Alertas.
45. Decisiones jurídicas abiertas.

---

# 11. La unidad central: finalidad

La arquitectura no debe girar únicamente alrededor de tablas o documentos.

Debe girar alrededor de finalidades específicas.

```ts
export type ProcessingPurpose = {
  id: string;
  version: string;

  name: string;
  description: string;

  product:
    | "nora"
    | "ecommerce"
    | "crm"
    | "shared";

  businessProcess: string;

  dataCategories: PersonalDataCategory[];
  dataSubjectCategories: DataSubjectCategory[];

  lawfulBasisId: string;

  compatibleSecondaryPurposeIds: string[];

  controllerId: string;

  processorIds: string[];
  subprocessorIds: string[];

  retentionPolicyId: string;

  noticeVersionId: string;

  active: boolean;

  approvedBy: string;
  approvedAt: string;
};
```

Ejemplos válidos:

- Generar un estudio fiscal solicitado.
- Gestionar una reserva inmobiliaria.
- Preparar documentación para firma.
- Tramitar un servicio de NIE.
- Analizar rentabilidad agregada de campañas.
- Gestionar soporte técnico.
- Detectar fraude o abuso.
- Facturar el servicio.
- Mantener seguridad y auditoría.

Ejemplo insuficiente:

```text
Mejorar la experiencia.
```

---

# 12. Purpose Registry

```ts
export interface ProcessingPurposeRegistry {
  getById(
    purposeId: string
  ): Promise<ProcessingPurpose | null>;

  listByProduct(
    product: string
  ): Promise<ProcessingPurpose[]>;

  assertActive(
    purposeId: string
  ): Promise<void>;

  getCompatibleSecondaryPurposes(
    purposeId: string
  ): Promise<ProcessingPurpose[]>;
}
```

Toda tool, workflow, consulta RAG, inferencia, memoria, exportación o integración que trate datos personales debe declarar una finalidad.

---

# 13. Purpose Binding

```ts
export type PersonalDataAccessRequest = {
  actorId: string;
  tenantId: string;

  purposeId: string;
  purposeVersion: string;

  resourceType: string;
  resourceId?: string;

  requestedFields: string[];

  requestedRecordCount: number;

  taskType: string;

  providerId?: string;

  persistentMemoryRequested: boolean;
};
```

```ts
export type PersonalDataAccessDecision = {
  allowed: boolean;

  allowedFields: string[];
  transformedFields: string[];
  redactedFields: string[];
  prohibitedFields: string[];

  maximumRecords: number;

  providerAllowed: boolean;

  memoryAllowed: boolean;

  reasonCodes: string[];

  policyVersion: string;
};
```

---

# 14. Prohibición de purpose laundering

No debe permitirse que una finalidad amplia o genérica se utilice para acceder a datos para otra finalidad real.

Ejemplo:

```text
Finalidad declarada:
Soporte técnico.

Finalidad real:
Analizar el comportamiento comercial de clientes.
```

Controles:

- Purpose IDs específicos.
- Logs.
- Reviewer.
- Tool-purpose mapping.
- Query-purpose mapping.
- Secondary-use review.
- Metrics de denegaciones.

---

# 15. Base jurídica

```ts
export type LawfulBasis =
  | "consent"
  | "contract"
  | "pre_contractual_measures"
  | "legal_obligation"
  | "vital_interests"
  | "public_task"
  | "legitimate_interests";
```

La taxonomía técnica puede separar medidas precontractuales para mayor claridad, aunque jurídicamente se integren en el artículo 6.1.b).

Cada finalidad debe tener una base documentada y aprobada.

---

# 16. Lawful Basis Record

```ts
export type LawfulBasisRecord = {
  id: string;

  purposeId: string;

  basis: LawfulBasis;

  legalReference: string;

  legalAnalysisReference: string;

  conditions: string[];

  excludedScenarios: string[];

  approvedBy: string;
  approvedAt: string;

  reviewAt?: string;

  active: boolean;
};
```

Codex no debe completar `legalReference` con una suposición.

---

# 17. Consentimiento

Cuando se utilice consentimiento, debe poder demostrarse:

- Quién consintió.
- Cuándo.
- Para qué finalidad.
- Qué aviso recibió.
- Cómo se capturó.
- Si era libre.
- Si era específico.
- Si fue retirado.
- Qué tratamientos se detuvieron.

```ts
export type ConsentRecord = {
  id: string;

  subjectId: string;

  purposeId: string;
  purposeVersion: string;

  noticeVersionId: string;

  grantedAt: string;
  withdrawnAt?: string;

  captureMethod: string;

  evidenceReference: string;

  status:
    | "active"
    | "withdrawn"
    | "expired"
    | "invalidated";
};
```

---

# 18. Consentimiento granular

Evitar:

```text
Acepto el uso de mis datos.
```

Preferir finalidades separadas cuando corresponda:

- Prestación del servicio.
- Comunicaciones comerciales.
- Analítica opcional.
- Memoria personalizable.
- Entrenamiento o mejora específica.
- Cesión a terceros no necesaria.

No debe solicitarse consentimiento para tratamientos cuya base sea otra solo para simplificar la arquitectura.

---

# 19. Retirada del consentimiento

La retirada debe activar un workflow.

```text
CONSENT WITHDRAWN
  ↓
IDENTIFICAR TRATAMIENTOS
  ↓
DETENER NUEVAS OPERACIONES
  ↓
INVALIDAR JOBS PENDIENTES
  ↓
REVISAR OTRA BASE JURÍDICA
  ↓
ELIMINAR O RESTRINGIR
  ↓
PROPAGAR A PROVEEDORES
  ↓
VERIFICAR
  ↓
AUDITAR
```

No debe borrar datos que deban conservarse por otra base jurídica.

---

# 20. Interés legítimo

Si se utiliza interés legítimo, debe existir una evaluación documentada.

```ts
export type LegitimateInterestsAssessment = {
  id: string;

  purposeId: string;

  legitimateInterestDescription: string;

  necessityAssessment: string;

  balancingAssessment: string;

  dataSubjectExpectations: string;

  safeguards: string[];

  optOutMechanism?: string;

  conclusion:
    | "approved"
    | "rejected"
    | "conditional";

  approvedBy: string;
  approvedAt: string;
};
```

No debe utilizarse interés legítimo como fallback automático cuando no existe consentimiento.

---

# 21. Categorías de interesados

```ts
export type DataSubjectCategory =
  | "customer"
  | "prospect"
  | "lead"
  | "buyer"
  | "seller"
  | "tenant_user"
  | "employee"
  | "contractor"
  | "supplier_contact"
  | "website_visitor"
  | "minor"
  | "vulnerable_person"
  | "third_party";
```

Un documento puede incluir datos de personas que no son usuarios directos.

Ejemplos:

- Cónyuge.
- Vendedor.
- Avalista.
- Representante.
- Testigo.
- Empleado.
- Contacto del proveedor.
- Persona mencionada en notas.

---

# 22. Categorías de datos

```ts
export type PersonalDataCategory =
  | "identity"
  | "contact"
  | "address"
  | "financial"
  | "transactional"
  | "professional"
  | "employment"
  | "location"
  | "behavioral"
  | "communications"
  | "documents"
  | "device"
  | "online_identifier"
  | "special_category"
  | "criminal_offence"
  | "derived"
  | "inferred";
```

---

# 23. Datos inferidos

Los siguientes pueden ser datos personales:

- Lead score.
- Probabilidad de compra.
- Urgencia.
- Riesgo.
- Perfil comercial.
- Sentimiento.
- Capacidad económica estimada.
- Clasificación de comportamiento.
- Recomendación personalizada.
- Resumen de conversación.
- Entidad resuelta.
- Perfil de fraude.

No deben almacenarse como hechos canónicos sin estado y procedencia.

---

# 24. Registro de inferencias personales

```ts
export type PersonalDataInference = {
  id: string;

  tenantId: string;
  subjectId: string;

  purposeId: string;

  inferenceType: string;

  value: unknown;

  sourceReferences: string[];

  modelId: string;
  modelSnapshot?: string;

  promptVersion: string;

  confidence?: number;

  status:
    | "unverified"
    | "confirmed"
    | "corrected"
    | "rejected"
    | "expired";

  createdAt: string;
  reviewedAt?: string;
};
```

---

# 25. Responsable, encargado y corresponsable

La arquitectura debe registrar roles jurídicos por tratamiento.

Un mismo proveedor o producto puede asumir roles diferentes según la operación.

Ejemplo:

- Gestión de usuarios propios: NORA puede ser responsable.
- Datos de clientes de una agencia: NORA puede actuar como encargado.
- Analítica propia con finalidad independiente: puede requerir análisis separado.
- Integración con un proveedor que determina fines propios: puede cambiar el mapa de roles.

---

# 26. Party Role Contract

```ts
export type ProcessingPartyRole =
  | "controller"
  | "joint_controller"
  | "processor"
  | "subprocessor"
  | "recipient"
  | "independent_controller";

export type ProcessingParty = {
  id: string;

  legalName: string;

  role: ProcessingPartyRole;

  purposeIds: string[];

  contractReference?: string;

  dataCategories: string[];

  processingRegions: string[];

  securityReviewReference?: string;

  privacyReviewReference?: string;

  active: boolean;
};
```

---

# 27. Encargados y artículo 28

Toda relación de encargado debe poder vincularse con:

- Contrato.
- Objeto.
- Duración.
- Naturaleza.
- Finalidad.
- Categorías de datos.
- Interesados.
- Instrucciones.
- Confidencialidad.
- Seguridad.
- Subencargados.
- Asistencia en derechos.
- Brechas.
- Devolución o supresión.
- Auditoría.

La plataforma debe reflejar restricciones contractuales en políticas técnicas.

---

# 28. Subencargados

```ts
export type SubprocessorRecord = {
  id: string;

  processorId: string;

  legalName: string;

  serviceDescription: string;

  purposeIds: string[];

  dataCategories: string[];

  regions: string[];

  transferMechanism?: string;

  authorizationMode:
    | "specific"
    | "general";

  noticeRequired: boolean;

  approvedAt?: string;

  active: boolean;
};
```

No debe activarse un subencargado nuevo sin pasar el proceso contractual y de privacidad aplicable.

---

# 29. Registro de Actividades de Tratamiento

```ts
export type ProcessingActivity = {
  id: string;

  name: string;

  purposeIds: string[];

  controllerId: string;

  processorIds: string[];
  subprocessorIds: string[];

  dataSubjectCategories: string[];
  personalDataCategories: string[];

  recipients: string[];

  internationalTransferIds: string[];

  retentionPolicyIds: string[];

  securityMeasureIds: string[];

  requiresDpia: boolean;

  dpiaId?: string;

  ownerId: string;

  status:
    | "draft"
    | "approved"
    | "suspended"
    | "retired";

  reviewedAt: string;
};
```

Mantener el registro como default operativo evita depender de una posible excepción del artículo 30.

---

# 30. Data Inventory

El inventario debe llegar a nivel de campo y ubicación.

```ts
export type PersonalDataField = {
  id: string;

  systemId: string;

  tableOrStore: string;

  fieldPath: string;

  category: PersonalDataCategory;

  subjectCategories: DataSubjectCategory[];

  purposes: string[];

  sensitivity:
    | "low"
    | "medium"
    | "high"
    | "special";

  source:
    | "data_subject"
    | "customer"
    | "third_party"
    | "public_source"
    | "derived"
    | "inferred";

  retentionPolicyId: string;

  allowedProviderIds: string[];

  redactForModel: boolean;
  redactForLogs: boolean;
  allowedInMemory: boolean;
};
```

---

# 31. Data Map

Debe mostrar flujos:

```text
DATA SUBJECT
  ↓
WEB / CRM / UPLOAD
  ↓
SUPABASE
  ↓
BACKEND
  ↓
MODEL PROVIDER
  ↓
TOOL
  ↓
LOGGING
  ↓
ANALYTICS
  ↓
BACKUP
```

Para cada salto:

- Finalidad.
- Actor.
- Datos.
- Base.
- Región.
- Retención.
- Seguridad.
- Contrato.
- Eliminación.

---

# 32. Privacy Classification

```ts
export type PrivacyClassification = {
  fieldPath: string;

  personalData: boolean;

  category?: PersonalDataCategory;

  sensitivity:
    | "low"
    | "medium"
    | "high"
    | "special";

  allowedPurposes: string[];

  prohibitedPurposes: string[];

  allowedProviders: string[];

  retentionPolicyId: string;

  redactForModel: boolean;
  redactForLogs: boolean;
  allowedInMemory: boolean;
  allowedInEvals: boolean;
};
```

---

# 33. Datos especiales

Debe existir una política reforzada para categorías especiales del artículo 9.

```ts
export type SpecialCategoryPolicy = {
  category: string;

  allowedPurposes: string[];

  article9ConditionReference: string;

  allowedProviders: string[];

  humanAccessRoles: string[];

  modelProcessingAllowed: boolean;

  pseudonymizationRequired: boolean;

  requiresDpia: boolean;

  approvedBy: string;
};
```

No debe inferirse una categoría especial salvo necesidad y cobertura jurídica.

---

# 34. Datos relativos a infracciones y condenas

Deben tener una política específica.

```ts
export type CriminalDataPolicy = {
  purposeId: string;

  legalAuthorizationReference: string;

  allowedRoles: string[];

  allowedProviders: string[];

  modelProcessingAllowed: boolean;

  retentionPolicyId: string;

  requiresDpiaReview: boolean;
};
```

Codex debe bloquear el uso si falta autorización jurídica documentada.

---

# 35. Menores y personas vulnerables

Debe existir una revisión reforzada cuando:

- Intervengan menores.
- Existan personas con discapacidad.
- Existan personas económicamente vulnerables.
- Se realice profiling.
- Se tomen decisiones significativas.
- Se traten documentos sensibles.

Controles:

- Mayor minimización.
- Transparencia adaptada.
- Intervención humana.
- Prohibiciones de scoring no aprobado.
- Retención reducida.
- Evaluación de riesgos.
- EIPD.

---

# 36. Minimización

La minimización debe aplicarse antes de la inferencia.

Ejemplo incorrecto:

```ts
{
  clientName,
  email,
  phone,
  passport,
  nie,
  bankAccount,
  address,
  maritalStatus,
  contract,
  legalNotes
}
```

para generar un recordatorio.

Ejemplo correcto:

```ts
{
  clientName,
  appointmentDate,
  appointmentLocation
}
```

---

# 37. Privacy Projection

```ts
export type PrivacyProjection = {
  id: string;
  version: string;

  taskType: string;

  purposeId: string;

  allowedFields: string[];
  prohibitedFields: string[];

  transformations: PrivacyTransformation[];

  maximumRecords: number;

  maximumDocuments: number;

  providerPolicyId: string;

  persistentMemoryAllowed: boolean;
};
```

---

# 38. Transformaciones de privacidad

```ts
export type PrivacyTransformation =
  | {
      type: "redact";
      field: string;
    }
  | {
      type: "pseudonymize";
      field: string;
    }
  | {
      type: "generalize";
      field: string;
    }
  | {
      type: "hash";
      field: string;
    }
  | {
      type: "aggregate";
      field: string;
    }
  | {
      type: "drop";
      field: string;
    };
```

---

# 39. Pseudonimización

Puede reemplazarse:

```text
Marta López
```

por:

```text
client_81
```

cuando la identidad no sea necesaria.

Puede generalizarse:

- Dirección completa → municipio.
- Fecha de nacimiento → rango.
- Importe exacto → tramo.
- IP completa → prefijo o hash, si sirve para la finalidad.

Los datos pseudonimizados siguen siendo personales si pueden reidentificarse.

---

# 40. Anonimización

No debe afirmarse que un dataset, embedding o modelo es anónimo sin evaluación.

La evaluación debe considerar:

- Identificación directa.
- Singularización.
- Vinculación.
- Inferencia.
- Extracción mediante consultas.
- Conocimiento auxiliar.
- Acceso de terceros.
- Medios razonablemente probables.
- Estado de la técnica.
- Costes y recursos.

El Dictamen 28/2024 del CEPD exige una valoración caso por caso para determinar si un modelo puede considerarse anónimo.

---

# 41. Anonymization Assessment

```ts
export type AnonymizationAssessment = {
  assetId: string;

  assetType:
    | "dataset"
    | "embedding_index"
    | "model"
    | "analytics_export";

  directIdentificationRisk: string;

  singlingOutRisk: string;

  linkabilityRisk: string;

  inferenceRisk: string;

  extractionRisk: string;

  attackerCapabilities: string[];

  mitigations: string[];

  conclusion:
    | "personal_data"
    | "pseudonymized"
    | "anonymous";

  approvedBy: string;
  approvedAt: string;
};
```

---

# 42. Data Minimization Service

```ts
export interface DataMinimizationService {
  project(
    data: unknown,
    projection: PrivacyProjection,
    context: PrivacyExecutionContext
  ): Promise<MinimizedData>;

  verify(
    minimized: MinimizedData,
    projection: PrivacyProjection
  ): Promise<MinimizationVerification>;
}
```

---

# 43. Privacy Execution Context

```ts
export type PrivacyExecutionContext = {
  tenantId: string;
  actorId: string;

  purposeId: string;
  purposeVersion: string;

  taskType: string;

  providerId?: string;

  workflowId?: string;

  traceId: string;
};
```

---

# 44. Model Privacy Routing

El Model Router debe considerar privacidad.

```ts
export type PrivacyRoutingRequirement = {
  purposeId: string;

  dataCategories: PersonalDataCategory[];

  sensitivity:
    | "low"
    | "medium"
    | "high"
    | "special";

  allowedProviders: string[];

  requiredRegion?: string;

  zeroRetentionRequired: boolean;

  trainingUseProhibited: boolean;

  localProcessingRequired: boolean;

  pseudonymizationRequired: boolean;

  customerSpecificRestrictions: string[];
};
```

---

# 45. Provider Privacy Registry

```ts
export type ProviderPrivacyProfile = {
  providerId: string;

  legalName: string;

  role:
    | "processor"
    | "subprocessor"
    | "independent_controller";

  allowedDataCategories: string[];

  prohibitedDataCategories: string[];

  processingRegions: string[];

  retentionMode: string;

  trainingUse:
    | "none"
    | "opt_out"
    | "possible"
    | "unknown";

  zeroRetentionAvailable: boolean;

  subprocessors: string[];

  transferMechanismIds: string[];

  contractReference: string;

  deletionApiAvailable: boolean;

  auditEvidenceReference?: string;

  approved: boolean;

  lastReviewedAt: string;
  nextReviewAt: string;
};
```

---

# 46. Proveedor técnicamente compatible no equivale a proveedor jurídicamente aprobado

Antes de activar un proveedor debe existir:

- Evaluación de rol.
- Contrato.
- Análisis de subencargados.
- Regiones.
- Retención.
- Uso para entrenamiento.
- Seguridad.
- Transferencias.
- Borrado.
- Derechos.
- Brechas.
- Auditoría.
- Política por categoría de datos.

---

# 47. Transferencias internacionales

```ts
export type InternationalTransfer = {
  id: string;

  providerId: string;

  destinationCountries: string[];

  purposeIds: string[];

  dataCategories: string[];

  legalMechanism:
    | "adequacy"
    | "standard_contractual_clauses"
    | "binding_corporate_rules"
    | "derogation"
    | "not_applicable";

  supplementaryMeasures: string[];

  transferImpactAssessmentReference?: string;

  approved: boolean;

  reviewedAt: string;
};
```

---

# 48. Transfer Impact Review

Debe revisar:

- Destino.
- Acceso gubernamental.
- Medidas técnicas.
- Cifrado.
- Gestión de claves.
- Pseudonimización.
- Capacidad del proveedor.
- Datos enviados.
- Necesidad.
- Riesgos.
- Medidas adicionales.

Codex debe representar el resultado, no decidir el mecanismo jurídico.

---

# 49. Privacy Context Filter

```text
CONTEXT CANDIDATE
  ↓
TENANT
  ↓
ACTOR
  ↓
PURPOSE
  ↓
FIELD POLICY
  ↓
MINIMIZATION
  ↓
PSEUDONYMIZATION
  ↓
PROVIDER POLICY
  ↓
CONTEXT BUDGET
  ↓
FINAL CONTEXT
```

```ts
export interface PrivacyContextFilter {
  filter(
    context: ModelContext,
    request: PersonalDataAccessRequest
  ): Promise<PrivacyFilteredContext>;
}
```

---

# 50. Privacy Budget

```ts
export type PrivacyBudget = {
  maximumSubjectsPerRun: number;

  maximumRecordsPerRun: number;

  maximumSensitiveFieldsPerRun: number;

  maximumDocumentsPerRun: number;

  maximumExternalProviders: number;

  maximumPersistentCopies: number;

  allowPersistentMemory: boolean;

  allowFullPromptLogging: boolean;
};
```

---

# 51. Privacy Budget Enforcement

Bloquear o degradar si:

- Se exceden personas.
- Se exceden documentos.
- Aparecen categorías prohibidas.
- Se necesita un proveedor no aprobado.
- Se intenta persistir memoria sin policy.
- Se intenta exportar demasiado.
- Se intenta acceder a datos no necesarios.

---

# 52. Privacidad en tools

Cada tool debe declarar:

- Finalidad.
- Campos de entrada.
- Campos de salida.
- Categorías de datos.
- Retención.
- Proveedor.
- Efectos.
- Log policy.
- Export policy.

```ts
export type ToolPrivacyProfile = {
  toolName: string;
  toolVersion: string;

  allowedPurposeIds: string[];

  inputDataCategories: string[];
  outputDataCategories: string[];

  fieldProjectionId: string;

  providerIds: string[];

  telemetryPolicyId: string;

  persistentOutput: boolean;

  retentionPolicyId?: string;
};
```

---

# 53. Tools de datos agregados

Preferir tools como:

```text
get_campaign_metrics
```

que devuelvan agregados.

Evitar para la misma tarea:

```text
get_all_customers_with_orders
```

si no es necesario.

---

# 54. Privacidad en RAG

Un fragmento puede ser relevante y seguir prohibido.

Filtros obligatorios:

- Tenant.
- Actor.
- Propósito.
- Expediente.
- Tipo documental.
- Sensibilidad.
- Rol.
- Provider compatibility.
- Retención.
- Estado.
- Vigencia.

---

# 55. Retrieval Privacy Policy

```ts
export type RetrievalPrivacyPolicy = {
  purposeId: string;

  allowedDocumentTypes: string[];

  prohibitedDocumentTypes: string[];

  maximumSensitivity:
    | "low"
    | "medium"
    | "high"
    | "special";

  fieldRedactions: string[];

  allowedProviderIds: string[];

  maximumChunks: number;

  persistentMemoryAllowed: boolean;
};
```

---

# 56. Privacidad en embeddings

Debe registrarse:

- Fuente.
- Tenant.
- Finalidad.
- Categorías.
- Modelo.
- Proveedor.
- Región.
- Versión.
- Índice.
- Retención.
- Método de eliminación.
- Datos derivados.

```ts
export type EmbeddingPrivacyRecord = {
  chunkId: string;

  tenantId: string;

  purposeIds: string[];

  dataCategories: string[];

  embeddingProviderId: string;
  embeddingModelId: string;

  processingRegion: string;

  retentionPolicyId: string;

  deletionStatus:
    | "active"
    | "scheduled"
    | "deleted"
    | "failed";
};
```

---

# 57. Eliminación de embeddings

Al borrar una fuente:

```text
DOCUMENT
  ↓
CHUNKS
  ↓
EMBEDDINGS
  ↓
VECTOR INDEX
  ↓
CACHE
  ↓
SUMMARY
  ↓
MEMORY
```

Debe verificarse que la fuente no vuelva a aparecer.

---

# 58. Privacidad en memoria

No toda conversación debe convertirse en memoria.

Antes de guardar:

- ¿Es necesario?
- ¿Es exacto?
- ¿Es del usuario o de un tercero?
- ¿Es una inferencia?
- ¿Es sensible?
- ¿Tiene vigencia?
- ¿Tiene finalidad?
- ¿Puede revocarse?
- ¿Puede eliminarse?
- ¿Está autorizado?

---

# 59. Privacy Memory Policy

```ts
export type PrivacyMemoryPolicy = {
  memoryType: string;

  allowedPurposeIds: string[];

  prohibitedDataCategories: string[];

  maximumRetentionDays: number;

  requiresExplicitPromotion: boolean;

  requiresUserControl: boolean;

  userDeletionSupported: boolean;

  providerIds: string[];

  redactForRetrieval: boolean;
};
```

---

# 60. Datos que no deben convertirse en memoria ordinaria

- Permisos.
- Roles.
- Consentimientos.
- Bases jurídicas.
- Datos bancarios.
- Documentos de identidad.
- Credenciales.
- Información de salud.
- Antecedentes.
- Aprobaciones financieras.
- Exenciones de controles.
- Información de terceros sin necesidad.

---

# 61. Memoria derivada e inferida

Ejemplo:

```text
El cliente parece tener prisa.
```

Debe guardarse, si procede, como inferencia:

- Con fuente.
- Con fecha.
- Con estado.
- Con finalidad.
- Con posibilidad de corrección.

No como hecho permanente.

---

# 62. Privacidad en logs y traces

Los logs pueden contener:

- Prompts.
- Outputs.
- Tool arguments.
- Documentos.
- Emails.
- DNI.
- IDs.
- Errores.
- URLs.
- Metadatos.
- Model responses.

Debe existir captura proporcional.

---

# 63. Telemetry Privacy Policy

```ts
export type TelemetryPrivacyPolicy = {
  id: string;

  captureInput:
    | "none"
    | "metadata"
    | "redacted"
    | "full";

  captureOutput:
    | "none"
    | "metadata"
    | "redacted"
    | "full";

  captureToolArguments:
    | "none"
    | "metadata"
    | "redacted"
    | "full";

  redactFields: string[];

  hashFields: string[];

  retentionDays: number;

  samplingRate: number;

  accessRoles: string[];

  exportAllowed: boolean;
};
```

---

# 64. Prohibiciones de telemetría

No registrar:

- Secretos.
- Access tokens.
- Refresh tokens.
- Contraseñas.
- Service-role keys.
- Datos completos innecesarios.
- Contenido restringido sin necesidad.
- Chain-of-thought privada.

---

# 65. Privacidad en cachés

La clave debe incluir contexto de autorización.

Ejemplo:

```text
tenant
+ actor scope
+ purpose
+ query
+ resource version
+ privacy policy version
```

No usar solo:

```text
hash(query)
```

---

# 66. Cache Privacy Record

```ts
export type PrivacyAwareCacheEntry = {
  key: string;

  tenantId: string;

  actorScopeHash: string;

  purposeId: string;

  privacyPolicyVersion: string;

  dataClassification: string;

  expiresAt: string;

  deletionSubjectReferences: string[];
};
```

---

# 67. Privacidad en evals

Los datasets deben aplicar:

- Minimización.
- Pseudonimización.
- Datos sintéticos.
- Acceso restringido.
- Versionado.
- Retención.
- Separación de producción.
- Borrado.
- Source references.
- Legal basis/purpose.

---

# 68. Eval Privacy Policy

```ts
export type EvalPrivacyPolicy = {
  datasetId: string;

  purposeId: string;

  allowedDataCategories: string[];

  syntheticPreferred: boolean;

  pseudonymizationRequired: boolean;

  productionDataAllowed: boolean;

  maximumRetentionDays: number;

  allowedReviewers: string[];

  providerIds: string[];
};
```

---

# 69. Privacidad en fine-tuning y distillation

No utilizar datos de producción para fine-tuning sin:

- Finalidad.
- Base jurídica.
- Información.
- Contrato.
- Minimización.
- Retención.
- Proveedor aprobado.
- Control de derechos.
- Eliminación.
- Análisis de impacto.
- Dataset governance.

No asumir que entrenar “para mejorar el servicio” es compatible automáticamente.

---

# 70. Privacidad en analítica

Distinguir:

- Analítica operacional necesaria.
- Analítica de producto.
- Marketing.
- Profiling.
- Seguridad.
- Experimentación.

Cada una puede requerir:

- Finalidad.
- Base.
- Aviso.
- Consentimiento o interés legítimo.
- Retención.
- Opt-out.
- Agregación.

---

# 71. Privacidad en soporte

El soporte puede acceder a datos amplios.

Controles:

- Just-in-time access.
- Ticket binding.
- Actor logging.
- Field masking.
- Expiración.
- Approval para datos sensibles.
- No acceso global permanente.
- Export restrictions.
- Review.

---

# 72. Privacidad en entornos no productivos

Prohibiciones:

- Copias completas de producción sin control.
- Datos reales en local por defecto.
- Dumps no cifrados.
- Secrets.
- Datos de clientes en tests unitarios.
- Logs copiados.

Preferir:

- Datos sintéticos.
- Pseudonimización irreversible en el entorno.
- Subconjuntos mínimos.
- Entornos segregados.
- Retención corta.
- Acceso limitado.

---

# 73. Retención

Cada finalidad y categoría debe tener una política.

```ts
export type RetentionPolicy = {
  id: string;
  version: string;

  purposeId: string;

  dataCategories: string[];

  activeRetentionDays: number;

  archiveRetentionDays?: number;

  deletionMode:
    | "hard_delete"
    | "anonymize"
    | "restrict"
    | "archive"
    | "legal_hold";

  derivedDataIncluded: boolean;

  providerDeletionRequired: boolean;

  backupDeletionDelayDays?: number;

  legalReference?: string;

  approvedBy: string;
};
```

---

# 74. Retention Trigger

La retención puede comenzar desde:

- Recogida.
- Fin del contrato.
- Última interacción.
- Cierre del expediente.
- Cumplimiento de obligación.
- Retirada de consentimiento.
- Finalización de servicio.
- Resolución de reclamación.

Debe definirse explícitamente.

---

# 75. Retention Schedule

```ts
export type RetentionSchedule = {
  resourceId: string;

  policyId: string;

  triggerType: string;
  triggerAt: string;

  deleteAt?: string;
  archiveAt?: string;
  reviewAt?: string;

  legalHoldId?: string;

  status:
    | "active"
    | "scheduled"
    | "blocked"
    | "completed"
    | "failed";
};
```

---

# 76. Legal Hold

```ts
export type LegalHold = {
  id: string;

  resourceIds: string[];

  reason: string;

  legalReference: string;

  createdBy: string;
  createdAt: string;

  expiresAt?: string;

  status:
    | "active"
    | "released";
};
```

El legal hold debe bloquear borrado, no conceder acceso adicional.

---

# 77. Bloqueo de datos

En España puede ser necesario aplicar bloqueo en determinados supuestos.

La arquitectura debe diferenciar:

- Dato activo.
- Dato restringido.
- Dato bloqueado.
- Dato archivado.
- Dato eliminado.

```ts
export type DataLifecycleStatus =
  | "active"
  | "restricted"
  | "blocked"
  | "archived"
  | "deleted";
```

La aplicación del bloqueo debe derivar de decisión jurídica documentada.

---

# 78. Deletion Graph

```ts
export type DataDeletionGraph = {
  subjectId: string;

  nodes: DataLocation[];

  dependencies: DataDependency[];

  legalBlocks: LegalRetentionBlock[];

  externalProviderNodes: ExternalDeletionNode[];

  backupNodes: BackupDeletionNode[];
};
```

---

# 79. Data Locations

Debe localizar:

- Tablas.
- Storage.
- Documents.
- Chunks.
- Embeddings.
- Vector indexes.
- Memory.
- Logs.
- Traces.
- Caches.
- Evals.
- Analytics.
- Exports.
- Backups.
- External providers.
- MCP.
- Email.
- Data warehouse.
- DLQ.

---

# 80. Deletion Workflow

```text
REQUEST
  ↓
IDENTITY / AUTHORITY
  ↓
SCOPE
  ↓
LEGAL EXCEPTIONS
  ↓
DELETION GRAPH
  ↓
ACTIVE DATA
  ↓
DERIVED DATA
  ↓
PROVIDERS
  ↓
CACHES
  ↓
BACKUPS / DELAY
  ↓
VERIFY
  ↓
RESPOND
  ↓
AUDIT
```

---

# 81. Deletion Result

```ts
export type DeletionResult = {
  requestId: string;

  deletedLocations: string[];

  anonymizedLocations: string[];

  restrictedLocations: string[];

  retainedLocations: {
    location: string;
    reason: string;
    reviewAt?: string;
  }[];

  failedLocations: string[];

  externalProviderResults: string[];

  verifiedAt: string;
};
```

---

# 82. Rectification Propagation

Rectificar un dato puede requerir actualizar:

- CRM.
- Documents.
- Derived summaries.
- Entity resolution.
- Memory.
- Search index.
- Embeddings.
- Caches.
- Evals.
- Provider copies.
- Automated decisions.

No debe cambiarse una fuente histórica firmada; puede requerirse una corrección vinculada.

---

# 83. Exactitud e inferencias

Diferenciar:

```text
CANONICAL FACT
```

de:

```text
MODEL INFERENCE
```

La UI debe etiquetar:

- Confirmado.
- No verificado.
- Inferido.
- Corregido.
- Rechazado.
- Obsoleto.

---

# 84. Derechos de los interesados

La arquitectura debe soportar, con requisitos jurídicos específicos:

- Acceso.
- Rectificación.
- Supresión.
- Limitación.
- Oposición.
- Portabilidad.
- Retirada del consentimiento.
- Revisión de decisiones automatizadas.
- Información.

No todos los derechos aplican de la misma forma en todos los casos.

El eligibility engine debe aplicar la norma y excepciones documentadas.

---

# 85. Data Subject Request Type

```ts
export type DataSubjectRequestType =
  | "access"
  | "rectification"
  | "erasure"
  | "restriction"
  | "objection"
  | "portability"
  | "withdraw_consent"
  | "automated_decision_review"
  | "information";
```

---

# 86. Data Subject Request

```ts
export type DataSubjectRequest = {
  id: string;

  controllerId: string;

  requestType: DataSubjectRequestType;

  subjectReference: string;

  identityVerificationStatus:
    | "pending"
    | "verified"
    | "failed";

  receivedAt: string;
  dueAt: string;

  extensionApplied: boolean;
  extensionReason?: string;

  status:
    | "received"
    | "verifying"
    | "processing"
    | "legal_review"
    | "completed"
    | "partially_completed"
    | "rejected";

  legalExceptions: string[];

  ownerId: string;
};
```

---

# 87. Verificación de identidad

Debe ser proporcional.

Evitar pedir más datos de los necesarios para ejercer un derecho.

Controles:

- Existing account authentication.
- Secure link.
- Document verification solo si es necesario.
- Representative authority.
- Audit.
- Expiration.

No enviar el resultado a una dirección no verificada.

---

# 88. Workflow de acceso

```text
VERIFY IDENTITY
  ↓
IDENTIFY CONTROLLER
  ↓
LOCATE DATA
  ↓
FILTER THIRD-PARTY DATA
  ↓
EXPLAIN SOURCES / PURPOSES / RECIPIENTS
  ↓
INCLUDE INFERENCES
  ↓
SECURE DELIVERY
  ↓
AUDIT
```

---

# 89. Export de acceso

Debe incluir, cuando proceda:

- Datos.
- Finalidades.
- Categorías.
- Destinatarios.
- Retención.
- Fuentes.
- Transferencias.
- Decisiones automatizadas.
- Derechos.
- Inferencias relacionadas.

Debe evitar revelar:

- Datos de terceros.
- Secretos empresariales de forma indebida.
- Seguridad sensible.
- Información fuera del alcance.

---

# 90. Portabilidad

La portabilidad debe evaluarse según:

- Base jurídica aplicable.
- Tratamiento automatizado.
- Datos proporcionados por el interesado.
- Derechos de terceros.
- Viabilidad técnica.

No debe tratarse como exportación global de todo el CRM.

---

# 91. Oposición

Debe activar:

- Evaluación de la finalidad.
- Evaluación de la base jurídica.
- Stop rules cuando proceda.
- Opt-out.
- Bloqueo de marketing.
- Actualización de proveedores.
- Auditoría.

---

# 92. Limitación

La limitación debe impedir nuevos usos sin borrar inmediatamente.

```ts
export type ProcessingRestriction = {
  subjectId: string;

  purposeIds: string[];

  reason: string;

  allowedOperations:
    | "storage_only"
    | "legal_claims_only"
    | "consent_only"
    | "public_interest_only";

  createdAt: string;
  releasedAt?: string;
};
```

---

# 93. Decisiones automatizadas y profiling

Debe identificarse si el sistema:

- Evalúa aspectos personales.
- Predice.
- Clasifica.
- Prioriza.
- Decide automáticamente.
- Produce efectos jurídicos.
- Afecta significativamente.
- Permite intervención humana real.
- Permite impugnación.

---

# 94. Automated Decision Registry

```ts
export type AutomatedDecisionDefinition = {
  id: string;

  name: string;

  purposeId: string;

  decisionType: string;

  inputCategories: string[];

  modelIds: string[];

  toolIds: string[];

  legalEffect: boolean;

  similarlySignificantEffect: boolean;

  humanReviewRequired: boolean;

  contestationSupported: boolean;

  explanationPolicyId: string;

  lawfulExceptionReference?: string;

  approved: boolean;
};
```

---

# 95. Intervención humana efectiva

No basta con:

- Pulsar “aceptar”.
- Revisar de forma rutinaria.
- No tener autoridad para cambiar.
- No disponer de información.
- Revisar después del efecto irreversible.

El revisor debe:

- Comprender el caso.
- Acceder a evidencia.
- Poder modificar o revertir.
- Tener autoridad.
- No depender ciegamente del score.
- Dejar razonamiento.

---

# 96. Automated Decision Review

```ts
export type AutomatedDecisionReview = {
  decisionId: string;

  subjectId: string;

  originalDecision: unknown;

  mainFactors: string[];

  sourceReferences: string[];

  reviewerId: string;

  reviewerAuthority: string[];

  outcome:
    | "confirmed"
    | "modified"
    | "reversed";

  reviewReasoning: string;

  reviewedAt: string;
};
```

---

# 97. Explicabilidad de decisiones personales

Debe poder explicar:

- Qué decisión se tomó.
- Qué datos se utilizaron.
- Qué fuentes.
- Qué factores principales.
- Qué modelo/configuración.
- Qué límites.
- Qué revisión existe.
- Cómo impugnar.

No debe revelarse chain-of-thought privada.

---

# 98. DPIA / EIPD

Debe realizarse antes del tratamiento cuando sea probable alto riesgo.

La EIPD debe incluir, al menos:

- Descripción sistemática.
- Finalidades.
- Interés legítimo, si procede.
- Necesidad.
- Proporcionalidad.
- Riesgos para derechos y libertades.
- Medidas para afrontarlos.
- Evidencias.
- Riesgo residual.
- Consulta a DPD.
- Decisión.

---

# 99. DPIA Trigger Assessment

```ts
export type DpiaAssessment = {
  processingActivityId: string;

  newTechnology: boolean;

  systematicEvaluation: boolean;

  automatedDecisionEffects: boolean;

  largeScaleMonitoring: boolean;

  specialCategoryData: boolean;

  criminalData: boolean;

  vulnerableSubjects: boolean;

  dataMatching: boolean;

  innovativeUse: boolean;

  preventsRightsOrServices: boolean;

  largeScaleData: boolean;

  riskLevel:
    | "low"
    | "medium"
    | "high";

  dpiaRequired: boolean;

  reasons: string[];

  reviewedBy: string;
};
```

---

# 100. DPIA como objeto vivo

```ts
export type DpiaRecord = {
  id: string;

  processingActivityId: string;

  version: string;

  systemVersions: string[];

  modelVersions: string[];

  providerVersions: string[];

  riskScenarios: string[];

  controls: string[];

  residualRisk: string;

  consultationRequired: boolean;

  status:
    | "draft"
    | "approved"
    | "review_required"
    | "superseded";

  approvedBy: string;

  reviewedAt: string;
  nextReviewAt: string;
};
```

---

# 101. Change Impact Assessment

Debe reabrirse el análisis si cambia:

- Finalidad.
- Base.
- Modelo.
- Proveedor.
- Región.
- Retención.
- Datos.
- Tool.
- Autonomía.
- Integración.
- Memoria.
- RAG.
- Seguridad.
- Número de personas.
- Decisión automatizada.
- Customer configuration.

---

# 102. Privacy Change Event

```ts
export type PrivacyChangeEvent = {
  componentType: string;
  componentId: string;

  oldVersion: string;
  newVersion: string;

  affectedPurposeIds: string[];

  affectedDataCategories: string[];

  affectedProviders: string[];

  requiresPrivacyReview: boolean;
  requiresContractReview: boolean;
  requiresNoticeUpdate: boolean;
  requiresDpiaReview: boolean;
};
```

---

# 103. Privacy Gate para releases

Antes del release:

- Compare data flows.
- Compare providers.
- Compare prompts.
- Compare tools.
- Compare retention.
- Compare memory.
- Compare telemetry.
- Compare decisions.
- Detect new purpose.
- Detect increased autonomy.
- Detect new data category.

---

# 104. Privacy Notice

La información debe ser:

- Concisa.
- Transparente.
- Comprensible.
- Accesible.
- Específica.
- Versionada.
- Adaptada al canal.

Debe explicar:

- Responsable.
- Finalidad.
- Base.
- Destinatarios.
- Transferencias.
- Retención.
- Derechos.
- Fuente.
- Decisiones automatizadas.
- Contacto del DPD cuando proceda.

---

# 105. Privacy Notice Version

```ts
export type PrivacyNoticeVersion = {
  id: string;

  version: string;

  applicablePurposeIds: string[];

  contentReference: string;

  effectiveFrom: string;
  effectiveUntil?: string;

  languages: string[];

  channels: string[];

  approvedBy: string;

  active: boolean;
};
```

---

# 106. Transparencia en agentes

Debe informarse cuando proceda de:

- Interacción con IA.
- Uso de agentes.
- Fuentes utilizadas.
- Uso de datos.
- Acciones automáticas.
- Supervisión humana.
- Límites.
- Contacto y derechos.

No basta:

```text
Usamos IA para mejorar la experiencia.
```

---

# 107. Privacy en IA agéntica

Un agente puede:

- Percibir datos.
- Enriquecerlos.
- Planificar.
- Consultar herramientas.
- Ejecutar.
- Persistir.
- Delegar.
- Aprender mediante memoria.

El tratamiento debe analizar el sistema completo:

```text
AGENT
+ MODEL
+ CONTEXT
+ RAG
+ MEMORY
+ TOOLS
+ WORKFLOWS
+ PROVIDERS
+ TELEMETRY
```

No solo la llamada al modelo.

---

# 108. Data Extraction Flow Control

Debe existir control sobre cuándo un agente extrae información de un sistema.

```ts
export type DataExtractionPolicy = {
  sourceSystemId: string;

  purposeId: string;

  allowedFields: string[];

  maximumRecords: number;

  maximumFrequency: number;

  bulkAccessRequiresApproval: boolean;

  exportAllowed: boolean;

  providerIds: string[];
};
```

---

# 109. Bulk Operations

Las operaciones masivas requieren:

- Finalidad.
- Permission.
- Data scope.
- Maximum records.
- Approval.
- Step-up auth.
- Watermark.
- Expiring download.
- Audit.
- DLP.
- Provider prohibition.

```ts
export type BulkPersonalDataPolicy = {
  maximumRecordsWithoutApproval: number;

  exportAllowed: boolean;

  requiredRoles: string[];

  requiresStepUpAuth: boolean;

  fileExpirationHours: number;

  watermarkRequired: boolean;

  downloadAuditRequired: boolean;
};
```

---

# 110. DPO / DPD Review Trigger

```ts
export type DpoReviewTrigger = {
  processingActivityId: string;

  publicAuthorityContext: boolean;

  largeScaleMonitoring: boolean;

  largeScaleSpecialCategoryData: boolean;

  highRiskProcessing: boolean;

  automatedDecisionImpact: boolean;

  dpiaRequired: boolean;

  reviewRequired: boolean;
};
```

La obligación formal de designación debe determinarse jurídicamente conforme al artículo 37 y normativa aplicable.

---

# 111. Seguridad del tratamiento

El artículo 32 exige medidas apropiadas al riesgo.

Privacy Engineering debe consumir evidencia de Security Engineering:

- Encryption.
- Access control.
- Availability.
- Resilience.
- Recovery.
- Testing.
- Incident response.
- Tenant isolation.
- Secret management.

No duplicar dos sistemas de riesgo incompatibles.

---

# 112. Brechas de datos personales

Debe distinguirse:

- Incidente de seguridad.
- Brecha de confidencialidad.
- Brecha de integridad.
- Brecha de disponibilidad.
- Brecha de datos personales.
- Incidente algorítmico sin datos personales.

---

# 113. Breach Record

```ts
export type PersonalDataBreach = {
  id: string;

  detectedAt: string;
  awarenessAt?: string;

  controllerId: string;

  processorIds: string[];

  breachType:
    | "confidentiality"
    | "integrity"
    | "availability"
    | "mixed";

  affectedDataCategories: string[];

  affectedSubjectCategories: string[];

  estimatedSubjects: number;

  likelyRisk:
    | "unlikely"
    | "risk"
    | "high_risk";

  supervisoryNotificationRequired: boolean;

  dataSubjectCommunicationRequired: boolean;

  notificationDeadlineAt?: string;

  status:
    | "detected"
    | "assessing"
    | "contained"
    | "notified"
    | "closed";

  ownerId: string;
};
```

---

# 114. Regla de 72 horas

Cuando el responsable sea consciente de una brecha de datos personales, debe evaluarse sin dilación si procede notificar a la autoridad.

Cuando sea exigible, la notificación debe hacerse sin dilación indebida y, cuando sea posible, dentro de las 72 horas.

El encargado debe informar al responsable sin dilación indebida.

Codex debe:

- Registrar `awarenessAt`.
- Calcular deadline.
- Alertar.
- No decidir jurídicamente por sí solo que no existe riesgo.
- Permitir decisión documentada.
- Conservar evidencia.

---

# 115. Breach Workflow

```text
DETECT
  ↓
CONTAIN
  ↓
SET AWARENESS TIME
  ↓
IDENTIFY DATA / SUBJECTS
  ↓
ASSESS RISK
  ↓
NOTIFY CONTROLLER
  ↓
DECIDE AUTHORITY NOTIFICATION
  ↓
DECIDE SUBJECT COMMUNICATION
  ↓
REMEDIATE
  ↓
DOCUMENT
  ↓
POSTMORTEM
```

---

# 116. Breach Evidence

Debe conservar:

- Qué ocurrió.
- Fecha.
- Awareness.
- Sistemas.
- Datos.
- Personas.
- Impacto.
- Contención.
- Decisiones.
- Notificaciones.
- Comunicación.
- Medidas.
- Timeline.
- Owners.

---

# 117. Privacy Incident Metrics

```text
personal_data_breaches_total
breach_awareness_to_assessment_ms
breach_notification_deadline_risk_total
processor_notification_delay_ms
data_subject_communication_total
deletion_failures_total
provider_deletion_failures_total
rights_deadline_risk_total
privacy_policy_denials_total
wrong_purpose_attempt_total
```

---

# 118. Aplicación a NORA

NORA puede tratar:

- Nombre.
- Email.
- Teléfono.
- DNI.
- NIE.
- Pasaporte.
- Nacionalidad.
- Residencia.
- Estado civil.
- Titularidad.
- Ingresos.
- Financiación.
- Datos de inmueble.
- Documentos.
- Pagos.
- Origen de fondos, cuando proceda.

Debe separar tratamientos por módulos.

---

# 119. NORA: finalidades separadas

Ejemplos:

- Registro de usuario.
- Gestión de suscripción.
- Estudio fiscal.
- CRM inmobiliario.
- Reserva.
- Firma.
- Servicio NIE.
- Licencia turística.
- Facturación.
- Soporte.
- Seguridad.
- Marketing.
- Playbook.

No usar una finalidad única “prestación del servicio”.

---

# 120. NORA: estudio fiscal

El input debería minimizarse a:

- Comunidad autónoma.
- Tipo de inmueble.
- Precio.
- Perfil relevante para beneficios.
- Titularidad.
- Circunstancias fiscales necesarias.
- Financiación cuando afecte a costes.

No necesita siempre:

- Pasaporte.
- Cuenta bancaria.
- Documento completo.
- Teléfono.
- Dirección exacta.
- Email.

---

# 121. NORA: servicio jurídico

Puede necesitar documentos más sensibles.

Aplicar:

- `service_case_id`.
- Purpose binding.
- Legal-team roles.
- Restricted storage.
- Provider routing.
- Telemetry redaction.
- Retention.
- Export controls.
- Audit.
- Deletion graph.

---

# 122. NORA: Playbook Inteligente

Los documentos empresariales pueden incluir datos de:

- Clientes.
- Empleados.
- Proveedores.
- Firmantes.
- Casos reales.

Antes de indexar:

- Classify.
- Detect personal data.
- Redact when appropriate.
- Define purpose.
- Define access.
- Define retention.
- Define provider.
- Define deletion.

---

# 123. NORA: CRM

El agente comercial debe recibir:

- Datos de contacto necesarios.
- Operación.
- Tareas.
- Comunicaciones autorizadas.

No debe recibir por defecto:

- Pasaporte.
- Datos bancarios.
- Notas legales restringidas.
- Documentos sensibles.
- Datos de otros agentes.

---

# 124. Aplicación a EcomScaling IA

Puede recibir datos de:

- Shopify.
- Meta.
- Klaviyo.
- Pedidos.
- Audiencias.
- Clientes.
- Emails.
- Teléfonos.
- Historial de compra.
- Eventos publicitarios.

Debe distinguir:

```text
AGGREGATED METRICS
```

de:

```text
INDIVIDUAL PERSONAL DATA
```

---

# 125. EcomScaling: agregación por defecto

Para analizar campañas, preferir:

```ts
{
  campaignId,
  spend,
  revenue,
  purchases,
  margin,
  period
}
```

No:

```ts
{
  customers: [
    {
      name,
      email,
      phone,
      orders
    }
  ]
}
```

---

# 126. EcomScaling: audiences

El tratamiento de audiencias puede implicar:

- Identificadores.
- Hashes.
- Matching.
- Profiling.
- Transferencias.
- Roles de plataformas.
- Marketing.
- Consentimiento o interés legítimo.

Debe existir revisión específica.

No asumir que un hash deja de ser dato personal.

---

# 127. EcomScaling: memoria de tienda

La memoria debe almacenar preferentemente:

- Configuración de negocio.
- Márgenes.
- Objetivos.
- Decisiones aprobadas.
- Reglas de operación.

Debe evitar:

- Datos individuales de compradores.
- Listas de emails.
- Información personal no necesaria.
- Inferencias permanentes sobre clientes.

---

# 128. Aplicación al CRM

El CRM contiene:

- Leads.
- Clientes.
- Comunicaciones.
- Documentos.
- Llamadas.
- Tareas.
- Reservas.
- Pagos.
- Datos de empleados.
- Notas.

El copiloto debe recibir una proyección por:

- Rol.
- Finalidad.
- Expediente.
- Tool.
- Acción.
- Sensibilidad.

---

# 129. CRM: matrices por rol

Ejemplo conceptual:

## Comercial

- Contacto.
- Operación.
- Tareas.
- Historial comercial permitido.

## Administración

- Pagos.
- Facturación.
- Documentación operativa.

## Legal

- Documentación jurídica autorizada.
- Incidencias.
- Contratos.

## Dirección

- Métricas agregadas.
- Casos específicos autorizados.

## Soporte

- Acceso temporal.
- Datos mínimos.
- Ticket binding.

---

# 130. CRM: grabaciones y transcripciones

Si existen llamadas:

- Informar.
- Definir base.
- Definir finalidad.
- Definir retención.
- Controlar proveedor.
- Minimizar transcripción.
- Redactar.
- Controlar acceso.
- Eliminar audio si no es necesario.
- Gestionar derechos.

---

# 131. Privacy Risk Levels

```ts
export type PrivacyRiskLevel =
  | "public"
  | "internal"
  | "personal"
  | "sensitive"
  | "high_impact";
```

---

# 132. Privacy Engineering Profile

```ts
export type PrivacyEngineeringProfile = {
  purposeId: string;

  riskLevel: PrivacyRiskLevel;

  allowedDataCategories: string[];

  prohibitedDataCategories: string[];

  minimizationPolicyId: string;

  providerPolicyId: string;

  retentionPolicyId: string;

  telemetryPolicyId: string;

  requiresDpia: boolean;

  requiresHumanReview: boolean;

  rightsSupported: DataSubjectRequestType[];
};
```

---

# 133. Arquitectura técnica propuesta

```text
src/
  privacy/
    privacy.types.ts
    privacy.config.ts

    purposes/
      purpose.registry.ts
      purpose-binding.service.ts
      lawful-basis.registry.ts
      secondary-purpose.service.ts

    processing/
      processing-activity.registry.ts
      controller-processor.service.ts
      processing-inventory.service.ts
      data-flow.service.ts

    classification/
      personal-data.registry.ts
      field-classification.service.ts
      special-category.policy.ts
      criminal-data.policy.ts

    minimization/
      privacy-projection.registry.ts
      data-minimization.service.ts
      pseudonymization.service.ts
      redaction.service.ts
      aggregation.service.ts

    routing/
      provider-privacy.registry.ts
      privacy-routing.service.ts
      international-transfer.service.ts
      subprocessor.service.ts

    context/
      privacy-context-filter.ts
      privacy-budget.service.ts

    consent/
      consent.service.ts
      consent-evidence.repository.ts
      consent-withdrawal.service.ts
      legitimate-interest.service.ts

    retention/
      retention-policy.registry.ts
      retention-runner.ts
      legal-hold.service.ts
      data-blocking.service.ts
      deletion-graph.service.ts
      deletion-verification.service.ts

    rights/
      data-subject-request.service.ts
      identity-verification.service.ts
      access-export.service.ts
      rectification.service.ts
      erasure.service.ts
      restriction.service.ts
      objection.service.ts
      portability.service.ts

    decisions/
      automated-decision.registry.ts
      human-review.service.ts
      contestation.service.ts
      explanation.service.ts

    impact/
      dpia.service.ts
      dpia-trigger.service.ts
      risk-assessment.service.ts
      change-impact.service.ts

    notices/
      privacy-notice.registry.ts
      transparency.service.ts

    telemetry/
      telemetry-privacy.policy.ts
      log-redaction.service.ts
      cache-privacy.service.ts

    memory/
      privacy-memory.policy.ts
      memory-deletion.service.ts

    rag/
      retrieval-privacy.service.ts
      embedding-privacy.service.ts

    providers/
      provider-privacy.repository.ts
      processor-contract.service.ts
      transfer-impact.service.ts

    incidents/
      personal-data-breach.service.ts
      breach-risk-assessment.service.ts
      breach-notification.service.ts

    audit/
      privacy-audit.service.ts
      accountability-evidence.service.ts

    evaluation/
      privacy-eval.service.ts
      privacy-regression-gate.ts

    tests/
    evals/

    adapters/
      nora/
      ecommerce/
      crm/
```

Adaptar a la estructura real.

---

# 134. Persistencia orientativa

Posibles tablas:

```text
privacy_processing_purposes
privacy_lawful_bases
privacy_legitimate_interest_assessments
privacy_processing_activities
privacy_processing_parties
privacy_subprocessors
privacy_data_fields
privacy_field_policies
privacy_projections
privacy_provider_profiles
privacy_international_transfers
privacy_consents
privacy_notice_versions
privacy_retention_policies
privacy_retention_schedules
privacy_legal_holds
privacy_data_subject_requests
privacy_processing_restrictions
privacy_automated_decisions
privacy_automated_decision_reviews
privacy_dpia_assessments
privacy_dpia_records
privacy_change_events
privacy_personal_data_breaches
privacy_audit_events
privacy_exceptions
```

No crear sin analizar el esquema existente.

---

# 135. Purpose Table orientativa

```sql
CREATE TABLE privacy_processing_purposes (
  id uuid PRIMARY KEY,

  purpose_key text NOT NULL,

  version text NOT NULL,

  name text NOT NULL,

  description text NOT NULL,

  product text NOT NULL,

  lawful_basis_id uuid NOT NULL,

  controller_id uuid NOT NULL,

  retention_policy_id uuid NOT NULL,

  notice_version_id uuid NOT NULL,

  active boolean NOT NULL DEFAULT true,

  approved_by uuid NOT NULL,

  approved_at timestamptz NOT NULL,

  UNIQUE (purpose_key, version)
);
```

---

# 136. Personal Data Field Table orientativa

```sql
CREATE TABLE privacy_data_fields (
  id uuid PRIMARY KEY,

  system_id text NOT NULL,

  table_or_store text NOT NULL,

  field_path text NOT NULL,

  category text NOT NULL,

  sensitivity text NOT NULL,

  purposes jsonb NOT NULL,

  allowed_providers jsonb NOT NULL,

  retention_policy_id uuid NOT NULL,

  redact_for_model boolean NOT NULL,

  redact_for_logs boolean NOT NULL,

  allowed_in_memory boolean NOT NULL,

  allowed_in_evals boolean NOT NULL,

  UNIQUE (system_id, table_or_store, field_path)
);
```

---

# 137. Provider Profile Table orientativa

```sql
CREATE TABLE privacy_provider_profiles (
  provider_id text PRIMARY KEY,

  legal_name text NOT NULL,

  role text NOT NULL,

  allowed_data_categories jsonb NOT NULL,

  prohibited_data_categories jsonb NOT NULL,

  processing_regions jsonb NOT NULL,

  retention_mode text NOT NULL,

  training_use text NOT NULL,

  zero_retention_available boolean NOT NULL,

  subprocessors jsonb NOT NULL,

  transfer_mechanism_ids jsonb NOT NULL,

  contract_reference text NOT NULL,

  approved boolean NOT NULL,

  last_reviewed_at timestamptz NOT NULL,

  next_review_at timestamptz NOT NULL
);
```

---

# 138. Retention Table orientativa

```sql
CREATE TABLE privacy_retention_policies (
  id uuid PRIMARY KEY,

  policy_key text NOT NULL,

  version text NOT NULL,

  purpose_id uuid NOT NULL,

  data_categories jsonb NOT NULL,

  active_retention_days integer NOT NULL,

  archive_retention_days integer,

  deletion_mode text NOT NULL,

  derived_data_included boolean NOT NULL,

  provider_deletion_required boolean NOT NULL,

  backup_deletion_delay_days integer,

  approved_by uuid NOT NULL,

  UNIQUE (policy_key, version)
);
```

---

# 139. Data Subject Request Table orientativa

```sql
CREATE TABLE privacy_data_subject_requests (
  id uuid PRIMARY KEY,

  controller_id uuid NOT NULL,

  request_type text NOT NULL,

  subject_reference text NOT NULL,

  identity_verification_status text NOT NULL,

  received_at timestamptz NOT NULL,

  due_at timestamptz NOT NULL,

  extension_applied boolean NOT NULL DEFAULT false,

  extension_reason text,

  status text NOT NULL,

  legal_exceptions jsonb NOT NULL DEFAULT '[]',

  owner_id uuid NOT NULL
);
```

---

# 140. Breach Table orientativa

```sql
CREATE TABLE privacy_personal_data_breaches (
  id uuid PRIMARY KEY,

  detected_at timestamptz NOT NULL,

  awareness_at timestamptz,

  controller_id uuid NOT NULL,

  breach_type text NOT NULL,

  affected_data_categories jsonb NOT NULL,

  affected_subject_categories jsonb NOT NULL,

  estimated_subjects integer,

  likely_risk text,

  supervisory_notification_required boolean,

  data_subject_communication_required boolean,

  notification_deadline_at timestamptz,

  status text NOT NULL,

  owner_id uuid NOT NULL
);
```

---

# 141. Privacy Audit Event

```ts
export type PrivacyAuditEvent = {
  id: string;

  eventType: string;

  tenantId?: string;
  actorId?: string;
  subjectId?: string;

  purposeId?: string;

  resourceType?: string;
  resourceId?: string;

  decision:
    | "allowed"
    | "denied"
    | "redacted"
    | "deleted"
    | "restricted"
    | "exported";

  reasonCodes: string[];

  policyVersion: string;

  traceId: string;

  createdAt: string;
};
```

---

# 142. Accountability Evidence

```ts
export type AccountabilityEvidence = {
  id: string;

  evidenceType:
    | "policy"
    | "test"
    | "approval"
    | "contract"
    | "dpia"
    | "risk_assessment"
    | "deletion_verification"
    | "rights_response"
    | "breach_record";

  reference: string;

  purposeIds: string[];

  systemVersions: string[];

  createdAt: string;

  validUntil?: string;
};
```

---

# 143. Métricas técnicas

```text
personal_data_model_calls_total
sensitive_data_model_calls_total
privacy_redactions_total
privacy_pseudonymizations_total
privacy_policy_denials_total
wrong_purpose_attempt_total
provider_privacy_denials_total
memory_privacy_denials_total
rag_privacy_denials_total
bulk_export_requests_total
```

---

# 144. Métricas de retención y derechos

```text
retention_deletions_total
retention_deletion_failures_total
provider_deletion_failures_total
data_subject_requests_total
data_subject_request_duration_ms
data_subject_request_deadline_risk_total
rectification_propagation_failures_total
consent_withdrawals_total
restriction_requests_total
```

---

# 145. Métricas de EIPD y governance

```text
processing_activities_total
processing_activities_without_owner
processing_activities_without_lawful_basis
processing_activities_without_retention
dpia_required_total
dpia_overdue_review_total
privacy_change_review_pending_total
unapproved_providers_total
expired_provider_reviews_total
```

---

# 146. Alertas críticas

- Cross-tenant privacy exposure.
- Sensitive data sent to prohibited provider.
- Deleted data resurfaced.
- Data subject export sent to wrong recipient.
- Personal data breach deadline risk.
- Model provider used without approval.
- RLS bypass.
- Restricted data in logs.
- Consent-withdrawn processing continues.
- Legal hold violated.

---

# 147. Alertas altas

- Rights request approaching deadline.
- Provider deletion failed.
- Retention job failed.
- New purpose without review.
- DPIA review overdue.
- Memory contains prohibited data.
- Evals contain production identifiers.
- Bulk export anomaly.
- Privacy notice version mismatch.
- Transfer mechanism missing.

---

# 148. Alertas medias

- Data field without classification.
- Purpose without owner.
- Stale consent evidence.
- Old provider review.
- Excessive full-prompt logging.
- Cache entries without purpose.
- Data inference unverified too long.
- Deletion graph incomplete.

---

# 149. Unit Tests

- Purpose binding.
- Lawful-basis lookup.
- Consent status.
- Legitimate-interest status.
- Field classification.
- Projection.
- Redaction.
- Pseudonymization.
- Provider eligibility.
- Retention dates.
- Legal hold.
- Rights eligibility.
- Deletion graph.
- DPIA trigger.
- Breach deadline.
- Cache key isolation.

---

# 150. Integration Tests

- Model context minimization.
- RAG privacy filtering.
- Memory promotion.
- Memory deletion.
- Provider routing.
- Consent withdrawal.
- Rights export.
- Rectification propagation.
- Erasure propagation.
- Provider deletion.
- Backup tombstone.
- Automated-decision review.
- Breach workflow.
- Telemetry redaction.

---

# 151. Cross-Tenant Privacy Tests

- Read another tenant.
- RAG another tenant.
- Memory another tenant.
- Cache collision.
- Export another tenant.
- Workflow resume.
- Support access.
- Provider connection ID.
- Storage download.
- Data subject request scope.
- Analytics aggregation.
- Evals lookup.
- Logs.
- Backups.

---

# 152. Wrong-Purpose Tests

- Support purpose requests marketing data.
- Fiscal-study purpose requests passport image.
- Campaign-analysis purpose requests customer identities.
- Security purpose used for commercial profiling.
- Playbook purpose accesses client case.
- CRM drafting purpose accesses bank account.
- Legal purpose reused for model training.

Expected:

```text
deny
```

o:

```text
minimize / require review
```

según policy.

---

# 153. Rights Tests

- Access.
- Rectification.
- Erasure.
- Restriction.
- Objection.
- Portability.
- Consent withdrawal.
- Automated-decision review.
- Third-party filtering.
- Legal exceptions.
- Identity failure.
- Deadline.
- Extension.
- Secure delivery.

---

# 154. Deletion Tests

- Primary DB.
- Storage.
- Chunks.
- Embeddings.
- Vector index.
- Memory.
- Cache.
- Logs.
- Evals.
- Analytics.
- Provider.
- Backup delay.
- Legal hold.
- Failure retry.
- Verification.

---

# 155. EIPD Tests

- Trigger detection.
- New provider.
- New special data.
- Large scale.
- Profiling.
- Automated decision.
- Vulnerable subjects.
- New purpose.
- Memory activation.
- Model migration.
- New tool.
- Increased autonomy.

---

# 156. Privacy Evals

Evaluar:

- Correct purpose.
- Data minimization.
- Field leakage.
- Provider routing.
- Retention.
- Rights discovery.
- Rectification.
- Deletion.
- Memory.
- RAG.
- Logs.
- Caches.
- Automated-decision handling.
- Transparency.
- No-answer when data prohibited.

---

# 157. Privacy Eval Case

```ts
export type PrivacyEvalCase = {
  id: string;

  taskType: string;

  purposeId: string;

  actorRole: string;

  tenantId: string;

  inputDataCategories: string[];

  expectedAllowedFields: string[];

  expectedRedactedFields: string[];

  expectedDecision:
    | "allow"
    | "minimize"
    | "review"
    | "deny";

  expectedProviderIds: string[];

  expectedMemoryAllowed: boolean;
};
```

---

# 158. Privacy Regression Gate

Bloquear release si:

- Aumenta sensitive-data leakage.
- Disminuye minimización.
- Provider routing viola policy.
- RAG devuelve documento prohibido.
- Memory persiste dato prohibido.
- Logs contienen campos restringidos.
- Rights workflow falla.
- Deletion propagation falla.
- Cross-tenant falla.
- Nueva finalidad no aprobada.
- EIPD necesaria no revisada.

---

# 159. Quality Gates

Bloquear release si:

- Falta finalidad.
- Falta base jurídica documentada.
- Falta owner.
- Falta data classification.
- Falta minimización.
- Falta provider profile.
- Falta retention.
- Falta deletion workflow.
- Falta rights workflow.
- Falta telemetry policy.
- Falta memory policy.
- Falta RAG policy.
- Falta change review.
- Falta DPIA assessment.
- Falta cross-tenant test.
- Existe proveedor no aprobado.
- Existe finding crítica.
- No existe rollback.

---

# 160. Fase 0 — Análisis exhaustivo

Analizar:

- Products.
- Purposes.
- Bases.
- Roles.
- Data.
- Fields.
- Providers.
- Transfers.
- RAG.
- Memory.
- Logs.
- Caches.
- Evals.
- Retention.
- Rights.
- Decisions.
- DPIA.
- Breaches.

Entregables:

- Inventarios.
- Matrices.
- Data-flow diagrams.
- Gaps.
- Arquitectura.
- Persistencia.
- Fases.
- Tests.
- Evals.
- Metrics.
- Alerts.
- Open legal decisions.

No implementar todavía.

---

# 161. Fase 1 — Purpose and Processing Registry

Implementar:

- ProcessingPurpose.
- LawfulBasisRecord.
- ProcessingActivity.
- ProcessingParty.
- Purpose binding.
- Owner.
- Audit.

---

# 162. Fase 2 — Data Inventory

Implementar:

- Field registry.
- Categories.
- Sensitivity.
- Sources.
- Purposes.
- Provider allowlists.
- Retention links.

---

# 163. Fase 3 — Minimization

Implementar:

- Privacy projections.
- Redaction.
- Pseudonymization.
- Aggregation.
- Context filter.
- Tests.

---

# 164. Fase 4 — Provider Privacy

Implementar:

- Provider registry.
- Subprocessors.
- Regions.
- Retention.
- Training-use policy.
- Transfer records.
- Routing.

---

# 165. Fase 5 — Telemetry, RAG and Memory

Implementar:

- Log policies.
- Cache privacy.
- RAG privacy filters.
- Embedding records.
- Memory policies.
- Deletion hooks.

---

# 166. Fase 6 — Retention

Implementar:

- Retention policies.
- Schedules.
- Legal holds.
- Blocking.
- Deletion graph.
- Verification.

---

# 167. Fase 7 — Rights

Implementar:

- DSR intake.
- Identity verification.
- Access.
- Rectification.
- Erasure.
- Restriction.
- Objection.
- Portability.
- Secure delivery.

---

# 168. Fase 8 — Automated Decisions

Implementar:

- Registry.
- Profiling detection.
- Human review.
- Contestation.
- Explanation evidence.

---

# 169. Fase 9 — Risk and DPIA

Implementar:

- Risk assessment.
- DPIA trigger.
- DPIA records.
- Change impact.
- Release gate.

---

# 170. Fase 10 — Consent and Transparency

Implementar:

- Consent evidence.
- Withdrawal.
- Notices.
- Versioning.
- User controls.

---

# 171. Fase 11 — Breach Management

Implementar:

- Awareness timestamp.
- Breach record.
- Risk assessment.
- Deadlines.
- Processor notification.
- Authority workflow.
- Subject communication workflow.
- Evidence.

---

# 172. Fase 12 — Evals and Audit

Implementar:

- Privacy eval dataset.
- Regression gate.
- Accountability evidence.
- Dashboards.
- Alerts.

---

# 173. Fase 13 — Segundo producto

Reutilizar núcleo y adaptar:

- Purposes.
- Data fields.
- Providers.
- Retention.
- Rights.
- DPIA.
- Product-specific tests.

---

# 174. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura transversal de Privacy & Data Protection Engineering adaptada al SaaS real.

## Regla obligatoria

Antes de implementar, analiza:

- Productos.
- Finalidades.
- Bases jurídicas documentadas.
- Roles.
- Datos.
- Campos.
- Tenants.
- Providers.
- Transfers.
- RAG.
- Embeddings.
- Memory.
- Logs.
- Caches.
- Evals.
- Rights.
- Retention.
- Decisions.
- DPIA.
- Breaches.

## Restricciones

1. No implementar antes del análisis.
2. No inventar bases jurídicas.
3. No asumir consentimiento.
4. No asumir roles jurídicos.
5. No enviar datos innecesarios.
6. No tratar pseudonimización como anonimización.
7. No usar proveedores no aprobados.
8. No persistir memoria por defecto.
9. No registrar prompts completos por defecto.
10. No crear cachés sin tenant y purpose.
11. No borrar solo la tabla principal.
12. No ignorar datos derivados.
13. No ignorar backups.
14. No ignorar proveedores.
15. No ejecutar decisiones sensibles sin revisión.
16. No marcar terminado sin rights/deletion tests.
17. Documentar cuestiones jurídicas abiertas.
18. Adaptar al producto real.

---

# 175. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura de Privacy & Data Protection Engineering adaptada al sistema real.

No implementes todavía nuevas tablas ni workflows.

Objetivos:

1. Identificar productos.
2. Identificar features.
3. Identificar tratamientos.
4. Identificar finalidades.
5. Identificar bases jurídicas documentadas.
6. Identificar responsables.
7. Identificar encargados.
8. Identificar corresponsables.
9. Identificar subencargados.
10. Identificar interesados.
11. Identificar categorías de datos.
12. Identificar campos.
13. Identificar datos inferidos.
14. Identificar documentos.
15. Identificar RAG.
16. Identificar embeddings.
17. Identificar memoria.
18. Identificar logs.
19. Identificar caches.
20. Identificar evals.
21. Identificar providers.
22. Identificar regiones.
23. Identificar transferencias.
24. Identificar retenciones.
25. Identificar rights workflows.
26. Identificar decisiones automatizadas.
27. Identificar EIPD.
28. Identificar brechas.
29. Crear data-flow diagrams.
30. Crear matriz purpose-data.
31. Crear matriz purpose-lawful basis.
32. Crear matriz actor-field-purpose.
33. Crear matriz provider-data-region.
34. Crear matriz retention.
35. Crear matriz rights.
36. Crear matriz risk.
37. Proponer Purpose Registry.
38. Proponer Processing Activity Registry.
39. Proponer Data Field Registry.
40. Proponer Privacy Projections.
41. Proponer Provider Registry.
42. Proponer Retention Engine.
43. Proponer Deletion Graph.
44. Proponer Rights Engine.
45. Proponer Automated Decision Registry.
46. Proponer DPIA Engine.
47. Proponer Breach Workflow.
48. Proponer arquitectura.
49. Proponer persistencia.
50. Proponer archivos.
51. Proponer fases.
52. Proponer tests.
53. Proponer evals.
54. Proponer métricas.
55. Proponer alertas.

Antes de modificar código, entrega:

a) diagnóstico,
b) inventario de tratamientos,
c) mapa de datos,
d) data-flow diagrams,
e) matriz finalidad-dato,
f) matriz finalidad-base,
g) matriz proveedor-dato,
h) matriz de retención,
i) decisiones jurídicas abiertas,
j) arquitectura,
k) persistencia,
l) archivos exactos.

Restricciones:

- No inventes una base jurídica.
- No inventes roles.
- No implementes todavía.
- No copies una arquitectura genérica.
- No marques terminado sin validación.
```

---

# 176. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
Privacy & Data Protection Engineering.

Implementa solo:

1. Contratos comunes.
2. ProcessingPurpose Registry.
3. ProcessingActivity Registry.
4. PersonalDataField Registry.
5. PrivacyProjection.
6. DataMinimizationService.
7. ProviderPrivacyProfile.
8. Purpose binding para una feature.
9. Telemetry redaction básica.
10. Cross-tenant and wrong-purpose tests.
11. Audit events.

No implementes todavía:

- Rights engine completo.
- EIPD automática completa.
- Consentimiento global.
- Borrado masivo.
- Transferencias automáticas.
- Decisiones automatizadas críticas.
- Segundo producto.

No inventes decisiones jurídicas.
Usa referencias configurables o estados pendientes.
Documenta cualquier desviación.
```

---

# 177. ADR recomendados

- ADR: purpose registry.
- ADR: lawful-basis registry.
- ADR: controller-processor mapping.
- ADR: data inventory.
- ADR: privacy classifications.
- ADR: minimization.
- ADR: pseudonymization.
- ADR: provider privacy registry.
- ADR: international transfers.
- ADR: telemetry privacy.
- ADR: cache privacy.
- ADR: RAG privacy.
- ADR: embedding privacy.
- ADR: memory privacy.
- ADR: retention.
- ADR: legal hold.
- ADR: data blocking.
- ADR: deletion graph.
- ADR: rights workflows.
- ADR: automated decisions.
- ADR: DPIA.
- ADR: consent.
- ADR: transparency.
- ADR: breach management.
- ADR: privacy evals.

---

# 178. Criterios de aceptación

- [ ] Existe inventario de tratamientos.
- [ ] Cada tratamiento tiene finalidad.
- [ ] Cada finalidad tiene base jurídica documentada.
- [ ] Cada tratamiento tiene owner.
- [ ] Roles jurídicos están documentados.
- [ ] Campos personales están clasificados.
- [ ] Existen privacy projections.
- [ ] Existe minimización previa al modelo.
- [ ] Existe provider privacy registry.
- [ ] Existe privacy routing.
- [ ] Existen políticas RAG.
- [ ] Existen políticas de memoria.
- [ ] Existen políticas de telemetría.
- [ ] Existen políticas de caché.
- [ ] Existe retención.
- [ ] Existe deletion graph.
- [ ] Existen legal holds.
- [ ] Existen rights workflows.
- [ ] Existe automated-decision registry.
- [ ] Existe DPIA trigger.
- [ ] Existe change-impact review.
- [ ] Existe consent evidence cuando procede.
- [ ] Existen notices versionados.
- [ ] Existe breach workflow.
- [ ] Existen privacy evals.
- [ ] Existen cross-tenant tests.
- [ ] Existen wrong-purpose tests.
- [ ] Existe rollback.
- [ ] Se validó en producto real.

---

# 179. Definición de terminado

Una capacidad que trata datos personales está terminada cuando:

1. Tiene finalidad.
2. Tiene base jurídica documentada.
3. Tiene responsable.
4. Tiene encargados identificados.
5. Tiene categorías de datos.
6. Tiene categorías de interesados.
7. Tiene field classification.
8. Tiene minimization policy.
9. Tiene provider policy.
10. Tiene transfer review.
11. Tiene retention policy.
12. Tiene telemetry policy.
13. Tiene RAG policy.
14. Tiene memory policy.
15. Tiene cache policy.
16. Tiene rights mapping.
17. Tiene deletion propagation.
18. Tiene risk assessment.
19. Tiene DPIA decision.
20. Tiene transparency.
21. Tiene tests.
22. Tiene evals.
23. Tiene audit.
24. Tiene owner.
25. Tiene rollback.
26. Está validada en el producto real.

---

# 180. Resumen ejecutivo

La secuencia correcta es:

```text
DEFINIR FINALIDAD
  ↓
DOCUMENTAR BASE
  ↓
IDENTIFICAR ROLES
  ↓
CLASIFICAR DATOS
  ↓
MINIMIZAR
  ↓
APLICAR TENANT / ACTOR / PURPOSE
  ↓
ELEGIR PROVEEDOR
  ↓
TRATAR
  ↓
LIMITAR RETENCIÓN
  ↓
ATENDER DERECHOS
  ↓
REVISAR CAMBIOS
  ↓
AUDITAR
```

La plataforma común debe proporcionar:

- Purpose Registry.
- Lawful Basis Registry.
- Processing Activity Registry.
- Processing Party Registry.
- Personal Data Field Registry.
- Privacy Projection Registry.
- Data Minimization Service.
- Pseudonymization.
- Provider Privacy Registry.
- Privacy Routing.
- Transfer Registry.
- Privacy Context Filter.
- Privacy Budget.
- Telemetry Privacy.
- RAG Privacy.
- Memory Privacy.
- Retention Engine.
- Legal Hold.
- Deletion Graph.
- Rights Engine.
- Automated Decision Registry.
- Human Review.
- DPIA Engine.
- Notice Registry.
- Consent Evidence.
- Breach Management.
- Privacy Evals.
- Accountability Evidence.

Cada producto debe aportar:

- Finalidades.
- Bases jurídicas aprobadas.
- Datos.
- Roles.
- Proveedores.
- Retenciones.
- Decisiones.
- Riesgos.
- Derechos.
- Tests específicos.
- Owners.

Privacy & Data Protection Engineering no es:

```text
cifrado
+
checkbox
+
política de privacidad
```

Es:

```text
finalidad
+ base jurídica
+ minimización
+ control de proveedores
+ retención
+ derechos
+ evaluación de impacto
+ trazabilidad
+ evidencia
```

---

# 181. Fuentes oficiales de referencia

## Reglamento General de Protección de Datos

- Reglamento (UE) 2016/679, texto en EUR-Lex:
  - https://eur-lex.europa.eu/eli/reg/2016/679/?locale=ES

Artículos especialmente relevantes:

- Artículo 5: principios.
- Artículo 6: licitud.
- Artículo 9: categorías especiales.
- Artículo 10: datos penales.
- Artículos 12 a 14: transparencia.
- Artículos 15 a 22: derechos.
- Artículo 22: decisiones automatizadas.
- Artículo 24: responsabilidad.
- Artículo 25: diseño y defecto.
- Artículo 28: encargados.
- Artículo 30: registro de actividades.
- Artículo 32: seguridad.
- Artículos 33 y 34: brechas.
- Artículo 35: EIPD.
- Artículo 37: DPD.
- Capítulo V: transferencias.

## LOPDGDD

- Ley Orgánica 3/2018, texto consolidado en BOE:
  - https://www.boe.es/eli/es/lo/2018/12/05/3/con

## Reglamento de Inteligencia Artificial

- Reglamento (UE) 2024/1689:
  - https://eur-lex.europa.eu/eli/reg/2024/1689/oj

## CEPD: modelos de IA

- Dictamen 28/2024 sobre protección de datos y modelos de IA:
  - https://www.edpb.europa.eu/system/files/2025-05/edpb_opinion_202428_ai-models_es_0.pdf

## AEPD: IA agéntica

- Inteligencia artificial agéntica desde la perspectiva de protección de datos, v1.2, febrero de 2026:
  - https://www.aepd.es/guias/orientaciones-ia-agentica.pdf

## AEPD: riesgo y EIPD

- Gestión del riesgo y evaluación de impacto en tratamientos de datos personales:
  - https://www.aepd.es/guias/gestion-riesgo-y-evaluacion-impacto-en-tratamientos-datos-personales.pdf

- Herramienta Evalúa-Riesgo RGPD:
  - https://evalua-riesgo.aepd.es/

## CEPD: decisiones automatizadas

- Directrices sobre toma de decisiones individuales automatizadas y elaboración de perfiles:
  - https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/automated-decision-making-and-profiling_es

## CEPD: EIPD

- Directrices sobre EIPD y tratamientos de alto riesgo:
  - https://www.edpb.europa.eu/documents/guideline/data-protection-impact-assessments-high-risk-processing_es

## AEPD: brechas

- Guía para la notificación de brechas de datos personales:
  - https://www.aepd.es/documento/guia-brechas-seguridad.pdf
