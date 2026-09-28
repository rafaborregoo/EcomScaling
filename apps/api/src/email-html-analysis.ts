import { parseFragment } from "parse5";
import { generate, parse as parseCss, walk as walkCss } from "css-tree";

const MAX_HTML_CHARS = 150_000;
const MAX_NODES = 20_000;
const MAX_SAMPLES = 40;

type HtmlNode = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

export type EmailHtmlAnalysis = {
  source: "stored_template_html";
  truncatedHtml: boolean;
  structure: { tables: number; rows: number; headings: number; paragraphs: number; images: number; links: number };
  typography: { fontSizes: string[]; fontFamilies: string[]; lineHeights: string[] };
  colors: { declaredValues: string[]; note: string };
  responsive: { mediaQueryCount: number; hasViewportMeta: boolean };
  images: Array<{ src: string; alt: string; width?: string; height?: string }>;
  links: Array<{ text: string; href: string; buttonLike: boolean }>;
  textSignals: { exclamations: number; questions: number; uppercaseWords: number; dynamicMarkers: string[] };
  limitations: string[];
};

function attr(node: HtmlNode, name: string): string {
  return node.attrs?.find((item) => item.name.toLowerCase() === name)?.value ?? "";
}

function declarations(value: string): Map<string, string> {
  const result = new Map<string, string>();
  try {
    const ast = parseCss(value, { context: "declarationList" });
    walkCss(ast, (node) => {
      if (node.type === "Declaration") result.set(node.property.toLowerCase(), generate(node.value));
    });
  } catch { /* Some email-client CSS extensions are intentionally non-standard. */ }
  return result;
}

function visibleText(node: HtmlNode): string {
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(visibleText).join(" ");
}

export function analyzeEmailHtml(html: string | null | undefined): EmailHtmlAnalysis {
  const original = html ?? "";
  const truncatedHtml = original.length > MAX_HTML_CHARS;
  const source = original.slice(0, MAX_HTML_CHARS);
  const root = parseFragment(source) as unknown as HtmlNode;
  const result: EmailHtmlAnalysis = {
    source: "stored_template_html",
    truncatedHtml,
    structure: { tables: 0, rows: 0, headings: 0, paragraphs: 0, images: 0, links: 0 },
    typography: { fontSizes: [], fontFamilies: [], lineHeights: [] },
    colors: { declaredValues: [], note: "Valores declarados encontrados; no representan area visible ni porcentaje de color renderizado." },
    responsive: { mediaQueryCount: 0, hasViewportMeta: false },
    images: [],
    links: [],
    textSignals: { exclamations: 0, questions: 0, uppercaseWords: 0, dynamicMarkers: [] },
    limitations: [
      "El HTML almacenado no garantiza que sea una copia exacta del mensaje enviado.",
      "No se ha renderizado en clientes de correo: no se infieren posicion visual, prominencia real del CTA, cascada CSS efectiva, modo oscuro ni comportamiento responsive observado.",
      "El contenido dinamico, la personalizacion y las imagenes remotas pueden mostrarse de forma distinta o no mostrarse.",
    ],
  };
  let nodeCount = 0;
  const textParts: string[] = [];
  const sizes = new Set<string>();
  const families = new Set<string>();
  const lineHeights = new Set<string>();
  const colors = new Set<string>();
  const pending: Array<{ node: HtmlNode; hidden: boolean }> = [{ node: root, hidden: false }];
  while (pending.length && nodeCount < MAX_NODES) {
    const current = pending.pop();
    if (!current) break;
    const { node, hidden } = current;
    nodeCount++;
    const tag = (node.tagName ?? "").toLowerCase();
    const hideDescendants = hidden || tag === "head" || tag === "style" || tag === "script";
    if (tag === "table") result.structure.tables++;
    if (tag === "tr") result.structure.rows++;
    if (/^h[1-6]$/.test(tag)) result.structure.headings++;
    if (tag === "p") result.structure.paragraphs++;
    if (tag === "meta" && attr(node, "name").toLowerCase() === "viewport") result.responsive.hasViewportMeta = true;
    const style = declarations(attr(node, "style"));
    for (const [property, value] of style) {
      if (property === "font-size") sizes.add(value);
      if (property === "font-family") families.add(value);
      if (property === "line-height") lineHeights.add(value);
      if (property === "color" || property === "background" || property === "background-color" || property === "border-color") colors.add(value);
    }
    if (tag === "style") {
      try {
        const ast = parseCss(visibleText(node));
        walkCss(ast, (cssNode) => {
          if (cssNode.type === "Atrule" && cssNode.name.toLowerCase() === "media") result.responsive.mediaQueryCount++;
          if (cssNode.type !== "Declaration") return;
          const property = cssNode.property.toLowerCase();
          const value = generate(cssNode.value);
          if (property === "font-size") sizes.add(value);
          if (property === "font-family") families.add(value);
          if (property === "line-height") lineHeights.add(value);
          if (property === "color" || property === "background-color" || property === "background") colors.add(value);
        });
      } catch { /* Keep the observed HTML structure even if an email CSS dialect is unsupported. */ }
    }
    if (tag === "img") {
      result.structure.images++;
      if (result.images.length < MAX_SAMPLES) result.images.push({
        src: attr(node, "src").slice(0, 500),
        alt: attr(node, "alt").slice(0, 250),
        ...(attr(node, "width") ? { width: attr(node, "width") } : {}),
        ...(attr(node, "height") ? { height: attr(node, "height") } : {}),
      });
    }
    if (tag === "a") {
      result.structure.links++;
      const text = visibleText(node).replace(/\s+/g, " ").trim().slice(0, 250);
      const href = attr(node, "href").slice(0, 500);
      if (result.links.length < MAX_SAMPLES && text && href) {
        result.links.push({ text, href, buttonLike: /button|btn/i.test(attr(node, "class")) || /background(?:-color)?\s*:/i.test(attr(node, "style")) });
      }
    }
    if (!hideDescendants && node.nodeName === "#text" && node.value) textParts.push(node.value);
    const children = node.childNodes ?? [];
    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (child) pending.push({ node: child, hidden: hideDescendants });
    }
  }
  result.typography = {
    fontSizes: [...sizes].slice(0, MAX_SAMPLES),
    fontFamilies: [...families].slice(0, MAX_SAMPLES),
    lineHeights: [...lineHeights].slice(0, MAX_SAMPLES),
  };
  result.colors.declaredValues = [...colors].slice(0, MAX_SAMPLES);
  const text = textParts.join(" ").replace(/\s+/g, " ");
  result.textSignals.exclamations = (text.match(/!/g) ?? []).length;
  result.textSignals.questions = (text.match(/\?/g) ?? []).length;
  result.textSignals.uppercaseWords = (text.match(/\b[A-ZÁÉÍÓÚÜÑ]{3,}\b/g) ?? []).length;
  result.textSignals.dynamicMarkers = [...new Set(text.match(/\{\{[^{}]{1,100}\}\}|\{%[^%]{1,100}%\}/g) ?? [])].slice(0, MAX_SAMPLES);
  if (truncatedHtml || nodeCount > MAX_NODES) result.limitations.push("Analisis limitado por tamaño HTML o cantidad de nodos; los conteos pueden estar incompletos.");
  return result;
}
