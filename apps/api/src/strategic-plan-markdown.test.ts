import assert from "node:assert/strict";
import test from "node:test";
import { parseStrategicPlanMarkdown } from "./strategic-plan-markdown.js";

test("parses the controlled Mi Camino markdown hierarchy", () => {
  const result = parseStrategicPlanMarkdown(`---
name: Escalar la tienda
description: Plan de crecimiento
---

# Escalar la tienda

## Fase 1: Fundamentos
Descripción: Preparar la base.

### Hito: Mejorar conversión
- Fecha objetivo: 2026-10-31
Descripción: Subir la conversión sin aumentar el tráfico.

#### Tareas
- Auditar el checkout
- [ ] Revisar páginas de producto

## Fase 2: Adquisición
### Hito: Activar campañas
#### Tareas
- Preparar la primera campaña
`);

  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, { phases: 2, milestones: 2, tasks: 3 });
  assert.equal(result.data?.name, "Escalar la tienda");
  assert.equal(result.data?.phases[0]?.name, "Fundamentos");
  assert.equal(result.data?.phases[0]?.milestones[0]?.targetDate, "2026-10-31");
  assert.equal(
    result.data?.phases[0]?.milestones[0]?.tasks[1]?.title,
    "Revisar páginas de producto",
  );
});

test("rejects orphan sections and invalid dates", () => {
  const result = parseStrategicPlanMarkdown(`
### Hito sin fase
## Fase: Fundamentos
### Hito: Conversión
- Fecha objetivo: 31/10/2026
`);

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((issue) => issue.message.includes("fase")),
    true,
  );
  assert.equal(
    result.errors.some((issue) => issue.message.includes("YYYY-MM-DD")),
    true,
  );
});
