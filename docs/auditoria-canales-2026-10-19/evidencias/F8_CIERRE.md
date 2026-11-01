# F8 · Métricas canónicas, atribución y resultados

Fecha: 21-10-2026 · Estado: implementación local completa; migración aditiva aplicada en test y producción; código aún no desplegado.

## Entregado

- Se reutiliza `METRIC_SPECS` como catálogo canónico de análisis: MER, CAC de cliente nuevo, conversión, ROAS atribuido por Meta y aperturas de email. Cada ficha define nombre, significado, fórmula, unidad, dirección y muestra mínima.
- `/metric-analysis` devuelve ahora el periodo exacto de Shopify (`start` y `end`) junto al número de días, para que la comparación no se lea como un rango implícito.
- Los adaptadores Shopify/Meta/Klaviyo ya generan evidencia con fuente, periodo, base de ingresos, moneda, atribución, calidad y limitaciones. Las comparaciones existentes no suman ventas atribuidas entre plataformas ni las presentan como incrementalidad; si periodo o moneda no son compatibles, no calculan dependencia.
- Al registrar un resultado de tarea se puede escoger un ID canónico o mantener una métrica libre. El registro captura periodo, fuente, fecha de medición y moneda en métricas monetarias. Las tasas se guardan en la escala canónica y se muestran como porcentaje. La ficha avisa que una variación observada no prueba causalidad.
- Los resultados antiguos sin ID, periodo, moneda o fuente siguen disponibles. El backend permite esas filas antiguas; toda medición nueva desde la pantalla ya envía el contexto completo.
- La migración `20270106100000_f8_task_outcome_metric_context.sql` añade metadatos opcionales y restricciones compatibles con filas existentes. Se aplicó solo esta versión a TEST y producción; no se ejecutó ninguna otra migración pendiente.
- El snapshot semanal de KPI ya tenía job idempotente lunes a lunes y entrada en el crontab del worker. Está cubierto por prueba de periodo, pero no se verificó una ejecución real del VPS durante esta fase.

## Verificación y límites

- Pruebas focalizadas de atribución, snapshots y resultados de tareas: 16/16 correctas.
- Typecheck API: correcto.
- Typecheck focalizado del formulario de tareas: correcto.
- ESLint de tareas: 0 errores; conserva 5 advertencias preexistentes en hooks de esa página.
- Preflight de migraciones de agentes: 5/5 correcto.
- La migración quedó registrada en ambos entornos. El dry run posterior confirma que ya no aparece como pendiente.
- No se verificó el dashboard en producción ni se ejecutaron lecturas live de Shopify, Meta o Klaviyo. En los resultados de tareas, la fuente es la declarada por el usuario, no una prueba de que la cifra se haya leído de esa integración.
- El typecheck global web sigue bloqueado por JSX sin cerrar en `apps/web/src/app/planificacion/calendario/page.tsx:1013`, edición ajena a F8. El código permanece sin desplegar, conforme al plan.
- Tras aplicar solo F8, siguen pendientes otras migraciones: 19 en test y 20 en producción. No se incluyeron porque pertenecen a fases/cambios distintos.

## Requiere el usuario

No hace falta cambiar permisos o scopes en Shopify, Meta ni Klaviyo. El despliegue y la comprobación con una cuenta de ensayo se reservan a la liberación final. La atribución basada en experimentos incrementales y la verificación automática de resultados frente a la API no quedan cubiertas por esta fase.
