/**
 * Calendario comercial de ecommerce con ventanas de preparación y fechas límite
 * de pedido por transportista.
 *
 * A19 planificaba sin calendario: dejaba Black Friday como "pedir al equipo que
 * confirme" y no veía que una tienda de nieve entra en temporada alta. Esto lo
 * calcula el servidor (fechas móviles y diferencias por mercado incluidas) y se
 * lo da al agente junto con cuándo hay que empezar a preparar cada fecha, para
 * que el Camino se planifique hacia atrás desde el calendario como haría un
 * consultor.
 *
 * Las semanas de preparación son pautas de consultoría, no datos de la tienda:
 * el agente las ajusta a la complejidad, el stock y la capacidad que vea. Las
 * fechas límite de envío, en cambio, salen de los plazos reales de la tienda
 * por transportista cuando hay muestra suficiente.
 */

export type Market = "ES" | "PT" | "FR" | "IT" | "DE" | "UK" | "US" | "MX";

export type CommercialEvent = {
  key: string;
  name: string;
  market: Market | "global";
  /** Fecha del evento (o inicio de la temporada), ISO yyyy-mm-dd. */
  date: string;
  /** Día en que conviene empezar a preparar, ISO. Puede ser anterior a hoy. */
  prep_start: string;
  prep_weeks: number;
  /** Días desde la fecha de referencia hasta el evento. */
  offset_days: number;
  /** El inicio de la preparación ya pasó: hay que ir con lo esencial. */
  late_start: boolean;
  scope: "general" | "category";
  /** El producto se regala: hay una fecha límite de entrega que comunicar. */
  gift_deadline: string | null;
  /** Qué suele haber que preparar; la lista de comprobación del consultor. */
  preparation: string[];
};

type EventSpec = {
  key: string;
  name: string;
  markets: Array<Market | "global">;
  date: (year: number, market: Market) => Date;
  prepWeeks: number;
  /** Día en que el regalo tiene que estar entregado, si aplica. */
  giftDeadline?: (eventDate: Date) => Date;
  preparation: string[];
};

const DAY_MS = 86_400_000;
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const iso = (date: Date) => date.toISOString().slice(0, 10);

function nthWeekday(year: number, month: number, weekday: number, nth: number) {
  const first = utc(year, month, 1);
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month, 1 + shift + (nth - 1) * 7);
}

function lastWeekday(year: number, month: number, weekday: number) {
  const last = utc(year, month + 1, 0);
  return addDays(last, -((last.getUTCDay() - weekday + 7) % 7));
}

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** Viernes siguiente al cuarto jueves de noviembre (Acción de Gracias). */
const blackFriday = (year: number) => addDays(nthWeekday(year, 11, 4, 4), 1);

function mothersDay(year: number, market: Market) {
  if (market === "UK") return addDays(easterSunday(year), -21); // Mothering Sunday
  if (market === "FR") return lastWeekday(year, 5, 0);
  if (market === "US" || market === "IT" || market === "DE") return nthWeekday(year, 5, 0, 2);
  if (market === "MX") return utc(year, 5, 10);
  return nthWeekday(year, 5, 0, 1); // ES, PT
}

function fathersDay(year: number, market: Market) {
  if (market === "ES" || market === "PT" || market === "IT") return utc(year, 3, 19);
  if (market === "DE") return addDays(easterSunday(year), 39); // Ascensión
  return nthWeekday(year, 6, 0, 3); // FR, UK, US, MX
}

const PEAK_PREPARATION = [
  "Elegir los productos héroe y comprobar stock y reposición con margen suficiente",
  "Diseñar la oferta protegiendo margen (umbral de envío gratis, packs, regalo, descuento escalonado)",
  "Preparar creatividades y landing o colección de la campaña",
  "Calentar audiencias en Meta y programar la campaña con presupuesto por fases",
  "Secuencia de email/SMS: aviso, acceso anticipado, lanzamiento, recordatorio y última oportunidad",
  "Revisar logística: plazos de envío, fecha límite de entrega garantizada y atención al cliente",
  "Medir el resultado y aprender para la siguiente fecha",
];
const GIFT_PREPARATION = [
  "Guía de regalos y packs por presupuesto",
  "Comunicar la fecha límite de pedido para recibir a tiempo y ofrecer tarjeta regalo después",
  "Email y anuncios orientados a regalo",
];

