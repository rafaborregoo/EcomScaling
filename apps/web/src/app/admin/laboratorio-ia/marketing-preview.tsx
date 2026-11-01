import type { AiModelLabResult } from "@e-nora/contracts";

/** Solo presenta el borrador; el iframe no puede ejecutar scripts ni cargar recursos externos. */
export function MarketingLabPreview({ result }: { result: AiModelLabResult }) {
  let output: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(result.raw_response);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    output = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const text = (key: string) =>
    typeof output[key] === "string" ? (output[key] as string) : "";
  if (text("html")) {
    const policy =
      '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; form-action &#39;none&#39;; base-uri &#39;none&#39;">';
    return (
      <section className="space-y-3" aria-label="Vista previa del email">
        <div className="rounded-lg border border-line p-3 text-sm">
          <p className="font-semibold">{text("subject") || "Sin asunto"}</p>
          <p className="text-muted">{text("preheader")}</p>
          <p className="text-xs text-muted">
            Remitente: {text("from_name") || "Sin confirmar"}
          </p>
        </div>
        <iframe
          title={`Email generado por ${result.model_id}`}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={policy + text("html")}
          className="h-[36rem] w-full rounded-lg border border-line bg-white"
          loading="lazy"
        />
        <p className="text-xs text-muted">
          Vista HTML aislada; los recursos externos están bloqueados. Verifica
          el diseño y el texto antes de aprobarlo.
        </p>
      </section>
    );
  }
  if (text("primary_text"))
    return (
      <section
        className="space-y-3 rounded-lg border border-line bg-background p-4"
        aria-label="Vista previa del anuncio de Meta"
      >
        <p className="text-xs text-muted">Anuncio de Meta · borrador</p>
        <p className="whitespace-pre-wrap text-sm">{text("primary_text")}</p>
        <p className="font-semibold">{text("headline")}</p>
        <p className="text-sm text-muted">{text("description")}</p>
        <p className="text-sm font-medium">CTA: {text("call_to_action")}</p>
        <p className="break-words text-xs text-muted">
          Destino: {text("destination_url") || "Pendiente de URL confirmada"}
        </p>
      </section>
    );
  if (text("caption"))
    return (
      <section
        className="space-y-3 rounded-lg border border-line bg-background p-4"
        aria-label="Vista previa del post de Instagram"
      >
        <p className="text-xs text-muted">
          Instagram · {text("format")} · borrador
        </p>
        <p className="font-semibold">{text("title")}</p>
        <p className="whitespace-pre-wrap text-sm">{text("caption")}</p>
        <p className="text-sm text-muted">
          {Array.isArray(output.hashtags)
            ? output.hashtags.filter((h) => typeof h === "string").join(" ")
            : ""}
        </p>
        <p className="text-sm font-medium">CTA: {text("call_to_action")}</p>
        <p className="whitespace-pre-wrap text-sm">{text("creative_brief")}</p>
        <p className="text-xs text-muted">
          Se comparan textos y dirección creativa; esta prueba no genera las
          imágenes.
        </p>
      </section>
    );
  return null;
}
