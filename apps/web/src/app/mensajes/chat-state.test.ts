import assert from "node:assert/strict";
import { test } from "node:test";
import { chatFilter, isWaiting, waitLabel } from "./chat-state";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const thread = (author: string, minutesAgo: number, unread = 0) => ({
  unread_count: unread,
  last_message: { author_kind: author, created_at: new Date(NOW - minutesAgo * 60_000).toISOString() },
});

test("al consultor le espera quien escribió el último; al cliente nadie", () => {
  assert.equal(isWaiting("client", false), true);
  assert.equal(isWaiting("consultant", false), false);
  assert.equal(isWaiting("platform", false), false);
  assert.equal(isWaiting(undefined, false), false);
  assert.equal(isWaiting("consultant", true), false);
});

test("«en silencio» empieza a los 14 días y excluye hilos sin mensajes", () => {
  assert.equal(chatFilter(thread("client", 13 * 1440), "quiet", false, NOW), false);
  assert.equal(chatFilter(thread("client", 14 * 1440), "quiet", false, NOW), true);
  assert.equal(chatFilter({ unread_count: 0, last_message: null }, "quiet", false, NOW), false);
});

test("sin leer y todos", () => {
  assert.equal(chatFilter(thread("client", 5, 2), "unread", false, NOW), true);
  assert.equal(chatFilter(thread("client", 5, 0), "unread", false, NOW), false);
  assert.equal(chatFilter({ unread_count: 0, last_message: null }, "all", false, NOW), true);
});

test("la espera se dice en minutos, horas o días", () => {
  const ago = (m: number) => new Date(NOW - m * 60_000).toISOString();
  assert.equal(waitLabel(ago(0), NOW), "te espera 1 min");
  assert.equal(waitLabel(ago(45), NOW), "te espera 45 min");
  assert.equal(waitLabel(ago(300), NOW), "te espera 5 h");
  assert.equal(waitLabel(ago(3 * 1440), NOW), "te espera 3 d");
});
