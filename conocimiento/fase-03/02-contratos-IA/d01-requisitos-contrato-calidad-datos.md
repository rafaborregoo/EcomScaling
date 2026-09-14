# Fase 03 · D01 — Requisitos contractuales de calidad y fiabilidad de datos

## Estado del artefacto

El documento fuente **no define un schema implementado, versionado ni serializado**. Define vocabulario, estados y requisitos conceptuales que deben poder intercambiar los componentes del sistema.

Este archivo no inventa JSON, tipos de base de datos, endpoints ni nombres definitivos de campos. Formaliza únicamente la información que el documento fuente exige o implica de forma directa.

---

## 1. Requisitos de evaluación de una fuente o dataset

Una evaluación de calidad debe poder comunicar, cuando aplique:

- identidad o referencia de la fuente;
- scope o segmento evaluado;
- periodo evaluado;
- momento de última sincronización o equivalente;
- cadencia esperada;
- estado de freshness;
- observaciones esperadas;
- observaciones disponibles;
- coverage;
- tipo de missingness;
- reliability resultante;
- razones que justifican la degradación.

Estados de freshness presentes en la fuente:

- `REAL_TIME`
- `FRESH`
- `DELAYED`
- `STALE`
- `SEVERELY_STALE`
- `UNKNOWN`

Tipos de missingness presentes en la fuente:

- `RANDOM_MISSINGNESS`
- `SYSTEMATIC_MISSINGNESS`
- `TIME_RANGE_MISSINGNESS`
- `SEGMENT_MISSINGNESS`
- `SOURCE_MISSINGNESS`

---

## 2. Requisitos de jerarquía y reconciliación de fuentes

Para una métrica o fenómeno debe poder comunicarse:

- fuente primaria;
- fuentes secundarias;
- fuentes de validación;
- fuentes derivadas;
- criterio o scope para el que aplica esa jerarquía.

Categorías definidas:

- `PRIMARY_SOURCE`
- `SECONDARY_SOURCE`
- `VALIDATION_SOURCE`
- `DERIVED_SOURCE`

Una reconciliación entre fuentes debe poder expresar:

- fuentes comparadas;
- fenómeno o métrica reconciliada;
- si las fuentes son comparables;
- diferencia observada;
- clasificación de la variación;
- explicación conocida o sospechada cuando exista.

Estados definidos:

- `MATCHED`
- `ACCEPTABLE_VARIANCE`
- `MATERIAL_VARIANCE`
- `SEVERE_VARIANCE`
- `NOT_COMPARABLE`

Debe preservarse la distinción entre `DATA_DISCREPANCY` y `DATA_ERROR`.

---

## 3. Requisitos de definición de métricas

El sistema debe poder intercambiar una definición de métrica suficientemente explícita para evitar ambigüedad entre agentes.

El documento fuente muestra como información relevante:

- nombre de métrica;
- definición;
- fórmula cuando sea derivada;
- fuente;
- scope;
- moneda o unidad cuando aplique.

Debe poder indicarse si existe `METRIC_DEFINITION_DRIFT`.

El documento no define el schema ni la versionación de un registro de métricas.

---

## 4. Requisitos de schema e integridad de eventos

Debe poder comunicarse la detección de `SCHEMA_DRIFT`.

Para eventos de tracking, una evaluación debe poder representar, cuando corresponda:

- existencia;
- disparo correcto;
- duplicación;
- corrección del payload;
- corrección temporal;
- corrección de atribución.

También debe poder expresar anomalías como:

- evento duplicado;
- evento ausente;
- inconsistencia entre ratios del funnel;
- definiciones incompatibles;
- ausencia de eventos upstream.

---

## 5. Requisitos de integridad matemática y lógica

Un componente de validación debe poder devolver:

- métrica o relación validada;
- valor observado;
- valor esperado o relación lógica;
- estado de consistencia;
- anomalía detectada;
- explicación disponible.

El documento fuente no define estados cerrados para estas validaciones, salvo los ejemplos y categorías de error descritos.

---

## 6. Requisitos de moneda y tiempo

Para análisis multi-moneda, el intercambio de datos debe poder conservar, cuando aplique:

- `native_currency`;
- `reporting_currency`;
- `conversion_rate`;
- `conversion_timestamp`.

Para análisis temporales debe poder conocerse:

- timezone de la fuente;
- timezone de reporting o referencia;
- alineamiento de timezone;
- ventana temporal comparada;
- posible distorsión por day boundary.

---

## 7. Requisitos de granularidad y continuidad

Debe poder comunicarse:

- granularidad disponible;
- granularidad requerida;
- si la granularidad es suficiente para la investigación;
- huecos de continuidad detectados.

Niveles mencionados en la fuente:

- `REAL_TIME`
- `HOURLY`
- `DAILY`
- `WEEKLY`
- `MONTHLY`
- `CAMPAIGN_LEVEL`
- `ADSET_LEVEL`
- `AD_LEVEL`
- `PRODUCT_LEVEL`
- `SKU_LEVEL`
- `CUSTOMER_LEVEL`

