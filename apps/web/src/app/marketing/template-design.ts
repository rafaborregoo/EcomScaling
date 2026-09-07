// AI-11 fase 1: modelo de bloques del builder visual de plantillas + render a
// HTML email-safe (sin script/iframe/CSS externo/flex/grid). El mismo render
// alimenta el preview en vivo y el `html` que se guarda con el borrador.

export type BlockAlign = "left" | "center" | "right";

export type TemplateBlock =
  | {
      id: string;
      type: "heading";
      text: string;
      align: BlockAlign;
      size: "sm" | "md" | "lg";
      color: string | null;
    }
  | {
      id: string;
      type: "text";
      text: string;
      align: BlockAlign;
      color: string | null;
    }
  | {
      id: string;
      type: "button";
      text: string;
      href: string;
      align: BlockAlign;
      bg: string | null;
      color: string | null;
    }
  | {
      id: string;
      type: "image";
      src: string;
      alt: string;
      align: BlockAlign;
      href: string;
    }
  | {
      id: string;
      type: "youtube";
      videoId: string;
      caption: string;
      align: BlockAlign;
    }
  | { id: string; type: "divider"; color: string | null }
  | { id: string; type: "spacer"; height: number }
  | {
      id: string;
      type: "columns";
      columns: [ColumnCell, ColumnCell];
    };

export type ColumnCell = { text: string; imageSrc: string };

export type TemplateStyles = {
  fontFamily: string;
  background: string;
  containerBackground: string;
  text: string;
  primary: string;
};

export type TemplateDesign = {
  version: 1;
  styles: TemplateStyles;
  blocks: TemplateBlock[];
};

export const FONT_OPTIONS = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial / Helvetica" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia (serif)" },
  { value: "'Trebuchet MS', Verdana, sans-serif", label: "Trebuchet" },
  { value: "'Courier New', monospace", label: "Courier (mono)" },
] as const;

export const HEADING_SIZE_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 20,
  md: 26,
  lg: 34,
};

