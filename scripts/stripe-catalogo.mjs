#!/usr/bin/env node
/**
 * Crea (o audita) el catalogo de planes en Stripe.
 *
 * El catalogo vive en Stripe, no en una tabla nuestra -- pero eso no significa
 * que tenga que crearse a mano. Este script lo deja en el repo: si hay que
 * recrearlo en otro sandbox, es volver a ejecutarlo.
 *
 *   node scripts/stripe-catalogo.mjs            audita: dice que falta
 *   node scripts/stripe-catalogo.mjs --aplicar  crea lo que falte
 *
 * Idempotente: busca por `metadata[ecomscaling_plan_code]` y no toca lo que ya
 * existe. **Un precio en Stripe es inmutable** (solo se le puede cambiar la
 * metadata y el nickname): si el importe no cuadra, el script lo dice y no
 * hace nada. Cambiar un precio es crear uno nuevo y archivar el viejo, que
 * sigue cobrando a quien ya lo tiene -- nadie ve su cuota subir sin firmarlo.
 *
 * Importes segun docs/MODELO_PLANES_Y_VINCULACION.md §2 y §3. Son SIN IVA:
 * el IVA lo repercute Stripe Tax cuando se active, no un precio hinchado.
 */

const API = "https://api.stripe.com/v1";
const VERSION = process.env.STRIPE_API_VERSION ?? "2026-08-26.dahlia";
const KEY = process.env.STRIPE_SECRET_KEY;
const APLICAR = process.argv.includes("--aplicar");

if (!KEY) {
  console.error("Falta STRIPE_SECRET_KEY (usa: npm run stripe:catalogo).");
  process.exit(1);
}

/**
 * Un PRODUCTO por plan, no un producto con varios precios.
 *
 * El nombre del producto es lo que sale en cada linea del checkout y de la
 * factura: si Starter y Consultora comparten producto, el cliente ve el mismo
 * nombre en las dos y no distingue que ha comprado.
 */
const CATALOGO = [
  {
    plan_code: "starter",
    name: "EcomScaling Starter",
    description:
      "1 tienda conectada, 2 usuarios, Shopify y Meta, y el Copiloto IA.",
    amount: 20000,
    store_limit: 1,
    copilot_model_tier: "sonnet",
  },
  {
    plan_code: "consultant",
    name: "EcomScaling Consultora",
    description:
      "4 clientes activos, 2 consultores, 2 tiendas propias y el Copiloto IA.",
    amount: 50000,
    // La consultora no conecta tiendas bajo su propia organizacion: sus
    // tiendas propias son organizaciones de cliente aparte, con su plan.
    store_limit: 1,
    copilot_model_tier: "opus",
  },
];

/**
 * El 10% del cliente vinculado (§2.1) es un CUPON, no un plan aparte.
 *
 * Con Whop habria hecho falta un plan duplicado, porque sus promo codes son
 * cupones reutilizables y §9 exige un solo uso. En Stripe el cupon se aplica
 * del lado del servidor a la suscripcion concreta: el cliente nunca teclea
 * nada, y al romperse la vinculacion se quita con una llamada y la tarifa
 * vuelve sola a la estandar. Que es exactamente lo que pide §30 -- el
 * descuento se DERIVA de la vinculacion, no se guarda como un numero suelto.
 */
/**
 * Descuento de bienvenida del codigo de referido (`referidos.ts`). El id se
 * deriva de `referral_codes`: `referido-{pct}-{meses}m`. Este es el de por
 * defecto; si platform_admin configura otro, hay que anadirlo aqui.
 */
const CUPONES = [
  {
    id: "vinculado-10",
    name: "Cliente vinculado a consultora",
    percent_off: 10,
    duration: "forever",
  },
  {
    id: "referido-10-3m",
    name: "Referido por consultor",
    percent_off: 10,
    duration: "repeating",
    duration_in_months: 3,
  },
];

async function stripe(path, body) {
  const response = await fetch(`${API}/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${KEY}`,
      "stripe-version": VERSION,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `${path} -> HTTP ${response.status}: ${payload?.error?.message ?? "sin detalle"}`,
    );
  }
  return payload;
}

const euros = (cents) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );

async function main() {
  const { data: precios } = await stripe(
    "prices?limit=100&active=true&expand[]=data.product",
  );

  let cambios = 0;

  for (const plan of CATALOGO) {
    const existente = precios.find(
      (precio) => precio.metadata?.ecomscaling_plan_code === plan.plan_code,
    );

    if (existente) {
      const coincide = existente.unit_amount === plan.amount;
      console.log(
        `${coincide ? "ok  " : "OJO "} ${plan.plan_code.padEnd(11)} ${existente.id} ${euros(existente.unit_amount)}` +
          (coincide
            ? ""
            : ` != ${euros(plan.amount)} del modelo. Un precio no se edita: crea uno nuevo y archiva este.`),
      );
      continue;
    }

    if (!APLICAR) {
      console.log(
        `falta ${plan.plan_code.padEnd(11)} ${plan.name} ${euros(plan.amount)}/mes`,
      );
      cambios += 1;
      continue;
    }

    const producto = await stripe("products", {
      name: plan.name,
      description: plan.description,
    });
    const precio = await stripe("prices", {
      product: producto.id,
      currency: "eur",
      unit_amount: String(plan.amount),
      "recurring[interval]": "month",
      // La metadata va en el PRECIO y no en el producto: el webhook de
      // suscripcion trae el precio entero dentro de cada item, pero del
      // producto solo el id.
      "metadata[ecomscaling_plan_code]": plan.plan_code,
      "metadata[ecomscaling_store_limit]": String(plan.store_limit),
      "metadata[ecomscaling_copilot_tier]": plan.copilot_model_tier,
    });
    console.log(
      `creado ${plan.plan_code.padEnd(11)} ${precio.id} ${euros(plan.amount)}/mes`,
    );
    cambios += 1;
  }

  for (const CUPON of CUPONES) {
    let cupon = null;
    try {
      cupon = await stripe(`coupons/${CUPON.id}`);
    } catch {
      cupon = null;
    }

    if (cupon) {
      console.log(`ok   cupon       ${cupon.id} -${cupon.percent_off}%`);
    } else if (APLICAR) {
      const creado = await stripe("coupons", {
        id: CUPON.id,
        name: CUPON.name,
        percent_off: String(CUPON.percent_off),
        duration: CUPON.duration,
        ...(CUPON.duration_in_months
          ? { duration_in_months: String(CUPON.duration_in_months) }
          : {}),
      });
      console.log(`creado cupon       ${creado.id} -${creado.percent_off}%`);
      cambios += 1;
    } else {
      console.log(`falta cupon       ${CUPON.id} -${CUPON.percent_off}%`);
      cambios += 1;
    }
  }

  if (!APLICAR && cambios > 0) {
    console.log(`\n${cambios} cosa(s) por crear. Repite con --aplicar.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
