# Fase 03 · D01 — Calidad y fiabilidad de los datos

## Propósito

Este documento contiene el conocimiento experto estable que el sistema de diagnóstico debe poder recuperar para decidir si una señal ecommerce es suficientemente fiable antes de interpretarla como un problema o una mejora del negocio.

La calidad de datos no es una propiedad binaria ni necesariamente global. Debe evaluarse por fuente, métrica, periodo, segmento y uso analítico.

---

## 1. Freshness y frescura contextual

**Freshness** responde a si un dato está suficientemente actualizado para el análisis que se quiere realizar.

Estados conceptuales útiles:

- `REAL_TIME`
- `FRESH`
- `DELAYED`
- `STALE`
- `SEVERELY_STALE`
- `UNKNOWN`

No existe un umbral universal de frescura. La frescura debe evaluarse contra la **cadencia esperada de la fuente y del fenómeno**.

Un dato financiero mensual puede seguir siendo válido durante días, mientras que un dato de campañas activas puede quedar obsoleto en horas.

### Principio

> La edad absoluta del dato no determina por sí sola su validez; importa su edad respecto de la cadencia esperada para ese uso.

---

## 2. Completeness, missingness y coverage

### Completeness

Mide si están disponibles las observaciones esperadas.

Una cobertura casi completa puede ser adecuada para ciertos análisis. Una cobertura parcial relevante puede invalidar un diagnóstico, aunque los datos presentes sean correctos.

### Missingness

No todos los datos faltantes significan lo mismo. Debe distinguirse entre:

- `RANDOM_MISSINGNESS`
- `SYSTEMATIC_MISSINGNESS`
- `TIME_RANGE_MISSINGNESS`
- `SEGMENT_MISSINGNESS`
- `SOURCE_MISSINGNESS`

La ausencia sistemática de un segmento puede producir una conclusión falsa sobre el negocio. Por ejemplo, si faltan eventos de un navegador concreto, una caída aparente de conversión en ese segmento puede ser un problema de observabilidad y no de comportamiento del cliente.

### Coverage

Coverage mide cuánto del fenómeno real está representado por una fuente.

Una plataforma de analytics puede cubrir solo una parte del revenue real sin que la fuente transaccional esté equivocada. Una cobertura incompleta debe interpretarse como limitación de observación, no automáticamente como error del sistema de registro principal.

---

## 3. Source of Truth y jerarquía de fuentes

Cada fenómeno o métrica debe tener una **fuente primaria preferente** según lo que se pretende medir.

Ejemplos conceptuales:

- pedidos y revenue transaccional: plataforma ecommerce;
- gasto publicitario: plataforma publicitaria;
- liquidaciones: PSP o finanzas;
- inventario: ecommerce, ERP o WMS según la arquitectura.

Una jerarquía útil distingue:

- `PRIMARY_SOURCE`
- `SECONDARY_SOURCE`
- `VALIDATION_SOURCE`
- `DERIVED_SOURCE`

La jerarquía depende del fenómeno. Una fuente que es primaria para una métrica puede ser secundaria o derivada para otra.

### Principio

> Las plataformas no deben compararse como si midieran exactamente lo mismo solo porque usen nombres similares.

---

## 4. Reconciliación entre fuentes

Fuentes relacionadas deben reconciliarse cuando describen el mismo fenómeno o fenómenos conectados.

Estados conceptuales:

- `MATCHED`
- `ACCEPTABLE_VARIANCE`
- `MATERIAL_VARIANCE`
- `SEVERE_VARIANCE`
- `NOT_COMPARABLE`

Una diferencia entre fuentes no implica necesariamente un error.

Debe distinguirse:

- `DATA_DISCREPANCY`: diferencia explicable por metodología, alcance, timing o atribución;
- `DATA_ERROR`: dato técnicamente incorrecto, incompleto o corrupto.

### Anti-pattern

Sumar revenue atribuido por Meta, Google, Klaviyo u otras plataformas y compararlo directamente con el revenue real del negocio es inválido porque puede existir **attribution overlap**.

---

## 5. Consistencia semántica de métricas

Métricas con el mismo nombre pueden representar conceptos distintos.

Ejemplos:

- Meta ROAS no es necesariamente igual a blended ROAS;
- Shopify conversion rate no es necesariamente igual a GA4 session conversion rate;
- gross sales, net sales, total sales y recognized revenue no son intercambiables.

El diagnóstico necesita conocer la definición de la métrica utilizada.

