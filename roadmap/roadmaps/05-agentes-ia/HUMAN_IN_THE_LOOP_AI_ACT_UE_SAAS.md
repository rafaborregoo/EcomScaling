# Human-in-the-Loop Design conforme al Reglamento Europeo de Inteligencia Artificial

## Estado del documento

- **Tipo:** especificación técnica, funcional y de cumplimiento normativo
- **Ámbito:** plataformas SaaS, CRM, copilotos, agentes operativos, workflows, tools, RAG, memoria y sistemas multi-tenant
- **Casos de referencia:** EcomScaling IA y CRM/SaaS
- **Fecha jurídica de referencia:** 29 de julio de 2026
- **Normativa principal:** Reglamento (UE) 2024/1689 de Inteligencia Artificial, modificado por el Reglamento (UE) 2026/1744 —Digital Omnibus on AI—
- **Normativa complementaria principal:** Reglamento (UE) 2016/679 —RGPD—
- **Objetivo:** introducir intervención humana únicamente donde sea necesaria por riesgo, impacto, contexto, derechos fundamentales o exigencia legal
- **Audiencia:** Codex, arquitectura, producto, seguridad, legal, privacidad, QA, operaciones y responsables de IA
- **Prioridad:** crítica
- **Idioma:** castellano
- **Principio rector:** la intervención humana debe ser efectiva, competente, informada, autorizada, trazable y capaz de alterar, detener o revertir la actuación del sistema

---

# 1. Advertencia de uso

Este documento proporciona una arquitectura técnica orientada al cumplimiento.

No sustituye:

- La clasificación jurídica definitiva del producto.
- El análisis de un caso de uso concreto.
- La evaluación de impacto en protección de datos.
- La evaluación de impacto sobre derechos fundamentales.
- La revisión de normativa sectorial.
- La consulta con el responsable jurídico o delegado de protección de datos.

Antes de implementar una obligación legal, debe comprobarse:

1. Qué producto se está analizando.
2. Qué finalidad prevista tiene el sistema.
3. Qué rol ocupa la empresa en la cadena de valor.
4. Qué datos utiliza.
5. Sobre quién produce efectos.
6. Si el caso está sometido a regulación sectorial.
7. Qué versión normativa resulta aplicable.
8. Qué fechas de aplicación están vigentes.

---

# 2. Marco normativo actualizado

## 2.1 Reglamento de Inteligencia Artificial

El marco principal es:

```text
Reglamento (UE) 2024/1689
  +
Reglamento (UE) 2026/1744
Digital Omnibus on AI
```

El segundo modifica el calendario y varias obligaciones del Reglamento de IA.

## 2.2 Calendario actualizado

```text
1 de agosto de 2024
Entrada en vigor del Reglamento de IA.

2 de febrero de 2025
Aplicación de definiciones, alfabetización en IA y primeras prácticas prohibidas.

2 de agosto de 2025
Aplicación de gobernanza y obligaciones para modelos de IA de propósito general.

2 de agosto de 2026
Aplicación de la mayoría de disposiciones generales pendientes.
Inicio de las obligaciones de transparencia del artículo 50.
Inicio de la aplicación y enforcement para las disposiciones ya aplicables.

2 de diciembre de 2026
Aplicación de nuevas prácticas prohibidas introducidas por el Digital Omnibus.
Fin del periodo transitorio del artículo 50.2 para determinados sistemas ya comercializados antes del 2 de agosto de 2026.

2 de diciembre de 2027
Aplicación de las obligaciones de sistemas de alto riesgo independientes del Anexo III.

2 de agosto de 2028
Aplicación de las obligaciones de sistemas de alto riesgo integrados en productos regulados del Anexo I.
```

## 2.3 Consecuencia para este documento

La obligación específica de supervisión humana del artículo 14 está asociada a los sistemas de IA de alto riesgo.

No obstante, antes de las fechas de aplicación del régimen de alto riesgo:

- Deben respetarse las obligaciones ya aplicables.
- Debe cumplirse el RGPD.
- Deben respetarse las prácticas prohibidas.
- Deben implementarse obligaciones de transparencia.
- Deben respetarse normas sectoriales.
- Debe evitarse automatizar decisiones significativas sin garantías.
- Conviene diseñar desde ahora la arquitectura compatible con supervisión humana.

---

# 3. Fuentes normativas principales

## 3.1 Reglamento (UE) 2024/1689

Artículos especialmente relevantes:

- Artículo 3: definiciones.
- Artículo 4: alfabetización en IA.
- Artículo 5: prácticas prohibidas.
- Artículo 6: clasificación de alto riesgo.
- Artículo 9: gestión de riesgos.
- Artículo 12: registro de actividad.
- Artículo 13: transparencia para responsables del despliegue.
- Artículo 14: supervisión humana.
- Artículo 15: precisión, robustez y ciberseguridad.
- Artículo 16: obligaciones del proveedor.
- Artículo 26: obligaciones del responsable del despliegue.
- Artículo 27: evaluación de impacto sobre derechos fundamentales.
- Artículo 50: transparencia de determinados sistemas.
- Artículo 86: derecho a explicación.
- Anexo I: productos regulados.
- Anexo III: casos de uso de alto riesgo.

## 3.2 Reglamento (UE) 2026/1744

Debe utilizarse para:

- Calendario actualizado.
- Modificaciones de obligaciones.
- Modificación del artículo 4.
- Nuevas prácticas prohibidas.
- Régimen transitorio de transparencia.
- Simplificación del régimen de alto riesgo.

## 3.3 RGPD

Artículos especialmente relevantes:

- Artículo 5: principios.
- Artículo 6: licitud.
- Artículo 9: categorías especiales.
- Artículos 13 y 14: información.
- Artículo 15: acceso.
- Artículo 22: decisiones automatizadas.
- Artículo 25: protección de datos desde el diseño.
- Artículo 30: registro de actividades.
- Artículo 32: seguridad.
- Artículo 35: evaluación de impacto.
- Artículo 36: consulta previa.

---

# 4. Regla obligatoria de análisis previo

## 4.1 Principio

Codex debe analizar exhaustivamente el producto antes de introducir Human-in-the-Loop.

No debe copiar una cola de aprobaciones genérica.

Debe adaptar HITL a:

- Finalidad prevista.
- Usuarios.
- Personas afectadas.
- Datos.
- Agentes.
- Tools.
- Workflows.
- Riesgos.
- Derechos.
- Decisiones.
- Impactos.
- Estados.
- Roles.
- Permisos.
- Integraciones.
- Reversibilidad.
- Normativa sectorial.
- RGPD.
- Reglamento de IA.

## 4.2 Prohibiciones

Codex no debe:

