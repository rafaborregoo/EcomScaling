# INT-02 — Contrato de escritura futura de Meta Ads

Incremento local: implementado sin llamadas externas.

`packages/integrations/src/meta-ad-write-contract.ts` prepara un plan dry-run con la jerarquía
`campaign → adset → creative → ad`, normaliza `act_<id>`, exige presupuesto positivo e idempotency
key, conserva IDs externos para reanudar y fija el estado inicial `PAUSED`.

El plan exige aprobación humana y rechaza secretos/tokens en el payload. No ejecuta POSTs: la futura
capa de escritura deberá reutilizar `meta-client.ts`, app-secret proof, retries, auditoría,
`ads_management` y el mismo aislamiento por conexión/organización que la lectura.

Tests directos cubren jerarquía, validación, secretos, presupuesto, reanudación e idempotencia.
