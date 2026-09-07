// Qué bloques de una integración están al día y cuáles no.
//
// El caso real que esto destapa: el token de Shopify caducó el 13/08 y su
// refresco falla desde entonces. Los pedidos SIGUEN entrando porque los
// webhooks no dependen de ese token -- 185 pedidos nuevos desde que caducó --,
// así que el dashboard se ve perfectamente sano mientras clientes, devoluciones
// y toda la reconciliación llevan tres semanas y media congelados.
//
// El aviso decía "los datos pueden estar desactualizados". Con las ventas de
// hoy en pantalla, nadie se lo cree. Hay que nombrar QUÉ está parado y DESDE
// CUÁNDO, que es lo único que hace actuar a alguien.
export type ScopeRun = { sync_scope: string; last_success_at: string };

export type FreshnessSummary = {
  fresh: string[];
  stale: Array<{ scope: string; since: string }>;
};

// 48 h y no 24: un bloque puede tener cadencia diaria y saltarse una pasada por
// un reintento sin que eso sea un problema que mereza avisar a nadie.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export function summarizeFreshness(
  rows: ScopeRun[],
  now: Date,
  staleAfterMs: number = STALE_AFTER_MS,
): FreshnessSummary {
  const fresh: string[] = [];
  const stale: Array<{ scope: string; since: string }> = [];

  for (const row of rows) {
    const at = Date.parse(row.last_success_at);
    // Una fecha ilegible se trata como parada: el lado que avisa de más es el
    // que no deja a nadie mirando cifras viejas creyéndolas de hoy.
    if (Number.isNaN(at) || now.getTime() - at > staleAfterMs) {
      stale.push({ scope: row.sync_scope, since: row.last_success_at });
    } else {
      fresh.push(row.sync_scope);
    }
  }

  return { fresh, stale };
}

const SCOPE_LABEL: Record<string, string> = {
  orders: "pedidos",
  catalog: "catálogo",
  inventory: "stock",
  customers: "clientes",
  refunds: "devoluciones",
  sessions: "sesiones",
  abandoned_checkouts: "carritos abandonados",
  discounts: "promociones",
  marketing_events: "campañas",
  collections: "colecciones",
};

export function scopeLabel(scope: string): string {
  return SCOPE_LABEL[scope] ?? scope;
}

function joinEs(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * El texto del aviso. Devuelve null cuando no hay nada parado: sin esto, una
 * conexión en error por un motivo ya resuelto seguiría gritando.
 */
export function freshnessMessage(
  summary: FreshnessSummary,
  now: Date,
): string | null {
  if (summary.stale.length === 0) return null;

  const stale = joinEs(summary.stale.map((item) => scopeLabel(item.scope)));
  const oldest = summary.stale
    .map((item) => item.since)
    .sort()[0] as string | undefined;

  const since = oldest
    ? new Date(oldest).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
      })
    : null;

  const tail = since
    ? `no se actualizan desde el ${since}.`
    : "no se han sincronizado nunca.";

  // Nombrar lo que SÍ llega es la mitad importante del aviso: es exactamente lo
  // que hace que el resto de la pantalla parezca fiable, y sin decirlo el aviso
  // se lee como un fallo genérico que se puede ignorar.
  if (summary.fresh.length > 0) {
    const fresh = joinEs(summary.fresh.map(scopeLabel));
    return `${capitalize(fresh)} siguen llegando, pero ${stale} ${tail}`;
  }

  return `${capitalize(stale)} ${tail}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