### Metric Definition Registry

Para cada métrica debería existir una definición consistente que permita conocer, como mínimo:

- significado;
- fórmula cuando sea derivada;
- fuente;
- alcance;
- unidad o moneda cuando aplique.

Esto evita que agentes diferentes calculen una misma métrica de forma distinta.

### Definition Drift

Existe `METRIC_DEFINITION_DRIFT` cuando cambia la definición de una métrica a lo largo del tiempo.

Una aparente variación del negocio puede ser solo un cambio de definición. Antes de atribuir causalidad empresarial debe comprobarse si la semántica se mantuvo estable.

---

## 6. Schema drift e integridad de eventos

### Schema Drift

`SCHEMA_DRIFT` ocurre cuando una integración cambia la estructura o disponibilidad de datos: campos eliminados, cambios de tipo, campos que pasan a ser opcionales o cambios equivalentes.

### Event Integrity

En tracking deben comprobarse, como mínimo:

- existencia del evento;
- disparo correcto;
- ausencia de duplicación;
- payload correcto;
- timestamp correcto;
- atribución correcta.

### Duplicate Events

Un evento de compra duplicado puede inflar artificialmente revenue, CVR y ROAS sin que el negocio haya mejorado.

### Missing Events

Si un evento de analytics cae mientras la evidencia transaccional equivalente permanece estable, debe investigarse primero un fallo de tracking antes de concluir deterioro del comportamiento.

### Event Ratio Integrity

Las relaciones entre eventos deben ser compatibles con el modelo de funnel utilizado. Relaciones imposibles o inesperadas pueden indicar:

- eventos duplicados;
- definiciones incorrectas;
- pérdida de eventos upstream;
- problemas cross-device.

---

## 7. Integridad lógica y matemática

La calidad también exige coherencia interna.

Ejemplos de comprobaciones:

- pedidos no negativos;
- refunds no superiores al universo que los origina, salvo que la definición lo explique;
- conversion rate dentro de un rango lógicamente posible;
- gasto no negativo;
- AOV coherente aproximadamente con revenue / orders;
- métricas derivadas reconciliables con sus inputs.

Una métrica reportada que contradice aritméticamente a sus componentes debe tratarse como inconsistente hasta explicar la diferencia de definición.

---

## 8. Consistencia de moneda y timezone

### Moneda

En negocios internacionales deben distinguirse:

- moneda nativa;
- moneda de reporting;
- tipo de cambio;
- momento o referencia temporal de la conversión.

Un crecimiento aparente puede proceder de FX y no de una mejora económica real.

### Timezone

Comparar periodos diarios de plataformas con zonas horarias distintas puede crear discrepancias artificiales.

Debe verificarse el alineamiento temporal antes de comparar datos diarios o intradía.

### Day Boundary Distortion

Una transacción puede pertenecer a días diferentes según la zona horaria de cada plataforma. Por tanto, la pertenencia a un día calendario no es universal hasta normalizar o alinear timezone.

---

## 9. Granularidad y continuidad

### Granularidad

Los datos pueden existir y aun así ser insuficientes para responder una pregunta.

Niveles habituales:

- tiempo real;
- horario;
- diario;
- semanal;
- mensual;
- campaña;
- ad set;
- anuncio;
- producto;
- SKU;
- cliente.

Si el diagnóstico pretende investigar una caída iniciada ayer, disponer solo de revenue mensual implica granularidad insuficiente.

### Continuidad

Una serie temporal debe comprobarse por continuidad. Una media agregada puede ocultar huecos relevantes en el periodo.

---

## 10. Outliers de ingestión y diferencia entre cero y ausencia

Un valor extremo puede proceder de:

- ingesta duplicada;
- carga histórica masiva;
- corrupción de timestamps.

Antes de interpretar un outlier como cambio empresarial debe descartarse un problema de ingestión.

### Zero vs Missing

`0` y `NULL` no significan lo mismo.

- `0` puede significar ausencia real de actividad;
- `NULL` puede significar dato no disponible, no observado o no recuperado.

Tratarlos como equivalentes puede producir diagnósticos falsos.

---

## 11. Salud de integración

Una conexión técnica activa no garantiza que los datos sean completos.

Fuentes frecuentes de degradación:

- permisos o scopes insuficientes;
- rate limits;
- webhooks fallidos o duplicados;
- sincronizaciones parciales;
- credenciales expiradas;
- cambios de versión de API;
- filtros incorrectos.

