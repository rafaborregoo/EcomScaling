import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketingBrief } from "./marketing-brief.js";

test("compone un brief estructurado para Claude sin perder las indicaciones", () => {
  const brief = buildMarketingBrief({
    channel: "email_klaviyo",
    objective: "conversion",
    audience: " clientes nuevos ",
    offer: "",
    tone: "brand",
    cta: " Ver colección ",
    instructions: "No inventar descuentos.",
  });

  assert.match(brief, /Objetivo: conversion/);
  assert.match(brief, /Canal de destino: email_klaviyo/);
  assert.match(brief, /Audiencia: clientes nuevos/);
  assert.match(brief, /Oferta o producto: No especificada; no inventar condiciones/);
  assert.match(brief, /CTA preferido: Ver colección/);
  assert.match(brief, /Indicaciones adicionales: No inventar descuentos\./);
});

test("marca datos opcionales ausentes sin inventarlos", () => {
  const brief = buildMarketingBrief({
    channel: "meta_ads",
    objective: "retention",
    audience: "",
    offer: "",
    tone: "brand",
    cta: "",
    instructions: "Revisar tono antes de aprobar.",
  });

  assert.match(brief, /No especificada; identificar supuestos/);
  assert.match(brief, /Proponer uno coherente con el objetivo/);
});
