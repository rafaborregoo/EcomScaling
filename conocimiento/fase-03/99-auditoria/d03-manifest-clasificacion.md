# Fase 03 · D03 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D03-deteccion-de-etapa-de-madurez.md`

**Identidad interna:**

- Fase 3 — Sistema de Diagnóstico
- D3 — Detección de Etapa de Madurez

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d03-deteccion-de-etapa-de-madurez.md` | Copia exacta del documento original. |
| `01-rag-produccion` | `d03-deteccion-de-etapa-de-madurez.md` | Conocimiento estable sobre madurez, capability gaps, stages, dependencies y structural risk. |
| `02-contratos-IA` | `d03-requisitos-contrato-madurez.md` | Requisitos conceptuales de intercambio. |
| `03-runtime` | `d03-flujo-deteccion-madurez.md` | Flujo operacional de evaluación. |
| `04-policies-guardrails` | `d03-guardrails-madurez.md` | Reglas críticas que no deben depender solo del retrieval. |
| `05-experience-learning` | `d03-aprendizaje-y-evolucion-madurez.md` | Evolución del perfil, outcome evidence, feedback loops y learning maturity. |
| `06-tenant-context` | `d03-contexto-madurez-ecommerce.md` | Complejidad, exposición, estrategia, ownership y procesos del tenant. |
| `99-auditoria` | `d03-manifest-clasificacion.md` | Auditoría completa. |

---

## 3. Capa principal

La capa principal es `01-rag-produccion`.

D3 contiene conocimiento reusable sobre:

- maturity;
- Stage Gates;
- capability maturity;
- required maturity;
- growth-system gap;
- structural debt;
- fragile growth;
- overengineering;
- maturity bottlenecks;
- state vs stage;
- structural regression;
- latent risk;
- evidence hierarchy;
- resilience;
- organizational transitions;
- premature scaling;
- complexity theater.

---

## 4. Experience-learning

A diferencia de D01 y de otros documentos conceptuales, D03 sí contiene mecanismos explícitos de aprendizaje.

Motivos:

- `Maturity Profile Evolution`;
- `Outcome evidence`;
- `feedback loops`;
- `postmortems`;
- `test repositories`;
- `creative learnings`;
- `forecast accuracy reviews`;
- `campaign learnings`;
- transición de conocimiento de persona a sistema.

No se ha añadido decay, promotion o cross-tenant learning porque la fuente no los define.

---

## 5. Conceptos presentes en varias capas

### Required maturity

- RAG: principio general.
- Contrato: información requerida.
- Runtime: cálculo/interpretación.
- Tenant: complejidad concreta.

### State vs Stage

- RAG: distinción conceptual.
- Contrato: representación separada.
- Runtime: evita reclasificaciones erróneas.
- Guardrail: no mezclar health con maturity.

### Evidence hierarchy

- RAG: jerarquía conceptual.
- Contrato: provenance/confidence.
- Runtime: orden de contraste.
- Guardrail: user claim no domina evidencia observable.
- Experience: actualización posterior del profile.

### Feedback loops

- RAG: dimensión de madurez.
- Experience: aprendizaje institucional.
- Tenant: existencia concreta de mecanismos.

### Capability dependencies

- RAG: dependency graph.
- Contrato: requisitos de representación.
- Runtime: detección de bottleneck.
- Tenant: dependencias concretas.

---

## 6. Redundancias consolidadas

Se agruparon:

- revenue/performance/tool/team/documentation ≠ maturity;
- capability maturity ladder;
- maturity dimensions;
- capability-specific maturity domains;
- dangerous maturity combinations;
- dependency graph + ceiling + bottleneck;
- state vs stage + degradation + regression;
- advancement evidence + outcome evidence + evidence hierarchy;
- founder/key-person dependency + institutional knowledge;
- repeatability/predictability/controllability/adaptability;
- complexity-adjusted maturity + simplicity;
- maturity anti-patterns + complexity theater;
- premature scaling + fragile growth + structural debt;
- learning maturity + feedback loops.

Los ejemplos específicos se conservaron como patrones de razonamiento.

---

## 7. Contenido excluido del RAG

### Tenant-specific

No se embeben como verdad general:

- actual stage de una tienda;
- capability levels reales;
- revenue;
- SKUs;
- growth;
- team;
- ownership;
- tooling concreto;
- exposure.

### Runtime

La secuencia de evaluación pertenece a ejecución.

### Guardrails

Las reglas críticas deben aplicarse aunque retrieval falle.

### Experience

La evolución histórica de maturity pertenece a memoria operacional.

---

## 8. Posibles solapamientos

D3 se solapa conceptualmente con:

- Fase 2 Stage Gates;
- D2 contextualización;
- D4 health diagnosis;
- F4 priorización;
- F9 learning;
- team/governance;
- strategy;
- capability maps.

La frontera es:

- Fase 2 define Stage Gates.
- D3 interpreta maturity respecto a capability y complejidad.
- D4 evalúa health actual.
- F4 prioriza.
- F9 profundiza aprendizaje.

---

## 9. Irregularidades del documento

La numeración interna no es continua.

Existen saltos significativos, por ejemplo:

- 1 → 3;
- 5 → 7;
- 8 → 10;
- 20 → 33;
- 45 → 47;
- 94 → 95 → 96 → 98;
- 100 → 105;
- 129 → 135;
- 143 → 144 → 147;
- 152 → 160;
- 169 → 170;
- 185 → 192;
- 198 → 210.

No se ha reconstruido contenido ausente.

---

## 10. Pérdida de información

No se detecta pérdida relevante.

El documento original se conserva íntegramente en `00-corpus-maestro`.

La inteligencia reusable ha sido distribuida entre las capas según responsabilidad.

---

## 11. Decisiones arquitectónicas

1. D3 es un bloque fuerte de RAG.
2. Debe existir contrato conceptual de maturity profile y evidence.
3. El proceso de evaluación pertenece a runtime.
4. Las equivalencias falsas deben convertirse en guardrails.
5. Learning maturity y profile evolution justifican `05-experience-learning`.
6. Complejidad, estrategia, exposure y ownership concretos pertenecen a tenant-context.
7. No se inventan mappings, thresholds, schemas ni algoritmos ausentes.
