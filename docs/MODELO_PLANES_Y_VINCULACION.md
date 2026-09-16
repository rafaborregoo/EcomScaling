# EcomScaling IA — Modelo de planes, organizaciones consultoras y seguridad de códigos

> **Estado:** decidido por Rafa (2026-09-16). Es el modelo comercial con el que se
> construyen los planes. Sustituye las cifras de
> [PRICING_Y_MODELO_MULTITIENDA.md](PRICING_Y_MODELO_MULTITIENDA.md), que queda
> como historial de las preguntas abiertas.
>
> **Plan de obra:** [PLAN_ORGANIZACION_CONSULTORA_Y_SALDO_COPILOTO.md](PLAN_ORGANIZACION_CONSULTORA_Y_SALDO_COPILOTO.md).
>
> **Implementación:** ver [STRIPE.md](STRIPE.md) (cobro y planes) y
> [ADR-0023](decisions/ADR-0023-el-rol-se-deriva-del-plan.md) (de dónde sale el
> rol). Lo que este documento describe **no está construido todavía** salvo lo
> que se señala en `STRIPE.md`.

## 1. Objetivo del documento

Este documento define la lógica funcional y de seguridad asociada al modelo comercial de EcomScaling IA para:

- clientes finales;
- organizaciones consultoras;
- consultores pertenecientes a una organización;
- códigos de vinculación;
- descuento del 10% para clientes vinculados;
- límites de cartera;
- control de uso de códigos;
- trazabilidad y prevención de abuso.

Este documento complementa la vista comercial mostrada en el HTML de planes.

La lógica interna de seguridad descrita aquí **no debe exponerse en el HTML público** salvo los mensajes estrictamente necesarios para el usuario.

---

# 2. Modelo comercial visible

## 2.1. Cliente

### Suscripción base

**200 €/mes + IVA**

Incluye:

- 1 tienda conectada;
- 2 usuarios;
- conexión con Shopify;
- conexión con Meta;
- acceso al Copiloto IA 24/7.

### Extras

- tienda adicional: **+120 €/mes + IVA**;
- usuario adicional: **+30 €/mes + IVA**.

### Cliente vinculado a consultor

Un cliente que se registra utilizando un código válido facilitado por un consultor obtiene:

**10% de descuento sobre su suscripción mientras permanezca vinculado a la organización consultora.**

La suscripción sigue perteneciendo al cliente.

La organización consultora no paga la suscripción del cliente.

Si el cliente deja de estar vinculado a la organización consultora:

- conserva su cuenta;
- conserva sus datos;
- conserva sus tiendas;
- conserva sus usuarios;
- deja de aplicarse el descuento;
- vuelve a tarifa estándar.

---

# 3. Organización consultora

La unidad comercial principal es la **organización consultora**.

Una organización consultora puede contener varios consultores activos.

## 3.1. Suscripción base

**500 €/mes + IVA**

Incluye:

- 4 clientes activos;
- 2 consultores activos;
- 2 tiendas propias;
- acceso al Copiloto IA 24/7 para los consultores incluidos.

## 3.2. Consultores adicionales

- 2 consultores incluidos;
- cada consultor adicional: **+60 €/mes + IVA**.

Un consultor adicional no debe modelarse como un simple usuario genérico.

Es un miembro operativo con capacidad para:

- acceder al Copiloto IA;
- gestionar clientes;
- recibir asignaciones;
- generar códigos;
- consultar información de clientes según permisos;
- participar en la operativa de la organización.

---

# 4. Escalado de clientes activos del consultor

La cartera se calcula a nivel de organización.

No se calcula un cupo independiente por cada consultor.

## Tramos

### Clientes 1 a 4

Incluidos en la cuota base de 500 €.

### Clientes 5 a 8

**+100 €/cliente activo**

### Clientes 9 a 15

**+80 €/cliente activo**

### Cliente 16 en adelante

**+50 €/cliente activo**

## Ejemplo

Organización con:

