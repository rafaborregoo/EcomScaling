import { metaGraphGet, MetaGraphError } from "./meta-client.js";

/** Billing details may need more access than the read-only reporting scope. */
export async function fetchMetaAccountProfile(accountId: string, token: string, appSecret?: string) {
  try {
    return await metaGraphGet<Record<string, unknown>>(accountId, token, {
      fields: "funding_source_details,business_country_code,tos_accepted,account_status,disable_reason,amount_spent,balance,spend_cap",
    }, appSecret);
  } catch (error) {
    if (!(error instanceof MetaGraphError) || ![10, 200].includes(error.code ?? -1)) throw error;
    // Retry the basic profile only. If account access itself is denied, this still fails.
    return metaGraphGet<Record<string, unknown>>(accountId, token, { fields: "id,name,account_status" }, appSecret);
  }
}
