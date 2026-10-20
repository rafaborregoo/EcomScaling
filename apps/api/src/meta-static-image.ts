import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";

export const META_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const META_IMAGE_HOST_SUFFIXES = [".fbcdn.net", ".fbsbx.com", ".facebook.com"];
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split(".").map(Number);
    const a = octets[0] ?? -1;
    const b = octets[1] ?? -1;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0) return false;
    return true;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      return isIP(mapped) === 4 && isPublicAddress(mapped);
    }
    // Meta CDNs use global unicast IPv6. Reject ULA, link-local, multicast,
    // loopback, unspecified and documentation-only ranges.
    return /^[23]/.test(normalized) && !normalized.startsWith("2001:db8:") && !normalized.startsWith("3fff:");
  }
  return false;
}

export function validateMetaStaticImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("meta_asset_url_invalid");
  }
  const host = url.hostname.toLowerCase();
  const allowedHost = META_IMAGE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (
    url.protocol !== "https:" ||
    !allowedHost ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(host)
  ) {
    throw new Error("meta_asset_host_not_allowed");
  }
  return url;
}

export function sniffStaticImageMime(bytes: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";
  return null;
}

async function resolvePublicAddresses(hostname: string) {
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("meta_asset_host_resolves_to_private_address");
  }
  return addresses;
}

type ResponsePayload =
  | { statusCode: number; location: string | null; body: Buffer; contentType: string | null }
  | { statusCode: number; location: null; body: Buffer; contentType: string | null };

async function requestPinnedImage(url: URL): Promise<ResponsePayload> {
  const addresses = await resolvePublicAddresses(url.hostname);
  const selected = addresses[0]!;
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { accept: "image/png,image/jpeg,image/webp" },
        lookup: ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
          if (options?.all) {
            callback(null, addresses);
          } else {
            callback(null, selected.address, selected.family);
          }
        }) as never,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location ?? null;
        const contentType = response.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? null;
        const declaredSize = Number(response.headers["content-length"] ?? 0);
        if (declaredSize > META_IMAGE_MAX_BYTES) {
          response.destroy();
          reject(new Error("meta_asset_too_large"));
          return;
        }
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          resolve({ statusCode, location, body: Buffer.alloc(0), contentType });
          return;
        }
        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`meta_asset_http_${statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.length;
          if (total > META_IMAGE_MAX_BYTES) {
            response.destroy(new Error("meta_asset_too_large"));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => resolve({ statusCode, location: null, body: Buffer.concat(chunks), contentType }));
        response.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => request.destroy(new Error("meta_asset_request_timeout")),
      REQUEST_TIMEOUT_MS,
    );
    request.on("close", () => clearTimeout(deadline));
    request.on("error", reject);
  });
}

export async function downloadMetaStaticImage(value: string) {
  let url = validateMetaStaticImageUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await requestPinnedImage(url);
    if (response.location) {
      if (redirects === MAX_REDIRECTS) throw new Error("meta_asset_too_many_redirects");
      url = validateMetaStaticImageUrl(new URL(response.location, url).toString());
      continue;
    }
    const actualMime = sniffStaticImageMime(response.body);
    if (!actualMime || response.contentType !== actualMime) {
      throw new Error("meta_asset_image_type_mismatch");
    }
    return { buffer: response.body, mime: actualMime, originHost: url.hostname };
  }
  throw new Error("meta_asset_too_many_redirects");
}

const META_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

/** Descarga acotada del vídeo fuente de Meta; solo acepta los mismos CDN
 * oficiales verificados por DNS/IP que la ingesta de imágenes. */
export async function downloadMetaVideo(value: string) {
  let url = validateMetaStaticImageUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const addresses = await resolvePublicAddresses(url.hostname);
    const selected = addresses[0]!;
    const response = await new Promise<ResponsePayload>((resolve, reject) => {
      const request = https.get(url, {
        headers: { accept: "video/mp4,video/quicktime,video/webm,application/octet-stream" },
        lookup: ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
          if (options?.all) callback(null, addresses);
          else callback(null, selected.address, selected.family);
        }) as never,
      }, (incoming) => {
        const statusCode = incoming.statusCode ?? 0;
        const location = incoming.headers.location ?? null;
        const contentType = incoming.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? null;
        if (statusCode >= 300 && statusCode < 400 && location) {
          incoming.resume();
          resolve({ statusCode, location, body: Buffer.alloc(0), contentType });
          return;
        }
        if (statusCode !== 200) {
          incoming.resume();
          reject(new Error(`meta_video_http_${statusCode}`));
          return;
        }
        if (Number(incoming.headers["content-length"] ?? 0) > META_VIDEO_MAX_BYTES) {
          incoming.destroy();
          reject(new Error("meta_video_too_large"));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        incoming.on("data", (chunk: Buffer | string) => {
          const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += part.length;
          if (total > META_VIDEO_MAX_BYTES) {
            incoming.destroy(new Error("meta_video_too_large"));
            return;
          }
          chunks.push(part);
        });
        incoming.on("end", () => resolve({ statusCode, location: null, body: Buffer.concat(chunks), contentType }));
        incoming.on("error", reject);
      });
      const deadline = setTimeout(() => request.destroy(new Error("meta_video_request_timeout")), 30_000);
      request.on("close", () => clearTimeout(deadline));
      request.on("error", reject);
    });
    if (response.location) {
      if (redirects === MAX_REDIRECTS) throw new Error("meta_video_too_many_redirects");
      url = validateMetaStaticImageUrl(new URL(response.location, url).toString());
      continue;
    }
    if (!response.body.length) throw new Error("meta_video_empty");
    return { buffer: response.body, originHost: url.hostname, contentType: response.contentType };
  }
  throw new Error("meta_video_too_many_redirects");
}
