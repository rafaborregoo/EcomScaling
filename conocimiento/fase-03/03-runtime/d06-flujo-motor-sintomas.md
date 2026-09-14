# Fase 03 · D06 — Runtime del motor de síntomas

## Propósito

D6 convierte signals y signal clusters en patrones empresariales observables suficientemente coherentes para ser tratados como symptoms.

---

## 1. Inputs

D6 consume:

- signals de D5;
- signal clusters;
- data confidence de D1;
- context de D2;
- maturity de D3;
- health state de D4;
- business scope;
- known business relationships;
- symptom pattern library;
- diagnostic memory cuando exista.

---

## 2. Pipeline principal

### Paso 1 — Recibir signals

Mantener:

- source;
- scope;
- timing;
- confidence;
- direction;
- magnitude;
- supporting context.

### Paso 2 — Revisar signal quality

Excluir o degradar señales insuficientemente fiables.

### Paso 3 — Buscar relaciones relevantes

Comprobar:

- temporal;
- mathematical;
- funnel;
- functional;
- economic;
- operational.

### Paso 4 — Evaluar pattern coherence

Confirmar:

- same/compatible time window;
- same/compatible scope;
- compatible directions;
- known relationship;
- sufficient evidence quality.

### Paso 5 — Formar business pattern

Transformar cluster coherente en candidate business pattern.

### Paso 6 — Aplicar symptom templates

Comparar con patrones expertos reutilizables.

### Paso 7 — Revisar contexto D2

Evitar síntomas falsos por:

- seasonality;
- promotion;
- mix;
- price change;
- launch;
- audience shift;
- market shift.

### Paso 8 — Localizar scope

Buscar el nivel más específico soportado por evidencia.

### Paso 9 — Determinar family

Asignar dominio:

- acquisition;
- creative;
- conversion;
- etc.

### Paso 10 — Determinar valence

Clasificar:

- negative;
- positive;
- neutral;
- mixed.

### Paso 11 — Determinar diagnostic depth

Clasificar:

- surface;
- intermediate;
- deep.

### Paso 12 — Determinar process position

Si aplica:

- upstream;
- midstream;
- downstream.

### Paso 13 — Determinar time role

Si aplica:

- leading;
- coincident;
- lagging.

### Paso 14 — Revisar parent-child relations

Crear jerarquía de síntomas cuando existan varios niveles.

### Paso 15 — Descomponer síntomas amplios

Ejemplos:

- Revenue decline → Traffic/CVR/AOV/Repeat.
- Contribution decline → Revenue/COGS/Discount/Shipping/Fees/Media/Refunds.
- Cash decline → Contribution/Inventory/Payables/Receivables/etc.

### Paso 16 — Componer síntomas relacionados

Varios síntomas pueden formar uno superior si existe coherencia suficiente.

### Paso 17 — Permitir múltiples síntomas

No forzar una narrativa única si existen patrones independientes.

### Paso 18 — Integrar evidencia cualitativa

Combinar texto y métricas cuando aporten especificidad.

### Paso 19 — Evaluar recurrence/chronicity

Clasificar:

- acute;
- recurring;
- chronic.

### Paso 20 — Registrar candidate relations

Guardar:

- may_precede;
- may_follow;
- often_cooccurs.

Sin causalidad.

### Paso 21 — Contrastar diagnostic memory

Consultar patrones previos similares sin convertirlos en explicación automática.

### Paso 22 — Construir Symptom Object

Incluir:

- pattern;
- scope;
- evidence;
- confidence;
- granularity;
- valence;
- depth;
- time role;
- relations.

### Paso 23 — Actualizar Business Symptom Map

Mantener síntomas activos por capability y scope.

### Paso 24 — Enviar a D7/D8

D7 recibe relaciones candidatas para causal graph.

D8 recibe symptoms para generación de hypotheses.

---

## 3. Refinement loop

Cuando existe un surface symptom:

1. descomponer;
2. solicitar/leer lower-level signals;
3. localizar scope;
4. construir deeper symptom;
5. repetir mientras aumente diagnostic utility y exista evidencia suficiente.

---

## 4. Multi-symptom behavior

D6 debe permitir:

- independent symptoms;
- connected symptoms;
- parent-child symptoms;
- cross-capability symptoms.

No debe fusionarlos automáticamente.

---

## 5. Output boundary

D6 termina en:

- symptom;
- symptom map;
- symptom graph no causal;
- relations candidates.

No termina en:

- hypothesis confirmada;
- cause;
- priority;
- recommendation.