- Implementar aprobación para todo.
- Eliminar la intervención humana porque una acción sea técnicamente reversible.
- Asumir que todo agente es de alto riesgo.
- Asumir que ningún agente es de alto riesgo.
- Inventar la clasificación jurídica.
- Confiar en la etiqueta comercial del producto.
- Usar el nombre del módulo como criterio legal.
- Confundir revisión humana con supervisión efectiva.
- Crear un botón simbólico.
- Ejecutar antes de aprobar.
- Reutilizar aprobaciones.
- Permitir que el aprobador carezca de autoridad.
- Aceptar un `tenantId` enviado por el modelo.
- Tratar una recomendación de IA como decisión humana.
- Considerar revisión humana el simple clic rutinario.
- Implementar sin analizar RGPD artículo 22.
- Omitir las obligaciones de transparencia del artículo 50.

## 4.3 Entregables previos

Antes de modificar código, Codex debe entregar:

1. Inventario de sistemas y funcionalidades de IA.
2. Finalidad prevista de cada sistema.
3. Rol jurídico de la empresa.
4. Clasificación de riesgo preliminar.
5. Casos de uso potencialmente prohibidos.
6. Casos de uso potencialmente de alto riesgo.
7. Casos afectados por transparencia.
8. Casos afectados por RGPD artículo 22.
9. Datos personales utilizados.
10. Categorías especiales.
11. Personas y grupos afectados.
12. Decisiones que producen efectos.
13. Tools con efectos.
14. Operaciones reversibles e irreversibles.
15. Intervenciones humanas existentes.
16. Roles y autoridad de los revisores.
17. Logs existentes.
18. Evaluaciones de impacto existentes.
19. Riesgos de automatización.
20. Matriz HITL propuesta.

No debe implementarse el sistema de aprobación antes de revisar estos entregables.

---

# 5. Determinar si existe un sistema de IA

Antes de aplicar el Reglamento de IA debe comprobarse si la funcionalidad encaja en la definición de sistema de IA.

No toda automatización es IA.

Ejemplos normalmente deterministas:

- Suma de importes.
- Regla fiscal codificada.
- Validación de campos.
- Máquina de estados fija.
- Filtro SQL.
- Cálculo de margen.

Ejemplos que pueden ser IA:

- Clasificación inferida.
- Predicción.
- Recomendación.
- Generación de contenido.
- Resolución probabilística.
- Scoring.
- Agente que decide herramientas.
- Análisis semántico.

Codex debe separar:

```text
Lógica determinista
de
Sistema de IA
```

No debe aplicar HITL regulatorio a una suma aritmética solo porque esté dentro de un producto con IA.

---

# 6. Determinar el rol jurídico

La empresa puede actuar como:

- Proveedor.
- Responsable del despliegue.
- Importador.
- Distribuidor.
- Fabricante de producto.
- Proveedor de modelo de propósito general.
- Encargado del tratamiento.
- Responsable del tratamiento.
- Corresponsable.

## 6.1 Proveedor

Puede existir cuando la empresa:

- Desarrolla un sistema.
- Encarga su desarrollo.
- Lo comercializa bajo su nombre.
- Lo pone en servicio bajo su marca.

Utilizar una API de un modelo externo no impide que la empresa pueda ser proveedor del sistema final.

## 6.2 Responsable del despliegue

Puede existir cuando la empresa utiliza un sistema de IA bajo su autoridad.

## 6.3 Regla

Un mismo SaaS puede ser:

```text
Proveedor frente a sus clientes
y
Responsable del despliegue respecto de herramientas internas.
```

Las obligaciones HITL deben asignarse según el rol real.

---

# 7. Clasificación por riesgo

## 7.1 Práctica prohibida

Resultado:

```text
NO IMPLEMENTAR.
NO CORREGIR MEDIANTE APROBACIÓN.
BLOQUEAR.
```

La supervisión humana no convierte una práctica prohibida en lícita.

## 7.2 Alto riesgo

Resultado:

```text
SUPERVISIÓN HUMANA DEL ARTÍCULO 14.
PERSONAS COMPETENTES, FORMADAS Y AUTORIZADAS.
CONTROLES DEL ARTÍCULO 26.
```

## 7.3 Transparencia específica

Resultado:

```text
INFORMAR AL USUARIO.
ETIQUETAR CUANDO PROCEDA.
NO CONFUNDIR TRANSPARENCIA CON APROBACIÓN.
```

## 7.4 Riesgo limitado o mínimo

Resultado:

```text
HITL SEGÚN IMPACTO REAL, RGPD, NORMATIVA SECTORIAL Y POLÍTICAS INTERNAS.
NO APROBACIÓN OBLIGATORIA POR DEFECTO.
```

---

# 8. Prácticas prohibidas

El análisis debe comprobar, como mínimo, si la funcionalidad:

- Manipula de manera perjudicial.
- Explota vulnerabilidades.
- Realiza determinadas formas de puntuación social.
- Predice delitos únicamente mediante perfiles o rasgos personales en supuestos prohibidos.
- Crea bases biométricas mediante scraping indiscriminado en supuestos prohibidos.
- Infiere emociones en trabajo o educación en supuestos prohibidos.
- Realiza categorización biométrica sensible en supuestos prohibidos.
- Utiliza identificación biométrica remota en tiempo real fuera de excepciones.
- Genera o manipula determinado contenido sexual o íntimo no consentido.
- Genera material de abuso sexual de menores.

## Regla

```text
PRACTICE_PROHIBITED
  → bloquear
  → registrar
  → escalar a legal
```

No crear:

```text
¿Desea aprobar esta práctica prohibida?
```

---

# 9. Sistemas de alto riesgo

## 9.1 Dos grandes grupos

### Sistemas vinculados a productos regulados

Casos del artículo 6.1 y Anexo I.

Fecha principal actualizada:

```text
2 de agosto de 2028
```

### Sistemas independientes de ámbitos del Anexo III

Fecha principal actualizada:

```text
2 de diciembre de 2027
```

## 9.2 Ámbitos del Anexo III relevantes para SaaS

Debe revisarse especialmente si el sistema se utiliza para:

- Biometría.
- Infraestructuras críticas.
- Educación y formación.
- Empleo.
- Selección de trabajadores.
- Decisiones sobre relaciones laborales.
- Evaluación del rendimiento.
- Acceso a trabajo autónomo.
- Acceso a servicios públicos o privados esenciales.
- Evaluación de solvencia.
- Determinados seguros.
- Migración, asilo o fronteras.
- Aplicación de la ley.
- Administración de justicia.
- Procesos democráticos.

## 9.3 CRM y EcomScaling

Un CRM o un agente de e-commerce no es automáticamente de alto riesgo.

Podría convertirse en alto riesgo si se adapta para:

- Seleccionar candidatos a empleo.
- Clasificar trabajadores.
- Determinar acceso a vivienda esencial.
- Determinar solvencia.
- Determinar acceso a seguros.
- Evaluar elegibilidad para servicios esenciales.
- Tomar decisiones judiciales.
- Realizar biometría regulada.