### Permission Gap

Una fuente puede estar conectada pero no disponer de todos los objetos necesarios. La ausencia de datos no debe confundirse con ausencia del fenómeno.

### Rate Limits

Los límites de API pueden producir sincronizaciones parciales. El sistema debe diferenciar degradación de ingestión de un cambio empresarial.

### Webhook Health

La fiabilidad event-driven depende de éxito de entrega, retries, latencia, eventos muertos, firmas y duplicados.

### Sync Health

La fiabilidad batch depende, entre otros factores, de runs esperados, correctos, fallidos o parciales, último run completo y registros procesados o rechazados.

---

## 12. Freshness cascade, lineage y propagación de fiabilidad

### Freshness Cascade

Un dataset derivado no puede considerarse más fresco que los inputs de los que depende.

Que un cálculo se haya ejecutado recientemente no vuelve reciente a un input obsoleto.

### Derived Metric Lineage

Toda métrica derivada debe poder relacionarse con sus dependencias.

Si una dependencia material presenta baja fiabilidad, la fiabilidad de la métrica derivada debe degradarse.

### Dependency Propagation

La calidad de una salida no puede evaluarse únicamente por mayoría de inputs. Una dependencia crítica con baja fiabilidad puede limitar la fiabilidad global de la salida.

### Data Lineage

La evidencia debe poder remontarse conceptualmente a lo largo de una cadena como:

`source → raw data → normalized data → business metric → signal → diagnostic evidence`

La trazabilidad permite explicar por qué una evidencia merece un determinado nivel de confianza.

---

## 13. Fiabilidad de atribución

La atribución es una de las áreas de mayor riesgo interpretativo en ecommerce.

Deben distinguirse:

- platform attribution;
- analytics attribution;
- backend attribution;
- blended economics;
- incrementality.

### Platform Self-Attribution

Varias plataformas pueden atribuirse simultáneamente la misma venta. La suma de revenues atribuidos no representa necesariamente el revenue del negocio.

### Attribution Window

Una cifra de rendimiento solo es comparable si se conoce la ventana de atribución utilizada.

Cambiar la ventana puede cambiar ROAS sin que cambie el negocio.

### Attribution Model Drift

Si cambia el modelo o ventana de atribución, una variación aparente puede ser metodológica. Debe descartarse este drift antes de diagnosticar deterioro de campañas.

### Modeled Conversions

Cuando sea posible debe distinguirse entre conversiones:

- observadas;
- modeladas;
- estimadas.

No todas tienen el mismo grado de certeza.

### Consent and Tracking Loss

Cambios en consentimiento, privacidad, navegador, server-side tracking o configuración de píxeles pueden reducir conversiones observadas sin reducir conversiones reales.

### Marketing vs Business Reality

Si cae una métrica atribuida de plataforma pero revenue, gasto y nuevos clientes permanecen estables, debe considerarse deterioro de atribución o tracking antes que deterioro empresarial.

---

## 14. Revenue, refunds y estados de pedido

### Revenue Reconciliation

La definición interna de revenue debe ser explícita y coherente con sus componentes.

Gross sales, descuentos, devoluciones, shipping, impuestos u otros elementos pueden producir cifras distintas según la metodología utilizada.

### Gross vs Net Revenue

No deben mezclarse métricas de revenue con bases distintas.

### Refund Timing

Una venta y su devolución pueden pertenecer a periodos distintos. La metodología de reconocimiento de refunds afecta a las comparaciones temporales.

### Order Status

El análisis debe distinguir estados como:

- paid;
- pending;
- cancelled;
- refunded;
- partially refunded;
- fraudulent;
- test.

Los pedidos de prueba no representan actividad comercial real.

---

## 15. Contaminación de datos

Cuando sea posible deben excluirse o identificarse:

- test orders;
- developer events;
- sandbox payments;
- compras internas de empleados;
- eventos de QA;
- bot traffic;
- internal traffic.

### Bot Traffic

Un aumento brusco de sesiones acompañado de revenue estable, rebote extremo o geografías inusuales puede ser tráfico automatizado y no crecimiento real.

---

## 16. Sampling, tamaño muestral y fragilidad estadística

### Sampling

Los datos muestreados reducen el nivel de precisión que puede justificarse.

### Sample Size

Variaciones grandes con muy pocas observaciones pueden ser ruido.

### Statistical Fragility

