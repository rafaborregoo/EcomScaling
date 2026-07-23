# Roadmap operativo - Seguridad, QA y observabilidad

## Objetivo

Hacer que seguridad, pruebas y diagnostico no sean una fase final, sino un bloque obligatorio de cada vertical slice.

## Fases

| Fase | Archivo | Relacion maestro | Resultado |
| --- | --- | --- | --- |
| SQO-00 | `fases/SQO-00-seguridad-base.md` | F1-F3 | Secret scanning, CORS, headers, permisos, RLS y matriz de acceso. |
| SQO-01 | `fases/SQO-01-testing.md` | F1-F14 | Unit, DB/RLS, contract, worker, E2E, IA evals y carga. |
| SQO-02 | `fases/SQO-02-observabilidad.md` | F1-F14 | Logs, metricas, tracing, alertas y panel interno de salud. |
| SQO-03 | `fases/SQO-03-privacidad-auditoria.md` | F2-F14 | PII, GDPR, audit logs, retencion, backups e incidentes. |
| SQO-04 | `fases/SQO-04-threat-model.md` | F1-F14 | `planned` — matriz de 17 amenazas mapeadas contra controles/tests reales; identifica SSRF, IDOR organizacional y supply-chain como criticas sin ningun control hoy. |
| SQO-05 | *(no creado todavia)* | F1-F14 | Propuesto, `planned`: disaster recovery (RPO/RTO, backups, restore, caida de DB/Redis, rollback de despliegue). |
| SQO-06 | *(no creado todavia)* | F1-F14 | Propuesto, `planned`: runbooks operativos (token expirado, sync atascado, cola bloqueada, coste IA disparado, posible fuga cross-tenant). |
