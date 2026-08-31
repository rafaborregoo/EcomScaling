# Remodelado de Planificación y cobertura real de los CSV

## Decisión de producto

La vista principal será una **Agenda de crecimiento**, no un formulario ni una tabla financiera. La agenda responde a: qué toca hacer, para qué sirve, en qué tienda, quién lo hace, cuándo vence y qué resultado esperamos.

El calendario mensual será una vista secundaria. Para un consultor con varios clientes y tiendas, una agenda filtrable por cliente/tienda evita perder acciones dentro de una cuadrícula mensual demasiado densa.

## Estructura de la pantalla

1. **Contexto**: cliente y tienda activa, periodo y calidad de datos.
2. **Resumen de decisión**: ventas, margen, ROAS/CAC y una única recomendación prioritaria.
3. **Agenda**: acciones agrupadas por “hoy”, “esta semana”, “próximas” y “vencidas”.
4. **Acción**: cada fila abre un modal con objetivo, canal, responsable, enlaces, tarea, milestone, KPI objetivo y resultado.
5. **Vistas secundarias**: calendario mensual, histórico KPI, exportación y configuración económica.

## Cobertura actual frente a la guía

| Área de los CSV | Estado actual | Falta para cobertura completa |
|---|---|---|
| Ventas, pedidos y AOV | Conectado a Shopify | Serie mensual y comparación contra objetivo |
| COGS, envíos, comisiones y margen | Configuración/SQL existente | Exponer desglose y estado “estimado” en Planificación |
| Funnel | Parcial | Sesiones, add-to-cart, checkout, conversión y fuente |
| Recurrencia y nuevos clientes | No completo | Cohortes, clientes nuevos/recurrentes y atribución disponible |
| ROAS, CAC y break-even | Meta + finanzas parcial | CAC máximo, ROAS mínimo y presupuesto sostenible visibles |
| Stock | Existe en Dashboard/planner | Relacionarlo con la acción y alertar campañas con riesgo de stock |
| Battle map anual | Persistido | Objetivo, campaña, preparación, responsable y dependencia |
| Rebajas multicanal | Referencia CSV | Acciones diarias persistidas, no solo plantilla |
| Tracking mensual | Snapshots semanales | Objetivo vs realidad por mes, frecuencia y desviación |
| Ejecución | Campos de Fase 4 creados | UI para completar, bloquear, saltar y registrar resultado |

## Fases pendientes

### Fase 4 — Ejecución trazable

Completar la UI para que cada acción pueda pasar por `planned`, `in_progress`, `published`, `completed` o `cancelled`, indicando responsable, incidencia y resultado. La finalización debe guardar quién, cuándo y qué KPI se observó.

### Fase 5 — Evaluación y alertas

Comparar objetivo contra realidad y crear alertas accionables: ROAS bajo, CAC alto, margen negativo, stock insuficiente, acción vencida y campaña planificada sin ejecución.

### Fase 6 — Cobertura completa de KPI

Añadir a la vista operativa el desglose financiero, funnel, nuevos/recurrentes, canal y objetivos mensuales. Cada valor debe indicar fuente, periodo, conexión y si es real, calculado o estimado.

### Fase 7 — Exportación y revisión

Exportar una hoja completa por organización/tienda con KPI, acciones, objetivos, ejecución, desviaciones y notas. El CSV debe poder reconstruir la revisión mensual del consultor.

## Regla de tracking

No se considera terminada una fase si solo muestra datos. Debe dejar una evidencia persistida y enlazada al alcance correcto: organización, tienda, periodo y usuario responsable.
