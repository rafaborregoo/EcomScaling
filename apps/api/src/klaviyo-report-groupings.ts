export function klaviyoReportGroupings(type: string): string[] {
  return type.startsWith("campaign")
    ? ["campaign_id", "campaign_message_id", "variation", "variation_name"]
    : ["flow_id", "flow_message_id"];
}
