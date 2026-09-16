/**
 * Revisa y rellena la metadata de los planes de Whop.
 *
 * Existe por una razon concreta: el `plan_code` y el limite de tiendas viajan
 * en la **metadata del plan**, y la metadata solo se pone por API -- el
 * dashboard no la expone. Un plan creado a mano llega sin ella y entra con el
 * tramo mas pequeno (ver `apps/api/src/whop.ts`), que es un fallo silencioso:
 * el cliente paga y conecta una tienda menos de las que le tocan.
 *
 * Sin argumentos lista lo que hay y senala lo que falta:
 *
 *   npm run whop:planes
 *
 * Y rellena un plan concreto:
 *
 *   npm run whop:planes -- --plan plan_xxxxx --code starter --tiendas 2
 *
 * Necesita WHOP_API_KEY con permiso de lectura y escritura sobre planes.
 */

const API = "https://api.whop.com/api/v1";

/**
 * La cuenta de Whop de EcomScaling. No es un secreto -- va en claro en el pixel
 * (`apps/web/src/components/whop-pixel.tsx`). El listado de planes lo exige
 * aunque la clave sea de esta misma cuenta.
 */
const ACCOUNT_ID = "biz_HL6dBbRpFBs2LJ";

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? null : process.argv[i + 1];
}

const apiKey = process.env.WHOP_API_KEY;
if (!apiKey) {
  console.error("Falta WHOP_API_KEY en el entorno.");
  process.exit(1);
}

async function whop(metodo, ruta, cuerpo) {
  const response = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(process.env.WHOP_API_VERSION_DATE
        ? { "api-version-date": process.env.WHOP_API_VERSION_DATE }
        : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `${metodo} ${ruta} -> ${response.status} ${JSON.stringify(payload)?.slice(0, 400)}`,
    );
  }
  return payload;
}

const planId = arg("plan");

if (planId) {
  const code = arg("code");
  const tiendas = arg("tiendas");
  if (!code || !tiendas) {
    console.error("Con --plan hacen falta --code y --tiendas.");
    process.exit(1);
  }
  if (!/^[1-9]\d*$/.test(tiendas)) {
    console.error(
      `--tiendas tiene que ser un entero positivo, no "${tiendas}".`,
    );
    process.exit(1);
  }

  // PATCH reemplaza el objeto entero, asi que se manda completo. Las claves
  // reservadas de Whop (custom_cta, custom_cta_url) se pierden si las hubiera:
  // se avisa en vez de borrarlas a la callada.
  const actual = await whop("GET", `/plans/${planId}`);
  const reservadas = Object.keys(actual.metadata ?? {}).filter((k) =>
    k.startsWith("custom_cta"),
  );
  if (reservadas.length) {
    console.error(
      `El plan tiene ${reservadas.join(", ")} en metadata y este script los borraria. Ponlos a mano.`,
    );
    process.exit(1);
  }

  const resultado = await whop("PATCH", `/plans/${planId}`, {
    metadata: {
      ecomscaling_plan_code: code,
      ecomscaling_store_limit: tiendas,
    },
  });
  console.log(`${planId} -> ${JSON.stringify(resultado.metadata)}`);
  process.exit(0);
}

const listado = await whop(
  "GET",
  `/plans?account_id=${arg("account") ?? ACCOUNT_ID}&first=100`,
);
const planes = listado?.data ?? [];

if (!planes.length) {
  console.log("Sin planes.");
  process.exit(0);
}

let incompletos = 0;
for (const plan of planes) {
  const meta = plan.metadata ?? {};
  const code = meta.ecomscaling_plan_code;
  const tiendas = meta.ecomscaling_store_limit;
  const falta = !code || !tiendas;
  if (falta) incompletos += 1;

  console.log(
    [
      falta ? "!" : " ",
      plan.id.padEnd(22),
      (plan.product?.title ?? plan.title ?? "").padEnd(24),
      (plan.formatted_price ?? "").padEnd(22),
      code
        ? `${code} / ${tiendas} tiendas`
        : "SIN METADATA -> entraria con 1 tienda",
    ].join(" "),
  );
}

if (incompletos) {
  console.log(
    `\n${incompletos} plan(es) sin metadata. Rellenalos con:\n  npm run whop:planes -- --plan <id> --code <codigo> --tiendas <n>`,
  );
}