const GENERAL_EVENTS: EventSpec[] = [
  { key: "rebajas_invierno", name: "Rebajas de enero", markets: ["ES", "PT", "FR", "IT", "DE", "UK"], date: (y) => utc(y, 1, 7), prepWeeks: 3, preparation: ["Seleccionar referencias a liquidar sin canibalizar las de margen", "Calendario de bajadas de precio por tramos", "Comunicación a clientes y lista de espera para los primeros días"] },
  { key: "san_valentin", name: "San Valentín", markets: ["global"], date: (y) => utc(y, 2, 14), prepWeeks: 4, giftDeadline: (date) => addDays(date, -1), preparation: GIFT_PREPARATION },
  { key: "dia_padre", name: "Día del Padre", markets: ["ES", "PT", "FR", "IT", "DE", "UK", "US", "MX"], date: (y, m) => fathersDay(y, m), prepWeeks: 4, giftDeadline: (date) => addDays(date, -1), preparation: GIFT_PREPARATION },
  { key: "semana_santa", name: "Semana Santa / Pascua", markets: ["global"], date: (y) => addDays(easterSunday(y), -7), prepWeeks: 3, preparation: ["Ajustar plazos logísticos por festivos", "Campaña si el producto encaja con vacaciones o viajes"] },
  { key: "dia_madre", name: "Día de la Madre", markets: ["ES", "PT", "FR", "IT", "DE", "UK", "US", "MX"], date: (y, m) => mothersDay(y, m), prepWeeks: 4, giftDeadline: (date) => addDays(date, -1), preparation: GIFT_PREPARATION },
  { key: "amazon_prime_day", name: "Prime Day (referencia de mercado, julio)", markets: ["ES", "FR", "IT", "DE", "UK", "US", "MX"], date: (y) => nthWeekday(y, 7, 2, 2), prepWeeks: 3, preparation: ["Decidir si se responde con una acción propia para no perder ventas por comparación de precio"] },
  { key: "rebajas_verano", name: "Rebajas de verano", markets: ["ES", "PT", "FR", "IT", "DE", "UK"], date: (y) => utc(y, 7, 1), prepWeeks: 3, preparation: ["Seleccionar referencias a liquidar", "Calendario de bajadas", "Comunicación a clientes"] },
  { key: "vuelta_cole", name: "Vuelta al cole / septiembre", markets: ["global"], date: (y) => utc(y, 9, 1), prepWeeks: 4, preparation: ["Campaña de reactivación de clientes tras el verano", "Novedades de temporada"] },
  { key: "halloween", name: "Halloween", markets: ["global"], date: (y) => utc(y, 10, 31), prepWeeks: 3, preparation: ["Acción temática ligera (código o contenido) si encaja con la marca", "Usarla para captar suscriptores antes de Black Friday"] },
  { key: "singles_day", name: "Singles Day (11.11)", markets: ["ES", "PT", "FR", "IT", "DE", "UK"], date: (y) => utc(y, 11, 11), prepWeeks: 3, preparation: ["Preventa o adelanto de Black Friday para clientes", "Captación de registros para la lista de acceso anticipado"] },
  { key: "buen_fin", name: "El Buen Fin", markets: ["MX"], date: (y) => addDays(nthWeekday(y, 11, 1, 3), -3), prepWeeks: 7, preparation: PEAK_PREPARATION },
  { key: "black_friday", name: "Black Friday", markets: ["global"], date: blackFriday, prepWeeks: 7, preparation: PEAK_PREPARATION },
  { key: "cyber_monday", name: "Cyber Monday", markets: ["global"], date: (y) => addDays(blackFriday(y), 3), prepWeeks: 7, preparation: ["Prolongar o rematar la campaña de Black Friday con el stock que quede", "Email de última oportunidad"] },
  { key: "navidad", name: "Navidad", markets: ["global"], date: (y) => utc(y, 12, 25), prepWeeks: 7, giftDeadline: (date) => addDays(date, -1), preparation: [...PEAK_PREPARATION, "Comunicar la fecha límite para recibir antes del 24 y ofrecer tarjeta regalo después"] },
  { key: "reyes", name: "Reyes", markets: ["ES", "MX"], date: (y) => utc(y, 1, 6), prepWeeks: 5, giftDeadline: (date) => addDays(date, -1), preparation: ["Fecha límite de envío para Reyes", "Tarjeta regalo digital para última hora", "Recordatorio a quien compró en Navidad"] },
];

