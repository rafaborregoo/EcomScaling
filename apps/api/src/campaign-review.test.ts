import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignNotification,
  isStaffActor,
  noteWriteDecision,
  notificationAudience,
  resolveThreadActor,
  reviewStatusAfterClientActivity,
} from "./campaign-review.js";

const ORG = "11111111-1111-1111-1111-111111111111";

function ctx(platformRole: string, role: string) {
  return {
    memberships: [{ organization_id: ORG, role, accessSource: "membership" as const }],
    profile: { platform_role: platformRole },
  };
}

test("actor del hilo: plataforma, consultor y cliente; sin membresia no hay acceso", () => {
  assert.equal(resolveThreadActor(ctx("platform_admin", "owner"), ORG), "platform");
  assert.equal(resolveThreadActor(ctx("consultant", "manager"), ORG), "consultant");
  assert.equal(resolveThreadActor(ctx("client", "owner"), ORG), "client");
  assert.equal(resolveThreadActor(ctx("client", "manager"), ORG), "client");
  assert.equal(resolveThreadActor(ctx("client", "viewer"), ORG), null);
  assert.equal(resolveThreadActor(ctx("consultant", "manager"), "other-org"), null);
});

test("el cliente deja notas visibles; corregir un apartado y las notas internas son del staff", () => {
  assert.deepEqual(noteWriteDecision("client", { kind: "note", target: null, visibleToClient: true }), { ok: true });
  assert.deepEqual(noteWriteDecision("client", { kind: "correction", target: "subject", visibleToClient: true }), {
    ok: false,
    error: "correction_staff_only",
  });
  assert.deepEqual(noteWriteDecision("client", { kind: "note", target: null, visibleToClient: false }), {
    ok: false,
    error: "internal_note_staff_only",
  });
  assert.deepEqual(noteWriteDecision("consultant", { kind: "correction", target: "cta", visibleToClient: true }), { ok: true });
  assert.deepEqual(noteWriteDecision("consultant", { kind: "note", target: null, visibleToClient: false }), { ok: true });
});

test("una correccion sin apartado no vale; las propuestas de IA y las de sistema no se escriben a mano", () => {
  assert.equal(
    noteWriteDecision("consultant", { kind: "correction", target: null, visibleToClient: true }).ok,
    false,
  );
  assert.equal(
    noteWriteDecision("consultant", { kind: "ai_proposal", target: null, visibleToClient: true }).ok,
    false,
  );
  assert.equal(noteWriteDecision("platform", { kind: "system", target: null, visibleToClient: true }).ok, false);
  assert.equal(isStaffActor("platform"), true);
  assert.equal(isStaffActor("client"), false);
});

test("revision: una nota responde a los cambios pedidos; editar lo suyo siempre obliga a revisar", () => {
  assert.equal(reviewStatusAfterClientActivity("changes_requested", "note"), "pending");
  assert.equal(reviewStatusAfterClientActivity("reviewed", "note"), "reviewed");
  assert.equal(reviewStatusAfterClientActivity("reviewed", "edit"), "pending");
  assert.equal(reviewStatusAfterClientActivity("changes_requested", "edit"), "pending");
  assert.equal(reviewStatusAfterClientActivity(null, "edit"), null);
});

test("avisos: lo que hace el cliente le llega al consultor y al reves", () => {
  assert.equal(notificationAudience("client_created"), "consultants");
  assert.equal(notificationAudience("client_edited"), "consultants");
  assert.equal(notificationAudience("client_scheduled"), "consultants");
  assert.equal(notificationAudience("consultant_note"), "client");
  assert.equal(notificationAudience("changes_requested"), "client");
  assert.equal(notificationAudience("reviewed"), "client");
  assert.equal(notificationAudience("scheduled"), "client");
});

test("aviso: nombra al cliente y a la campaña y lleva a la campaña", () => {
  const notification = buildCampaignNotification({
    event: "client_created",
    organizationId: ORG,
    organizationName: "Huerta Norte",
    itemId: "item-1",
    itemTitle: "Oferta del puente",
  });
  assert.equal(notification.title, "Huerta Norte ha creado «Oferta del puente»");
  assert.equal(notification.type, "campaign_review");
  assert.equal(notification.entity_type, "campaign_calendar_item");
  assert.equal(notification.entity_id, "item-1");
  assert.equal(
    notification.action_url,
    `/marketing?section=campanas&organizationId=${ORG}&campaign=item-1`,
  );
  const scheduled = buildCampaignNotification({
    event: "scheduled",
    organizationId: ORG,
    organizationName: null,
    itemId: "item-1",
    itemTitle: "Oferta del puente",
    detail: "Sale el domingo 11 de octubre.",
  });
  assert.equal(scheduled.title, "Tu consultor ha programado «Oferta del puente»");
  assert.equal(scheduled.message, "Sale el domingo 11 de octubre.");
});