- 12 clientes activos;
- 2 consultores;
- 2 tiendas propias.

Cálculo:

- base: 500 €;
- clientes 5-8: 4 × 100 € = 400 €;
- clientes 9-12: 4 × 80 € = 320 €.

Total:

**1.220 €/mes + IVA**

---

# 5. Tiendas propias de la organización consultora

La organización consultora incluye:

- 2 tiendas propias.

Cada tienda propia adicional:

**+120 €/mes + IVA**

Estas tiendas pertenecen a la operativa propia del consultor u organización consultora.

No deben confundirse con las tiendas pertenecientes a los clientes vinculados.

---

# 6. Relación Organización → Consultor → Cliente

La estructura funcional recomendada es:

```text
ORGANIZACIÓN CONSULTORA
│
├── Consultor A
│   ├── Cliente 1
│   └── Cliente 2
│
├── Consultor B
│   ├── Cliente 3
│   └── Cliente 4
│
└── Cartera total compartida
```

La cartera pertenece a la organización.

Cada cliente puede tener:

- una organización consultora vinculada;
- un consultor responsable;
- un consultor captador;
- un historial de reasignaciones.

Un cliente puede cambiar de consultor interno sin perder:

- su vinculación con la organización;
- su descuento del 10%;
- su cuenta;
- su información histórica.

---

# 7. Código de vinculación

## 7.1. Qué es

El código no debe tratarse como un simple cupón promocional.

Debe modelarse como un **token de vinculación de un solo uso**.

Su función es:

1. identificar la organización consultora;
2. identificar al consultor que generó o facilitó el código;
3. crear la relación cliente ↔ organización consultora;
4. registrar quién captó al cliente;
5. activar el descuento del 10%;
6. consumir una plaza de cliente disponible cuando corresponda.

---

# 8. Regla principal: código de un solo uso

Cada código debe ser válido para **una única vinculación de cliente**.

Ejemplo:

```text
Código: ECS-X8M4-KP29
Estado inicial: ACTIVE

Cliente A lo utiliza correctamente.

Estado final:
CONSUMED
```

Si otra persona intenta utilizar el mismo código:

```text
ERROR:
Código ya utilizado.
```

El código nunca debe volver a ser válido después de consumirse.

---

# 9. Los códigos no deben ser reutilizables

No utilizar:

```text
CONSULTOR10
RAFA10
CELIA10
ECOMSCALING10
```

como códigos reutilizables.

Eso permitiría:

- compartir el código públicamente;
- publicarlo en redes sociales;
- usarlo por clientes que no pertenecen a la cartera;
- crear descuentos ilimitados;
- falsear el número de clientes gestionados.

Cada incorporación debe utilizar un código único.

---

# 10. Generación de códigos

Un consultor debe solicitar o generar un código desde su panel.

Ejemplo:

```text
Generar nuevo código de cliente
```

Resultado:

```text
ECS-7FV9-KQ4M
```

Cada código debe estar asociado internamente a:

```text
code_id
organization_id
consultant_id
status
created_at
expires_at
consumed_at
consumed_by_customer_id
```

---

# 11. El número de códigos debe estar limitado

La organización no debe poder generar códigos ilimitados.

La aplicación debe conocer:

```text
clientes_contratados
clientes_activos
codigos_pendientes
```

Y calcular:

```text
capacidad_disponible =
clientes_contratados
- clientes_activos
- codigos_pendientes_reservados
```

Ejemplo:

```text
Plan / configuración:
8 clientes activos permitidos

Clientes actualmente vinculados:
6

Códigos activos sin utilizar:
1

Capacidad disponible:
1
```

La organización podrá generar como máximo otro código.

---

# 12. Evitar sobreventa de plazas

Problema:

Una organización con capacidad para 8 clientes tiene 7 activos.

Dos consultores generan simultáneamente dos códigos.

Si el sistema no controla concurrencia, podría terminar con 9 clientes.

## Solución

La generación de un código debe reservar capacidad.

Ejemplo:

```text
clientes_activos = 7
codigos_activos = 1
limite = 8

NO permitir generar otro código.
```

La comprobación debe ejecutarse en backend y dentro de una operación transaccional.

Nunca confiar únicamente en la interfaz.

---

# 13. Estados recomendados para un código

```text
ACTIVE
CONSUMED
EXPIRED
REVOKED
CANCELLED
```

## ACTIVE

Código válido y pendiente de uso.

## CONSUMED

Código utilizado correctamente por un cliente.

## EXPIRED

Ha superado su fecha de validez.

## REVOKED

La organización o EcomScaling lo ha invalidado manualmente.

## CANCELLED

Código cancelado antes de utilizarse y cuya plaza puede liberarse.

---

# 14. Caducidad

Los códigos deberían caducar.

Recomendación inicial:

**7 días**

o:

**14 días**

No recomiendo códigos sin caducidad.

Esto reduce:

- fugas;
- códigos olvidados;
- plazas bloqueadas;
- códigos compartidos mucho tiempo después.

---

# 15. Reserva de plaza y expiración

Cuando se genera un código:

```text
status = ACTIVE
```

La plaza queda temporalmente reservada.

Si el código caduca:

```text
status = EXPIRED
```

La plaza vuelve a estar disponible.

---

# 16. Validación durante el registro

El flujo correcto es:

```text
Cliente inicia registro
        ↓
Introduce código
        ↓
Backend valida código
        ↓
Comprueba organización
        ↓
Comprueba consultor
        ↓
Comprueba estado ACTIVE
        ↓
Comprueba expiración
        ↓
Comprueba capacidad
        ↓
Completa registro
        ↓
Crea vinculación
        ↓
Marca código CONSUMED
        ↓
Activa descuento 10%
```

---

# 17. No consumir el código demasiado pronto

No debe marcarse el código como consumido simplemente al escribirlo.

Solo debe consumirse cuando:

- el registro se completa;
- el usuario queda creado;
- la organización del cliente queda creada;
- la vinculación se guarda correctamente.

Si el registro falla:

```text
el código debe permanecer ACTIVE
```

o mantenerse reservado durante un periodo breve.

---

# 18. Operación atómica

La vinculación debe realizarse de forma transaccional.

Idealmente:

```text
BEGIN TRANSACTION

validar código
validar capacidad
crear cliente
crear organización cliente
crear relación consultant_customer
marcar código consumed
activar descuento

COMMIT
```

Si falla cualquier paso:

```text
ROLLBACK
```

Nunca debe ocurrir:

```text
código consumido
pero cliente no creado
```

o:

```text
cliente creado
pero código todavía reutilizable
```

---

# 19. Protección contra doble uso simultáneo

Dos solicitudes podrían intentar usar el mismo código al mismo tiempo.

Debe utilizarse:

- bloqueo de fila;
- transacción;
- constraint único;
- operación atómica.

Ejemplo conceptual SQL:

```sql
SELECT *
FROM consultant_invite_codes
WHERE id = ?
FOR UPDATE;
```

Después validar:

```text
status == ACTIVE
```

y consumirlo dentro de la misma transacción.

---

# 20. Código no predecible

Los códigos deben generarse usando aleatoriedad criptográficamente segura.

Evitar:

```text
CLIENTE0001
CLIENTE0002
CLIENTE0003
```

porque son enumerables.

Formato posible:

```text
ECS-8K2F-Q7MW
```

La seguridad real debe estar en la entropía, no en el prefijo.

---

# 21. No guardar el código en claro si no es necesario

Modelo recomendado:

```text
code_hash
```

en base de datos.

Flujo:

```text
usuario introduce código
↓
backend calcula hash
↓
compara con code_hash
```

Esto evita que una filtración de base de datos exponga todos los códigos activos.

---

# 22. Rate limiting

El endpoint de validación de códigos debe tener rate limiting.

Ejemplo:

```text
10 intentos / minuto / IP
```

y adicionalmente:

```text
20 intentos / hora / cuenta
```

Esto evita fuerza bruta.

---

# 23. Protección anti-enumeración

La API no debe responder:

```text
Este código pertenece a Consultora X.
```

antes de validarlo.

Respuestas recomendadas:

```text
Código válido.
```

o:

```text
Código no válido o no disponible.
```

Evitar revelar:

- organización;
- consultor;
- número de plazas;
- estado interno.

---

# 24. Asociación del código

Cada código debe guardar como mínimo:

```text
organization_id
consultant_id
```

Esto permite saber:

- qué organización captó al cliente;
- qué consultor lo originó.

---

# 25. Cliente vinculado a organización

La relación principal debe ser:

```text
customer_organization_id
        ↓
consulting_organization_id
```

No únicamente:

```text
customer_id
↓
consultant_user_id
```

Porque el consultor individual puede abandonar la organización.

---

# 26. Consultor responsable

Separar:

```text
captured_by_consultant_id
```

de:

```text
assigned_consultant_id
```

Ejemplo:

Celia capta al cliente.

Después el cliente pasa a Pedro.

Debe quedar:

```text
captured_by = Celia
assigned_to = Pedro
```

La atribución comercial no se pierde.

---

# 27. Cambio de consultor

Un administrador de la organización debe poder:

```text
Cliente A
Consultor actual: Celia

REASIGNAR

Nuevo consultor: Pedro
```

La reasignación:

- no modifica la suscripción;
- no elimina el descuento;
- no cambia la organización vinculada;
- debe quedar auditada.

---

# 28. Baja de un consultor

Si un consultor abandona una organización:

NO se deben desvincular automáticamente sus clientes.

Debe ejecutarse:

```text
consultant.status = disabled
```

y después:

```text
clientes asignados → pendientes de reasignación
```

o reasignación automática a un administrador.

---

# 29. Baja de la organización consultora

Si la organización consultora cancela su plan:

los clientes NO deben perder sus cuentas.

Debe ocurrir:

```text
vinculación consultor → finalizada
descuento → eliminado
cliente → permanece activo
tarifa → estándar
```

---

# 30. Descuento del cliente

El descuento no debería almacenarse únicamente como:

```text
discount = 10
```

Es mejor derivarlo de la relación:

```text
consultant_link.status = ACTIVE
```

Entonces:

```text
si ACTIVE:
  descuento = 10%

si INACTIVE:
  descuento = 0%
```

Esto evita inconsistencias.

---

# 31. Fuente de verdad

La fuente de verdad debe ser la relación de vinculación.

Ejemplo:

```text
consultant_customer_links
```

Campos posibles:

```text
id
consulting_organization_id
customer_organization_id
captured_by_consultant_id
assigned_consultant_id
invite_code_id
status
linked_at
unlinked_at
created_at
updated_at
```

---

# 32. Estados de vinculación

```text
PENDING
ACTIVE
SUSPENDED
ENDED
```

## PENDING

Registro iniciado pero no completado.

## ACTIVE

Cliente vinculado y descuento activo.

## SUSPENDED

Relación temporalmente bloqueada.

## ENDED

Relación terminada.

---

# 33. Cliente activo para facturación del consultor

Debe definirse con precisión qué significa:

```text
cliente activo
```

Recomendación:

Un cliente cuenta como activo cuando:

```text
link.status == ACTIVE
AND
customer.subscription.status IN ('active', 'trialing')
```

No contar:

```text
cancelled
expired
pending
unlinked
```

---

# 34. Sincronización con facturación

La cuota del consultor depende de:

- clientes activos;
- consultores activos;
- tiendas propias.

Esto significa que cambios en cualquiera de estos valores pueden afectar facturación.

Debe existir un snapshot de facturación.

Ejemplo:

```text
billing_snapshot
{
  active_clients: 12,
  active_consultants: 4,
  own_stores: 3,
  calculated_amount: 1460
}
```

No depender únicamente del estado mutable actual.

---