/** Temporadas propias de una categoría, detectadas por palabras del contexto de la tienda. */
const CATEGORY_SEASONS: Array<{ match: RegExp; specs: EventSpec[] }> = [
  {
    match: /\b(nieve|esqu[ií]|ski|snow|snowboard|monta[ñn]a|invierno)\b/i,
    specs: [{
      key: "temporada_nieve", name: "Temporada de nieve (apertura de estaciones, pico de diciembre a febrero)", markets: ["global"], date: (y) => utc(y, 12, 1), prepWeeks: 8,
      preparation: [
        "Stock completo de las tallas y modelos que más rotan antes de la apertura de estaciones",
        "Colecciones y guías por uso (pista, freeride, niños, principiante) y guía de tallas",
        "Campaña de inicio de temporada en Meta y email a clientes de la temporada pasada",
        "Puentes de diciembre como primer pico de ventas",
        "Plan para cambios y devoluciones de tallas en temporada alta",
      ],
    }],
  },
  {
    match: /\b(playa|ba[ñn]o|bikini|surf|verano|piscina|solar)\b/i,
    specs: [{ key: "temporada_verano", name: "Temporada de verano", markets: ["global"], date: (y) => utc(y, 6, 1), prepWeeks: 8, preparation: ["Stock de temporada antes de mayo", "Colección y campaña de verano", "Email a clientes del verano anterior"] }],
  },
  {
    match: /\b(jard[ií]n|huerto|terraza|plantas?)\b/i,
    specs: [{ key: "temporada_jardin", name: "Temporada de primavera (jardín y terraza)", markets: ["global"], date: (y) => utc(y, 3, 21), prepWeeks: 6, preparation: ["Stock de primavera", "Guías de uso", "Campaña de inicio de temporada"] }],
  },
  {
    match: /\b(moda|ropa|calzado|zapatos|textil|fashion)\b/i,
    specs: [
      { key: "moda_primavera", name: "Cambio de temporada primavera-verano (moda)", markets: ["global"], date: (y) => utc(y, 3, 1), prepWeeks: 6, preparation: ["Lanzamiento de la nueva colección", "Liquidar invierno antes de que llegue", "Lookbook y contenido de temporada"] },
      { key: "moda_otono", name: "Cambio de temporada otoño-invierno (moda)", markets: ["global"], date: (y) => utc(y, 9, 15), prepWeeks: 6, preparation: ["Lanzamiento de la nueva colección", "Liquidar verano", "Lookbook y contenido de temporada"] },
    ],
  },
  {
    match: /\b(juguete|juguetes|toys?|infantil|ni[ñn]os)\b/i,
    specs: [{ key: "campana_juguete", name: "Campaña de juguete (Navidad y Reyes)", markets: ["global"], date: (y) => utc(y, 11, 15), prepWeeks: 10, preparation: ["Pedido de stock con proveedores antes de octubre", "Catálogo por edades y presupuesto", "Carta a los Reyes / lista de deseos para captar emails"] }],
  },
  {
    match: /\b(cosm[eé]tica|belleza|perfume|maquillaje|skincare|joyer[ií]a|joyas|regalo)\b/i,
    specs: [{ key: "temporada_regalo", name: "Temporada de regalo (packs de Navidad)", markets: ["global"], date: (y) => utc(y, 11, 20), prepWeeks: 8, preparation: ["Packs y cofres de regalo con margen", "Envoltorio y mensaje regalo", "Guía de regalos por presupuesto"] }],
  },
  {
    match: /\b(fitness|gimnasio|deporte|running|suplementos?|nutrici[oó]n|prote[ií]na)\b/i,
    specs: [{ key: "propositos_enero", name: "Propósitos de año nuevo (deporte y salud)", markets: ["global"], date: (y) => utc(y, 1, 2), prepWeeks: 5, preparation: ["Packs de inicio y suscripción", "Contenido de retos y planes", "Campaña desde el 26 de diciembre"] }],
  },
  {
    match: /\b(escolar|papeler[ií]a|mochilas?|material escolar)\b/i,
    specs: [{ key: "vuelta_cole_escolar", name: "Vuelta al cole (material escolar)", markets: ["global"], date: (y) => utc(y, 8, 20), prepWeeks: 8, preparation: ["Stock antes de agosto", "Listas por curso", "Campaña a familias de clientes"] }],
  },
  {
    match: /\b(vino|gourmet|aceite|jam[oó]n|alimentaci[oó]n|cestas?)\b/i,
    specs: [{ key: "cestas_navidad", name: "Cestas y regalo de empresa (Navidad)", markets: ["global"], date: (y) => utc(y, 12, 1), prepWeeks: 9, preparation: ["Catálogo de cestas y precios por volumen para empresas", "Captación B2B en octubre", "Logística de envíos múltiples"] }],
  },
  {
    match: /\b(bici|bicicleta|ciclismo|outdoor|camping|senderismo)\b/i,
    specs: [{ key: "temporada_outdoor", name: "Temporada outdoor (primavera)", markets: ["global"], date: (y) => utc(y, 4, 1), prepWeeks: 6, preparation: ["Stock y revisión de tallas", "Guías de ruta y uso", "Campaña de inicio de temporada"] }],
  },
];

