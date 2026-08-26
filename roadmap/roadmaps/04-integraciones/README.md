# Roadmap operativo - Integraciones

## Objetivo

> Verificacion vigente 2026-08-24: la suite contractual actual de integraciones
> pasa 14/14 con `npx tsx --test`; las cifras 10/10 y 6/6 de notas anteriores
> son historicas. Shopify permanece operativo y los conectores futuros siguen
> protegidos por feature flags y estados honestos.

Integrar proveedores externos de forma aislada, auditable e idempotente, sin contaminar el dominio interno con payloads externos.

## Contrato de preparación

La definición operativa de “preparado para conectar” está en
[`CONTRATO_PREPARACION_CONECTORES.md`](CONTRATO_PREPARACION_CONECTORES.md). Shopify
puede estar operativo mientras Meta, Klaviyo e Instagram permanecen en estados
honestos de preparación o no disponibilidad. La interfaz, los estados, la selección
de activos y los agentes no dependen de credenciales presentes para existir.

La ejecución cuando lleguen credenciales está definida en
[`INT-08-EXTERNAL-CONNECTOR-VALIDATION-MATRIX.md`](INT-08-EXTERNAL-CONNECTOR-VALIDATION-MATRIX.md),
con precondiciones, pruebas, evidencias y criterios de promoción por proveedor.

Este roadmap aplica el [objetivo global del SaaS y sus criterios de terminado](../../../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md).
Shopify es la única integración operativa del piloto; Meta Ads, Klaviyo e Instagram se preparan para una
activación posterior sin cambiar la UI ni el dominio. Ningún conector puede mostrar datos simulados como
reales.

> Correccion contractual 2026-08-02: el catalogo comun declara `tokenRefresh`
> como `true` para Shopify y Klaviyo (ambos tienen refresh implementado) y
> `false` para Meta Ads (el token caducado exige reautorizacion). La prueba
> contractual de catalogo y adapters pasa 10/10.

> Correccion de contrato de flags 2026-08-02: el allowlist acepta tanto el
> formato corto de entorno (`meta_ads`) como el nombre canonico publicado por
> el catalogo (`integration.meta_ads`), evitando que UI y runtime diverjan.
> Regresion de `packages/integrations`: 6/6.

> **Corrección de activación 2026-08-24:** la API y la pantalla de Integraciones distinguen si el conector está configurado, carece de credenciales, tiene el feature flag desactivado o aún no está implementado. Los botones OAuth se habilitan solo cuando el estado es `configured`.

## Fases

| Fase   | Archivo                        | Relacion maestro | Resultado                                                        |
| ------ | ------------------------------ | ---------------- | ---------------------------------------------------------------- |
| INT-00 | `fases/INT-00-nucleo-comun.md` | F4               | OAuth, credenciales, sync runs, webhooks, retries y rate limits. |
| INT-01 | `fases/INT-01-shopify.md`      | F4-F5            | Shopify end-to-end.                                              |
| INT-02 | `fases/INT-02-meta-ads.md`     | F6               | Meta Ads y creatividades.                                        |
| INT-03 | `fases/INT-03-klaviyo.md`      | F11              | Klaviyo y email reporting.                                       |
| INT-04 | `fases/INT-04-fathom-loom.md`  | F8/F12           | Llamadas manuales Loom y automatizacion Fathom.                  |
| INT-05 | `fases/INT-05-instagram.md`    | F14              | Instagram Graph API y contenido organico.                        |
