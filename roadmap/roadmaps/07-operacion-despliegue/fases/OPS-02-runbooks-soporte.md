# OPS-02 - Runbooks y soporte

## Estado

- **Estado real:** `planned`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** SQO-02 (observabilidad, para poder diagnosticar lo que el runbook pide comprobar)
- **Evidencia de que es un indice, no una coleccion de runbooks reales**: este archivo enumera nombres de
  runbooks pero ninguno tiene pasos concretos todavia. Formato acordado para cuando se escriban (no
  implementado): un archivo por incidente en `roadmap/roadmaps/07-operacion-despliegue/runbooks/RB-XXX-*.md`
  con secciones Sintoma / Impacto / Severidad / Comprobaciones iniciales / Diagnostico / Acciones /
  Rollback / Validacion de recuperacion / Comunicacion al cliente / Escalado / Responsable / Evidencias a
  conservar / Prevencion.
- **Runbooks priorizados a escribir primero** (mayor probabilidad x impacto segun `RIESGOS.md`): sync
  Shopify fallido, token OAuth expirado, coste IA disparado (ver R-011), posible fuga cross-tenant (ver
  R-004), webhook duplicado/backlog, restauracion de backup (ver R-016, nunca probada).
- **Siguiente accion**: escribir el runbook de sync fallido primero — es el incidente mas probable en el
  Piloto 1 (OPS-01) y hoy no existe ningun protocolo, solo investigacion ad-hoc.

## Entregables

- Runbook de sync fallido.
- Runbook de OAuth/token expirado.
- Runbook de migracion fallida.
- Runbook de incidente de privacidad.
- Procedimiento de rollback y replay.
- Checklist semanal de salud por cliente.

## Criterios de cierre

- Un fallo comun tiene pasos claros de diagnostico.
- Hay responsables y canales de escalado definidos.