## 9.4 Regla de finalidad

La clasificación depende principalmente de la finalidad prevista y del uso real.

No depende solo de:

- Modelo usado.
- Nombre del agente.
- Interfaz.
- Tamaño de la empresa.
- Uso de un chatbot.

---

# 10. Supervisión humana del artículo 14

Para sistemas de alto riesgo, el diseño debe permitir supervisión efectiva durante el uso.

La persona debe poder:

1. Comprender capacidades y limitaciones.
2. Monitorizar el funcionamiento.
3. Detectar anomalías.
4. Comprender el output.
5. Ser consciente del sesgo de automatización.
6. Decidir no utilizar el sistema.
7. Ignorar el output.
8. Anular el output.
9. Revertir el output cuando sea posible.
10. Intervenir.
11. Detener el sistema de forma segura.

## 10.1 Requisito técnico

```ts
export interface HumanOversightControl {
  canInspectInput: boolean;
  canInspectOutput: boolean;
  canInspectEvidence: boolean;
  canRejectOutput: boolean;
  canOverrideOutput: boolean;
  canStopExecution: boolean;
  canEscalate: boolean;
  canRecordReason: boolean;
}
```

## 10.2 Proporcionalidad

Las medidas deben adaptarse a:

- Riesgo.
- Autonomía.
- Contexto.
- Personas afectadas.
- Reversibilidad.
- Escala.
- Frecuencia.
- Consecuencias.

---

# 11. Obligaciones del responsable del despliegue

Para sistemas de alto riesgo, el diseño debe permitir:

- Uso conforme a instrucciones.
- Asignación de supervisión humana.
- Personas con competencia.
- Personas con formación.
- Personas con autoridad.
- Apoyo suficiente.
- Monitorización.
- Suspensión ante riesgos.
- Comunicación de incidentes.
- Conservación de logs.
- Información a trabajadores cuando proceda.
- Información a personas afectadas cuando proceda.
- Cooperación con autoridades.

## 11.1 Registro mínimo

Los logs bajo control del responsable del despliegue deben conservarse durante un periodo apropiado y, como regla del artículo 26, al menos seis meses, salvo que otra norma disponga algo distinto.

## 11.2 Persona supervisora

```ts
export type HumanSupervisor = {
  userId: string;
  tenantId: string;
  roles: string[];
  competencies: string[];
  trainingRecords: string[];
  authorityScopes: string[];
  supportedActions: string[];
  active: boolean;
};
```

---

# 12. Alfabetización en IA

El Digital Omnibus modifica el artículo 4.

La arquitectura debe ayudar a que proveedores y responsables del despliegue adopten medidas que apoyen el desarrollo de alfabetización en IA de las personas que operan o utilizan los sistemas en su nombre.

## 12.1 No basta una formación genérica

La formación debe adaptarse a:

- Función.
- Riesgo.
- Sistema.
- Herramientas.
- Personas afectadas.
- Datos.
- Sesgo de automatización.
- Mecanismos de intervención.
- Procedimientos de incidente.

## 12.2 Registro recomendado

```ts
export type AiLiteracyRecord = {
  userId: string;
  role: string;
  systemId: string;
  trainingType: string;
  completedAt: string;
  expiresAt?: string;
  competenciesCovered: string[];
};
```

## 12.3 Gate de aprobación

Para determinados sistemas:

```ts
if (!reviewer.hasRequiredTraining) {
  denyReviewAuthority();
}
```

---

# 13. Transparencia del artículo 50

Desde el 2 de agosto de 2026, deben analizarse las obligaciones de transparencia.

## 13.1 Interacción con IA

Si una persona interactúa directamente con IA, debe ser informada, salvo que resulte evidente en las circunstancias.

Para un SaaS:

```text
Estás interactuando con un asistente de inteligencia artificial.
Sus respuestas pueden requerir revisión humana.
```

## 13.2 Contenido sintético

Los proveedores de sistemas que generan audio, imagen, vídeo o texto sintético deben implementar las obligaciones de marcado técnico cuando resulten aplicables.

Para determinados sistemas ya comercializados antes del 2 de agosto de 2026, el Digital Omnibus establece un periodo transitorio hasta el 2 de diciembre de 2026 respecto del artículo 50.2.

## 13.3 Deepfakes

Los responsables del despliegue deben informar cuando publiquen o expongan contenido deepfake en los términos del artículo 50.

## 13.4 Texto sobre asuntos de interés público

Debe informarse de que el texto ha sido generado o manipulado por IA, salvo que exista revisión humana o control editorial y una persona física o jurídica asuma responsabilidad editorial.

## 13.5 Consecuencia para HITL

La revisión humana puede ser relevante para la excepción editorial de determinados textos de interés público.

Pero:

```text
revisión humana simbólica
≠
control editorial real
```

Debe existir:

- Persona identificada.
- Autoridad editorial.
- Revisión efectiva.
- Registro.
- Responsabilidad asumida.

---

# 14. RGPD artículo 22

Debe analizarse si el sistema toma una decisión:

1. Basada únicamente en tratamiento automatizado.
2. Sobre una persona física.
3. Con efectos jurídicos.
4. O que le afecte significativamente de forma similar.

Ejemplos:

- Rechazo de crédito.
- Rechazo de candidato.
- Determinación automática de condiciones.
- Exclusión de servicio.
- Clasificación con efecto determinante.
- Decisión automatizada sobre acceso a oportunidades.

## 14.1 Intervención humana significativa

No basta con que una persona pulse “aprobar”.

La intervención debe:

- Ser real.
- Tener influencia.
- Ser realizada por persona competente.
- Ser realizada por persona autorizada.
- Considerar información relevante.
- Poder cambiar la decisión.
- Poder rechazar el resultado.
- Poder escuchar el punto de vista del afectado.
- Poder tramitar impugnación.

## 14.2 Señales de intervención simbólica

```text
El humano aprueba el 100 % sin revisar.
No puede modificar.
No ve los datos.
No conoce el sistema.
No tiene autoridad.
Solo recibe una puntuación.
No dispone de tiempo.
No puede documentar discrepancias.
```

En estos casos puede seguir existiendo una decisión basada únicamente en tratamiento automatizado.

---

# 15. Evaluación de impacto en protección de datos

Debe evaluarse la necesidad de una EIPD cuando el tratamiento pueda entrañar alto riesgo para derechos y libertades.

Factores:

- Scoring.
- Perfilado.
- Decisiones significativas.
- Datos sensibles.
- Monitorización.
- Gran escala.
- Personas vulnerables.
- Nuevas tecnologías.
- Combinación de fuentes.
- Datos laborales.
- Datos financieros.
- Datos de salud.

## 15.1 HITL dentro de la EIPD

La EIPD debe describir:

