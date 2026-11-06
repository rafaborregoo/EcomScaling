import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp, { type OverlayOptions } from "sharp";
import { z } from "zod";
import type { InstagramOverlayDraft } from "@e-nora/ai";

export const overlayRatioSchema = z.enum(["1:1", "4:5", "9:16"]);
export const overlayBlockSchema = z.object({
  id: z.string().max(80), text: z.string().max(400),
  xPct: z.number().min(0).max(100), yPct: z.number().min(0).max(100),
  widthPct: z.number().min(10).max(100), fontSize: z.number().min(12).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  align: z.enum(["left", "center", "right"]), weight: z.number().int().min(300).max(900),
  lineHeight: z.number().min(0.9).max(2),
});
export type OverlayBlock = z.infer<typeof overlayBlockSchema>;
export const overlaySlidesSchema = z.array(z.object({
  image_id: z.string().uuid().nullable(), blocks: z.array(overlayBlockSchema).max(12),
  generation_run_id: z.string().uuid().optional(),
})).max(10);
export const OVERLAY_DIMS = { "1:1": { width: 1080, height: 1080 }, "4:5": { width: 1080, height: 1350 }, "9:16": { width: 1080, height: 1920 } } as const;
export const OVERLAY_RENDER_VERSION = "a16-sharp-geist-v2";
const fontPaths = [new URL("../assets/fonts/Geist-Regular.ttf", import.meta.url), new URL("../../assets/fonts/Geist-Regular.ttf", import.meta.url)];
const overlayFontFile = fileURLToPath(fontPaths.find(path => existsSync(path)) ?? fontPaths[0]!);
export function overlayFingerprint(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function overlayEditorBlocks(draft: InstagramOverlayDraft): OverlayBlock[] {
  const sizes = { kicker: 30, headline: 78, subheadline: 44, cta: 38 };
  return draft.blocks.map((item, index) => ({
    id: `a16-${index}`, text: item.text, widthPct: item.position.width_pct,
    xPct: Math.min(100 - item.position.width_pct, item.position.x_pct), yPct: Math.min(90, item.position.y_pct),
    fontSize: Math.max(12, Math.round(sizes[item.role] * Math.min(1, item.position.width_pct / 84))),
    align: item.align, weight: item.emphasis === "strong" || item.role === "headline" ? 800 : 600,
    color: draft.palette.text_hex, bgColor: item.role === "cta" ? draft.palette.accent_hex : null, lineHeight: 1.1,
  }));
}
const xml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
export async function cropOverlayImage(input: Buffer, ratio: z.infer<typeof overlayRatioSchema>) {
  return sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize({ ...OVERLAY_DIMS[ratio], fit: "cover", position: "centre" }).png().toBuffer();
}
/** Same centered cover crop is sent to vision and used in the exported PNG. */
export async function renderOverlayImage(input: Buffer, ratio: z.infer<typeof overlayRatioSchema>, rawBlocks: unknown) {
  const blocks = z.array(overlayBlockSchema).max(12).parse(rawBlocks);
  const { width, height } = OVERLAY_DIMS[ratio];
  const layers: OverlayOptions[] = [];
  for (const block of blocks) {
    if (!block.text.trim()) continue;
    const left = Math.round(block.xPct / 100 * width), top = Math.round(block.yPct / 100 * height);
    const boxWidth = Math.min(Math.round(block.widthPct / 100 * width), width - left);
    const padX = block.bgColor ? 24 : 0, padY = block.bgColor ? 12 : 0;
    if (boxWidth <= padX * 2 || top >= height) throw new Error("overlay_text_overflow");
    const text = await sharp({ text: {
      text: `<span foreground="${block.color}" weight="${block.weight}">${xml(block.text)}</span>`,
      font: `Geist ${block.fontSize}`, fontfile: overlayFontFile, dpi: 72, width: boxWidth - padX * 2,
      align: block.align, rgba: true, spacing: Math.max(0, Math.round(block.fontSize * (block.lineHeight - 1))),
    } }).png().toBuffer({ resolveWithObject: true });
    if (top + text.info.height + padY * 2 > height) throw new Error("overlay_text_overflow");
    const contentWidth = text.info.width + padX * 2;
    const offset = block.align === "right" ? boxWidth - contentWidth : block.align === "center" ? Math.round((boxWidth - contentWidth) / 2) : 0;
    if (block.bgColor) layers.push({ input: Buffer.from(`<svg width="${contentWidth}" height="${text.info.height + padY * 2}"><rect width="100%" height="100%" fill="${block.bgColor}"/></svg>`), left: left + offset, top });
    layers.push({ input: text.data, left: left + offset + padX, top: top + padY });
  }
  return sharp(await cropOverlayImage(input, ratio)).composite(layers).png().toBuffer();
}
