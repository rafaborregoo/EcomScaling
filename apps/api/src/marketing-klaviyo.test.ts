import assert from "node:assert/strict";
import test from "node:test";
import { klaviyoCreateCampaignBody } from "./marketing-klaviyo.js";
import { readSeries } from "./klaviyo-sync-marketing.js";

const base = {
  name: "Otoño",
  subject: "Ya está aquí",
  previewText: "32 piezas nuevas",
  fromEmail: "hola@tienda.com",
  fromLabel: "Tienda",
  replyToEmail: null,
  included: ["L1"],
  excluded: ["S9"],
  smartSending: true,
};

test("scheduled campaign uses a static send strategy with the datetime and email content", () => {
  const body = klaviyoCreateCampaignBody({ ...base, sendAt: "2026-10-01T08:00:00.000Z" });
  const attributes = body.data.attributes;
  assert.equal(body.data.type, "campaign");
  assert.deepEqual(attributes.audiences, { included: ["L1"], excluded: ["S9"] });
  assert.deepEqual(attributes.send_strategy, {
    method: "static",
    datetime: "2026-10-01T08:00:00.000Z",
    options: { is_local: false },
  });
  const message = attributes["campaign-messages"].data[0]!;
  assert.equal(message.type, "campaign-message");
  assert.equal(message.attributes.definition.channel, "email");
  assert.equal(message.attributes.definition.content.subject, "Ya está aquí");
  assert.equal("reply_to_email" in message.attributes.definition.content, false);
});

test("immediate campaign has no datetime and keeps reply-to when given", () => {
  const body = klaviyoCreateCampaignBody({ ...base, sendAt: null, replyToEmail: "r@tienda.com" });
  assert.deepEqual(body.data.attributes.send_strategy, { method: "immediate" });
  assert.equal(
    body.data.attributes["campaign-messages"].data[0]!.attributes.definition.content.reply_to_email,
    "r@tienda.com",
  );
});

test("series responses become day strings and numeric arrays", () => {
  const series = readSeries({
    data: {
      attributes: {
        date_times: ["2026-09-01T00:00:00+02:00", "2026-09-02T00:00:00+02:00"],
        results: [{ groupings: { flow_id: "F" }, statistics: { conversion_value: [10.5, null], recipients: "x" } }],
      },
    },
  });
  assert.deepEqual(series.dates, ["2026-09-01", "2026-09-02"]);
  assert.deepEqual(series.results[0]!.statistics.conversion_value, [10.5, 0]);
  assert.deepEqual(series.results[0]!.statistics.recipients, []);
  assert.deepEqual(readSeries({}), { dates: [], results: [] });
});
