/**
 * Aplicar un reparto a toda la cartera de golpe.
 *
 * El fallo silencioso que hay que evitar: mandar "todo para Bruno" a una tienda
 * donde Bruno no esta asignado dejaria a Ana a 0 y esa tienda no asignaria las
 * tareas a nadie -- sin error, sin aviso, hasta que alguien se pregunte por que
 * ese cliente lleva un mes sin responsable.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sharesForOrganization } from "./work-split.js";

const ANA = "ana";
const BRUNO = "bruno";

test("el reparto se aplica donde los dos estan asignados", () => {
  assert.deepEqual(
    sharesForOrganization(
      [
        { user_id: ANA, work_share: 50 },
        { user_id: BRUNO, work_share: 50 },
      ],
      [ANA, BRUNO],
    ),
    [
      { user_id: ANA, work_share: 50 },
      { user_id: BRUNO, work_share: 50 },
    ],
  );
});

test("tienda sin el socio: se salta en vez de dejarla sin nadie", () => {
  assert.equal(
    sharesForOrganization(
      [
        { user_id: ANA, work_share: 0 },
        { user_id: BRUNO, work_share: 100 },
      ],
      [ANA],
    ),
    null,
  );
});

test("tienda sin el socio pero yo con peso: se aplica solo lo mio", () => {
  assert.deepEqual(
    sharesForOrganization(
      [
        { user_id: ANA, work_share: 70 },
        { user_id: BRUNO, work_share: 30 },
      ],
      [ANA],
    ),
    [{ user_id: ANA, work_share: 70 }],
  );
});

test("un consultor al que el reparto no menciona no se toca", () => {
  // Un tercero asignado por platform admin no se queda a 0 porque dos socios
  // se repartan entre ellos.
  assert.deepEqual(
    sharesForOrganization([{ user_id: ANA, work_share: 100 }], [ANA, "carla"]),
    [{ user_id: ANA, work_share: 100 }],
  );
});

test("dejar a todos a 0 nunca es un reparto valido", () => {
  assert.equal(
    sharesForOrganization(
      [
        { user_id: ANA, work_share: 0 },
        { user_id: BRUNO, work_share: 0 },
      ],
      [ANA, BRUNO],
    ),
    null,
  );
  assert.equal(sharesForOrganization([], [ANA]), null);
});
