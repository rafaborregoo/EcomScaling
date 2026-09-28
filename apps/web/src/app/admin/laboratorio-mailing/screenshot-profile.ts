export type ScreenshotVisualProfile = {
  version: 1;
  width: number;
  height: number;
  method: "sampled_pixels_quantized";
  colors: Array<{ hex: string; share_percent: number }>;
  vertical_bands: Array<{ from_percent: number; to_percent: number; dominant_hex: string }>;
};

const MAX_DIMENSION = 12_000;
const MAX_PIXELS = 18_000_000;
const QUANTIZATION_STEP = 32;

function colorHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function dominantColor(counts: Map<string, number>) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "#ffffff";
}

/**
 * Summarizes a small browser-side screenshot sample. It never uploads or stores
 * image bytes; color shares are pixel-sample estimates, not semantic findings.
 */
export function profileScreenshotPixels(
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
): ScreenshotVisualProfile {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new Error("screenshot_dimensions_unsupported");
  }
  if (pixels.length !== width * height * 4) throw new Error("screenshot_pixel_buffer_invalid");

  const all = new Map<string, number>();
  const rows = Array.from({ length: 8 }, () => new Map<string, number>());
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    const r = Math.round((pixels[i] * alpha + 255 * (1 - alpha)) / QUANTIZATION_STEP) * QUANTIZATION_STEP;
    const g = Math.round((pixels[i + 1] * alpha + 255 * (1 - alpha)) / QUANTIZATION_STEP) * QUANTIZATION_STEP;
    const b = Math.round((pixels[i + 2] * alpha + 255 * (1 - alpha)) / QUANTIZATION_STEP) * QUANTIZATION_STEP;
    const hex = colorHex(Math.min(255, r), Math.min(255, g), Math.min(255, b));
    const pixelIndex = i / 4;
    const row = Math.min(7, Math.floor(pixelIndex / width / height * 8));
    all.set(hex, (all.get(hex) ?? 0) + 1);
    rows[row].set(hex, (rows[row].get(hex) ?? 0) + 1);
  }
  const sampleCount = width * height;
  const colors = [...all.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count]) => ({ hex, share_percent: Math.round(count / sampleCount * 1000) / 10 }));

  return {
    version: 1,
    width,
    height,
    method: "sampled_pixels_quantized",
    colors,
    vertical_bands: rows.map((counts, index) => ({
      from_percent: index * 12.5,
      to_percent: (index + 1) * 12.5,
      dominant_hex: dominantColor(counts),
    })),
  };
}

export async function profileScreenshotFile(file: File): Promise<ScreenshotVisualProfile> {
  if (file.size < 1 || file.size > 2 * 1024 * 1024) throw new Error("screenshot_size_unsupported");
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type) && !(!file.type && /\.(png|jpe?g|webp)$/i.test(file.name))) {
    throw new Error("screenshot_format_unsupported");
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION || bitmap.width * bitmap.height > MAX_PIXELS) {
      throw new Error("screenshot_dimensions_unsupported");
    }
    const sampleWidth = 64;
    const sampleHeight = 64;
    const canvas = document.createElement("canvas");
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("screenshot_canvas_unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sampleWidth, sampleHeight);
    context.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    return profileScreenshotPixels(bitmap.width, bitmap.height, pixels);
  } finally {
    bitmap.close();
  }
}
