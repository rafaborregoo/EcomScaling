import assert from "node:assert/strict";
import test from "node:test";
import { isKnowledgeAuditDocumentInScope, knowledgeAuditScopeFilter } from "./knowledge-audit-scope.js";
const organizationId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
test("audit includes shared methodology and own client documents without local private or foreign documents", () => {
  assert.equal(isKnowledgeAuditDocumentInScope({ visibility: "global", audience: "consultant_only" }, organizationId), true);
  assert.equal(isKnowledgeAuditDocumentInScope({ visibility: "global", audience: "client_visible" }, organizationId), true);
  assert.equal(isKnowledgeAuditDocumentInScope({ visibility: "global", audience: "system_only" }, organizationId), false);
  assert.equal(isKnowledgeAuditDocumentInScope({ visibility: "organization", audience: "client_visible", organization_id: organizationId }, organizationId), true);
  assert.equal(isKnowledgeAuditDocumentInScope({ visibility: "organization", audience: "consultant_only", organization_id: organizationId }, organizationId), false);
  assert.equal(isKnowledgeAuditDocumentInScope({ visibility: "organization", audience: "client_visible", organization_id: "other" }, organizationId), false);
});
test("raw PostgREST scope rejects injected organization filters", () => {
  assert.throws(() => knowledgeAuditScopeFilter("x),visibility.eq.global"), /invalid_organization_id/);
  assert.ok(knowledgeAuditScopeFilter(organizationId).includes(`organization_id.eq.${organizationId}`));
});
