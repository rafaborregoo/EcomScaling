/**
 * Economía de escala calculada por el servidor: lo que un consultor mira antes
 * de decidir cuánto invertir. El agente recibía el resumen financiero sin leer
 * de él la regla de decisión (break-even de ROAS, techo de CAC, MER) y el plan
 * hablaba de validar datos en vez de escalar con criterio.
 *
 * Todo sale de cifras ya calculadas por el motor financiero; aquí solo se
 * comparan entre sí y se declara cuánta fe merecen. La atribución de cada
 * plataforma no se suma a nada (ADR-0021).
 */

type Row = Record<string, unknown> | null | undefined;

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export type ScalingEconomics = {
  status: "available" | "insufficient";
  period_net_revenue: number | null;
  ads_spend: number | null;
  /** Ingresos netos de la tienda / gasto en anuncios (Shopify entero, sin atribución). */
  mer: number | null;
  /** ROAS por debajo del cual la publicidad no cubre ni los costes variables (producto, comisiones, envío). */
  breakeven_roas_variable: number | null;
  /** ROAS por debajo del cual la publicidad no cubre además los costes fijos. */
  breakeven_roas_total: number | null;
  /** ROAS que declara Meta para sus propias compras. Atribución de Meta, no comparable como incremental. */
  meta_attributed_roas: number | null;
  gross_margin_pct: number | null;
  net_margin_pct: number | null;
  aov: number | null;
  contribution_per_order: number | null;
  cac_per_order_paid: number | null;
  breakeven_cac_per_order: number | null;
  ads_share_of_revenue_pct: number | null;
  /** Umbral de envío gratis orientativo: el AOV actual + 20 %, a validar con el margen. */
  free_shipping_threshold_hint: number | null;
  /** Lectura para decidir; nunca una orden. */
  reading: string[];
  /** Por qué las cifras no son de fiar todavía. */
  quality_flags: string[];
};

export function scalingEconomics(financial: Row, meta: Row, margin: Row): ScalingEconomics {
  const revenue = num(financial?.net_revenue_ex_tax) ?? num(financial?.net_sales);
  const ads = num(financial?.ads_spend);
  const cogs = num(financial?.cogs);
  const fees = num(financial?.payment_fees) ?? 0;
  const shipping = num(financial?.shipping_costs) ?? 0;
  const orders = num(financial?.orders_count);
  if (!financial || revenue === null || revenue <= 0) {
    return {
      status: "insufficient", period_net_revenue: null, ads_spend: ads, mer: null, breakeven_roas_variable: null, breakeven_roas_total: null,
      meta_attributed_roas: num(meta?.roas), gross_margin_pct: null, net_margin_pct: null, aov: null, contribution_per_order: null,
      cac_per_order_paid: null, breakeven_cac_per_order: null, ads_share_of_revenue_pct: null, free_shipping_threshold_hint: null,
      reading: [], quality_flags: ["No hay resumen financiero con ventas: no se puede razonar la inversión."],
    };
  }
  const variableContribution = cogs === null ? null : revenue - cogs - fees - shipping;
  const breakevenVariable = variableContribution && variableContribution > 0 ? round(revenue / variableContribution) : null;
  const breakevenTotal = num(financial.breakeven_roas);
  const mer = ads && ads > 0 ? round(revenue / ads) : null;
  const metaRoas = num(meta?.roas);
  const aov = num(financial.aov_ex_tax) ?? (orders ? round(revenue / orders) : null);

  const flags: string[] = [];
  const estimatedCosts = num(margin?.items_with_estimated_cost) ?? 0;
  const lines = (num(margin?.items_with_cost) ?? 0) + (num(margin?.items_without_cost) ?? 0);
  if (lines > 0 && estimatedCosts / lines > 0.5) flags.push("Más de la mitad de las líneas tienen coste de producto estimado: el break-even es una estimación hasta confirmar costes.");
  if ((num(financial.items_without_cost) ?? 0) > 0) flags.push("Hay productos sin coste: el break-even sale optimista.");
  const newCustomers = num(financial.new_customers);
  if (newCustomers !== null && newCustomers < 30) flags.push(`Solo ${newCustomers} clientes nuevos identificados: el CAC blended no es fiable; usa el coste por pedido y el ROAS.`);
  if (!ads) flags.push("No hay gasto en anuncios medido en el periodo: no se puede razonar el escalado de pago.");
  if (metaRoas !== null) flags.push("El ROAS de Meta es atribución de Meta con su ventana: no es resultado incremental ni se suma a Shopify o Klaviyo.");
  if (financial.has_settings === false) flags.push("No hay costes fijos configurados: el break-even total no incluye estructura.");

  const reading: string[] = [];
  if (mer !== null && breakevenTotal !== null) {
    reading.push(
      mer >= breakevenTotal * 1.25
        ? `El MER (${mer}) supera con holgura el ROAS de equilibrio total (${breakevenTotal}): hay margen para aumentar la inversión por tramos mientras el ROAS se mantenga por encima del equilibrio.`
        : mer >= breakevenTotal
          ? `El MER (${mer}) apenas supera el ROAS de equilibrio total (${breakevenTotal}): escalar gasto sin mejorar margen o conversión comprime el beneficio.`
          : `El MER (${mer}) está por debajo del ROAS de equilibrio total (${breakevenTotal}): la publicidad no se paga con la estructura actual; primero margen, ticket o conversión.`,
    );
  }
  if (metaRoas !== null && breakevenVariable !== null) {
    reading.push(
      metaRoas >= breakevenVariable
        ? `El ROAS atribuido por Meta (${metaRoas}) supera el equilibrio variable (${breakevenVariable}); es la señal de Meta, no prueba de incrementalidad: valídala con el MER y con pruebas de gasto.`
        : `El ROAS atribuido por Meta (${metaRoas}) no llega al equilibrio variable (${breakevenVariable}): es una señal de riesgo, no una prueba de pérdida; contrástala con el MER y con una prueba de gasto antes de recortar.`,
    );
  }
  const cacPaid = ads && orders ? round(ads / orders) : null;
  const beCac = num(financial.breakeven_cac_per_order);
  if (cacPaid !== null && beCac !== null) {
    reading.push(`Coste de anuncios por pedido: ${cacPaid} frente a un techo de ${beCac} por pedido (todo lo demás ya descontado).`);
  }

  return {
    status: "available",
    period_net_revenue: round(revenue),
    ads_spend: ads,
    mer,
    breakeven_roas_variable: breakevenVariable,
    breakeven_roas_total: breakevenTotal,
    meta_attributed_roas: metaRoas,
    gross_margin_pct: num(margin?.margin_pct) ?? (cogs !== null ? round(((revenue - cogs) / revenue) * 100, 1) : null),
    net_margin_pct: num(financial.net_margin_pct),
    aov,
    contribution_per_order: num(financial.contribution_per_order),
    cac_per_order_paid: cacPaid,
    breakeven_cac_per_order: beCac,
    ads_share_of_revenue_pct: ads ? round((ads / revenue) * 100, 1) : null,
    free_shipping_threshold_hint: aov ? Math.ceil((aov * 1.2) / 5) * 5 : null,
    reading,
    quality_flags: flags,
  };
}