# 35. Evitar facturación retroactiva inesperada

Si un consultor añade un cliente a mitad de mes:

definir política clara:

### Opción recomendada

Prorrateo.

Ejemplo:

```text
cliente adicional: 100 €/mes
quedan 15 días
cargo: ~50 €
```

Igual para consultores y tiendas adicionales.

---

# 36. Auditoría

Registrar eventos relevantes.

Ejemplo:

```text
CONSULTANT_CODE_CREATED
CONSULTANT_CODE_REVOKED
CONSULTANT_CODE_EXPIRED
CONSULTANT_CODE_CONSUMED

CUSTOMER_LINK_CREATED
CUSTOMER_LINK_ENDED
CUSTOMER_REASSIGNED

CONSULTANT_ADDED
CONSULTANT_DISABLED

PORTFOLIO_LIMIT_CHANGED
```

Cada evento debe guardar:

```text
timestamp
actor_user_id
organization_id
entity_id
metadata
ip_address
```

cuando sea necesario.

---

# 37. Panel del consultor

El consultor debería poder ver:

```text
Clientes contratados / capacidad
Clientes activos
Códigos activos
Códigos consumidos
Códigos caducados
Capacidad disponible
```

Ejemplo:

```text
Clientes activos      7
Capacidad contratada  8
Códigos pendientes    1
Plazas disponibles    0
```

---

# 38. Panel del administrador de organización

Un administrador debería poder:

- añadir consultores;
- desactivar consultores;
- reasignar clientes;
- ver códigos generados;
- revocar códigos;
- ver atribución de clientes;
- ver capacidad utilizada;
- cambiar número de tiendas propias;
- consultar facturación.

---

# 39. Permisos

Roles mínimos recomendados:

```text
organization_owner
organization_admin
consultant
```

## organization_owner

Control total.

## organization_admin

Puede:

- gestionar consultores;
- reasignar clientes;
- generar/revocar códigos;
- ver facturación según política.

## consultant

Puede:

- ver clientes asignados;
- generar códigos si tiene permiso;
- trabajar con clientes;
- utilizar Copiloto IA.

---

# 40. Seguridad multi-tenant

La arquitectura debe garantizar:

```text
consulting_organization_A
```

nunca puede consultar datos de:

```text
consulting_organization_B
```

Ni siquiera mediante IDs manipulados.

Si se usa PostgreSQL/Supabase:

usar RLS.

Ejemplo conceptual:

```text
organization_id == authenticated_user.organization_id
```

---

# 41. Acceso a clientes

Un consultor no debería obtener automáticamente acceso global a todos los clientes salvo que la política de organización lo permita.

Modelo posible:

```text
Owner/Admin:
  toda la cartera

Consultant:
  clientes asignados
```

Esto reduce riesgo interno.

---

# 42. Protección de APIs

Nunca confiar en:

```text
organization_id
consultant_id
customer_id
```

enviados por frontend.

El backend debe derivar el contexto autorizado desde:

```text
authenticated_user_id
```

y sus memberships.

---

# 43. Idempotencia

Los endpoints sensibles deben soportar idempotencia.

Especialmente:

```text
consume_invite_code
create_customer_link
create_subscription
```

Para evitar dobles operaciones por:

- doble click;
- reintentos;
- problemas de red.

---

# 44. Webhooks de facturación

Si se utiliza Stripe u otro proveedor:

verificar firma de webhook.

Nunca confiar en llamadas no firmadas.

Eventos relevantes:

```text
subscription.created
subscription.updated
subscription.deleted
invoice.paid
invoice.payment_failed
```

---

# 45. Fallos de pago

Si el consultor no paga:

no eliminar inmediatamente clientes.

Puede aplicarse:

```text
ACTIVE
↓
PAST_DUE
↓
GRACE_PERIOD
↓
SUSPENDED
```

Durante suspensión:

- no generar nuevos códigos;
- no añadir nuevos clientes;
- limitar operativa de consultoría según política.

