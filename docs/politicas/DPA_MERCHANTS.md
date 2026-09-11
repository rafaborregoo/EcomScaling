# Acuerdo de tratamiento de datos (DPA) con los merchants — BORRADOR

> **Este documento es un borrador técnico, no un contrato firmado.** Recoge lo que
> el sistema hace de verdad para que un abogado lo convierta en el anexo
> contractual definitivo. **No lo envíes a un merchant ni lo publiques sin
> revisión legal.** Lo que sí es fiable aquí es la parte técnica: categorías de
> datos, subencargados y medidas, verificadas contra el código el 2026-09-10.

- **Última revisión:** 2026-09-10
- **Cubre:** requisito de Nivel 1 de Shopify "acuerdos de privacidad con los
  merchants".

## 1. Partes y papeles

- **Responsable del tratamiento:** el merchant (la tienda que conecta su cuenta).
  Decide qué datos conecta y para qué.
- **Encargado del tratamiento:** EcomScaling IA (Rafael Borrego,
  rafael@noraapp.es), que trata esos datos únicamente siguiendo las instrucciones
  del merchant.

Conectar una integración desde la plataforma es la instrucción documentada del
merchant para tratar los datos de esa plataforma.

## 2. Objeto y duración

Prestar el servicio de consultoría y análisis: mostrar métricas de la tienda,
generar diagnósticos y recomendaciones mediante agentes de IA, y permitir el
seguimiento por parte del consultor asignado.

El tratamiento dura mientras la integración esté conectada. Al desconectarla o
dar de baja la cuenta, los datos se borran tras 30 días de gracia
([ADR-0022](../decisions/ADR-0022-retencion-datos-shopify.md)). El merchant puede
exigir el borrado inmediato.

## 3. Categorías de datos

**De la tienda (no personales):** catálogo, inventario, pedidos, reembolsos,
costes, métricas de campañas de Meta Ads y de Klaviyo.

**De los clientes finales del merchant:** únicamente
- un identificador de referencia **con hash** (`customer_reference_hash`),
- número de pedidos, importe gastado, moneda, estado y etiquetas,
- estados de consentimiento de marketing (email y SMS).

**No se tratan** nombre, email, teléfono, dirección postal ni ubicación de los
clientes finales. Los pedidos y checkouts no almacenan email ni dirección de
envío.

**Del personal del merchant:** nombre, email y rol dentro de su organización, para
dar acceso a la plataforma.

## 4. Subencargados

| Subencargado | Para qué | Ubicación |
|---|---|---|
| Supabase | Base de datos, autenticación y copias de seguridad | UE (`eu-west-3`, París) |
| Vercel | Alojamiento de la aplicación web | Global (CDN) |
| IONOS | Servidor de la API, worker y Redis | UE |
| Anthropic | Modelos de lenguaje para los agentes | EE. UU. |
| OpenAI | Modelos de lenguaje y embeddings | EE. UU. |

A los proveedores de IA se les envían **métricas agregadas** del negocio, no
listados de clientes ni el hash de referencia. Las transferencias a EE. UU. se
amparan en las cláusulas contractuales tipo de cada proveedor.

Se informará al merchant antes de incorporar un subencargado nuevo, para que
pueda oponerse.

## 5. Medidas de seguridad

- Cifrado en tránsito (TLS) y en reposo, copias de seguridad cifradas.
- Aislamiento entre merchants impuesto por la base de datos (RLS por
  organización), no por el código de aplicación.
- Credenciales de integración cifradas a nivel de aplicación, en un esquema
  separado sin acceso desde la API pública.
- Registro de accesos a datos de cliente
  ([política de acceso del personal](ACCESO_DEL_PERSONAL.md)).
- Minimización: se pide a Shopify el mínimo de campos necesarios.
- [Prevención de pérdida de datos](PREVENCION_PERDIDA_DE_DATOS.md) y
  [respuesta a incidentes](RESPUESTA_A_INCIDENTES.md).

## 6. Personas con acceso

Solo el personal que lo necesita para prestar el servicio: el consultor asignado
a ese merchant y el administrador de la plataforma. El acceso está sujeto a
confidencialidad y se revisa al alta, a la baja y trimestralmente.

## 7. Derechos de los interesados

El merchant es quien responde ante sus clientes. EcomScaling IA le asiste:

- `customers/data_request`, `customers/redact` y `shop/redact` de Shopify se
  atienden por el flujo de webhooks obligatorios.
- Como no se guarda PII directa, una solicitud de acceso no genera un export de
  datos personales: no hay identidad que devolver, solo el hash con el que
  Shopify identifica a ese cliente.

## 8. Incidentes

Notificación al merchant sin demora indebida y como máximo en **72 horas** desde
que se conoce el incidente, según la
[política de respuesta a incidentes](RESPUESTA_A_INCIDENTES.md).

## 9. Al terminar

Borrado de los datos del merchant en los 30 días siguientes a la baja, salvo lo
que haya que conservar por obligación legal. A petición, certificado de borrado.

## Pendiente antes de que esto sea firmable

- Revisión legal del texto completo.
- Datos identificativos completos de la entidad responsable (razón social, NIF,
  domicilio).
- Confirmar y enlazar las cláusulas contractuales tipo de Anthropic y OpenAI.
- Separar entorno de desarrollo del de producción: hoy comparten proyecto de
  Supabase, y afirmar aislamiento en un contrato sin haberlo hecho sería falso.
