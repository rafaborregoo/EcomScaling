import type { InventoryFilter } from "./inventory-groups";

/* Ilustraciones de fondo de las cards del inventario: trazo fino, color del texto de la card.
   Son decorativas (aria-hidden); la cifra y la etiqueta ya lo dicen todo. */

const common = {
  width: 92,
  height: 92,
  viewBox: "0 0 112 112",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Caja abierta y vacía. */
function EmptyBox() {
  return (
    <svg {...common}>
      <path d="M20 46 56 60l36-14" />
      <path d="M20 46v36l36 14 36-14V46" />
      <path d="M56 60v36" />
      <path d="M20 46 8 32l36-14 12 14" />
      <path d="M92 46l12-14-36-14-12 14" />
      <path d="M38 70l6 2M68 72l6-2" opacity="0.5" />
    </svg>
  );
}

/** Caja con barras que bajan: queda poco. */
function LowBox() {
  return (
    <svg {...common}>
      <path d="M18 58 56 72l38-14" />
      <path d="M18 58v28l38 14 38-14V58" />
      <path d="M56 72v28" />
      <path d="M18 58 56 44l38 14" />
      <path d="M30 34V14M48 34V22M66 34v-6M84 34v-2" strokeWidth="5" opacity="0.55" />
    </svg>
  );
}

/** Tres cajas apiladas: hay stock. */
function StackedBoxes() {
  return (
    <svg {...common}>
      <rect x="10" y="62" width="44" height="38" rx="3" />
      <rect x="58" y="62" width="44" height="38" rx="3" />
      <rect x="34" y="20" width="44" height="38" rx="3" />
      <path d="M26 62v10h12V62M74 62v10h12V62M50 20v10h12V20" opacity="0.6" />
    </svg>
  );
}

/** Caja punteada con interrogante: Shopify no ha mandado el dato. */
function UnknownBox() {
  return (
    <svg {...common}>
      <rect x="18" y="26" width="76" height="70" rx="6" strokeDasharray="5 6" />
      <path d="M46 52a10 10 0 1 1 14 9c-3 1.4-4 3.4-4 6v2" />
      <circle cx="56" cy="80" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** Ojo tachado: Shopify no cuenta el stock. */
function Untracked() {
  return (
    <svg {...common}>
      <path d="M12 56s16-28 44-28 44 28 44 28-16 28-44 28S12 56 12 56Z" />
      <circle cx="56" cy="56" r="12" />
      <path d="M20 92 92 20" />
    </svg>
  );
}

export function GroupArt({ filter }: { filter: InventoryFilter }) {
  if (filter === "out") return <EmptyBox />;
  if (filter === "low") return <LowBox />;
  if (filter === "ok") return <StackedBoxes />;
  if (filter === "unread") return <UnknownBox />;
  if (filter === "untracked") return <Untracked />;
  return null;
}
