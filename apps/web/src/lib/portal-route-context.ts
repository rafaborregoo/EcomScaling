/** Keeps deep links scoped to the organization and Shopify connection selected
 * when the action was generated. Existing filters and hashes are preserved. */
export function withPortalRouteContext(
  href: string,
  organizationId: string,
  connectionId?: string | null,
): string {
  if (!href.startsWith("/")) return href;
  const url = new URL(href, "http://local");
  if (!url.searchParams.has("organizationId")) {
    url.searchParams.set("organizationId", organizationId);
  }
  if (
    connectionId &&
    url.pathname.startsWith("/shopify") &&
    !url.searchParams.has("connectionId")
  ) {
    url.searchParams.set("connectionId", connectionId);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