Sin convertir el diagnóstico en un sistema estadístico completo, conviene poder reconocer estados como:

- `LOW_SAMPLE`
- `HIGH_VARIANCE`
- `INSUFFICIENT_OBSERVATIONS`

Una conclusión fuerte requiere evidencia proporcionalmente fuerte.

---

## 17. Calidad del baseline y temporalidad de los datos

La calidad no debe evaluarse solo en el periodo actual. El baseline también debe ser técnicamente comparable.

Un periodo promocional excepcional puede invalidar una comparación aunque los datos estén completos.

### Historical Backfill

Una carga histórica puede crear spikes artificiales en el momento de ingestión. Debe distinguirse del crecimiento real.

### Late Arriving Data

Algunas métricas se completan con retraso. El valor observado inicialmente puede cambiar después por datos tardíos.

### Period Closure

Estados conceptuales:

- `OPEN`
- `PARTIALLY_SETTLED`
- `SETTLED`

Comparar un periodo abierto con uno completamente cerrado puede producir conclusiones inválidas.

---

## 18. Fiabilidad por scope o segmento

La calidad no tiene por qué ser global para una fuente.

Una misma integración puede ser fiable en un mercado y deficiente en otro, o correcta para pedidos estándar y deficiente para suscripciones.

La fiabilidad debe poder expresarse por scope relevante: mercado, producto, tipo de pedido, canal, periodo u otro segmento material.

---

## 19. Anomalías técnicas temporales

Cuando una métrica instrumentada cambia abruptamente coincidiendo con un despliegue técnico, cambio de tracking o modificación equivalente, debe investigarse primero una regresión técnica.

La coincidencia temporal no prueba causalidad por sí sola, pero cambia la prioridad de investigación.

---

## 20. Validación multi-source y peso de la evidencia

La corroboración entre fuentes aumenta la fuerza de una señal.

Ejemplo conceptual:

- si pedidos, pagos y envíos caen simultáneamente, existe evidencia empresarial fuerte;
- si solo cae el evento de purchase en analytics mientras pedidos y pagos permanecen estables, la hipótesis técnica es más fuerte.

### Cross-validation

Cada fenómeno puede disponer de una fuente principal y una o varias fuentes de validación.

### Evidence Weight

Dos evidencias no tienen el mismo peso para todas las preguntas.

Para investigar pedidos reales, una orden pagada en el backend puede pesar más que un evento de purchase en analytics.

### Human Evidence

Tickets de soporte, quejas, informes internos, incidencias de almacén o avisos de proveedores pueden aportar evidencia valiosa.

Deben distinguirse de datos instrumentados y no convertirse automáticamente en porcentajes o magnitudes sin denominador válido.

---

## 21. Patrones recurrentes de fallo

El sistema de diagnóstico debe reconocer, como mínimo, patrones como:

- silent integration failure;
- partial sync;
- duplicated sync;
- stale token;
- expired credentials;
- permission removal;
- API version migration;
- timezone drift;
- currency normalization failure;
- event duplication;
- event suppression;
- tracking deployment regression;
- attribution window change;
- historical backfill;
- schema change;
- incorrect filter;
- bot spike;
- test data pollution.

### Silent Failure

Una respuesta técnica satisfactoria no demuestra que los datos sean correctos o completos.

> `HTTP success` no equivale a `data success`.

---

## 22. Criterio de salida para el diagnóstico

Cuando la calidad de la evidencia es insuficiente, el sistema no debe forzar una conclusión empresarial.

Resultados conceptuales posibles:

- evidencia apta para diagnóstico;
- diagnóstico degradado;
- diagnóstico bloqueado;
- hipótesis técnica prioritaria;
- `data_gap` explícito;
- confidence reducido.

### Ejemplos de interpretación

**Caída atribuida de Meta con negocio estable y despliegue reciente de píxel:** priorizar hipótesis de regresión de tracking y degradar o bloquear el diagnóstico de adquisición.

**Purchases de GA4 crecen fuertemente mientras pedidos reales permanecen estables:** priorizar duplicación de eventos antes que mejora de conversión.

**Importación parcial de campañas:** no calcular CAC como si el gasto importado fuera completo.

**Periodo actual incompleto frente a día completo anterior:** la comparación no es válida; deben alinearse ventanas equivalentes.

**Señal compatible con fatiga creativa pero sin datos a nivel creativo:** mantener la hipótesis con confidence bajo o medio y declarar el gap de datos.