- Punto de intervención.
- Persona responsable.
- Autoridad.
- Información disponible.
- Tiempo disponible.
- Capacidad de modificación.
- Vías de impugnación.
- Logs.
- Métricas de override.
- Sesgo de automatización.

---

# 16. Evaluación de impacto sobre derechos fundamentales

Para determinados responsables del despliegue de sistemas de alto riesgo del Anexo III, el artículo 27 exige una evaluación de impacto sobre derechos fundamentales.

Debe analizar:

- Procesos donde se utilizará.
- Duración y frecuencia.
- Personas y grupos afectados.
- Riesgos específicos.
- Medidas de supervisión humana.
- Mecanismos de reclamación.
- Gobernanza.
- Medidas de mitigación.

No debe asumirse que toda empresa privada debe realizar siempre esta evaluación.

Codex debe determinar:

```text
FRIA_REQUIRED
FRIA_RECOMMENDED
FRIA_NOT_REQUIRED
LEGAL_REVIEW_NEEDED
```

---

# 17. Derecho a explicación

En determinados casos de decisiones basadas en sistemas de alto riesgo del Anexo III con efectos jurídicos o similares, las personas afectadas pueden tener derecho a explicaciones claras y significativas sobre:

- Papel del sistema de IA.
- Procedimiento de decisión.
- Elementos principales de la decisión.

La arquitectura debe conservar:

- Versión del sistema.
- Inputs relevantes.
- Outputs.
- Reglas aplicadas.
- Intervención humana.
- Resultado final.
- Evidencias.
- Motivo del override.
- Persona responsable.

No debe conservar razonamientos internos del modelo como sustituto de una explicación comprensible.

---

# 18. Matriz de necesidad de HITL

## Nivel 0 — Sin HITL

Adecuado normalmente para:

- Lectura de datos internos.
- Cálculos deterministas.
- Resúmenes internos sin efectos.
- Búsqueda documental.
- Borradores no publicados.
- Clasificaciones reversibles de baja importancia.

Controles:

- Permisos.
- Logs.
- Transparencia.
- Validación.
- Evals.

## Nivel 1 — Supervisión por excepción

Adecuado para:

- Recomendaciones internas.
- Etiquetado corregible.
- Creación de tareas.
- Borradores.
- Análisis sin ejecución.

Controles:

- Posibilidad de corregir.
- Feedback.
- Monitorización.
- Alertas por anomalía.

## Nivel 2 — Revisión antes de efecto externo

Adecuado para:

- Envío de correos.
- Publicación de contenido.
- Modificación de datos relevantes.
- Recomendaciones que afecten a clientes.
- Cambios operativos moderados.

Controles:

- Preview.
- Approve/edit/reject.
- Revalidación.
- Auditoría.

## Nivel 3 — Aprobación reforzada

Adecuado para:

- Operaciones económicas.
- Cancelaciones.
- Cambios contractuales.
- Acciones masivas.
- Decisiones significativas sobre personas.
- Alto riesgo.

Controles:

- Persona competente.
- Autoridad.
- Evidencia.
- Explicación.
- Hash.
- Expiración.
- Revalidación.
- Verificación.

## Nivel 4 — Doble control o toma humana directa

Adecuado para:

- Operaciones críticas.
- Efectos graves.
- Decisiones de alto riesgo.
- Reembolsos elevados.
- Cambios de permisos.
- Datos especialmente sensibles.
- Acciones difícilmente reversibles.

Controles:

- Dos aprobadores cuando proceda.
- Separación de funciones.
- Stop control.
- Plan de contingencia.
- Revisión legal.

## Nivel 5 — Prohibido

Resultado:

```text
No ejecutar.
No presentar aprobación.
Bloquear.
Escalar.
```

---

# 19. Motor de decisión HITL

```ts
export type HitlDecision =
  | "automatic"
  | "monitor_only"
  | "human_review"
  | "enhanced_approval"
  | "dual_approval"
  | "human_takeover"
  | "blocked";

export type HitlAssessment = {
  systemId: string;
  useCaseId: string;

  aiActCategory:
    | "prohibited"
    | "high_risk"
    | "transparency"
    | "other";

  gdprArticle22Risk:
    | "not_applicable"
    | "possible"
    | "applicable"
    | "legal_review";

  affectsNaturalPersons: boolean;
  legalEffect: boolean;
  similarlySignificantEffect: boolean;

  financialImpact: number | null;
  affectedResources: number;
  affectedPersons: number;

  reversibility:
    | "reversible"
    | "compensatable"
    | "partially_reversible"
    | "irreversible";

  confidence: number | null;
  ambiguityDetected: boolean;
  sensitiveDataUsed: boolean;
  policyException: boolean;

  decision: HitlDecision;
  reasons: string[];
  legalReferences: string[];
};
```

---

# 20. Política HITL

```ts
export type HumanInterventionPolicy = {
  id: string;
  version: string;

  productType: string;
  useCaseType: string;

  legalBasis: string[];
  appliesWhen: PolicyCondition[];

  decision: HitlDecision;

  requiredReviewerRoles: string[];
  requiredCompetencies: string[];
  requiredTraining: string[];

  allowedDecisions:
    | ["approve", "reject"]
    | ["approve", "edit", "reject"]
    | ["take_over", "reject"];

  minimumApprovals: number;
  separationOfDuties: boolean;

  expiresAfterSeconds: number;
  requireRevalidation: boolean;
  requireVerification: boolean;
};
```

---

# 21. Arquitectura funcional

```text
Solicitud o evento
  ↓
Clasificación del caso
  ↓
Evaluación jurídica y de riesgo
  ↓
Policy Engine
  ├── automático
  ├── monitorización
  ├── revisión
  ├── aprobación reforzada
  ├── doble aprobación
  ├── toma humana
  └── bloqueo
          ↓
Persistir estado
          ↓
Crear review card
          ↓
Decisión humana
          ↓
Revalidar
          ↓
Ejecutar
          ↓
Verificar
          ↓
Auditar
          ↓
Permitir explicación o impugnación
```

---

# 22. Interrupción persistente

La espera de una persona no debe mantener un proceso abierto.

Debe:

1. Persistir estado.
2. Crear interrupción.
3. Finalizar ejecución activa.
4. Notificar.
5. Recibir decisión.
6. Recuperar checkpoint.
7. Revalidar.
8. Reanudar.

```ts
export type WorkflowInterrupt = {
  id: string;
  tenantId: string;
  workflowId: string;
  nodeId: string;

  type:
    | "clarification"
    | "review"
    | "approval"
    | "dual_approval"
    | "takeover";

  status:
    | "pending"
    | "partially_resolved"
    | "resolved"
    | "expired"
    | "cancelled";

  reviewPayloadId: string;

  createdAt: string;
  expiresAt: string;

  workflowVersion: number;
};
```

---

# 23. Review Payload

