/** Whether a same-organization draft is eligible for the template library. */
export function isUsableMarketingEmailTemplateRequest(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return request.channel === "email_klaviyo" &&
    (request.source === "klaviyo_import" || request.source === "visual_builder" || Boolean(request.template_profile) || Boolean(request.design));
}
