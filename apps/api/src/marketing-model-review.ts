import { parse } from "parse5";

export type MarketingModelReview = {
  checks: Array<{ label: string; status: "pass" | "warning" | "fail"; detail: string }>;
  issues: string[];
  evidence: { images: string[]; links: string[]; prices: number[] };
};

/** Mechanical checks are evidence for review, never a fabricated design-quality score. */
export function reviewMarketingModelOutput(channel: string, output: Record<string, any>, products: ReadonlyArray<{ title: unknown; price: unknown; image_url: unknown; product_url: unknown }>): MarketingModelReview {
  const images: string[] = [], links: string[] = [], texts: string[] = [];
  const walk = (node: any) => {
    if (node.nodeName === "#text") texts.push(node.value);
    for (const attr of node.attrs ?? []) {
      if (node.tagName === "img" && attr.name === "src") images.push(attr.value);
      if (node.tagName === "a" && attr.name === "href") links.push(attr.value);
    }
    for (const child of node.childNodes ?? []) if (!["style", "script"].includes(child.tagName)) walk(child);
  };
  const email = channel === "email_klaviyo";
  if (email) walk(parse(String(output.html ?? "")));
  const copy = email ? [output.subject, output.preheader, texts.join(" "), output.plain_text].filter(Boolean).join(" ") : [output.primary_text, output.caption, output.headline, output.title, output.call_to_action].filter(Boolean).join(" ");
  if (!email && output.destination_url) links.push(String(output.destination_url));
  const allowedImages = new Set(products.map((p) => p.image_url).filter((url): url is string => typeof url === "string"));
  const allowedLinks = new Set(products.map((p) => p.product_url).filter((url): url is string => typeof url === "string"));
  const sameProductLink = (url: string) => {
    if (allowedLinks.has(url)) return true;
    try {
      const parsed = new URL(url);
      return [...allowedLinks].some((known) => { const expected = new URL(known); return parsed.origin === expected.origin && parsed.pathname.replace(/\/$/, "") === expected.pathname.replace(/\/$/, "") && [...parsed.searchParams.keys()].every((key) => /^utm_/.test(key)); });
    } catch { return false; }
  };
  const unknownImages = images.filter((url) => !allowedImages.has(url));
  const unknownLinks = links.filter((url) => !sameProductLink(url) && !/unsubscribe|desuscrib|baja/i.test(url));
  const prices = [...copy.matchAll(/(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|EUR)/gi)].map((match) => {
    const raw = match[1]!.replace(/\.(?=\d{3}(?:[.,]|$))/g, "").replace(",", "."); return Number(raw);
  });
  const unknownPrices = prices.filter((price) => !products.some((p) => Number(p.price) === price));
  const promotion = /\b\d+(?:[.,]\d+)?\s*%|env[ií]o\s+gratis|[uú]ltimas\s+unidades|stock\s+limitado|oferta\s+limitada|est[aá](?:n)?\s+disponibles?|en\s+stock/i.test(copy);
  const checks: MarketingModelReview["checks"] = [
    { label: "Precios del catálogo", status: unknownPrices.length ? "fail" : "pass", detail: unknownPrices.length ? `Importes no presentes en el catálogo: ${unknownPrices.join(", ")}` : prices.length ? "Los importes detectados coinciden con los productos entregados." : "No muestra precios; no se exige incluirlos." },
    { label: "Enlaces de producto", status: unknownLinks.length ? "fail" : links.some(sameProductLink) ? "pass" : "warning", detail: unknownLinks.length ? "Hay enlaces ajenos a los destinos verificados." : links.some(sameProductLink) ? "CTA enlazado a un producto del encargo." : "Revisar el destino del CTA en este canal." },
    { label: "Oferta y disponibilidad", status: promotion ? "fail" : "pass", detail: promotion ? "Aparece una promoción o afirmación de disponibilidad no autorizada en el brief." : "No se han detectado promociones o afirmaciones de disponibilidad con las reglas automáticas." },
    { label: "Composición visual", status: !email ? "warning" : unknownImages.length || !images.length ? "fail" : "pass", detail: !email ? "El contrato actual entrega copy y dirección visual, no un PNG terminado." : unknownImages.length ? "Hay imágenes no incluidas entre las fotos verificadas." : !images.length ? "El email no utiliza ninguna foto del catálogo." : `${images.length} imágenes, todas pertenecientes al catálogo entregado.` },
  ];
  const issues = checks.filter((check) => check.status !== "pass").map((check) => `${check.label}: ${check.detail}`);
  return { checks, issues, evidence: { images, links, prices } };
}