```ts
export type ReviewPayload = {
  id: string;
  tenantId: string;

  title: string;
  objective: string;

  legalClassification: {
    aiActCategory: string;
    gdprArticle22Risk: string;
    legalReferences: string[];
  };

  proposedAction: {
    toolName: string;
    toolVersion: string;
    arguments: unknown;
    argumentsHash: string;
  };

  affectedResources: Array<{
    type: string;
    id: string;
    label: string;
    currentState?: unknown;
    proposedState?: unknown;
  }>;

  affectedPersons?: Array<{
    pseudonymousId: string;
    effectType: string;
  }>;

  impact: {
    financial?: unknown;
    operational?: unknown;
    contractual?: unknown;
    rightsAndFreedoms?: unknown;
    externalCommunication?: boolean;
  };

  evidence: Evidence[];
  limitations: string[];
  uncertainties: string[];
  alternatives: ProposedAlternative[];

  risk: {
    level: RiskLevel;
    reasons: string[];
    reversibility: Reversibility;
  };

  allowedDecisions: HumanDecisionType[];

  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
};
```

---

# 24. Información para el revisor

La interfaz debe permitir comprender:

- Qué quiere hacer el sistema.
- Por qué.
- Qué datos ha utilizado.
- Qué datos faltan.
- Qué limitaciones existen.
- Qué personas se ven afectadas.
- Qué efecto produce.
- Qué alternativa existe.
- Qué ocurre si no se aprueba.
- Si puede revertirse.
- Qué derechos pueden verse afectados.
- Qué norma o política activa la revisión.

No debe mostrar únicamente:

```text
¿Continuar?
```

---

# 25. Competencia, formación y autoridad

## 25.1 Competencia

La persona debe entender:

- Dominio.
- Resultado.
- Limitaciones.
- Riesgos.
- Señales de error.
- Sesgo de automatización.

## 25.2 Formación

Debe haber recibido formación adecuada al sistema.

## 25.3 Autoridad

Debe poder:

- Rechazar.
- Editar.
- Detener.
- Escalar.
- Anular.
- Cambiar la decisión.

## 25.4 Soporte

Debe disponer de:

- Tiempo.
- Información.
- Herramientas.
- Acceso a evidencia.
- Canal de escalado.

---

# 26. Sesgo de automatización

El diseño debe reducir la tendencia a aceptar el output por venir de una IA.

Medidas:

- No presentar la recomendación como verdad.
- Mostrar incertidumbre.
- Mostrar evidencia.
- Mostrar alternativas.
- Mostrar limitaciones.
- Permitir decisión antes de mostrar score cuando proceda.
- Medir aprobaciones automáticas.
- Introducir controles de calidad.
- Formar a revisores.

Ejemplo de UI incorrecta:

```text
RECOMENDACIÓN IA: APROBAR
Confianza: 98 %
[Botón grande verde: Aprobar]
```

Ejemplo mejor:

```text
Resultado propuesto.
Evidencias a favor.
Evidencias en contra.
Información ausente.
Alternativas.
Opciones de decisión equivalentes.
```

---

# 27. Decisiones humanas

```ts
export type HumanDecisionType =
  | "approve"
  | "reject"
  | "edit"
  | "provide_input"
  | "override"
  | "take_over"
  | "escalate";

export type HumanDecision = {
  id: string;
  interruptId: string;
  tenantId: string;

  decision: HumanDecisionType;

  decidedBy: string;
  reviewerRole: string;
  competenciesVerified: boolean;
  trainingVerified: boolean;
  authorityVerified: boolean;

  reason: string;
  editedArguments?: unknown;
  providedInput?: unknown;

  originalArgumentsHash: string;
  finalArgumentsHash: string;

  decidedAt: string;
  reviewVersion: number;
};
```

---

# 28. Aprobación exacta

La aprobación debe vincularse a:

- Tool.
- Versión.
- Argumentos.
- Recursos.
- Importe.
- Personas afectadas.
- Impacto.
- Workflow.
- Política.
- Fecha.
- Aprobador.

Si cambia cualquiera de los elementos esenciales:

```text
Nueva evaluación.
Nueva revisión.
Nueva aprobación.
```

---

# 29. Revalidación obligatoria

Antes de ejecutar:

1. Recargar recurso.
2. Comprobar tenant.
3. Comprobar permisos.
4. Comprobar rol.
5. Comprobar formación.
6. Comprobar autoridad.
7. Comprobar vigencia.
8. Comprobar hash.
9. Comprobar estado.
10. Recalcular impacto.
11. Comprobar política actual.
12. Comprobar ejecución previa.

---

# 30. Verificación posterior

La supervisión no termina con la aprobación.

Debe comprobarse:

- Acción ejecutada.
- Estado final.
- Resultados parciales.
- Errores.
- Efectos secundarios.
- Notificaciones.
- Reversión o compensación.
- Incidente.

```ts
export type PostExecutionVerification = {
  executionId: string;
  expectedState: unknown;
  actualState: unknown;
  passed: boolean;
  discrepancies: string[];
  verifiedAt: string;
};
```

---

# 31. Stop control

Para sistemas de alto riesgo o procesos autónomos relevantes debe existir un mecanismo de parada.

```ts
export interface SafeStopService {
  requestStop(input: {
    tenantId: string;
    workflowId: string;
    requestedBy: string;
    reason: string;
  }): Promise<SafeStopResult>;
}
```

Debe:

- Evitar nuevos pasos.
- Finalizar de forma segura.
- No dejar transacciones inconsistentes.
- Registrar estado.
- Notificar responsables.
- Permitir investigación.

---

# 32. Impugnación y revisión

Cuando el sistema interviene en decisiones sobre personas, debe contemplarse:

- Solicitud de intervención humana.
- Expresión del punto de vista.
- Presentación de documentación.
- Impugnación.
- Nueva revisión.
- Decisión final.
- Explicación.

```ts
export type DecisionChallenge = {
  id: string;
  tenantId: string;
  decisionId: string;
  submittedBy: string;
  reason: string;
  evidence: unknown[];
  status:
    | "submitted"
    | "under_review"
    | "resolved"
    | "rejected";
};
```

---

# 33. Explicación

La explicación debe ser:

- Clara.
- Significativa.
- Específica.
- Comprensible.
- Vinculada al caso.
- Basada en hechos.
- Sin revelar secretos empresariales innecesarios.
- Sin exponer razonamiento interno.

Debe indicar:

- Papel de la IA.
- Datos principales.
- Factores relevantes.
- Papel humano.
- Resultado final.
- Vía de revisión.

---

# 34. Casos en EcomScaling IA

## 34.1 Análisis de campañas

Normalmente:

```text
Nivel 0 o 1
```

Si solo:

- Consulta métricas.
- Calcula.
- Recomienda.
- No ejecuta.

