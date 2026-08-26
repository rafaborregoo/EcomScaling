import { isIP } from "node:net";

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

/**
 * Validates an externally displayed/fetched URL. DNS resolution is deliberately
 * not performed here; server-side fetchers must revalidate the resolved address
 * and disable redirects before making a request.
 */
export function parseSafeExternalHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipVersion = isIP(hostname);
  const localName =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".invalid");

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !hostname ||
    parsed.username ||
    parsed.password ||
    localName ||
    (ipVersion === 4 && isPrivateIpv4(hostname)) ||
    (ipVersion === 6 && isPrivateIpv6(hostname))
  ) {
    return null;
  }

  return parsed.toString();
}