---

## 8. Requisitos de salud de integración

### Permisos

Debe poder comunicarse un `PERMISSION_GAP` cuando una conexión existe pero carece de acceso suficiente a determinados datos.

### Rate limits

Debe poder comunicarse un estado equivalente a `INGESTION_DEGRADED` cuando rate limits u otros fallos produzcan una ingesta parcial.

### Webhooks

La evaluación puede requerir información sobre:

- delivery success;
- retry count;
- latency;
- dead-letter events;
- signature failures;
- duplicate deliveries.

### Sincronizaciones batch

La evaluación puede requerir:

- expected runs;
- successful runs;
- failed runs;
- partial runs;
- last complete run;
- records processed;
- records rejected.

---

## 9. Requisitos de lineage y dependencias

Una métrica derivada debe poder identificar sus dependencias materiales.

La información intercambiada debe permitir:

- trazar una salida hasta sus inputs;
- conocer freshness y reliability de las dependencias;
- propagar degradación de calidad;
- remontar evidencia hacia la fuente.

Cadena conceptual expresada en el documento:

`source → raw_table → normalized_table → business_metric → signal → diagnostic_evidence`

El documento no define identificadores técnicos ni formato de lineage.

---

## 10. Requisitos de atribución

Cuando una métrica dependa de atribución, debe poder conocerse, cuando esté disponible:

- tipo de atribución: plataforma, analytics, backend, blended o incrementality;
- attribution window;
- cambios de attribution model o window;
- si las conversiones son observadas, modeladas o estimadas;
- posibles pérdidas de tracking o consentimiento.

Esto es necesario para evitar comparar cifras cuya metodología haya cambiado.

---

## 11. Requisitos de revenue, refunds y pedidos

Debe poder comunicarse la definición concreta de revenue utilizada.

Cuando aplique, deben distinguirse conceptos como:

- gross sales;
- net sales;
- total sales;
- recognized revenue.

Debe poder conocerse la lógica temporal de reconocimiento de refunds.

Estados de pedido mencionados:

- `paid`
- `pending`
- `cancelled`
- `refunded`
- `partially_refunded`
- `fraudulent`
- `test`

---

## 12. Requisitos sobre datos contaminados o no representativos

La evaluación debe poder señalar o identificar, cuando sea posible:

- test orders;
- developer events;
- sandbox payments;
- internal employee purchases;
- QA events;
- bot traffic;
- internal traffic.

---

## 13. Requisitos de sampling y suficiencia de evidencia

Debe poder indicarse si los datos están muestreados.

La fuente propone estados conceptuales de fragilidad:

- `LOW_SAMPLE`
- `HIGH_VARIANCE`
- `INSUFFICIENT_OBSERVATIONS`

Un resultado diagnóstico debe poder reflejar confidence reducido cuando estas condiciones sean materiales.

---

## 14. Requisitos de temporalidad y cierre de periodo

Debe poder distinguirse un periodo:

- `OPEN`
- `PARTIALLY_SETTLED`
- `SETTLED`

Debe poder comunicarse:

- existencia de historical backfill;
- llegada tardía de datos;
- estado de cierre;
- comparabilidad temporal del baseline.

---

## 15. Requisitos de fiabilidad segmentada

La reliability debe poder asociarse a un scope y no únicamente a una fuente global.

El scope puede representar, según el caso:

- mercado;
- canal;
- tipo de pedido;
- producto;
- periodo;
- otro segmento material.

El documento no define una taxonomía cerrada de scopes.

---

## 16. Requisitos de evidencia diagnóstica

Una evidencia o conjunto de evidencias debería poder comunicar:

- fenómeno observado;
- fuente;
- scope;
- peso o relevancia para la pregunta;
- corroboración por otras fuentes;
- si es evidencia instrumentada o humana;
- confidence;
- gaps de datos;
- posibles explicaciones técnicas.

La evidencia humana debe permanecer diferenciada de la evidencia instrumentada.

---

## 17. Requisitos de salida hacia el diagnóstico

Cuando D1 determina que los datos no permiten una conclusión empresarial sólida, la salida debe poder expresar como mínimo:

- issue o anomalía de datos;
- evidencia que sustenta la evaluación;
- confidence;
- `data_gap` cuando exista;
- si el diagnóstico downstream queda operativo, degradado o bloqueado.

El documento muestra explícitamente resultados como:

- `BLOCKED`
- `DEGRADED`
- `FAIL`
- confidence `HIGH`, `LOW` o `MEDIUM`

No define un enum contractual completo ni un schema definitivo para estos estados.

---

## 18. Elementos no definidos por el documento

No se consideran implementados ni deben inventarse a partir de este archivo:

- JSON Schema;
- TypeScript interfaces;
- tablas;
- nombres de columnas definitivos;
- API endpoints;
- versionado de contratos;
- IDs;
- estrategia de persistencia;
- ownership entre agentes;
- protocolo de transporte.

Estos elementos deberán definirse en un contrato técnico posterior.