## 34.2 Pausar una campaña individual

Posible:

```text
Nivel 2
```

Depende de:

- Configuración.
- Presupuesto.
- Reversibilidad.
- Política del tenant.

## 34.3 Pausar campañas masivamente

Normalmente:

```text
Nivel 3
```

Por:

- Impacto económico.
- Acción masiva.
- Efectos externos.

## 34.4 Cambiar presupuestos

Normalmente:

```text
Nivel 2 o 3
```

Según:

- Importe.
- Porcentaje.
- Número de campañas.
- Autonomía autorizada.

## 34.5 Crear recomendaciones internas

Normalmente:

```text
Nivel 0 o 1
```

## 34.6 Publicar anuncios o contenido

Normalmente:

```text
Nivel 2
```

Debe analizarse además artículo 50.

---

# 35. Casos en CRM/SaaS

## 35.1 Buscar y resumir expediente

Normalmente:

```text
Nivel 0
```

Con controles de privacidad y tenant.

## 35.2 Crear tarea interna

Normalmente:

```text
Nivel 1
```

Si es reversible y de bajo impacto.

## 35.3 Enviar comunicación al cliente

Normalmente:

```text
Nivel 2
```

Por efecto externo e irreversibilidad práctica.

## 35.4 Cambiar estado de oportunidad

Puede ser:

```text
Nivel 1 o 2
```

Según impacto.

## 35.5 Cancelar reserva

Normalmente:

```text
Nivel 3
```

Por efecto contractual y operativo.

## 35.6 Ejecutar reembolso

Normalmente:

```text
Nivel 3 o 4
```

Por efecto económico e irreversibilidad.

## 35.7 Cambiar permisos de usuarios

Normalmente:

```text
Nivel 4
```

## 35.8 Scoring de clientes o compradores

Requiere análisis especial:

- Finalidad.
- Datos personales.
- Efecto.
- Uso para acceso a servicio.
- Profiling.
- Artículo 22 RGPD.
- Posible Anexo III.

No debe activarse sin revisión jurídica.

---

# 36. Decisiones sobre vivienda

En un CRM inmobiliario debe prestarse atención especial a funciones que:

- Puntúen candidatos a alquiler.
- Seleccionen compradores.
- Determinen acceso a oportunidades.
- Excluyan personas.
- Utilicen solvencia.
- Utilicen perfiles.
- Utilicen categorías sensibles.
- Produzcan efectos similares a denegación de servicio esencial.

Aunque una herramienta inmobiliaria general no sea automáticamente de alto riesgo, determinados usos concretos pueden afectar de forma significativa a personas y requieren análisis jurídico reforzado.

---

# 37. Contenido jurídico

Un agente que:

- Resume documentos.
- Extrae cláusulas.
- Prepara borradores.
- Detecta campos.

no es equivalente a un sistema que:

- Toma decisiones judiciales.
- Sustituye al profesional.
- Presenta escritos automáticamente.
- Determina derechos.
- Emite una decisión vinculante.

Para borradores legales:

```text
Nivel 2
```

antes de:

- Enviar.
- Firmar.
- Presentar.
- Comunicar formalmente.

---

# 38. Arquitectura técnica

```text
src/
  ai/
    hitl/
      hitl.types.ts
      hitl-assessment.service.ts
      hitl-policy.registry.ts
      hitl-policy.engine.ts

      legal-classification.service.ts
      ai-act-classifier.ts
      gdpr-article22-assessor.ts

      interrupt.service.ts
      interrupt.repository.ts
      checkpoint.service.ts

      review-payload.builder.ts
      review.service.ts
      approval.service.ts
      decision.service.ts

      reviewer-competency.service.ts
      ai-literacy.service.ts

      revalidation.service.ts
      verification.service.ts
      safe-stop.service.ts

      challenge.service.ts
      explanation.service.ts

      audit.service.ts
      metrics.service.ts

      policies/
        platform/
        ecommerce/
        crm/

      adapters/
        ecommerce/
        crm/

      tests/
      evals/
      observability/
```

Adaptar al repositorio real.

---

# 39. Persistencia orientativa

Tablas posibles:

```text
ai_system_registry
ai_use_cases
ai_legal_classifications
hitl_policies
workflow_interrupts
review_payloads
human_decisions
approval_requirements
approval_steps
reviewer_competencies
ai_literacy_records
decision_challenges
decision_explanations
post_execution_verifications
ai_incidents
```

No crear tablas sin analizar el esquema actual.

---

# 40. Registro de sistemas de IA

```ts
export type AiSystemRegistryRecord = {
  id: string;
  tenantId?: string;

  name: string;
  version: string;
  productType: string;

  intendedPurpose: string;
  providerRole: boolean;
  deployerRole: boolean;

  aiActClassification:
    | "prohibited"
    | "high_risk_annex_i"
    | "high_risk_annex_iii"
    | "article_50"
    | "other"
    | "pending_review";

  personalDataUsed: boolean;
  article22Risk: string;

  legalOwner: string;
  technicalOwner: string;

  lastReviewedAt: string;
  nextReviewAt: string;
};
```

---

# 41. Legal Classification Gate

Ningún caso de uso nuevo debería llegar a producción sin:

```text
AI system check
  ↓
Intended purpose
  ↓
Role classification
  ↓
AI Act classification
  ↓
GDPR assessment
  ↓
HITL policy
  ↓
Approval
```

```ts
export type LegalClassificationGate = {
  aiSystemIdentified: boolean;
  intendedPurposeDocumented: boolean;
  operatorRolesDocumented: boolean;
  aiActClassified: boolean;
  gdprAssessed: boolean;
  transparencyAssessed: boolean;
  hitlPolicyAssigned: boolean;
  approvedForRelease: boolean;
};
```

---

# 42. Logs y trazabilidad

Registrar:

- Sistema.
- Versión.
- Finalidad.
- Caso de uso.
- Actor.
- Tenant.
- Inputs relevantes.
- Output.
- Evidencia.
- Política HITL.
- Interrupción.
- Revisor.
- Competencia.
- Decisión.
- Motivo.
- Override.
- Acción.
- Verificación.
- Reclamación.
- Explicación.

Aplicar:

- Minimización.
- Redacción.
- Seguridad.
- Retención.
- Acceso restringido.

---

# 43. Auditoría de supervisión humana

```ts
export type HumanOversightAudit = {
  workflowId: string;
  decisionId: string;
  tenantId: string;

  aiSystemId: string;
  aiSystemVersion: string;

  policyId: string;
  policyVersion: string;

  requestedBy: string;
  reviewedBy: string;

  competenceVerified: boolean;
  trainingVerified: boolean;
  authorityVerified: boolean;

  originalArgumentsHash: string;
  finalArgumentsHash: string;

  humanDecision: HumanDecisionType;
  humanReason: string;

  aiOutputAccepted: boolean;
  aiOutputModified: boolean;
  aiOutputOverridden: boolean;

  executionResult: string;
  verificationResult: string;

  createdAt: string;
};
```

