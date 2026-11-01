# F6 · Áreas operativas de Klaviyo

Fecha: 21-10-2026 · Estado: pantallas de lectura implementadas en local; pendientes de despliegue y prueba en cuenta de ensayo.

## Entregado

- El menú de Klaviyo ahora separa Campañas, Flows, Emails, Plantillas, Audiencias y Formularios. Cada entrada abre una pantalla propia bajo `/klaviyo`.
- Campañas muestra campañas sincronizadas, estado remoto, canal, destinatarios, clics e ingresos atribuidos en la moneda de la cuenta.
- Flows reutiliza el constructor y el mapa de estado ya implementados en Marketing; los borradores locales siguen identificados como tales y los cambios remotos continúan sujetos a los permisos que la API ya valida.
- Plantillas y Audiencias reutilizan sus vistas existentes. Formularios tiene una pantalla específica con estado remoto, vistas únicas, altas, conversión y fecha de sincronización de los últimos 30 días.
- No se crean copias de recursos en una segunda base de datos. La identidad y los datos siguen procediendo del workspace sincronizado de Klaviyo y de los borradores existentes de E-NORA.

## Límites y compatibilidad

- F6 no cambia el contrato global de Klaviyo `2026-07-15`, la sincronización ni los payloads de campañas. La revisión GA `2026-10-15` introduce cambios de modelo de campañas; su adopción requiere un adaptador versionado por recurso y pruebas de migración antes de modificar el cliente compartido.
- Formularios se presenta en lectura desde los datos ya sincronizados. No se habilita `forms:write`, ni crear, editar, publicar o despublicar. No se solicitaron scopes nuevos ni se cambiaron los permisos de OAuth.
- La vista no expone Perfiles ni Cupones: el workspace actual no provee una ficha de perfil/eventos/consentimiento ni una fuente de cupones con semántica suficiente. No se muestran recursos incompletos como si fueran funcionalidades terminadas.
- F6 aún no certifica escritura en una cuenta de ensayo. La cuenta de prueba y su reautorización se revisarán al preparar el despliegue final; ninguna tarea manual de Klaviyo es necesaria para estas pantallas de lectura.

## Verificación local

- `npm run typecheck --workspace=web`: correcto.
- ESLint focalizado sobre navegación y pantallas Klaviyo nuevas: sin errores; reporta 1 warning ya presente en el efecto del constructor de flows.
- Pruebas focalizadas de flows y modelos de Klaviyo: 12/12 correctas.
- No se aplicó migración de base de datos, no se cambió la revisión API ni los scopes y no se desplegó código.
- El inventario estático actualizado cuenta 93 páginas, 0 enlaces href literales sin ruta y la verificación documental pasa 93 enlaces locales; esto no prueba la navegación autenticada ni los permisos en producción.
