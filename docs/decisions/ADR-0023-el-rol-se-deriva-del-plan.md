# ADR-0023 - El rol se deriva del plan, no se concede

## Estado

Aprobada. Implementada en `20261006090000_rol_derivado_de_la_suscripcion.sql`,
`20261011090000_ver_la_suscripcion_propia.sql` y `apps/api/src/auth-context.ts`
(2026-09-15). Queda pendiente el ultimo paso: borrar `profiles.platform_role`.

## Contexto

`profiles.platform_role` (enum `user` / `consultant` / `platform_admin`) decidia
quien era quien. Era una columna que alguien ponia a mano: un platform admin
daba de alta a un consultor y le subia el rol.

Dos problemas, uno de producto y otro de arquitectura.

**De producto:** para que un consultor trabajase con un socio, o para que un
cliente pasara a llevar tiendas, habia que pedirselo a la direccion. La
plataforma no escalaba mas alla de la agenda de una persona.

**De arquitectura:** el modelo de negocio es que el consultor paga su
organizacion y el cliente paga la suya. Es decir, ser consultor **ya era**
consecuencia de pagar un plan. Tenerlo ademas como columna suelta son dos
fuentes de verdad sobre el mismo hecho, y se separan solas: el dia que una
suscripcion caduca, alguien se queda con `platform_role = 'consultant'` y sin
plan que lo respalde. Nadie se entera, porque no hay nada que lo compare. Es la
misma deriva silenciosa que documenta `CLAUDE.md` para las migraciones.

## Decision

El rol deja de almacenarse y pasa a derivarse:

| rol | de donde sale |
| --- | --- |
| staff (`platform_admin`) | `profiles.is_platform_staff`, explicito |
| consultor | tiene una suscripcion vigente **a su nombre** (`service_subscriptions.user_id`) |
| cliente | lo demas |

Tres cosas que no son obvias y que son el nucleo de la decision:

**1. El staff no se deriva.** Ningun plan otorga administrar la plataforma. Si
dependiera de una fila de facturacion, cancelarla dejaria la plataforma sin
administradores — y peor, alguien con acceso a facturacion podria concederselo.
Es la unica excepcion, y es deliberada.

**2. La suscripcion del consultor cuelga del usuario, no de una organizacion.**
`service_subscriptions.organization_id` pasa a nullable y un `check` obliga a
que vaya exactamente una de las dos columnas: o es de una organizacion, o es de
una persona. Con las dos (o con ninguna) no se sabe a quien cobrar.

Esto es lo que hace que la decision **no dependa del catalogo de planes**, que
no existe todavia: no hay que saber "que codigos de plan son de consultor",
basta con a quien pertenece la fila. La señal es el sujeto, no el contenido.

**3. El rol lo cambia su dueño, no quien le invita.** Un consultor puede crear
la cuenta de un compañero que no existe — eso no le quita nada a nadie. Lo que
no puede es convertir en consultora una cuenta que ya existe: esa cuenta es de
otra persona y el cambio de rol lo decide ella, contratando el plan. Se intento
lo contrario (commit `344ed6b`, con una confirmacion del consultor de por medio)
y se revirtio: la confirmacion era del invitador, no del dueño.

## Consecuencias

`profiles.platform_role` deja de ser la verdad. Se sigue escribiendo mientras
exista porque ~8 consultas la leen para pintar listas de perfiles; el `drop
column` exige migrarlas antes.

La API (`derivePlatformRole` en `auth-context.ts`) sigue devolviendo
`profile.platform_role` con los mismos tres valores, asi que los ~149 sitios que
lo leen no cambian: todos pasaban ya por `loadProfile`. El coste real del
refactor fue el SQL, no el TypeScript.

La vigencia se calcula con el mismo criterio en `private.is_consultant` y en
Node. Si divergieran, la RLS y la API dirian cosas distintas sobre la misma
persona.

**Un plan caducado deja de dar rol solo.** Eso es el objetivo, y tambien el
riesgo nuevo: cuando exista la caducidad de verdad (hoy nada mueve una
suscripcion a `expired`), un consultor que no pague dejara de ver su cartera sin
mas aviso que el que le demos. Hay que diseñar ese aviso junto al catalogo.

En RLS el cambio fue pequeño porque estaba bien factorizado: **ninguna policy
menciona `platform_role`**, todas pasan por cinco funciones de `private`
(comprobado en `pg_policies` contra produccion). Se reapuntaron esas cinco.

Se encontro de paso un fallo que ya existia: la policy de select de
`service_subscriptions` filtraba por `organization_id in (...)`, y con
`organization_id` nulo `null in (...)` nunca es cierto. Ninguna suscripcion de
usuario era visible para su dueño. Corregido en `20261011090000` con una policy
aparte en vez de un `or` en la existente: la de organizacion y la de persona
responden a preguntas distintas, y es en las expresiones con `or` donde se cuela
el permiso de mas cuando alguien las toca.

## Alternativa descartada

Dejar `platform_role` como cache que solo escribe el flujo de cambio de plan,
con un job que la revierta al caducar. Mas barato y no toca RLS, pero mantiene
las dos fuentes de verdad: sigue habiendo una ventana en la que la columna y el
plan no coinciden, y un sitio del que acordarse. Se descarto expresamente a
favor de derivar de verdad.
