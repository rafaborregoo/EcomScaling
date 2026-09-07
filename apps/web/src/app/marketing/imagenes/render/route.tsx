import { ImageResponse } from "next/og";

// Render de una pieza estática de Instagram (imagen del banco + texto
// sobreimpreso) a PNG. Todo llega en la query: `src` (URL pública de la imagen,
// restringida al bucket marketing-assets para evitar SSRF) y `spec` (layout en
// base64url). No persiste nada; el editor la usa solo para exportar.

export const dynamic = "force-dynamic";

type Block = {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  fontSize: number;
  color: string;
  bgColor: string | null;
  align: "left" | "center" | "right";
  weight: number;
  lineHeight: number;
};

type Spec = { ratio: "1:1" | "4:5" | "9:16"; blocks: Block[] };

const DIMS: Record<Spec["ratio"], { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

function decodeSpec(raw: string): Spec | null {
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Spec;
    if (!parsed || !Array.isArray(parsed.blocks)) return null;
    const ratio: Spec["ratio"] =
      parsed.ratio === "1:1" || parsed.ratio === "9:16" ? parsed.ratio : "4:5";
    const blocks: Block[] = parsed.blocks.slice(0, 12).map((block, index) => ({
      id: String(block.id ?? index),
      text: String(block.text ?? "").slice(0, 400),
      xPct: clamp(Number(block.xPct), 0, 100, 8),
      yPct: clamp(Number(block.yPct), 0, 100, 8),
      widthPct: clamp(Number(block.widthPct), 10, 100, 84),
      fontSize: clamp(Number(block.fontSize), 12, 200, 64),
      color: safeColor(block.color, "#ffffff"),
      bgColor:
        block.bgColor === null || block.bgColor === undefined
          ? null
          : safeColor(block.bgColor, "#000000"),
      align:
        block.align === "left" || block.align === "right"
          ? block.align
          : "center",
      weight: clamp(Number(block.weight), 300, 900, 700),
      lineHeight: clamp(Number(block.lineHeight), 0.9, 2, 1.15),
    }));
    return { ratio, blocks };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const src = url.searchParams.get("src") ?? "";
  const specRaw = url.searchParams.get("spec") ?? "";

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const allowedPrefix = `${supabaseUrl}/storage/v1/object/public/marketing-assets/`;
  if (!supabaseUrl || !src.startsWith(allowedPrefix)) {
    return new Response("invalid_src", { status: 400 });
  }

  const spec = decodeSpec(specRaw);
  if (!spec) return new Response("invalid_spec", { status: 400 });

  const { w, h } = DIMS[spec.ratio];

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: w,
          height: h,
          backgroundColor: "#000",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          width={w}
          height={h}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: w,
            height: h,
            objectFit: "cover",
          }}
          alt=""
        />
        {spec.blocks.map((block) => (
          <div
            key={block.id}
            style={{
              position: "absolute",
              left: `${block.xPct}%`,
              top: `${block.yPct}%`,
              width: `${block.widthPct}%`,
              display: "flex",
              justifyContent:
                block.align === "center"
                  ? "center"
                  : block.align === "right"
                    ? "flex-end"
                    : "flex-start",
            }}
          >
            <span
              style={{
                color: block.color,
                fontSize: block.fontSize,
                fontWeight: block.weight,
                lineHeight: block.lineHeight,
                textAlign: block.align,
                whiteSpace: "pre-wrap",
                ...(block.bgColor
                  ? {
                      backgroundColor: block.bgColor,
                      padding: "12px 24px",
                    }
                  : {}),
              }}
            >
              {block.text}
            </span>
          </div>
        ))}
      </div>
    ),
    {
      width: w,
      height: h,
      headers: {
        "Content-Disposition": 'inline; filename="instagram.png"',
        "Cache-Control": "no-store",
      },
    },
  );
}
