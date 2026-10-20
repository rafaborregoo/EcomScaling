/**
 * Chat con la IA del estudio: aplicar al diseño los cambios que devuelve
 * `POST .../marketing/studio/ai-chat`. Lo usan la web y el móvil, así que un
 * mismo mensaje deja el mismo email en los dos sitios.
 *
 * El servidor ya filtra imágenes, enlaces y precios; aquí se vuelve a comprobar
 * lo que depende del modelo del bloque: solo propiedades que ese bloque tiene y
 * del mismo tipo que las suyas por defecto.
 */
import { BLOCK_LABEL, newBlock, snippet, type BlockType, type StudioBlock, type StudioDesign } from "./studio-design";

export type StudioChatOp =
  | { op: "set"; block_id: string; props: Record<string, unknown> }
  | { op: "add"; type: string; props: Record<string, unknown>; after_id: string | null }
  | { op: "remove"; block_id: string }
  | { op: "move"; block_id: string; after_id: string | null }
  | { op: "header"; field: "subject" | "preheader"; value: string };

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type ChatHeader = { subject: string; preheader: string };

function cleanProps(type: BlockType, props: Record<string, unknown>): Record<string, unknown> {
  const base = newBlock(type).props as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!(key in base)) continue;
    const want = base[key];
    if (Array.isArray(want)) {
      if (!Array.isArray(value) || value.length > 6) continue;
      if (type === "products" && key === "items") {
        const items = value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<Record<string, unknown>>;
        if (items.length !== value.length || items.some((item) => typeof item.id !== "string" || typeof item.title !== "string" || typeof item.price !== "string" || typeof item.image !== "string" || typeof item.url !== "string" || (item.url && !/^https?:\/\//i.test(item.url)) || (item.image && !/^https?:\/\//i.test(item.image)))) continue;
        clean[key] = items;
      } else if (type === "columns" && key === "items") {
        const items = value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<Record<string, unknown>>;
        if (items.length !== value.length || items.some((item) => Object.keys(item).some((field) => !["t", "d"].includes(field)) || Object.values(item).some((part) => typeof part !== "string" || part.length > 1000))) continue;
        clean[key] = items;
      } else if (type === "social" && key === "links") {
        const links = value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<Record<string, unknown>>;
        if (links.length !== value.length || links.some((item) => Object.keys(item).some((field) => !["name", "url"].includes(field)) || typeof item.name !== "string" || typeof item.url !== "string" || !/^https?:\/\//i.test(String(item.url)))) continue;
        clean[key] = links;
      }
    } else if (typeof want === "number" && typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      clean[key] = Number(value);
    } else if (typeof value === typeof want) {
      clean[key] = value;
    }
  }
  return clean;
}

const isType = (type: string): type is BlockType => type in BLOCK_LABEL;

function place(blocks: StudioBlock[], block: StudioBlock, afterId: string | null): StudioBlock[] {
  const rest = blocks.filter((item) => item.id !== block.id);
  const anchor = afterId === null || afterId === "inicio" ? -1 : rest.findIndex((item) => item.id === afterId);
  if (afterId !== null && afterId !== "inicio" && anchor < 0) return blocks;
  const index = afterId === "inicio" ? 0 : afterId === null ? rest.length : anchor + 1;
  return [...rest.slice(0, index), block, ...rest.slice(index)];
}

export function applyStudioOps(
  design: StudioDesign,
  header: ChatHeader,
  ops: StudioChatOp[],
): { design: StudioDesign; header: ChatHeader; touched: string[]; labels: string[] } {
  let blocks = design.blocks;
  let nextHeader = header;
  const touched: string[] = [];
  const labels: string[] = [];
  const touch = (id: string) => {
    if (!touched.includes(id)) touched.push(id);
  };
  for (const op of ops) {
    if (op.op === "header") {
      nextHeader = { ...nextHeader, [op.field]: op.value };
      labels.push(`${op.field === "subject" ? "Asunto" : "Preheader"}: ${op.value}`);
    } else if (op.op === "add") {
      if (!isType(op.type)) continue;
      const block = newBlock(op.type, cleanProps(op.type, op.props) as never);
      blocks = place(blocks, block, op.after_id);
      touch(block.id);
      labels.push(`Añadido: ${BLOCK_LABEL[op.type]}`);
    } else {
      const block = blocks.find((item) => item.id === op.block_id);
      if (!block) continue;
      if (op.op === "set") {
        const props = cleanProps(block.type, op.props);
        if (!Object.keys(props).length) continue;
        const next = { ...block, props: { ...block.props, ...props } } as StudioBlock;
        blocks = blocks.map((item) => (item.id === block.id ? next : item));
        touch(block.id);
        labels.push(`${BLOCK_LABEL[block.type]}: ${snippet(next).slice(0, 60) || "ajustado"}`);
      } else if (op.op === "remove") {
        blocks = blocks.filter((item) => item.id !== block.id);
        labels.push(`Quitado: ${BLOCK_LABEL[block.type]}`);
      } else if (op.op === "move") {
        blocks = place(blocks, block, op.after_id);
        touch(block.id);
        labels.push(`Movido: ${BLOCK_LABEL[block.type]}`);
      }
    }
  }
  return { design: { ...design, blocks }, header: nextHeader, touched, labels };
}

/** Cuerpo de la petición: el diseño tal cual, con el HTML a mano recortado. */
export function studioChatBody(input: {
  message: string;
  history: ChatTurn[];
  design: StudioDesign;
  header: ChatHeader;
  selectedId: string | null;
  connectionId: string | null;
  model?: string;
}) {
  return {
    message: input.message,
    history: input.history.slice(-12),
    subject: input.header.subject,
    preheader: input.header.preheader,
    blocks: input.design.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      props: block.type === "html" ? { html: block.props.html.slice(0, 2000) } : block.props,
    })),
    brand: input.design.brand,
    selected_id: input.selectedId,
    connection_id: input.connectionId,
    ...(input.model ? { model: input.model } : {}),
  };
}
