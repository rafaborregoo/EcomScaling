# Ficha de campaña de email · 3 de noviembre de 2026

La ficha está en **Klaviyo → Campañas → Ver email, resultados y valoración**. También se enlaza desde la ficha anterior de Emails. Cliente y consultor comparten las fuentes y conclusión de su tienda. No hay una nueva sección de laboratorio en la cuenta.

Ruta: `/klaviyo/campanas/[campaignId]`, con el contexto de organización y conexión. API autenticada: `GET /v1/organizations/:organizationId/klaviyo/campaigns/:campaignId/dossier`.

## Qué reúne

- Resultados atribuidos de la campaña del mismo RPC que consume A12, con ventana y granularidad mensual explícitas. Desconocido no se convierte en cero; las métricas incompletas no se presentan como completas.
- HTML sanitizado o texto de los mensajes disponibles, con procedencia histórica o plantilla actual. La simulación no verifica el email personalizado recibido. Vista previa sin scripts, navegación o recursos de red ajenos a Shopify/data.
- Revisiones A26 guardadas, asociadas por organización, tienda, cuenta, mensaje, huella de contenido y revisión de fuente. Citas, observaciones, hipótesis, cambios propuestos y criterios de aceptación; un borrador ya preparado se puede abrir en el Estudio.
- Revisiones antiguas conservadas como históricas, sin decidir el estado actual. Consulta fallida, contenido ausente y revisión no realizada se distinguen.
- Evidencia favorable de rendimiento y siguientes pasos, sin atribuir ventas al diseño.

## Conclusiones

1. **Corregir antes de reutilizar:** CTA observado sin destino utilizable. No se cancela ni se retira ninguna campaña.
2. **Mejorar y probar:** hay una propuesta editorial A26 vigente; se explica cómo comprobarla. Las hipótesis no se convierten en hechos.
3. **Reutilizable como base editorial:** existe una decisión A26 aprobada/publicada sin cambios, cuyo snapshot contiene todos los mensajes y sus versiones exactas, y hay entregas medidas. No significa «ganadora», rentabilidad demostrada ni aprobación de un nuevo envío; hay que revalidar oferta, fechas, producto y destinatarios.
4. **Evidencia insuficiente:** faltan cuerpos, revisión editorial vigente o resultados. Pocas ventas por sí solas nunca determinan un veto ni un diseño malo.

La ventana de atribución de la cuenta no se ha verificado en este flujo; la ficha no declara resultados maduros ni usa un plazo universal de cinco días. Se corrigió ese texto fijo en la ficha antigua de email.

No se ha añadido otra llamada LLM al abrir la ficha. Se ensamblan métricas, revisiones A26 existentes y comprobaciones deterministas; no se inventa una evaluación A26 cuando aún no se ha ejecutado. A26 sigue seleccionando muestras y el orquestador existente detecta cambios/importaciones; no se ha creado un análisis inmediato individual de cada importación. Las propuestas aprobadas siguen su flujo existente hacia A11/A28.

## Validación y límites

Siete pruebas focalizadas correctas: desconocidos/cobertura parcial, cero ventas, CTA defectuoso, hipótesis frente a hecho, revisión obsoleta/descartada, reutilización condicionada y aislamiento de organización/tienda. Build de contratos y typechecks API/web correctos. ESLint sin errores; aviso anterior de setState en efecto en la ficha antigua de email.

Prueba autenticada de cliente y consultor TEST: misma campaña, métricas y conclusión; otra tienda devuelve 404 y otra organización queda denegada. Campaña de ejemplo: `c4b0d878-5a8a-ff79-fa99-b2d919c825a5` (E-NORA · enora email 202611 promo). Sus métricas existen, pero falta el cuerpo y no tiene revisión A26: muestra evidencia insuficiente, no un juicio de calidad inventado. Los valores de ese histórico son sintéticos, indicado en la ficha.

Ruta de ejemplo HTTP 200. Evidencia privada: `.e-nora-test-lab/email-campaign-dossier-2026-11-03/verification.json`. El host de acceso a navegador no está disponible; no se declara inspección visual autenticada de escritorio/móvil.

Sin migraciones, escrituras en Klaviyo, envíos, creación de tareas o cambios en datos de campaña. Código activo localmente; no desplegado en producción.
