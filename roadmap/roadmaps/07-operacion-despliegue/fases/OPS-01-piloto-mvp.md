# OPS-01 - Piloto MVP

## Estado

- **Estado real:** `planned`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** OPS-00 (staging), SQO-00/02/03, INT-01 (webhooks de privacidad)
- **Bloqueador:** ninguno tecnico para el Piloto 1 (Shopify); Meta App Review bloquea el Piloto 2.
- **Correccion sobre la version anterior de este documento**: el paso 1 exigia "Shopify y Meta" desde el
  arranque, pero Meta sigue bloqueado por App Review/business verification (ver BE-04, INT-02) — no tiene
  sentido bloquear todo el piloto por eso. Dividido en piloto por capacidad, no todo-o-nada.

## Piloto 1 — Shopify y operacion (primero, sin dependencia de Meta)

Validar: onboarding, sincronizacion, metricas, configuracion financiera, dashboard, alertas, tareas,
llamadas (A01), monitor de negocio (A02) en shadow mode, soporte.

### Criterios de entrada (ninguno cumplido todavia — no incorporar clientes hasta marcarlos)

- [ ] No existe hard-delete inmediato de organizaciones (Q-009, decision de Rafa pendiente).
- [ ] Shopify reconciliado con desviacion conocida contra una tienda real con pedidos (INT-01).
- [ ] Webhooks de privacidad de Shopify registrados (`customers/data_request`, `customers/redact`,
      `shop/redact`, INT-01).
- [ ] `app/uninstalled` gestionado (INT-01).
- [ ] RLS basico validado — cumplido parcialmente (11 tests, 3 dominios, ver SQO-00; falta ampliar).
- [ ] Backups configurados y restauracion probada al menos una vez (SQO-03, R-016).
- [ ] Logs y alertas minimas (SQO-02, hoy inexistente).
- [ ] Runbook de sync fallido existe (OPS-02, hoy vacio).
- [ ] Staging operativo (OPS-00, hoy inexistente).
- [ ] Responsable de soporte definido (hoy "sin asignar" en todo el estado global).

## Piloto 2 — Adquisicion (solo cuando Meta este desbloqueado)

Añadir: Meta OAuth, Insights, ROAS, CAC, creatividades, reconciliacion con Ads Manager. No empieza hasta
que Meta apruebe la app (bloqueador externo, ver BE-04/INT-02).

## Piloto 3 — Retencion (cuando el nucleo anterior sea estable)

Añadir Klaviyo (INT-03, hoy `planned` sin codigo).

## Metricas de exito (sustituyen a "dashboard confiable", que no es medible)

| Metrica | Objetivo inicial |
| --- | --- |
| Diferencia facturacion vs Shopify Admin | <1%, o explicada |
| Diferencia pedidos vs Shopify Admin | 0, o explicada |
| Sync de pedidos (freshness) | <30 min |
| Sync diario correcto | >=99% |
| Incidentes criticos cross-tenant | 0 |
| Tareas consideradas utiles por el consultor | >=60% |
| Resumenes A01 aprobados sin cambios | >=70% |
| Tiempo de diagnostico de un sync fallido | <30 min |
| Uso semanal del panel por el consultor | >=3 dias/semana |

## Protocolo por cliente incorporado

`seleccion -> consentimiento y alcance -> conexion -> reconciliacion -> configuracion financiera ->
formacion -> primera semana acompañada -> revision semanal -> registro de incidencias -> evaluacion final`.
Recoger explicitamente: discrepancias, tareas utiles/inutiles, tiempo ahorrado, decisiones tomadas,
modulos no usados, errores, frustraciones, solicitudes de funcionalidad.

## Freeze de alcance (cuantificado, no solo "congelar expansion")

No iniciar Klaviyo, Instagram ni agentes nuevos hasta que al menos 3 clientes hayan usado el nucleo del
Piloto 1 durante 4 semanas continuas y se cumplan los umbrales de la tabla de metricas de arriba.

## Criterios de cierre

- Todos los criterios de entrada del Piloto 1 marcados.
- Umbrales de la tabla de metricas alcanzados con al menos 3 clientes reales durante 4 semanas.
- Soporte puede diagnosticar un fallo de sync en <30 min usando runbooks (no investigacion ad-hoc).