const MARKET_WORDS: Array<[Market, RegExp]> = [
  ["ES", /\b(espa[ñn]a|spain|peninsular|canarias|baleares)\b/i],
  ["PT", /\b(portugal)\b/i],
  ["FR", /\b(francia|france)\b/i],
  ["IT", /\b(italia|italy)\b/i],
  ["DE", /\b(alemania|germany|deutschland)\b/i],
  ["UK", /\b(reino unido|uk|united kingdom|inglaterra)\b/i],
  ["US", /\b(estados unidos|eeuu|ee\.uu\.|usa|united states)\b/i],
  ["MX", /\b(m[eé]xico|mexico)\b/i],
];

/** Mercados mencionados en el contexto; España si no se menciona ninguno. */
export function detectMarkets(storeDescription: string): Market[] {
  const found = MARKET_WORDS.filter(([, pattern]) => pattern.test(storeDescription)).map(([market]) => market);
  return found.length ? found : ["ES"];
}

export function commercialCalendar(
  referenceDate: Date,
  horizonDays: number,
  storeDescription = "",
): CommercialEvent[] {
  const today = utc(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, referenceDate.getUTCDate());
  const end = today.getTime() + horizonDays * DAY_MS;
  const markets = detectMarkets(storeDescription);
  const specs: Array<{ spec: EventSpec; scope: CommercialEvent["scope"] }> = [
    ...GENERAL_EVENTS.map((spec) => ({ spec, scope: "general" as const })),
    ...CATEGORY_SEASONS.filter((season) => season.match.test(storeDescription)).flatMap((season) =>
      season.specs.map((spec) => ({ spec, scope: "category" as const })),
    ),
  ];
  const events: CommercialEvent[] = [];
  const seen = new Set<string>();
  for (const { spec, scope } of specs) {
    const applicable: Array<Market | "global"> = spec.markets.includes("global")
      ? ["global"]
      : markets.filter((market) => spec.markets.includes(market));
    for (const market of applicable) {
      for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
        const date = spec.date(year, market === "global" ? markets[0]! : market);
        const prepStart = addDays(date, -spec.prepWeeks * 7);
        // Entra si el evento cae en el horizonte o si su preparación empieza dentro de él.
        const inHorizon = date.getTime() >= today.getTime() && date.getTime() <= end;
        const prepInHorizon = date.getTime() > end && prepStart.getTime() <= end;
        if (!inHorizon && !prepInHorizon) continue;
        // Mismo evento y fecha en varios mercados: una sola entrada.
        const dedupe = `${spec.key}:${iso(date)}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        events.push({
          key: spec.key,
          name: spec.name,
          market,
          date: iso(date),
          prep_start: iso(prepStart),
          prep_weeks: spec.prepWeeks,
          offset_days: Math.round((date.getTime() - today.getTime()) / DAY_MS),
          late_start: prepStart.getTime() < today.getTime(),
          scope,
          gift_deadline: spec.giftDeadline ? iso(spec.giftDeadline(date)) : null,
          preparation: spec.preparation,
        });
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Fechas límite de pedido por transportista
// ---------------------------------------------------------------------------

/** Una fila de shopify_delivery_diagnostics (transportista × almacén × destino). */
export type CarrierDeliveryRow = {
  tracking_company: string | null;
  destination_country_code?: string | null;
  fulfillments: number | string | null;
  delivered?: number | string | null;
  p90_hours_to_fulfillment_created: number | string | null;
  p90_days_from_fulfillment_created_to_delivery: number | string | null;
};

export type CarrierLeadTime = {
  carrier: string;
  shipments: number;
  /** Días (p90) desde el pedido hasta que sale del almacén. */
  handling_days_p90: number;
  /** Días (p90) desde que sale hasta que se entrega. */
  transit_days_p90: number;
};

/** Con menos envíos entregados el p90 no es fiable para prometer una fecha. */
export const MIN_SHIPMENTS_FOR_CUTOFF = 20;
/** Margen de seguridad sobre el p90 en temporada alta (los transportistas se saturan). */
export const PEAK_SAFETY_DAYS = 1;
/** Plazo estándar sin datos de la tienda: 1 día de preparación y 3 de tránsito. */
const STANDARD_LEAD = { handling_days_p90: 1, transit_days_p90: 3 };

const num = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Plazo p90 por transportista, quedándose con su ruta de más volumen. */
export function carrierLeadTimes(rows: CarrierDeliveryRow[]): CarrierLeadTime[] {
  const best = new Map<string, CarrierLeadTime>();
  for (const row of rows) {
    const carrier = row.tracking_company?.trim();
    const shipments = num(row.delivered ?? row.fulfillments) ?? 0;
    const handlingHours = num(row.p90_hours_to_fulfillment_created);
    const transit = num(row.p90_days_from_fulfillment_created_to_delivery);
    if (!carrier || shipments < MIN_SHIPMENTS_FOR_CUTOFF || handlingHours === null || transit === null) continue;
    const current = best.get(carrier);
    if (current && current.shipments >= shipments) continue;
    best.set(carrier, {
      carrier,
      shipments,
      handling_days_p90: Math.round((handlingHours / 24) * 10) / 10,
      transit_days_p90: Math.round(transit * 10) / 10,
    });
  }
  return [...best.values()].sort((a, b) => b.shipments - a.shipments);
}

export type ShippingCutoff = {
  event: string;
  deliver_by: string;
  by_carrier: Array<CarrierLeadTime & { last_order_day: string }>;
  /** Solo si la tienda no tiene muestra suficiente de ningún transportista. */
  standard_last_order_day: string | null;
};

/** Último día de pedido para recibir a tiempo: entrega − (p90 preparación + p90 tránsito + margen). */
export function shippingCutoffs(events: CommercialEvent[], leadTimes: CarrierLeadTime[]): ShippingCutoff[] {
  const lastOrderDay = (deliverBy: string, lead: { handling_days_p90: number; transit_days_p90: number }) =>
    iso(addDays(new Date(`${deliverBy}T00:00:00Z`), -Math.ceil(lead.handling_days_p90 + lead.transit_days_p90 + PEAK_SAFETY_DAYS)));
  return events
    .filter((event): event is CommercialEvent & { gift_deadline: string } => Boolean(event.gift_deadline))
    .map((event) => ({
      event: event.name,
      deliver_by: event.gift_deadline,
      by_carrier: leadTimes.map((lead) => ({ ...lead, last_order_day: lastOrderDay(event.gift_deadline, lead) })),
      standard_last_order_day: leadTimes.length ? null : lastOrderDay(event.gift_deadline, STANDARD_LEAD),
    }));
}