Los clientes siguen manteniendo sus propias cuentas.

---

# 46. Protección contra autofiliación

Un consultor no debería poder:

- crear una cuenta cliente propia;
- usar su propio código;
- beneficiarse fraudulentamente del descuento.

Se pueden aplicar comprobaciones sobre:

- misma cuenta;
- mismo email;
- mismo dominio;
- misma organización;
- mismo método de pago;
- señales de riesgo.

No bloquear únicamente por IP, ya que oficinas completas comparten IP.

---

# 47. Protección contra circularidad

Evitar:

```text
Organización A usa código de B
Organización B usa código de A
```

para crear descuentos artificiales.

Si una organización tiene tipo:

```text
CONSULTING_ORGANIZATION
```

definir si puede o no actuar también como cliente vinculado.

La política debe ser explícita.

---

# 48. Límite de códigos activos por consultor

Aunque exista capacidad, puede ser razonable limitar códigos pendientes por consultor.

Ejemplo:

```text
máximo 5 códigos ACTIVE por consultor
```

Esto evita generar cientos de códigos sin necesidad.

---

# 49. Alertas de fraude

Crear alertas cuando:

```text
muchos intentos fallidos de código
muchos códigos generados y nunca consumidos
múltiples cuentas desde patrones sospechosos
múltiples usos desde misma identidad
picos anormales de generación
```

---

# 50. Código visible una sola vez

Opcionalmente, por mayor seguridad:

al generar código:

```text
ECS-8FH2-QP9M
```

mostrarlo una sola vez.

Después mostrar:

```text
••••••••••••
```

con opción:

```text
Revocar
Generar nuevo
```

No es estrictamente obligatorio si se almacena de forma segura, pero mejora la postura de seguridad.

---

# 51. Hashing de códigos

No utilizar cifrado reversible si no es necesario.

Preferible:

```text
code_hash = HMAC-SHA256(secret, code)
```

Esto permite búsquedas deterministas seguras.

Alternativamente usar:

```text
SHA-256
```

si la entropía del código es suficientemente alta.

HMAC es preferible.

---

# 52. No exponer reglas internas

El HTML público NO debe mostrar:

- cómo se calcula la capacidad reservada;
- límites de códigos simultáneos;
- algoritmo de generación;
- hashes;
- rate limits;
- mecanismos antifraude;
- lógica de bloqueo;
- reglas internas de concurrencia.

El cliente solo necesita ver:

```text
Introduce el código facilitado por tu consultor durante el registro.
```

Y el consultor:

```text
Genera un código para vincular un nuevo cliente.
```

---

# 53. Mensajes de error públicos

Correcto:

```text
El código no es válido o ya no está disponible.
```

Evitar:

```text
Este código existía pero expiró ayer.
```

```text
Este código pertenece a Celia García.
```

```text
La organización ha alcanzado exactamente 8 clientes.
```

La información operativa detallada debe permanecer en el panel autorizado del consultor.

---

# 54. Entidades recomendadas

Modelo conceptual:

```text
organizations
users
organization_memberships

consultant_invite_codes
consultant_customer_links

stores
subscriptions
billing_snapshots

audit_events
```

---

# 55. consultant_invite_codes

Campos conceptuales:

```text
id
organization_id
consultant_id
code_hash
status
created_at
expires_at
consumed_at
consumed_by_customer_organization_id
revoked_at
metadata
```

Constraints:

```text
code_hash UNIQUE
```

---

# 56. consultant_customer_links

```text
id
consulting_organization_id
customer_organization_id
captured_by_consultant_id
assigned_consultant_id
invite_code_id
status
linked_at
unlinked_at
created_at
updated_at
```

Constraint importante:

Un cliente solo debería tener una vinculación activa de este tipo si esa es la regla comercial.

Ejemplo:

```text
UNIQUE ACTIVE link per customer_organization
```

---

# 57. organization_memberships

Permite múltiples consultores:

```text
organization_id
user_id
role
status
joined_at
```

Ejemplo:

