# AI-28 — Estado de evaluaciones en la UI

Estado: `implemented_partial` · 2026-08-26

## Objetivo

Mostrar de forma honesta la diferencia entre matriz offline preparada,
evaluaciones persistidas y validación live con proveedores reales.

## Implementación

`AgentEvalReadinessPanel` y `getAgentEvalReadinessPresentation` son componentes
reutilizables. La página de agentes muestra actualmente:

- cobertura declarada de los diez agentes;
- matriz offline preparada;
- evaluaciones live pendientes;
- una explicación explícita que evita confundir preparación con validación.

Los props permiten conectar posteriormente el estado leído de AI-26 sin cambiar
la composición visual.

## Verificación

- Tests de estado de evaluaciones y runtime: 4/4.
- Typecheck web: pasa.

No se muestran resultados live inventados ni se requiere una conexión externa.