export function defaultDesign(palette?: Partial<TemplateStyles>): TemplateDesign {
  return {
    version: 1,
    styles: {
      fontFamily: FONT_OPTIONS[0].value,
      background: palette?.background ?? "#f4f4f5",
      containerBackground: palette?.containerBackground ?? "#ffffff",
      text: palette?.text ?? "#171717",
      primary: palette?.primary ?? "#1d4ed8",
    },
    blocks: [],
  };
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter}`;
}

export function newBlock(
  type: TemplateBlock["type"],
  styles: TemplateStyles,
): TemplateBlock {
  const id = nextId();
  switch (type) {
    case "heading":
      return { id, type, text: "Título", align: "left", size: "lg", color: null };
    case "text":
      return {
        id,
        type,
        text: "Escribe aquí tu texto…",
        align: "left",
        color: null,
      };
    case "button":
      return {
        id,
        type,
        text: "Ver más",
        href: "https://",
        align: "left",
        bg: styles.primary,
        color: "#ffffff",
      };
    case "image":
      return { id, type, src: "", alt: "", align: "center", href: "" };
    case "youtube":
      return { id, type, videoId: "", caption: "▶ Ver el vídeo", align: "center" };
    case "divider":
      return { id, type, color: null };
    case "spacer":
      return { id, type, height: 24 };
    case "columns":
      return {
        id,
        type,
        columns: [
          { text: "Columna izquierda", imageSrc: "" },
          { text: "Columna derecha", imageSrc: "" },
        ],
      };
  }
}

/**
 * AI-11 fase 3: convierte los bloques que devuelve el agente a11
 * (`{ type, content, href, alt }`, contrato klaviyo-email-v1) al modelo del
 * builder para que un borrador generado por IA se pueda reabrir en el editor.
 * `columns` no existe en el builder -> degrada a texto; `image` solo acepta
 * src/href https.
 */
export function designFromAiBlocks(
  rawBlocks: unknown[],
  palette?: Partial<TemplateStyles>,
): TemplateDesign {
  const design = defaultDesign(palette);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const httpsOnly = (v: unknown): string =>
    /^https?:\/\//i.test(str(v).trim()) ? str(v).trim() : "";
  for (const raw of rawBlocks) {
    const b = (raw ?? {}) as {
      type?: unknown;
      content?: unknown;
      href?: unknown;
      alt?: unknown;
    };
    const content = str(b.content);
    switch (b.type) {
      case "heading":
        design.blocks.push({
          id: nextId(),
          type: "heading",
          text: content || "Título",
          align: "left",
          size: "lg",
          color: null,
        });
        break;
      case "text":
        if (content.trim())
          design.blocks.push({
            id: nextId(),
            type: "text",
            text: content,
            align: "left",
            color: null,
          });
        break;
      case "columns": {
        // a11 devuelve `content` como un unico string; separamos por linea en
        // blanco. Si no hay separador claro, cae a un bloque de texto normal.
        const parts = content
          .split(/\n{2,}/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
        if (parts.length >= 2) {
          design.blocks.push({
            id: nextId(),
            type: "columns",
            columns: [
              { text: parts[0], imageSrc: "" },
              { text: parts.slice(1).join("\n\n"), imageSrc: "" },
            ],
          });
        } else if (content.trim()) {
          design.blocks.push({
            id: nextId(),
            type: "text",
            text: content,
            align: "left",
            color: null,
          });
        }
        break;
      }
      case "button":
        design.blocks.push({
          id: nextId(),
          type: "button",
          text: content || "Ver más",
          href: str(b.href) || "https://",
          align: "left",
          bg: design.styles.primary,
          color: "#ffffff",
        });
        break;
      case "image":
        design.blocks.push({
          id: nextId(),
          type: "image",
          src: httpsOnly(b.content),
          alt: str(b.alt),
          align: "center",
          href: httpsOnly(b.href),
        });
        break;
      case "divider":
        design.blocks.push({ id: nextId(), type: "divider", color: null });
        break;
      case "spacer":
        design.blocks.push({ id: nextId(), type: "spacer", height: 24 });
        break;
    }
  }
  return design;
}

export function parseYouTubeId(input: string): string {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/,
  );
  return match ? match[1] : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? escapeHtml(trimmed) : "";
}

function renderBlock(
  block: TemplateBlock,
  styles: TemplateStyles,
  editable = false,
): string {
  const pad = "padding:8px 24px;";
  // En el lienzo el texto se escribe encima del propio bloque; en el HTML que
  // se guarda estos atributos no existen.
  const ed = editable ? ` data-edit="1" contenteditable="true"` : "";
  switch (block.type) {
    case "heading":
      return `<div${ed} style="${pad}text-align:${block.align};font-size:${HEADING_SIZE_PX[block.size]}px;font-weight:700;line-height:1.25;color:${block.color ?? styles.text};">${escapeHtml(block.text)}</div>`;
    case "text":
      return `<div${ed} style="${pad}text-align:${block.align};font-size:15px;line-height:1.6;color:${block.color ?? styles.text};">${escapeHtml(block.text).replace(/\n/g, "<br>")}</div>`;
    case "button": {
      const href = safeUrl(block.href) || "#";
      return `<div style="${pad}text-align:${block.align};"><a href="${href}"${ed} style="display:inline-block;padding:12px 22px;border-radius:6px;background:${block.bg ?? styles.primary};color:${block.color ?? "#ffffff"};text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(block.text)}</a></div>`;
    }
    case "image": {
      const src = safeUrl(block.src);
      if (!src) return "";
      const img = `<img src="${src}" alt="${escapeHtml(block.alt)}" style="max-width:100%;height:auto;display:inline-block;" />`;
      const href = safeUrl(block.href);
      return `<div style="${pad}text-align:${block.align};">${href ? `<a href="${href}">${img}</a>` : img}</div>`;
    }
    case "youtube": {
      if (!block.videoId) return "";
      const watch = `https://www.youtube.com/watch?v=${escapeHtml(block.videoId)}`;
      const thumb = `https://img.youtube.com/vi/${escapeHtml(block.videoId)}/hqdefault.jpg`;
      return `<div style="${pad}text-align:${block.align};"><a href="${watch}" style="text-decoration:none;color:${styles.text};"><img src="${thumb}" alt="${escapeHtml(block.caption)}" style="max-width:100%;height:auto;display:inline-block;border-radius:6px;" /><div style="font-size:13px;margin-top:6px;">${escapeHtml(block.caption)}</div></a></div>`;
    }
    case "divider":
      return `<div style="padding:12px 24px;"><hr style="border:none;border-top:1px solid ${block.color ?? "#e2e2e2"};margin:0;" /></div>`;
    case "spacer":
      return `<div style="height:${Math.max(4, Math.min(120, block.height))}px;line-height:1px;font-size:1px;">&nbsp;</div>`;
    case "columns": {
      const cell = (col: { text: string; imageSrc: string }) => {
        const src = safeUrl(col.imageSrc);
        const img = src
          ? `<img src="${src}" alt="" style="max-width:100%;height:auto;display:block;margin-bottom:8px;" />`
          : "";
        const text = col.text.trim()
          ? `<div style="font-size:15px;line-height:1.6;color:${styles.text};">${escapeHtml(col.text).replace(/\n/g, "<br>")}</div>`
          : "";
        return `<td valign="top" width="50%" style="padding:8px 12px;">${img}${text}</td>`;
      };
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:8px 12px;"><tr>${cell(block.columns[0])}${cell(block.columns[1])}</tr></table>`;
    }
  }
}

/**
 * Bloques que en el email no pintan nada hasta tener URL. En el lienzo tienen
 * que seguir siendo visibles y seleccionables o no hay forma de rellenarlos.
 */
const EMPTY_CANVAS_HINT: Partial<Record<TemplateBlock["type"], string>> = {
  image: "Imagen sin URL · selecciónala para subirla o pegar el enlace",
  youtube: "Vídeo sin identificar · selecciónalo para pegar la URL de YouTube",
};

