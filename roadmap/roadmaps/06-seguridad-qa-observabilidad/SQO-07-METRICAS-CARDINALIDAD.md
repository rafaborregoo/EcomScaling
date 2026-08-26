# SQO-07 — Métricas acotadas y agregación futura

## Estado

`implemented_partial`: la instrumentación HTTP/IA y el endpoint Prometheus
existen por proceso. La agregación entre instancias necesita un backend
compartido (Redis, OpenTelemetry Collector o APM) y queda como gate de
despliegue, no se simula en desarrollo.

## Protección local implementada

`MetricsRegistry` limita a 5.000 series por proceso. Si una etiqueta inesperada
intenta crear más series, se descarta esa nueva serie y se expone
`observability_metric_series_dropped_total`. Esto evita crecimiento ilimitado
de memoria y trabajo de serialización en `/health/metrics`.

Las etiquetas actuales son acotadas (`route`, método, estado y código de
agente). No se deben introducir IDs de usuario, organización, tokens ni URLs
completas como labels Prometheus.

## Siguiente gate externo

Con varias instancias, sustituir o complementar el registro local por un
agregador compartido y definir retención, alertas y SLO. Mientras tanto, el
endpoint local se interpreta como diagnóstico de una instancia, no como
telemetría global.
