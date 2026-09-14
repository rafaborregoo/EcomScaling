# Fase 03 · D02 — Experiencia histórica y aprendizaje contextual

## Propósito

D2 contiene contenido suficiente para una capa de experiencia porque reconoce explícitamente que diagnósticos anteriores, experimentos y decisiones pasadas forman parte del contexto futuro.

Este documento no inventa un sistema completo de aprendizaje automático. Extrae únicamente los mecanismos conceptuales soportados por la fuente.

---

## 1. Experiencia previa como contexto

El historial de:

- diagnósticos;
- experimentos;
- decisiones;
- cambios deliberados;
- resultados observados posteriormente;

puede modificar la interpretación de una señal actual.

Ejemplo conceptual:

Una caída de CVR después de retirar un descuento puede ser esperada si la decisión buscaba recuperar margen.

Sin el historial de decisión, la variación podría parecer un fallo.

---

## 2. Diferencia entre tenant context y experience

### Tenant context

Describe cómo es o cómo está configurado el ecommerce en un momento determinado:

- mercados;
- canales;
- objetivos;
- estrategia;
- restricciones;
- mix;
- measurement state.

### Experience

Describe qué ocurrió antes:

- qué diagnóstico se hizo;
- qué intervención se ejecutó;
- qué efecto se esperaba;
- qué ocurrió después;
- bajo qué contexto sucedió.

No deben mezclarse.

---

## 3. Context snapshot

Para que una experiencia histórica siga siendo interpretable, debe conservarse el contexto vigente en ese momento.

El documento fuente identifica como relevantes:

- business model;
- markets;
- channels;
- product mix;
- promotion state;
- known changes;
- seasonality;
- objectives;
- constraints;
- measurement state.

El contexto cambia con el tiempo.

Por tanto, una experiencia no debe reconstruirse exclusivamente usando el estado actual del tenant.

---

## 4. Experimentos y decisiones pasadas

Los experimentos y decisiones anteriores pueden servir para:

- explicar cambios esperados;
- evitar repetir interpretaciones ya descartadas;
- distinguir deterioro de trade-offs deliberados;
- seleccionar mejores baselines;
- reconocer patrones recurrentes del propio negocio.

La fuente no define todavía cómo se puntúa, promueve o generaliza ese aprendizaje.

---

## 5. Outcomes

Aunque el documento no define un modelo formal de outcomes, su lógica requiere distinguir:

- decisión tomada;
- expectativa;
- cambio observado posteriormente.

Esa relación es la base mínima para aprovechar experiencia operacional.

No debe inferirse un resultado si no fue observado.

---

## 6. Uso futuro de experiencias

Una experiencia histórica puede utilizarse para contextualizar una señal cuando existe suficiente similitud en:

- modelo de negocio;
- segmento;
- canal;
- mercado;
- promoción;
- estrategia;
- restricciones;
- estado de medición.

La similitud contextual importa más que una coincidencia superficial de métrica.

---

## 7. Límites de generalización

Este documento no justifica todavía:

- transferir automáticamente aprendizajes entre tenants;
- convertir un caso anterior en regla universal;
- aumentar confidence de manera automática;
- hacer knowledge promotion;
- aplicar decay;
- actualizar pesos de agentes;
- entrenar modelos con outcomes.

Esos mecanismos requieren documentos posteriores.

---

## 8. Riesgo de contexto obsoleto

Una experiencia histórica puede perder comparabilidad después de:

- `REGIME_CHANGE`;
- cambio de estrategia;
- expansión de mercado;
- cambio de modelo de negocio;
- cambio de medición;
- cambio fuerte de product mix;
- cambio de canal dominante.

La experiencia sigue siendo útil, pero debe etiquetarse como menos comparable.

---

## 9. Aprendizaje contextual mínimo soportado por D2

D2 soporta conceptualmente el siguiente ciclo:

1. observar señal;
2. registrar contexto;
3. formular diagnóstico o decisión;
4. observar el resultado posterior;
5. conservar la experiencia con su snapshot;
6. recuperar experiencias comparables en diagnósticos futuros.

El documento fuente no define todavía automatización de los pasos 4–6.

---

## 10. Lo que queda para documentos futuros

Serán necesarios artefactos específicos si se desea definir:

- experience schema;
- outcome schema;
- confidence calibration;
- similarity retrieval;
- promotion de experiencias a conocimiento;
- decay;
- tenant-local vs cross-tenant learning;
- governance del aprendizaje.
