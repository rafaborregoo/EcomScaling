# Fase 03 · D01 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D01-calidad-y-fiabilidad-de-los-datos.md`

**Identidad interna del documento:**

- Fase 3 — Sistema de Diagnóstico
- D1 — Calidad y fiabilidad de los datos

**Tratamiento:** conservado sin reescritura en `00-corpus-maestro/`.

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d01-calidad-y-fiabilidad-de-los-datos.md` | Copia exacta del documento recibido. |
| `01-rag-produccion` | `d01-calidad-y-fiabilidad-de-los-datos.md` | Conocimiento experto estable para evaluar fiabilidad antes de diagnosticar. |
| `02-contratos-IA` | `d01-requisitos-contrato-calidad-datos.md` | Requisitos conceptuales de información que deben poder intercambiar componentes y agentes. |
| `03-runtime` | `d01-flujo-evaluacion-calidad-datos.md` | Secuencia operacional de evaluación y ramas de decisión. |
| `04-policies-guardrails` | `d01-guardrails-calidad-diagnostico.md` | Reglas que deben limitar inferencias incorrectas y no depender solo del RAG. |
| `06-tenant-context` | `d01-configuracion-calidad-y-semantica.md` | Configuración dependiente de cada ecommerce: fuentes, cadencias, definiciones, moneda, timezone, atribución, etc. |
| `99-auditoria` | `d01-manifest-clasificacion.md` | Trazabilidad de la clasificación. |

No se genera archivo en `05-experience-learning`.

---

## 3. Capas con contenido real

### `01-rag-produccion`

Contenido abundante y central:

- freshness;
- completeness;
- missingness;
- coverage;
- source of truth;
- reconciliación;
- consistencia semántica;
- integridad de eventos;
- consistency checks;
- moneda y timezone;
- granularidad y continuidad;
- salud de ingestión;
- lineage;
- reliability propagation;
- atribución;
- revenue/refunds;
- sample size;
- baselines;
- multi-source validation;
- evidence weight;
- failure modes.

### `02-contratos-IA`

El documento contiene numerosos requisitos de información y vocabulario compartido, pero **no contiene un contrato técnico implementado**.

Se han extraído requisitos sin inventar:

- JSON;
- interfaces;
- tablas;
- endpoints;
- versionado;
- persistencia.

### `03-runtime`

Existe comportamiento operacional claro:

- validar antes de diagnosticar;
- reconciliar;
- comprobar tracking;
- propagar reliability;
- validar periodos;
- cross-validar;
- bloquear o degradar diagnósticos.

### `04-policies-guardrails`

Existe un conjunto fuerte de restricciones de interpretación, por ejemplo:

- no sumar atribución de plataformas;
- no equiparar cero y null;
- no interpretar HTTP 200 como éxito de datos;
- no diagnosticar deterioro empresarial si el tracking no es fiable;
- no emitir alta confidence sobre evidencia insuficiente.

### `06-tenant-context`

El documento exige contexto configurable de cada ecommerce:

- cadencias;
- source of truth;
- definiciones de métricas;
- moneda;
- timezone;
- arquitectura de integración;
- atribución;
- reglas de revenue/refunds;
- scopes;
- fuentes de validación.

### `05-experience-learning`

No se genera porque el documento no define:

- aprendizaje a partir de outcomes;
- memoria de experiencias;
- feedback loop;
- promoción de conocimiento;
- decay;
- generalización entre experiencias.

`Historical backfill`, `late arriving data`, `baseline quality`, `evidence weight` y `confidence` son relevantes para la calidad de una ejecución, pero no constituyen por sí mismos un sistema de aprendizaje experiencial.

---

## 4. Conceptos clasificados en más de una capa

### Freshness

- **RAG:** principio de frescura contextual.
- **Contrato:** información necesaria para representar freshness.
- **Runtime:** momento y secuencia en que se evalúa.
- **Tenant:** cadencia esperada de cada fuente.
- **Guardrail:** prohibición de un threshold global.

### Source of Truth

- **RAG:** principio de jerarquía de fuentes.
- **Contrato:** información que debe compartirse sobre la jerarquía.
- **Runtime:** resolución de la fuente adecuada antes de reconciliar.
- **Tenant:** jerarquía concreta de cada ecommerce.

### Metric definitions

- **RAG:** consistencia semántica y definition drift.
- **Contrato:** requisitos de definición de métricas.
- **Runtime:** validación semántica antes de comparar.
- **Tenant:** definición concreta de CAC, MER, revenue y otras métricas.
- **Guardrail:** no mezclar definiciones incompatibles.

### Attribution

- **RAG:** conocimiento experto sobre self-attribution, windows y model drift.
- **Contrato:** requisitos para representar metodología.
- **Runtime:** comprobación de atribución antes del diagnóstico.
- **Tenant:** configuración concreta de cada plataforma.
- **Guardrail:** prohibición de sumar attributed revenue como revenue del negocio.

### Reliability / lineage

- **RAG:** principio de propagación de calidad.
- **Contrato:** dependencias y estado de reliability.
- **Runtime:** propagación desde inputs hacia métricas derivadas.
- **Guardrail:** una dependencia crítica degradada limita la salida.

### Baselines y period closure

- **RAG:** conocimiento sobre comparabilidad temporal.
- **Contrato:** estado del periodo.
- **Runtime:** comprobación antes de comparar.
- **Tenant:** periodos especiales del negocio.
- **Guardrail:** no comparar ventanas no equivalentes.

### Evidencia y confidence

- **RAG:** peso relativo de evidencias y fragilidad.
- **Contrato:** requisitos de salida.
- **Runtime:** ponderación y decisión final.
- **Guardrail:** limitar confidence cuando la evidencia es insuficiente.

La duplicación se ha adaptado a la responsabilidad de cada capa y no se han copiado párrafos completos indiscriminadamente.

---

## 5. Redundancias reducidas del RAG

Se consolidaron conceptos repetidos en el original:

- freshness + freshness contextual;
- reconciliation + reconciliation status + diferencia no implica error;
- event integrity + duplicate events + missing events + event ratio integrity;
- timezone consistency + day boundary distortion;
- API permissions + rate limits + webhook health + sync health dentro de salud de integración;
- freshness cascade + derived metric lineage + dependency propagation + data lineage;
- attribution reliability + self-attribution + attribution window + model drift + modeled conversions + tracking loss;
- revenue reconciliation + gross/net revenue + refund timing + order status;
- sampling + sample size + statistical fragility;
- historical backfill + late arriving data + period closure;
- multi-source validation + cross-validation matrix + evidence weight;
- ejemplos 106–110 integrados como patrones de interpretación en lugar de repetirlos como secciones extensas.

No se eliminó la capacidad de razonamiento que aportaban esos ejemplos.

---

## 6. Contenido excluido del RAG de producción y motivo

### Estados y telemetría operacional

Elementos como:

- last sync;
- runs;
- retry count;
- dead-letter events;
- records processed;
- records rejected;
- estados concretos de una ejecución;

no se tratan como conocimiento recuperable estático cuando representan runtime o telemetría.

### Configuración de tenant

No se embeben como verdad universal:

- cadencias concretas;
- fuente primaria concreta;
- currency de reporting;
- timezone;
- attribution window;
- definición interna de revenue.

El corpus utiliza ejemplos concretos para ilustrar principios, pero su valor correcto es contextual.

### Implementación técnica

No se ha creado schema, API, tabla ni persistencia porque la fuente no los define.

---

## 7. Posibles solapamientos con otros documentos

El propio documento anticipa o sugiere solapamiento con:

- **D2** para comparación de periodos y baselines equivalentes;
- documentos de contratos de IA que formalicen schemas y estados;
- runtime de observabilidad/ingestión;
- políticas de ejecución o supervisión que definan qué hacer cuando el diagnóstico queda bloqueado;
- capas posteriores de experiencia/learning si confidence, outcomes o evidence history se convierten en memoria operacional.

Estos solapamientos deben resolverse por responsabilidad, no eliminando los conceptos compartidos.

---

## 8. Irregularidades detectadas en el documento fuente

La numeración del documento recibido no es continua:

- comienza en la sección 7;
- después de 63 salta a 68;
- después de 69 salta a 88;
- faltan otros números intermedios antes de 112.

No se ha inferido ni reconstruido contenido ausente.

Esto parece indicar que el archivo recibido puede ser un extracto de un corpus mayor o que determinadas secciones fueron eliminadas previamente.

---

## 9. Pérdida de información

**No se detecta pérdida relevante causada por la clasificación.**

Toda la inteligencia útil del documento queda cubierta por al menos una de las capas generadas o conservada íntegramente en `00-corpus-maestro`.

Los ejemplos específicos se han condensado cuando su función era demostrar un principio ya preservado.

---

## 10. Decisiones de arquitectura

1. D1 debe existir en RAG porque contiene conocimiento experto estable.
2. Sus límites de inferencia deben convertirse además en guardrails.
3. Sus estados y señales compartidas requieren un contrato posterior, pero el corpus actual no justifica inventar ese schema.
4. Las reglas de ejecución pertenecen a runtime y no al embedding.
5. Las configuraciones que varían por ecommerce pertenecen a tenant-context.
6. No existe base suficiente para crear experience-learning en este documento.