---

# 44. Métricas

## Operativas

- `approval_rate`
- `rejection_rate`
- `edit_rate`
- `override_rate`
- `takeover_rate`
- `escalation_rate`
- `approval_latency`
- `expiration_rate`
- `verification_failure_rate`

## Calidad de supervisión

- Aprobaciones sin abrir evidencia.
- Tiempo medio de revisión.
- Aprobaciones sistemáticas.
- Ratio de cambio por revisor.
- Ratio de discrepancia.
- Resultados corregidos.
- Incidentes evitados.
- Decisiones impugnadas.
- Decisiones revocadas.

## Cumplimiento

- Revisores sin formación.
- Revisores sin autoridad.
- Aprobaciones caducadas.
- Aprobaciones reutilizadas.
- Acciones sin política.
- Acciones significativas sin supervisión.
- Fallos de transparencia.
- Logs incompletos.

---

# 45. Evals

La suite debe incluir:

## 45.1 Clasificación

- No IA.
- IA sin alto riesgo.
- Posible alto riesgo.
- Prohibido.
- Transparencia artículo 50.
- Posible artículo 22 RGPD.

## 45.2 Intervención

- Automático cuando procede.
- Review cuando procede.
- Bloqueo cuando procede.
- Doble aprobación.
- Takeover.

## 45.3 Revisor

- Sin competencia.
- Sin formación.
- Sin autoridad.
- Otro tenant.
- Rol incorrecto.

## 45.4 Aprobación

- Hash correcto.
- Hash modificado.
- Expirada.
- Reutilizada.
- Cambió estado.
- Cambió permiso.
- Cambió impacto.

## 45.5 Supervisión efectiva

- Puede modificar.
- Puede rechazar.
- Puede detener.
- Ve evidencia.
- Ve incertidumbre.
- Registra motivo.

## 45.6 RGPD

- Decisión automatizada significativa.
- Revisión simbólica.
- Solicitud de intervención.
- Impugnación.
- Explicación.

## 45.7 Transparencia

- Chatbot identificado.
- Contenido etiquetado.
- Revisión editorial real.
- Excepción incorrecta.

---

# 46. Tests

## Unitarios

- HitlAssessment.
- AI Act classifier.
- Article 22 assessor.
- Policy engine.
- Hash.
- Expiración.
- Competencia.
- Autoridad.
- Revalidación.
- Stop.

## Integración

- Workflow pausado.
- Persistencia.
- Reanudación.
- Edición.
- Rechazo.
- Doble aprobación.
- Verificación.
- Impugnación.
- Explicación.

## Seguridad

- Cross-tenant.
- Replay.
- CSRF.
- Argument tampering.
- Reviewer escalation.
- Approval reuse.
- Prompt injection.
- External payload.
- Log exposure.

---

# 47. Fases de implementación

## Fase 0 — Auditoría jurídica y técnica

Analizar:

- Producto.
- IA.
- Finalidades.
- Roles.
- Datos.
- Personas afectadas.
- Decisiones.
- Tools.
- Workflows.
- Alto riesgo.
- Transparencia.
- RGPD.
- Normativa sectorial.
- HITL existente.

Entregables:

- Inventario.
- Clasificación.
- Matriz de riesgo.
- Matriz HITL.
- Riesgos.
- Archivos.
- Plan.

No implementar todavía.

## Fase 1 — Registro de sistemas y casos de uso

Crear o adaptar:

- AI system registry.
- Use case registry.
- Intended purpose.
- Legal owner.
- Technical owner.

## Fase 2 — Motor de clasificación

Implementar:

- No IA.
- Prohibido.
- Alto riesgo.
- Transparencia.
- RGPD artículo 22.
- Revisión legal.

## Fase 3 — Contratos HITL

Crear tipos comunes.

## Fase 4 — Interrupciones y checkpoints

Implementar pausa y reanudación.

## Fase 5 — Review card

Implementar evidencia, impacto y alternativas.

## Fase 6 — Competencia y autoridad

Implementar reviewer eligibility.

## Fase 7 — Revalidación

Implementar revalidación obligatoria.

## Fase 8 — Verificación y stop

Implementar verificación y parada segura.

## Fase 9 — Impugnación y explicación

Implementar derechos y canales.

## Fase 10 — Evals y auditoría

Medir supervisión efectiva.

---

# 48. Criterios de aceptación

- [ ] Existe inventario de sistemas de IA.
- [ ] Existe finalidad prevista documentada.
- [ ] Existe clasificación jurídica preliminar.
- [ ] Existe revisión de prácticas prohibidas.
- [ ] Existe revisión de alto riesgo.
- [ ] Existe revisión del artículo 50.
- [ ] Existe evaluación del artículo 22 RGPD.
- [ ] Existe matriz HITL.
- [ ] HITL se aplica solo donde corresponde.
- [ ] Existen interrupciones persistentes.
- [ ] Existe review payload.
- [ ] Existe evidencia.
- [ ] Existe explicación.
- [ ] Existe override.
- [ ] Existe stop.
- [ ] Existe reviewer eligibility.
- [ ] Existe formación.
- [ ] Existe autoridad.
- [ ] Existen hashes.
- [ ] Existe expiración.
- [ ] Existe revalidación.
- [ ] Existe verificación.
- [ ] Existe impugnación cuando procede.
- [ ] Existe auditoría.
- [ ] Existen evals.
- [ ] No se aprueban prácticas prohibidas.
- [ ] No existe revisión simbólica.

---

# 49. Instrucciones directas para Codex

## Misión

Diseñar una arquitectura Human-in-the-Loop adaptada al SaaS real y alineada con:

- Reglamento (UE) 2024/1689.
- Reglamento (UE) 2026/1744.
- RGPD.
- Normativa sectorial aplicable.

## Regla obligatoria

Antes de implementar, analiza exhaustivamente:

- Repositorio.
- Producto.
- Dominio.
- Agentes.
- Tools.
- Workflows.
- RAG.
- Memoria.
- Datos.
- Roles.
- Permisos.
- Decisiones.
- Efectos.
- Personas.
- Riesgos.
- Finalidad prevista.
- Clasificación legal.
- Transparencia.
- RGPD.

## Restricciones

1. No implementar antes del análisis.
2. No inventar clasificación legal.
3. No asumir que todo es alto riesgo.
4. No asumir que nada es alto riesgo.
5. No aplicar HITL a todo.
6. No eliminar HITL en acciones relevantes.
7. No permitir prácticas prohibidas.
8. No confundir transparencia con aprobación.
9. No confundir permiso con aprobación.
10. No aceptar revisión simbólica.
11. No aceptar tenant del modelo.
12. No ejecutar antes de aprobar.
13. No reutilizar aprobaciones.
14. No omitir revalidación.
15. No omitir verificación.
16. No guardar razonamiento interno.
17. No exponer datos innecesarios.
18. No implementar sin logs.
19. No marcar como terminado con tests fallando.
20. Documentar toda desviación.

