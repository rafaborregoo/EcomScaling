# Política de acceso del personal a datos de cliente

- **Última revisión:** 2026-09-10
- **Responsable:** Rafael Borrego (rafael@noraapp.es)
- **Cubre:** requisito de Nivel 2 de Shopify "limitar el acceso del personal a
  datos protegidos" y "contraseñas fuertes para las cuentas del equipo".

Este documento describe lo que el sistema hace hoy y lo que la persona que lo
opera se compromete a hacer. Donde algo todavía no se cumple, se dice.

## Quién puede ver qué

El acceso no depende de la buena voluntad de nadie: está impuesto por la base de
datos mediante RLS por organización. Ningún rol puede leer datos de una
organización a la que no pertenece o que no tiene asignada.

| Rol | Alcance | Cómo se impone |
|---|---|---|
| `owner` / `manager` / `member` de una organización | Solo su organización | RLS: `private.is_active_org_member()` |
| Consultor | Solo los clientes que tiene asignados | RLS: `private.is_assigned_consultant()` |
| `platform_admin` | Toda la plataforma | RLS: `private.is_platform_admin()` |

Las escrituras que pasan por `SUPABASE_SERVICE_ROLE_KEY` (y por tanto se saltan
RLS) comprueban la pertenencia y el rol a mano antes de tocar nada, según el
punto 7 de [ADR-0006](../decisions/ADR-0006-integration-module-pattern.md).

## Principio de mínimo necesario

- `platform_admin` es un rol de operación de plataforma, no de trabajo diario:
  hoy lo tiene **una sola persona**. Un consultor no lo necesita para llevar
  clientes, y la navegación está separada precisamente para que no haga falta.
- Los datos de los clientes finales del merchant se procesan al mínimo: hash de
  referencia en vez de identidad, sin email, teléfono ni dirección postal. Lo que
  no se guarda no hay que protegerlo.
- Los agentes de IA leen a través de vistas de solo lectura filtradas por
  organización ([SQL Gateway](../../apps/api/src/sql-gateway.ts)); no tienen
  acceso directo a las tablas.

## Registro de accesos

Toda lectura de datos de cliente queda registrada en `audit_logs` con una acción
que empieza por `protected_data.`
([protected-data-access.ts](../../apps/api/src/protected-data-access.ts)). Se
consulta en **Administración → Auditoría y errores**, filtrando por el área
"Accesos a datos de cliente".

Quedan cubiertas las cuatro superficies por las que hoy salen esos datos:

| Superficie | Acción registrada |
|---|---|
| Panel de Shopify del consultor (recurrencia, valor, cohortes) | `protected_data.shopify_insights` |
| Herramientas de los agentes de IA | `protected_data.ai_agent_context` |
| Consultas SQL de agentes que tocan la tabla de clientes | `protected_data.ai_sql_gateway` |
| Export completo de una organización | `protected_data.organization_export` |

Las consultas de agentes tienen además su propio registro con el SQL entero en
`agent_query_runs`.

## Cuentas del equipo

La autenticación es Supabase Auth: la política de contraseñas **no vive en este
repositorio**, es configuración del proyecto en el panel de Supabase
(Authentication → Sign In / Providers → Password). Por eso hay que revisarla ahí
y no basta con leer el código.

Estado medido el 2026-09-10 en el proyecto de producción (`SaaS-EcomScaling`):

| Ajuste | Estado | Objetivo |
|---|---|---|
| Protección de contraseñas filtradas (HaveIBeenPwned) | **Desactivada y no activable hoy**: requiere plan Pro y la organización está en **free** | Activada (exige subir de plan) |
| Longitud mínima | Por defecto de Supabase (**6**) mientras no se cambie | 12 |
| Requisitos de caracteres | Por defecto: ninguno | Dígitos, minúsculas, mayúsculas y símbolos |
| MFA para `platform_admin` | No exigido | Exigido |

Los tres últimos se cambian en
`https://supabase.com/dashboard/project/cthjwpeygpzwdmjkxeqa/auth/providers?provider=Email`
y no dependen del plan.

El primero sí: **Supabase solo ofrece la protección de contraseñas filtradas a
partir del plan Pro**, y la organización `EcomScaling` está en free (comprobado
el 2026-09-10). Es decir, este punto no se cierra escribiendo nada ni tocando
ajustes: o se sube de plan, o se declara ante Shopify que se cubre por longitud y
complejidad de contraseña. **Mientras tanto, el requisito no se cumple del todo**,
y conviene no marcarlo como cerrado en la solicitud.

## Revisión de accesos

- Al alta y baja de cualquier persona del equipo: revisar `platform_admin` y
  asignaciones de consultor.
- Trimestralmente: repasar quién tiene `platform_admin`, quién sigue asignado a
  cada cliente, y pasar el advisor de seguridad de Supabase.
- Al cerrar la relación con un cliente: retirar la asignación de consultor, que
  es lo que corta el acceso por RLS.

## Lo que hoy no se cumple

- **Entornos separados de test y producción.** El desarrollo local apunta al
  mismo proyecto de Supabase que producción. Es el punto más serio de esta lista
  y ninguna redacción lo arregla: requiere un proyecto aparte para desarrollo.
- **MFA** no está exigido para las cuentas con más alcance.
- La revisión trimestral es un compromiso desde hoy, sin histórico todavía.
