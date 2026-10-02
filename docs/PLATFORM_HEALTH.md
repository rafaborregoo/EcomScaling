# Monitorización de plataforma

El panel `/admin/infraestructura` agrega métricas del proceso API, Redis, Supabase y el VPS. En producción, la API necesita acceso de solo lectura al proxy Docker y a cAdvisor; ninguno publica puertos al exterior.

## Configuración de producción

Añade estas variables al entorno de API (`.env.production` en el VPS):

- `PLATFORM_ALERT_WEBHOOK_URL`: webhook entrante de Slack o Discord. La API evalúa recursos, colas, contenedores y SLO cada 60 segundos y avisa cuando cambia el conjunto de alertas; también envía el mensaje de recuperación.
- `PLATFORM_MONITOR_TOKEN`: secreto aleatorio compartido con la sonda externa. Se valida en `POST /health/external-probe` y nunca se expone en el frontend.
- `SUPABASE_ACCESS_TOKEN`: token de Supabase Management API con permisos `database_read` y `backups_read`. Se usa para conexiones PostgreSQL y metadatos de backups; la consulta SQL es de solo lectura.
- `SUPABASE_LAST_RESTORE_VERIFIED_AT`: fecha ISO 8601 que se actualiza después de completar una restauración de prueba. El panel no ejecuta restauraciones automáticamente.

En GitHub, configura los secretos `PLATFORM_API_BASE_URL` (URL pública de la API), `PLATFORM_MONITOR_TOKEN` (el mismo token) y, opcionalmente, `PLATFORM_ALERT_WEBHOOK_URL`. El workflow `External platform uptime` prueba cada cinco minutos DNS, TLS y `/health/ready`; guarda el resultado en Redis para mostrarlo en el panel y avisa si detecta caída o certificado próximo a caducar.

El monitor necesita que Redis esté disponible. Las métricas HTTP y los picos de concurrencia se conservan en memoria del proceso, mientras que presencia, alertas y sondeos externos se comparten en Redis. La latencia p50/p95/p99 se presenta por plantilla de ruta para no guardar identificadores de cliente.

## Señales y límites

- cAdvisor entrega CPU, RAM y eventos OOM por contenedor. El proxy Docker de solo lectura aporta estado y reinicios.
- El contador de conexiones y los backups requieren el token de Management API. La ausencia de token aparece como «Sin datos».
- La antigüedad de la restauración probada es manual: la API no puede demostrar que el backup se haya restaurado correctamente sin ejecutar un ejercicio de recuperación.
- GitHub Actions ofrece una sonda desde fuera del VPS; el workflow debe estar habilitado en el repositorio y sus secretos configurados.
