# Fase 03 · D01 — Flujo operativo de evaluación de calidad de datos

## Propósito

Este documento extrae del corpus D1 el comportamiento operacional del sistema antes y durante un diagnóstico ecommerce.

No define código, APIs ni persistencia.

---

## 1. Principio de ejecución

Antes de interpretar una variación como cambio del negocio, el sistema debe determinar si la evidencia disponible es técnicamente apta para sostener esa interpretación.

La evaluación de calidad puede:

- permitir el diagnóstico;
- degradar su confidence;
- exigir una hipótesis técnica prioritaria;
- bloquear una conclusión downstream.

---

## 2. Secuencia de evaluación

### Paso 1 — Identificar fenómeno, fuente y scope

Determinar:

- qué fenómeno se intenta diagnosticar;
- qué métrica lo representa;
- qué fuente actúa como referencia primaria;
- qué otras fuentes pueden validar;
- qué segmento y periodo están siendo analizados.

La calidad no debe evaluarse solo a nivel global de integración si el diagnóstico ocurre en un scope concreto.

### Paso 2 — Evaluar freshness contra la cadencia esperada

Comparar la edad del dato con la frecuencia esperada de actualización para esa fuente y uso.

Clasificar la freshness con los estados definidos en el corpus.

Si la fuente está obsoleta para el análisis, degradar su peso o impedir que sustente una conclusión sensible al tiempo.

### Paso 3 — Evaluar completeness, missingness y coverage

Comprobar:

- observaciones esperadas frente a disponibles;
- existencia de huecos temporales;
- ausencia de segmentos;
- ausencia de fuentes;
- cobertura del fenómeno.

Si la falta de datos puede sesgar la interpretación, declarar el gap explícitamente.

### Paso 4 — Comprobar source of truth y comparabilidad

Resolver cuál es la fuente primaria para la pregunta.

Antes de reconciliar, comprobar que las fuentes:

- representan el mismo fenómeno;
- usan definiciones compatibles;
- cubren periodos comparables;
- no presentan solapamiento de atribución que invalide una suma o contraste.

### Paso 5 — Reconciliar fuentes

Clasificar la relación entre fuentes como matched, variación aceptable, material, severa o no comparable.

No transformar automáticamente una discrepancia en un error.

### Paso 6 — Comprobar consistencia semántica

Verificar la definición de las métricas utilizadas.

Detectar si:

- dos métricas con el mismo nombre significan cosas distintas;
- una fórmula ha cambiado;
- una ventana o modelo de atribución ha cambiado;
- gross, net, total o recognized revenue están mezclándose.

Si existe definition drift, reducir la comparabilidad histórica.

### Paso 7 — Comprobar schema e integridad de tracking

Investigar:

- schema drift;
- eventos ausentes;
- eventos duplicados;
- payload incorrecto;
- timestamps incorrectos;
- relaciones imposibles del funnel.

Cuando analytics y backend divergen, priorizar la investigación técnica antes de atribuir el cambio al comportamiento del cliente.

### Paso 8 — Ejecutar checks lógicos y matemáticos

Validar relaciones fundamentales y métricas derivadas.

Si una métrica no coincide con sus componentes, marcar inconsistencia y no utilizarla como evidencia fuerte sin explicación.

### Paso 9 — Normalizar contexto temporal y monetario

Comprobar:

- moneda nativa y de reporting;
- tipo de cambio;
- timestamp de conversión;
- timezone;
- day boundaries;
- equivalencia de ventanas temporales.

No comparar periodos que cubren duraciones distintas o estados de cierre distintos como si fueran equivalentes.

### Paso 10 — Evaluar granularidad y continuidad

Determinar si el nivel de detalle permite responder a la pregunta.

Detectar huecos en series temporales que puedan quedar ocultos por agregaciones.

### Paso 11 — Verificar salud de ingestión

Revisar señales de:

- permission gaps;
- rate limits;
- webhooks fallidos o duplicados;
- syncs parciales;
- credenciales o tokens;
- cambios de API;
- backfills.

