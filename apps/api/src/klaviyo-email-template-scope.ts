export type KlaviyoEmailTemplateRef = {
  account_id: string | null;
  external_template_id: string | null;
};

export type KlaviyoEmailTemplateBody = KlaviyoEmailTemplateRef & {
  html_content: string | null;
};

export function klaviyoEmailTemplateKey(accountId: string, externalTemplateId: string) {
  return `${accountId}\u0000${externalTemplateId}`;
}

/**
 * External template IDs are only unique inside one Klaviyo account. Indexing
 * by the compound identity prevents a multi-store org from attaching another
 * account's content when IDs collide.
 */
export function indexKlaviyoEmailTemplateBodies(rows: KlaviyoEmailTemplateBody[]) {
  const bodies = new Map<string, string | null>();
  for (const row of rows) {
    if (!row.account_id || !row.external_template_id) continue;
    bodies.set(klaviyoEmailTemplateKey(row.account_id, row.external_template_id), row.html_content);
  }
  return bodies;
}

export function getKlaviyoEmailTemplateBody(
  bodies: Map<string, string | null>,
  ref: KlaviyoEmailTemplateRef,
) {
  if (!ref.account_id || !ref.external_template_id) return undefined;
  return bodies.get(klaviyoEmailTemplateKey(ref.account_id, ref.external_template_id));
}
