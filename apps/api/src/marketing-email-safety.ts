import { parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["childNode"];
type Element = DefaultTreeAdapterMap["element"];

const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "caption", "center", "col", "colgroup", "dd", "del", "div", "dl", "dt", "em", "font", "h1", "h2", "h3", "h4", "hr", "i", "img", "li", "ol", "p", "s", "small", "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
]);
const DROP_CONTENT = new Set(["script", "style", "iframe", "form", "input", "button", "object", "embed", "svg", "math", "video", "audio", "template"]);
const ALLOWED_ATTRS = new Set([
  "align", "alt", "bgcolor", "border", "cellpadding", "cellspacing", "colspan", "dir", "height", "href", "hreflang", "lang", "role", "rowspan", "src", "style", "target", "title", "valign", "width",
]);

function safeUrl(value: string, image = false) {
  const normalized = value.replace(/[\u0000-\u0020]+/g, "").trim();
  if (/^https?:\/\//i.test(normalized)) return true;
  if (!image && (/^mailto:/i.test(normalized) || /^\{\{[\s\S]*\}\}$/.test(normalized) || /^\{%[\s\S]*%\}$/.test(normalized))) return true;
  return false;
}

function cleanStyle(value: string) {
  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon < 1) return false;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const content = declaration.slice(colon + 1).trim();
      return /^[a-z-]+$/.test(property) && content.length <= 300 && !/(?:url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:)/i.test(content);
    })
    .join("; ");
}

function sanitizeNode(node: Node, insideDrop = false): Node[] {
  if (node.nodeName === "#text" || node.nodeName === "#comment") return insideDrop ? [] : [node];
  if (node.nodeName === "#documentType") return [];
  const element = node as Element;
  const tag = element.tagName?.toLowerCase();
  if (!tag) return [];
  if (insideDrop || DROP_CONTENT.has(tag)) return [];
  const children = (element.childNodes ?? []).flatMap((child) => sanitizeNode(child));
  if (!ALLOWED_TAGS.has(tag)) return children;
  element.childNodes = children;
  element.attrs = element.attrs.filter(({ name, value }) => {
    const key = name.toLowerCase();
    if (!ALLOWED_ATTRS.has(key) || key.startsWith("on")) return false;
    if (key === "href" && !safeUrl(value)) return false;
    if (key === "src" && !safeUrl(value, true)) return false;
    if (key === "style") {
      const cleaned = cleanStyle(value);
      if (!cleaned) return false;
      (element.attrs.find((attr) => attr.name === name) as { value: string }).value = cleaned;
    }
    if (key === "target" && value !== "_blank" && value !== "_self") return false;
    return value.length <= 4000;
  });
  if (tag === "a" && element.attrs.some((attr) => attr.name === "target" && attr.value === "_blank")) {
    element.attrs = [...element.attrs.filter((attr) => attr.name !== "rel"), { name: "rel", value: "noopener noreferrer" }];
  }
  return [element];
}

/** Parser HTML5 real, limpieza por lista permitida para email y sin atributos ejecutables. */
export function sanitizeMarketingEmailHtml(html: string): string {
  const fragment = parseFragment(html);
  fragment.childNodes = fragment.childNodes.flatMap((node) => sanitizeNode(node));
  return serialize(fragment).trim();
}

export type MarketingEmailCheck = { blocking: boolean; code: string; message: string };

/** Controles de servidor que se aplican igual al estudio, campañas y exportación. */
export function reviewMarketingEmailHtml(input: {
  html: string;
  subject?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
  requiredTexts?: string[];
}): MarketingEmailCheck[] {
  const html = sanitizeMarketingEmailHtml(input.html);
  const text = html.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#160);/gi, " ").replace(/\s+/g, " ");
  const checks: MarketingEmailCheck[] = [];
  if (!html) checks.push({ blocking: true, code: "empty_html", message: "El email no tiene contenido válido." });
  if (!input.subject?.trim()) checks.push({ blocking: true, code: "missing_subject", message: "Añade un asunto antes de continuar." });
  if (!input.fromName?.trim()) checks.push({ blocking: true, code: "missing_sender", message: "Añade el nombre del remitente." });
  if (/(?:\[[^\]]{1,100}\]|[«‹][^»›]{1,100}[»›]|\{\{\s*(?:PRECIO|FECHA|FECHA_FIN|CODIGO|CUPON)[^}]*\}\})/iu.test(text)) {
    checks.push({ blocking: true, code: "unresolved_placeholder", message: "Hay un marcador de plantilla que debe completarse." });
  }
  const imageHasMissingAlt = (node: Node): boolean => {
    if (node.nodeName === "#text" || node.nodeName === "#comment" || node.nodeName === "#documentType") return false;
    const element = node as Element;
    const hasMissingAlt = element.tagName?.toLowerCase() === "img" && !element.attrs.some((attr) => attr.name.toLowerCase() === "alt" && attr.value.trim());
    return Boolean(hasMissingAlt || (element.childNodes ?? []).some(imageHasMissingAlt));
  };
  if (parseFragment(html).childNodes.some(imageHasMissingAlt)) checks.push({ blocking: false, code: "image_alt_missing", message: "Añade texto alternativo a cada imagen." });
  if (input.requiredTexts?.some((required) => required.trim() && !text.toLocaleLowerCase().includes(required.trim().toLocaleLowerCase()))) {
    checks.push({ blocking: true, code: "required_brand_text_missing", message: "Falta un texto obligatorio de la guía de marca." });
  }
  if (input.replyTo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.replyTo)) checks.push({ blocking: true, code: "invalid_reply_to", message: "El email de respuesta no es válido." });
  if (!/\{%\s*unsubscribe\b/i.test(input.html) && !/unsubscribe/i.test(text)) checks.push({ blocking: false, code: "unsubscribe_missing", message: "Comprueba que la plantilla incluya el enlace de baja de Klaviyo." });
  return checks;
}
