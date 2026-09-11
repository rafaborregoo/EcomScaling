# Política de respuesta a incidentes de seguridad

- **Última revisión:** 2026-09-10
- **Responsable de incidentes:** Rafael Borrego (rafael@noraapp.es)
- **Cubre:** requisito de Nivel 2 de Shopify "política de respuesta a incidentes".

Un procedimiento que nadie puede ejecutar no sirve. Este está escrito para el
tamaño real del equipo (una persona responsable) y para lo que de verdad hay
montado.

## Qué cuenta como incidente

- Acceso no autorizado a datos de un merchant o de sus clientes.
- Fuga o sospecha de fuga de credenciales: `SUPABASE_SERVICE_ROLE_KEY`, tokens de
  Shopify/Meta/Klaviyo, claves de proveedores de IA.
- Un fallo de RLS o de comprobación de pertenencia que exponga datos de una
  organización a otra.
- Pérdida de datos: borrado no intencionado sin copia recuperable.
- Compromiso de una cuenta del equipo, especialmente `platform_admin`.

Un sync caído o un agente que falla **no** es un incidente de seguridad: es una
incidencia operativa y se ve en Administración → Auditoría y errores.

## Fases

### 1. Detectar y registrar (inmediato)

Anotar hora, quién detecta y qué se observó. Fuentes disponibles:

- `audit_logs` — acciones y accesos a datos de cliente (`protected_data.*`).
- `agent_query_runs` — SQL ejecutado por agentes.
- Advisors de seguridad de Supabase.
- Logs de API y worker.

### 2. Contener (primeras horas)

Según el caso:

- **Credencial comprometida:** rotarla en el proveedor y en el entorno de
  despliegue. Las credenciales de integración se guardan cifradas en
  `private.integration_credentials`; rotarlas obliga a reautorizar la tienda.
- **Cuenta comprometida:** revocar sesiones en Supabase Auth y cambiar la
  contraseña; si es `platform_admin`, retirarle el rol hasta aclararlo.
- **Fallo de aislamiento entre organizaciones:** desplegar el arreglo de RLS o,
  si no es inmediato, retirar el acceso al endpoint afectado.

### 3. Evaluar el alcance

Responder por escrito: qué datos, de qué merchants, durante cuánto tiempo, y si
había datos de clientes finales implicados. El registro `protected_data.*` existe
para poder contestar esto sin adivinar.

### 4. Notificar

- **A los merchants afectados:** sin demora indebida, y como máximo **72 horas**
  desde que se conoce el incidente, con qué pasó, qué datos y qué deben hacer.
- **A Shopify:** si hay datos protegidos de clientes implicados, por los canales
  del Partner Dashboard.
- **A la autoridad de control (AEPD):** dentro de las 72 horas, si hay riesgo
  para los derechos de las personas afectadas (RGPD art. 33).

### 5. Cerrar

Una nota con causa raíz, qué se cambió para que no se repita y qué se aprendió.
Si el arreglo es de código, va con su test.

## Copias de seguridad y recuperación

Las copias las gestiona Supabase (cifradas en reposo). La recuperación no está
probada todavía: **hacer una prueba de restauración antes del primer cliente
real** es tarea pendiente, y hasta entonces la capacidad de recuperación es una
suposición, no un hecho.

## Contacto

Cualquier persona puede reportar un problema de seguridad a
**rafael@noraapp.es**. Se acusa recibo en 48 horas.