```text
Organization A
- Rafa      OWNER
- Celia     CONSULTANT
- Pedro     CONSULTANT
```

---

# 58. Separación entre usuario y consultor

No asumir:

```text
user == consultant
```

El sistema debería permitir en el futuro:

```text
owner
admin
consultant
analyst
billing
```

aunque inicialmente solo se comercialicen consultores.

---

# 59. Métricas útiles

Para la organización:

```text
active_clients
active_consultants
available_client_capacity
active_codes
conversion_rate_codes
monthly_mrr_generated
```

Para EcomScaling:

```text
MRR consultores
MRR clientes vinculados
ARPU consultor
clientes por consultor
churn cliente vinculado
churn organización consultora
code_conversion_rate
fraud_rate
```

---

# 60. Regla económica importante

El consultor funciona simultáneamente como:

- cliente SaaS;
- usuario profesional;
- canal de adquisición.

Por ello la estructura debe evitar penalizar excesivamente su crecimiento.

La reducción del coste marginal:

```text
100 € → 80 € → 50 €
```

busca que el consultor tenga incentivo económico para incorporar más clientes.

---

# 61. Flujo completo final

```text
ORGANIZACIÓN CONSULTORA
        │
        ├── tiene N consultores activos
        │
        ├── tiene capacidad para N clientes
        │
        └── cada consultor puede generar códigos
                     │
                     ▼
               CÓDIGO ÚNICO
                     │
                     ▼
            CLIENTE SE REGISTRA
                     │
                     ▼
             BACKEND VALIDA
                     │
                     ├── código válido
                     ├── código no usado
                     ├── código no expirado
                     ├── organización activa
                     ├── consultor activo
                     └── capacidad disponible
                     │
                     ▼
               VINCULACIÓN
                     │
                     ├── cliente → organización
                     ├── captured_by → consultor
                     └── assigned_to → consultor
                     │
                     ▼
              10% DESCUENTO
                     │
                     ▼
           CÓDIGO → CONSUMED
```

---

# 62. Principios no negociables

1. **Código de un solo uso.**
2. **Código no reutilizable.**
3. **Generación limitada por capacidad contratada.**
4. **Validación siempre en backend.**
5. **Consumo mediante transacción atómica.**
6. **Protección contra concurrencia.**
7. **Código no predecible.**
8. **Rate limiting.**
9. **Auditoría completa.**
10. **Cliente vinculado a organización, no únicamente a persona.**
11. **Consultor captador y consultor asignado deben ser conceptos separados.**
12. **El descuento depende de una vinculación activa.**
13. **La baja del consultor no elimina clientes.**
14. **La baja de la organización no elimina cuentas de clientes.**
15. **Aislamiento multi-tenant obligatorio.**
16. **No confiar en IDs enviados por frontend.**
17. **No exponer lógica interna de seguridad en el HTML público.**
18. **La capacidad debe calcular clientes activos + códigos pendientes reservados.**
19. **La facturación debe basarse en snapshots auditables.**
20. **Toda operación crítica debe ser idempotente.**

---

# 63. Resumen ejecutivo

El HTML comercial debe comunicar únicamente:

## Cliente

```text
200 €/mes + IVA
1 tienda
2 usuarios
+120 €/tienda
+30 €/usuario
10% de descuento con código de consultor válido
```

## Consultor

```text
500 €/mes + IVA
4 clientes
2 consultores
2 tiendas propias

5–8 clientes   +100 €/cliente
9–15 clientes  +80 €/cliente
16+ clientes   +50 €/cliente

+60 €/consultor adicional
+120 €/tienda propia adicional
```

La infraestructura interna debe convertir el código de consultor en un **token de vinculación de un solo uso**, limitado por la capacidad contratada de la organización y protegido por controles transaccionales, antifraude, multi-tenant y de auditoría.

Ese sistema permite que EcomScaling IA escale a organizaciones con múltiples consultores y cientos de clientes sin convertir el descuento en un cupón compartible o explotable.
