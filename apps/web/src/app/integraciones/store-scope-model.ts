// A que tienda pertenece cada cuenta de un proveedor.
//
// Vive aparte de shared.tsx a proposito: ahi dentro hay componentes que tiran
// de HeroUI, y esto tiene que poder probarse sin arrancar media interfaz.

export type ScopeStore = {
  id: string;
  connection_id: string | null;
  myshopify_domain: string;
  shop_name: string;
};

export type ScopeAccount = {
  id: string;
  connection_id: string;
  store_id: string | null;
  account_name?: string | null;
  external_ad_account_id?: string;
  external_account_id?: string;
};

export type StoreScope = {
  stores: ScopeStore[];
  meta_ad_accounts: ScopeAccount[];
  klaviyo_accounts: ScopeAccount[];
  store_count: number;
  unassigned_count: number;
};

export function storeLabel(store: ScopeStore) {
  return store.shop_name || store.myshopify_domain;
}

/** La tienda a la que pertenece cada conexion de un proveedor, deducida de sus
 * cuentas.
 *
 * En Klaviyo la cuenta es 1:1 con la conexion (unique (connection_id)), asi que
 * el mapa es exacto. En Meta una conexion puede servir a varias tiendas -- una
 * cuenta publicitaria por tienda dentro del mismo portfolio -- y entonces no
 * hay una respuesta: esa conexion se queda fuera del mapa en vez de atribuirse
 * a la primera tienda que aparezca. Decir "esto es de la Tienda A" sobre algo
 * que tambien mueve dinero de la B es peor que no decir nada. */
export function storesByConnection(
  accounts: ScopeAccount[],
  stores: ScopeStore[],
): Map<string, ScopeStore> {
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const result = new Map<string, ScopeStore>();
  const ambiguous = new Set<string>();

  for (const account of accounts) {
    if (!account.store_id) continue;
    const store = storeById.get(account.store_id);
    if (!store) continue;
    const existing = result.get(account.connection_id);
    if (existing && existing.id !== store.id) {
      ambiguous.add(account.connection_id);
      continue;
    }
    result.set(account.connection_id, store);
  }

  for (const connectionId of ambiguous) result.delete(connectionId);
  return result;
}