const CANVAS_STYLE = `<style>
.eb{position:relative;outline:1px dashed transparent;outline-offset:-1px;}
.eb:hover{outline-color:#94a3b8;}
.eb.sel{outline:2px solid #1d4ed8;}
.eb [data-edit]:focus{outline:2px solid #93c5fd;outline-offset:2px;}
.ebar{position:absolute;top:0;right:0;display:flex;background:#1d4ed8;z-index:9;}
.ebar button{border:0;background:transparent;color:#fff;font:13px/1 system-ui,sans-serif;padding:6px 8px;cursor:pointer;}
.ebar button:hover{background:#1e40af;}
.ebar button:disabled{opacity:.4;cursor:default;}
.ebhint{padding:18px 24px;text-align:center;border:1px dashed #cbd5e1;color:#64748b;font:13px/1.4 system-ui,sans-serif;}
.ebempty{padding:56px 24px;text-align:center;color:#64748b;font:14px/1.5 system-ui,sans-serif;}
</style>`;

/**
 * El lienzo habla con React por `postMessage`. Todo lo que se puede resolver
 * mirando (escribir, reordenar, duplicar, borrar) se hace aqui dentro; el
 * panel lateral solo guarda lo que no se manipula directamente sobre la pieza
 * (colores, enlaces, tamaños).
 */
const CANVAS_SCRIPT = `<script>
(function(){
  var post=function(m){m.tpl=1;parent.postMessage(m,'*');};
  document.addEventListener('click',function(e){
    // Un enlace pulsado en el lienzo sacaria al consultor del editor.
    var a=e.target.closest('a');
    if(a)e.preventDefault();
    var act=e.target.closest('[data-a]');
    if(act){e.stopPropagation();post({t:'act',a:act.dataset.a,id:act.closest('[data-b]').dataset.b});return;}
    var w=e.target.closest('[data-b]');
    post({t:'select',id:w?w.dataset.b:null});
  },true);
  document.addEventListener('input',function(e){
    var el=e.target.closest('[data-edit]');
    if(!el)return;
    post({t:'text',id:el.closest('[data-b]').dataset.b,value:el.innerText});
  });
  var sel=document.querySelector('.eb.sel');
  if(sel)sel.scrollIntoView({block:'nearest'});
})();
</script>`;

function canvasToolbar(isFirst: boolean, isLast: boolean): string {
  const button = (
    action: string,
    label: string,
    glyph: string,
    disabled: boolean,
  ) =>
    `<button type="button" data-a="${action}" aria-label="${label}" title="${label}"${disabled ? " disabled" : ""}>${glyph}</button>`;
  return `<div class="ebar" contenteditable="false">${button("up", "Subir el bloque", "&#8593;", isFirst)}${button("down", "Bajar el bloque", "&#8595;", isLast)}${button("dup", "Duplicar el bloque", "&#10697;", false)}${button("del", "Eliminar el bloque", "&#10005;", false)}</div>`;
}

/**
 * AI-11 fase 4: el mismo render alimenta dos cosas distintas.
 *
 * Sin opciones produce el HTML que se guarda y se envia al cliente: sin
 * script, sin estilos de editor, sin atributos extra. Con `editable` produce
 * el LIENZO del editor. Esa version no se guarda nunca: si el `html` de un
 * borrador arrastrara el script del editor, acabaria en la bandeja de entrada
 * de alguien.
 */
export function renderTemplateHtml(
  design: TemplateDesign,
  options?: { editable?: boolean; selectedId?: string | null },
): string {
  const { styles, blocks } = design;
  const editable = options?.editable === true;
  const body = blocks
    .map((block, index) => {
      const rendered = renderBlock(block, styles, editable);
      const hint = EMPTY_CANVAS_HINT[block.type];
      const inner =
        rendered || (editable && hint ? `<div class="ebhint">${hint}</div>` : "");
      if (!editable) return inner;
      const selected = block.id === options?.selectedId;
      const bar = selected
        ? canvasToolbar(index === 0, index === blocks.length - 1)
        : "";
      return `<div class="eb${selected ? " sel" : ""}" data-b="${block.id}">${bar}${inner}</div>`;
    })
    .join("\n");
  const canvasEmpty =
    editable && blocks.length === 0
      ? `<div class="ebempty">Añade el primer bloque desde el panel de la derecha.</div>`
      : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${editable ? CANVAS_STYLE : ""}</head>
<body style="margin:0;padding:24px 0;background:${styles.background};font-family:${styles.fontFamily};">
<div style="max-width:600px;margin:0 auto;background:${styles.containerBackground};">
${body}${canvasEmpty}
</div>
${editable ? CANVAS_SCRIPT : ""}
</body></html>`;
}

export function templatePlainText(design: TemplateDesign): string {
  return design.blocks
    .map((block) => {
      if (block.type === "heading" || block.type === "text") return block.text;
      if (block.type === "button") return `${block.text}: ${block.href}`;
      if (block.type === "youtube")
        return `${block.caption}: https://www.youtube.com/watch?v=${block.videoId}`;
      if (block.type === "image" && block.alt) return `[${block.alt}]`;
      if (block.type === "columns")
        return block.columns
          .map((col) => col.text.trim())
          .filter((text) => text.length > 0)
          .join("\n");
      return "";
    })
    .filter((line) => line.trim().length > 0)
    .join("\n\n");
}
