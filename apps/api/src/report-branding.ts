export const DEFAULT_REPORT_ACCENT = "#1D4ED8";

/** The accent is also used for small text on white. */
export function isReportAccentColor(value: unknown): value is string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return false;
  const rgb = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  return 1.05 / (luminance + 0.05) >= 4.5;
}

/** Only download an uploaded public logo from our own Storage client. Never fetch its URL. */
export function reportLogoStoragePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const prefix = "/storage/v1/object/public/avatars/";
    if (url.protocol !== "https:" || !url.pathname.startsWith(prefix)) return null;
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    return /^[a-z0-9-]+\/marca-[a-z0-9-]+\.(png|jpe?g)$/i.test(key) ? key : null;
  } catch { return null; }
}

export function isReportLogo(buffer: Buffer): boolean {
  if (buffer.length > 2 * 1024 * 1024) return false;
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 && width <= 4096 && height <= 4096;
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  for (let offset = 2; offset + 8 < buffer.length;) {
    if (buffer[offset] !== 0xff) return false;
    const marker = buffer[offset + 1]!;
    if (marker === 0xda || marker === 0xd9) return false;
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2 || offset + 2 + size > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      const height = buffer.readUInt16BE(offset + 5), width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 && width <= 4096 && height <= 4096;
    }
    offset += 2 + size;
  }
  return false;
}
