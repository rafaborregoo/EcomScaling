import assert from "node:assert/strict";
import test from "node:test";
import {
  extractKlaviyoActionType,
  extractKlaviyoChannel,
  extractKlaviyoClickUrl,
  extractKlaviyoFlowMessage,
  extractKlaviyoPreviewText,
  extractKlaviyoSubject,
  extractKlaviyoTemplateId,
} from "./klaviyo-sync.js";

test("resuelve el asunto en la forma reciente (definition.content.subject)", () => {
  assert.equal(
    extractKlaviyoSubject({
      definition: { content: { subject: "Rebajas de verano" } },
    }),
    "Rebajas de verano",
  );
});

test("resuelve el asunto en la forma antigua (content.subject)", () => {
  assert.equal(
    extractKlaviyoSubject({ content: { subject: "Bienvenido" } }),
    "Bienvenido",
  );
});

test("devuelve null cuando no hay asunto o la forma es desconocida", () => {
  assert.equal(extractKlaviyoSubject(null), null);
  assert.equal(extractKlaviyoSubject({ definition: { content: {} } }), null);
  assert.equal(extractKlaviyoSubject({ subject_line: "otra ruta" }), null);
  assert.equal(extractKlaviyoSubject({ content: { subject: "   " } }), null);
});

test("saca el id de plantilla de relationships, que es donde vive", () => {
  assert.equal(
    extractKlaviyoTemplateId({
      attributes: {},
      relationships: { template: { data: { type: "template", id: "TPL123" } } },
    }),
    "TPL123",
  );
});

test("cae a las rutas de attributes si una revision lo devuelve ahi", () => {
  assert.equal(
    extractKlaviyoTemplateId({ attributes: { template_id: "TPL9" } }),
    "TPL9",
  );
  assert.equal(
    extractKlaviyoTemplateId({
      attributes: { definition: { template_id: "TPL7" } },
    }),
    "TPL7",
  );
});

test("sin plantilla resoluble devuelve null, no una cadena vacia", () => {
  assert.equal(extractKlaviyoTemplateId({ attributes: {} }), null);
  assert.equal(
    extractKlaviyoTemplateId({
      attributes: {},
      relationships: { template: { data: null } },
    }),
    null,
  );
  assert.equal(
    extractKlaviyoTemplateId({ attributes: { template_id: "  " } }),
    null,
  );
});

test("el canal se lee suelto o dentro de definition", () => {
  assert.equal(extractKlaviyoChannel({ channel: "sms" }), "sms");
  assert.equal(
    extractKlaviyoChannel({ definition: { channel: "email" } }),
    "email",
  );
  // null a proposito: aguas abajo se trata como email en vez de descartarse.
  assert.equal(extractKlaviyoChannel({ definition: {} }), null);
});

test("el preheader sigue las mismas dos rutas que el asunto", () => {
  assert.equal(
    extractKlaviyoPreviewText({
      definition: { content: { preview_text: "Solo hoy" } },
    }),
    "Solo hoy",
  );
  assert.equal(
    extractKlaviyoPreviewText({ content: { preview_text: "Ultimas horas" } }),
    "Ultimas horas",
  );
  assert.equal(extractKlaviyoPreviewText({ content: {} }), null);
});

// Forma REAL observada contra la API (revision 2026-07-15), no la de la
// documentacion: el tipo va en definition.type y el mensaje viene incrustado.
const accionEnvio = {
  created: "2026-09-08T10:36:21+00:00",
  definition: {
    id: "116709103",
    type: "send-email",
    data: {
      status: "live",
      message: {
        id: "XqpjAW",
        name: "Bienvenida — Primeros pasos con la API",
        template_id: "TcwvXm",
        subject_line: "Bienvenido a NORA: conecta tus datos por API",
        preview_text: "Empieza a centralizar tus datos.",
        from_label: "NORA",
      },
    },
  },
};

const accionRetardo = {
  definition: { id: "116709106", type: "time-delay", data: { unit: "days" } },
};

test("el tipo de accion sale de definition.type, no de action_type", () => {
  assert.equal(extractKlaviyoActionType(accionEnvio), "send-email");
  assert.equal(extractKlaviyoActionType(accionRetardo), "time-delay");
  assert.equal(extractKlaviyoActionType({ action_type: "SEND_EMAIL" }), "SEND_EMAIL");
  assert.equal(extractKlaviyoActionType({}), null);
});

test("el mensaje del flujo viene incrustado en la accion de envio", () => {
  const message = extractKlaviyoFlowMessage(accionEnvio);
  assert.equal(message?.id, "XqpjAW");
  assert.equal(message?.template_id, "TcwvXm");
  assert.equal(
    message?.subject_line,
    "Bienvenido a NORA: conecta tus datos por API",
  );
});

test("una accion que no envia no tiene mensaje, y eso es como se distingue", () => {
  assert.equal(extractKlaviyoFlowMessage(accionRetardo), null);
  assert.equal(extractKlaviyoFlowMessage({}), null);
  // Un array no es un mensaje aunque sea un objeto para typeof.
  assert.equal(
    extractKlaviyoFlowMessage({ definition: { data: { message: [] } } }),
    null,
  );
});

test("la URL de un click se busca en las claves que Klaviyo usa de verdad", () => {
  assert.equal(
    extractKlaviyoClickUrl({ URL: "https://tienda.com/rebajas" }),
    "https://tienda.com/rebajas",
  );
  assert.equal(extractKlaviyoClickUrl({ url: "https://x.com/a" }), "https://x.com/a");
  assert.equal(extractKlaviyoClickUrl({ $url: "https://x.com/b" }), "https://x.com/b");
});

test("un click sin URL devuelve null para que el sync lo registre", () => {
  // Si esto pasa en produccion el log dice las claves reales: el evento no
  // sirve de nada sin destino, y suponerlo seria peor que no tenerlo.
  assert.equal(extractKlaviyoClickUrl({ permission_name: "x" }), null);
  assert.equal(extractKlaviyoClickUrl(null), null);
  assert.equal(extractKlaviyoClickUrl({ URL: "   " }), null);
});
