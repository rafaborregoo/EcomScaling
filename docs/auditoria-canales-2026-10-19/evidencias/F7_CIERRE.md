# F7 · Web pública y capturas de revisión

Fecha: 21-10-2026 · Estado: implementación local terminada; servicio de captura apagado por defecto y pendiente de despliegue/validación en una tienda de ensayo.

## Entregado

- Nueva página `/web`, enlazada desde el menú. Usa la URL pública `organizations.website_url` ya registrada para esa tienda y no acepta una URL arbitraria desde el navegador.
- API de organización para encolar revisiones, consultar el historial reciente y servir imágenes solo a miembros con acceso a la organización. No se guarda la query ni el fragmento de la URL.
- Capturas de primera pantalla en 1280×800 y 390×844, título, meta description, encabezados H1, texto alternativo de imágenes, estado HTTP y desbordamiento horizontal; añade hallazgos deterministas y fechados.
- El Consultor IA puede analizar título, encabezados y hallazgos estructurados. La imagen se conserva en la ficha y no se adjunta al chat; la revisión visual por IA queda pendiente.
- Límites: hasta 3 revisiones al día por tienda, un trabajo activo por tienda, 40 solicitudes de página por captura, 20 MiB por imagen, 500 MiB de evidencias y retención máxima de 30 días.
- Sin sesión/cookies, JavaScript desactivado, sin envíos de formularios y con solicitudes limitadas al hostname exacto. Un proxy separado resuelve el hostname, rechaza respuestas DNS privadas/especiales y conecta a la IP pública resuelta; el worker solo accede a ese proxy por una red Docker interna.
- No se crea una migración. La cola y las capturas viven en el volumen privado compartido de renderizado; la API vuelve a comprobar la organización antes de devolver cada PNG.

## Verificación y límites

- API typecheck: correcto.
- ESLint focalizado de la pantalla Web y navegación: correcto.
- TypeScript focalizado de los módulos F7: correcto (con declaraciones temporales solo para resolver imports CSS de componentes compartidos; los archivos temporales se retiraron después).
- Pruebas unitarias de política SSRF, credenciales firmadas, límites del trabajo, capturas y hallazgos: 5/5 correctas.
- `docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.build.yml config --quiet`: correcto.
- El typecheck web se bloqueó en un JSX sin cerrar en `apps/web/src/app/planificacion/calendario/page.tsx:1013`, dentro de cambios ajenos a F7. La navegación y página Web sí pasan ESLint, pero no se certifica el typecheck global web hasta resolver esa edición.
- `npm run verify` detectó bypasses de `promote_agent_version()` en tres migraciones ya modificadas fuera de F7 (`20261230180000_a09_exact_knowledge_document.sql`, `20261231230200_a11_prompt_v11.sql`, `20270103100000_a15_multichannel_creative_integrity.sql`). La ejecución completa no se pudo certificar porque se detuvo mientras seguía otra guarda; esas migraciones no se alteraron en esta fase.
- No se hizo captura en una URL pública real ni se desplegó código. Sin el secreto de proxy y el perfil de Docker, la API informa que la captura está desactivada.
- El alcance no incluye páginas privadas, navegación interactiva, Lighthouse/PageSpeed, editar la web o enviar compras. Los assets alojados fuera del dominio exacto se bloquean; algunas páginas pueden verse incompletas. Las capturas muestran observaciones técnicas, no conversión ni impacto comercial.

## Acción necesaria en la liberación final

Para habilitar el servicio al desplegar, configura `WEB_REVIEW_CAPTURE_ENABLED=true` y `WEB_REVIEW_PROXY_SECRET` con un secreto aleatorio de al menos 32 caracteres en el entorno Compose. Construye y arranca los servicios con el perfil `web-review` (`web-review-proxy` y `web-review-worker`). Después hace falta probar una captura con la URL de una tienda de ensayo. No ejecutes ni actives el perfil antes de configurar el secreto; no es necesario cambiar DNS, Shopify, Meta o Klaviyo.