Una respuesta HTTP correcta no finaliza la validación si la cobertura real de datos es incompleta.

### Paso 12 — Propagar calidad por lineage

Para métricas derivadas:

1. identificar dependencias;
2. obtener freshness y reliability de cada dependencia material;
3. degradar la salida cuando una dependencia crítica esté degradada;
4. conservar trazabilidad hasta la fuente.

La hora de cálculo de la métrica derivada no sustituye la freshness de sus inputs.

### Paso 13 — Evaluar atribución y tracking

Cuando la señal procede de marketing:

- distinguir atribución de plataforma, analytics, backend, blended e incrementality;
- comprobar attribution window;
- detectar model drift;
- considerar conversiones modeladas;
- considerar cambios de consentimiento, navegador, píxel o server-side tracking.

Una caída de atribución no debe traducirse automáticamente en caída de negocio.

### Paso 14 — Limpiar datos no representativos

Identificar o excluir cuando sea posible:

- tests;
- sandbox;
- QA;
- compras internas;
- bots;
- tráfico interno.

### Paso 15 — Evaluar suficiencia estadística mínima

Comprobar si la evidencia tiene tamaño muestral suficiente y si existe alta varianza o sampling.

Si la evidencia es frágil, limitar la confidence.

### Paso 16 — Evaluar baseline y cierre temporal

Comprobar:

- comparabilidad técnica del baseline;
- promociones o contextos que lo vuelvan no equivalente;
- backfill histórico;
- datos tardíos;
- si el periodo está open, partially settled o settled.

### Paso 17 — Cross-validation

Para señales materiales, buscar corroboración en fuentes independientes cuando existan.

Ejemplo operacional:

- orders ↓ + payments ↓ + shipments ↓ → mayor probabilidad de señal empresarial real;
- analytics purchase ↓ + orders estables + payments estables → mayor probabilidad de problema de analytics.

### Paso 18 — Ponderar evidencia

Dar mayor peso a la evidencia más directamente relacionada con la pregunta.

La evidencia humana puede reforzar una hipótesis, pero no debe convertirse en magnitud cuantitativa sin base válida.

### Paso 19 — Emitir resultado D1

El resultado debe distinguir entre:

- datos aptos;
- datos degradados;
- datos insuficientes;
- issue técnico probable;
- diagnóstico downstream bloqueado o degradado.

Debe adjuntar las razones principales, confidence y gaps materiales.

---

## 3. Ramas operativas destacadas

### A. Tracking cae, negocio estable

Si conversiones atribuidas o eventos caen, pero pedidos, clientes o pagos permanecen estables:

1. inspeccionar tracking y attribution;
2. revisar despliegues recientes;
3. revisar consentimiento y configuración;
4. evitar diagnosticar deterioro del canal hasta resolver D1.

### B. Analytics sube, backend estable

Si purchases de analytics crecen muy por encima de pedidos reales:

1. comprobar duplicación de eventos;
2. comprobar schema/payload;
3. comparar ratios del funnel;
4. no concluir mejora de conversión sin reconciliación.

### C. Fuente parcialmente importada

Si faltan campañas, segmentos o periodos:

1. estimar coverage;
2. identificar causa de missingness;
3. impedir cálculos derivados que asuman completitud;
4. declarar `FAIL`, degradación o gap según severidad.

### D. Periodo todavía abierto

Si el periodo actual no está cerrado:

1. evitar compararlo contra un periodo completo;
2. alinear ventanas equivalentes;
3. marcar estado de cierre;
4. reducir confidence cuando existan late-arriving data.

### E. Señal plausible pero granularidad insuficiente

Si existe una señal agregada pero faltan dimensiones necesarias para confirmar la causa:

1. mantener la hipótesis como no confirmada;
2. declarar el data gap;
3. reducir confidence;
4. solicitar o esperar el nivel de datos necesario antes de confirmar.
