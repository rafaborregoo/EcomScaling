# Fase 03 · D05 — Runtime del motor de señales y anomalías

## Propósito

D5 transforma observaciones validadas en cambios relevantes que merecen investigación.

---

## 1. Inputs

D5 consume:

- datos validados por D1;
- contexto de D2;
- maturity de D3 cuando sea relevante;
- health state de D4;
- baselines;
- guardrails;
- metric lineage;
- eventos de cambio;
- histórico de señales;
- scopes del tenant.

---

## 2. Pipeline principal

### Paso 1 — Ingestar observation

Registrar valor, timestamp, source, metric y scope.

### Paso 2 — Seleccionar baseline

Elegir uno o varios baselines contextualmente válidos.

### Paso 3 — Calcular variation

Medir diferencia absoluta, relativa o residual.

### Paso 4 — Ajustar por contexto

Aplicar:

- seasonality;
- weekday;
- promotion;
- market;
- channel;
- business stage;
- event context.

### Paso 5 — Proteger small samples

Si D1 indica bajo sample, reducir confidence o suprimir señal.

### Paso 6 — Detectar señal por tipo

Evaluar:

- level;
- trend;
- step change;
- rate;
- acceleration;
- volatility;
- concentration;
- mix;
- ratio;
- capacity;
- dependency;
- regression;
- improvement;
- risk.

### Paso 7 — Estimar onset

Determinar cuándo comenzó el cambio.

### Paso 8 — Detectar change points

Localizar rupturas candidatas de régimen.

### Paso 9 — Evaluar persistence

Clasificar:

- transient;
- emerging;
- persistent;
- chronic.

### Paso 10 — Evaluar expected range

Comparar observed vs expected contextual value.

### Paso 11 — Evaluar guardrails

Detectar:

- breach;
- crossing;
- approaching guardrail.

### Paso 12 — Evaluar statistical strength

Aplicar método apropiado cuando sea necesario.

### Paso 13 — Evaluar business significance

Considerar exposure y materialidad económica/operativa.

### Paso 14 — Localizar scope

Buscar si el cambio es:

- global;
- localized;
- segment-specific.

### Paso 15 — Top-down drilldown

Si existe anomalía global, investigar candidate dimensions.

### Paso 16 — Bottom-up scan

Detectar subsegmentos críticos aunque el global sea estable.

### Paso 17 — Detectar multi-dimensional interactions

Analizar relaciones y ratios.

### Paso 18 — Descomponer métricas

Utilizar metric graph para identificar contribuciones matemáticas.

### Paso 19 — Corroborar fuentes

Aumentar confidence cuando fuentes independientes coinciden.

### Paso 20 — Detectar conflictos

Emitir `SIGNAL_CONFLICT` cuando la evidencia diverge.

### Paso 21 — Deduplicar

Usar temporal overlap, scope y dependency para evitar múltiples alertas del mismo fenómeno.

### Paso 22 — Crear Signal Cluster

Agrupar señales relacionadas sin convertirlas todavía en síntoma.

### Paso 23 — Relacionar business events

Vigilar ventanas pre/post y expected lags.

### Paso 24 — Evaluar leading indicators

Emitir early risk signals cuando corresponda.

### Paso 25 — Comparar patrones históricos

Consultar known patterns del tenant.

### Paso 26 — Evaluar novelty

Distinguir first-ever, rare, common y recurring.

### Paso 27 — Aplicar suppression

Reducir atención a patrones conocidos y explicados.

### Paso 28 — Emitir Signal Card

Preservar explicación, confidence, exposure y evidencia.

### Paso 29 — Actualizar D4

Varias señales pueden provocar health update.

### Paso 30 — Enviar a D6

D6 recibe señales y clusters para construir síntomas.

---

## 3. D4 ↔ D5 loop

Ciclo:

`METRICS → SIGNALS → HEALTH → HEALTH CHANGE → NEW INVESTIGATION`

Una transición D4 puede generar una señal.

Varias señales D5 pueden actualizar health.

---

## 4. Scheduling

### Instant / real-time

- checkout outage;
- payment failure;
- integration disconnect;
- uptime.

### Short-term

- CAC;
- CVR;
- creative;
- ads.

### Medium-term

- inventory;
- retention cohorts;
- margin.

### Long-term

- brand demand;
- market position;
- organizational maturity.

Cada métrica debe usar una frecuencia acorde con su dinámica.

---

## 5. Signal processing boundaries

D5 puede:

- detectar;
- contextualizar;
- agrupar;
- corroborar;
- localizar;
- descomponer;
- estimar relevancia;
- monitorizar.

D5 no puede:

- confirmar síntoma empresarial final;
- confirmar root cause;
- recomendar acción;
- priorizar intervención.
