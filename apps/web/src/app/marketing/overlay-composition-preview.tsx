import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { Link } from "@/components/ui";

export function OverlayCompositionPreview({ draft }: { draft: MarketingDraft }) {
  const composition = draft.request?.overlay_composition;
  if (!composition) return null;
  if (composition.preview_error) return <p role="status" className="text-sm text-muted">{composition.preview_error}</p>;
  if (!composition.assets?.length) return null;
  return <div className="space-y-3 rounded-md border border-separator p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium">Imágenes de esta pieza</p>
      <Link href={`/marketing/imagenes/${composition.overlay_id}`}>Editar imagen y texto</Link>
    </div>
    <div className="flex gap-3 overflow-x-auto">
      {composition.assets.map(asset => <figure key={asset.slide_index} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.alt_text ?? `Imagen ${asset.slide_index + 1} de la pieza`} className="max-h-80 max-w-72 object-contain" />
        {composition.assets.length > 1 ? <figcaption className="text-xs text-muted">Imagen {asset.slide_index + 1}</figcaption> : null}
      </figure>)}
    </div>
  </div>;
}