---

# 50. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura Human-in-the-Loop adaptada al SaaS y conforme al marco
europeo vigente a 29 de julio de 2026.

Normativa de referencia:

- Reglamento (UE) 2024/1689.
- Reglamento (UE) 2026/1744, Digital Omnibus on AI.
- Reglamento (UE) 2016/679, RGPD.
- Normativa sectorial aplicable.

No implementes todavía cambios.

Objetivos:

1. Identificar todas las funcionalidades de IA.
2. Separar lógica determinista de sistemas de IA.
3. Documentar finalidad prevista.
4. Identificar rol de proveedor y responsable del despliegue.
5. Identificar personas afectadas.
6. Identificar datos personales y categorías especiales.
7. Identificar decisiones y efectos.
8. Identificar tools con efectos.
9. Identificar workflows autónomos.
10. Identificar contenido generado.
11. Identificar posibles prácticas prohibidas.
12. Identificar posibles casos de alto riesgo.
13. Identificar obligaciones de transparencia.
14. Identificar posibles decisiones del artículo 22 RGPD.
15. Identificar EIPD existentes o necesarias.
16. Identificar FRIA potencialmente necesaria.
17. Identificar intervención humana actual.
18. Evaluar si la intervención es efectiva o simbólica.
19. Identificar revisores, competencia, formación y autoridad.
20. Identificar logs.
21. Identificar canales de impugnación.
22. Proponer niveles HITL:
    - automatic
    - monitor_only
    - human_review
    - enhanced_approval
    - dual_approval
    - human_takeover
    - blocked
23. Proponer HumanInterventionPolicy.
24. Proponer HitlAssessment.
25. Proponer arquitectura.
26. Proponer tablas o adaptaciones.
27. Proponer archivos.
28. Proponer fases.
29. Proponer tests.
30. Proponer evals.

Antes de modificar código, entrega:

a) diagnóstico,
b) inventario de sistemas de IA,
c) finalidades previstas,
d) roles jurídicos,
e) matriz de clasificación,
f) matriz RGPD,
g) matriz HITL,
h) riesgos,
i) arquitectura,
j) archivos exactos.

Restricciones:

- No inventes datos.
- No inventes clasificaciones.
- No implementes todavía.
- No copies una matriz genérica sin adaptarla.
- No conviertas todo en aprobación.
- No omitas acciones críticas.
- No marques como terminado sin revisión.
```

---

# 51. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
Human-in-the-Loop.

Implementa solo:

1. Contratos comunes.
2. Registro de sistemas de IA.
3. Registro de casos de uso.
4. HitlAssessment.
5. Policy Engine.
6. Interrupciones persistentes.
7. Checkpoints.
8. Review Payload.
9. Approve/edit/reject.
10. Hash de argumentos.
11. Revalidación.
12. Auditoría.
13. Un único caso real de riesgo moderado.
14. Tests.

No implementes todavía:

- Doble aprobación.
- Sistemas de alto riesgo no confirmados.
- Decisiones automatizadas significativas no revisadas.
- Impugnación completa.
- Explicación regulatoria completa.
- Segundo producto.
- Automatizaciones críticas.

Reutiliza el análisis previo y documenta cualquier desviación.
```

---

# 52. ADR recomendados

- ADR: inventario de sistemas de IA.
- ADR: finalidad prevista.
- ADR: clasificación AI Act.
- ADR: roles de operador.
- ADR: prácticas prohibidas.
- ADR: alto riesgo.
- ADR: transparencia.
- ADR: RGPD artículo 22.
- ADR: EIPD.
- ADR: FRIA.
- ADR: matriz HITL.
- ADR: reviewer eligibility.
- ADR: supervisión efectiva.
- ADR: stop control.
- ADR: impugnación.
- ADR: explicación.
- ADR: logs y retención.
- ADR: calendario normativo.

---

# 53. Definición de terminado

Una capacidad HITL está terminada cuando:

1. Se analizó el producto.
2. Se identificó si es IA.
3. Se documentó finalidad.
4. Se identificó rol jurídico.
5. Se clasificó el caso.
6. Se comprobó prohibición.
7. Se comprobó alto riesgo.
8. Se comprobó transparencia.
9. Se comprobó RGPD artículo 22.
10. Se definió nivel HITL.
11. Se definió revisor.
12. Se verificó competencia.
13. Se verificó formación.
14. Se verificó autoridad.
15. Se definió review payload.
16. Se definió hash.
17. Se definió expiración.
18. Se definió revalidación.
19. Se definió verificación.
20. Se definió stop.
21. Se definió auditoría.
22. Se definió explicación.
23. Se definió impugnación cuando procede.
24. Se definieron tests.
25. Se definieron evals.
26. Se validó en el producto real.

---

# 54. Resumen ejecutivo

La secuencia correcta es:

```text
INVENTARIAR
  ↓
DEFINIR FINALIDAD
  ↓
CLASIFICAR
  ↓
EVALUAR EFECTOS
  ↓
ASIGNAR NIVEL HITL
  ↓
PERSISTIR
  ↓
REVISAR
  ↓
REVALIDAR
  ↓
EJECUTAR
  ↓
VERIFICAR
  ↓
EXPLICAR Y AUDITAR
```

HITL no debe aplicarse indiscriminadamente.

Debe utilizarse cuando:

- La ley lo exige.
- Existe alto riesgo.
- Hay decisiones significativas.
- Existen efectos jurídicos.
- La acción es económica o contractual.
- La acción es difícilmente reversible.
- Existen ambigüedades.
- Existen personas afectadas.
- Falla la verificación.
- Se supera una política.

La supervisión humana no consiste en añadir un botón.

Consiste en garantizar que una persona competente, formada y autorizada pueda comprender, cuestionar, modificar, detener o anular la actuación del sistema.

---

# 55. Referencias oficiales

- Reglamento (UE) 2024/1689 del Parlamento Europeo y del Consejo, de 13 de junio de 2024.
- Reglamento (UE) 2026/1744 del Parlamento Europeo y del Consejo, de 8 de julio de 2026.
- AI Act Service Desk de la Comisión Europea.
- Artículo 14: Human oversight.
- Artículo 26: Obligations of deployers of high-risk AI systems.
- Artículo 27: Fundamental rights impact assessment.
- Artículo 50: Transparency obligations.
- Artículo 86: Right to explanation.
- Reglamento (UE) 2016/679.
- Directrices del EDPB sobre decisiones automatizadas y elaboración de perfiles.
- Criterios de la AEPD sobre intervención humana en decisiones automatizadas.
