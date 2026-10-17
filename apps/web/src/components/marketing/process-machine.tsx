import { cylinder, depthOf, iso, knurl, onTop, pathOf, slabOf, type Plane, type Point3, type SolidPaths } from "./anatomy/iso-kit";
import { Solid } from "./anatomy/react/draw";
import { useInView, useLoop, useStillness } from "./anatomy/react/live";
import { tubePieces, type TubePiece } from "./anatomy/geometry/tube.mjs";
import { sphereOf } from "./anatomy/geometry/lathe.mjs";
import { useRef, type CSSProperties } from "react";

// Each chapter is a small diorama of everyday objects (a shop, a phone, a
// mailbox, a table with people) instead of machinery: the drawing has to be
// understood by a shop owner at a glance. Built from Anatomy's isometric solids.

type Opts = { r?: number; source?: string; float?: boolean; layer?: number; alpha?: number };
type Part = { flat?: boolean; shape?: SolidPaths; tube?: TubePiece[]; lines: string[]; ridges?: string[]; color: string; depth: number; source?: string; float?: boolean; alpha?: number };
type Kit = {
  block: (x: number, y: number, w: number, d: number, z: number, h: number, color: string, o?: Opts) => Part;
  disc: (x: number, y: number, z: number, radius: number, h: number, color: string, o?: Opts & { ridged?: boolean }) => Part;
  ball: (x: number, y: number, z: number, radius: number, color: string, o?: Opts) => Part;
  rod: (points: Point3[], radius: number, color: string, o?: Opts) => Part;
  top: (points: Plane[], z: number) => string;
};
type Painter = (k: Kit) => void;

const P = { origin: [420, 170] as [number, number], scale: 1.55 };
const c = {
  ink: "#33403c", green: "#3d3b3a", shopify: "#3f9c6d", meta: "#2f6fe0", klaviyo: "#3a3836", coral: "#e0795b",
  gold: "#e8b94a", sand: "#efe6d6", wood: "#c99a6b", paper: "#ffffff", cream: "#f6f2ea", sky: "#cfe4f2", mint: "#e6e4e2",
  grey: "#a9b8b2", skin: "#f1d3b6", card: "#d8b48a",
};
const routeColors = { shopify: c.shopify, meta: c.meta, klaviyo: c.klaviyo };

function shades(color: string): CSSProperties {
  return {
    "--anatomy-paper": color,
    "--anatomy-top": `color-mix(in srgb, ${color} 80%, white)`,
    "--anatomy-shade-0": `color-mix(in srgb, ${color} 62%, #14231f)`,
    "--anatomy-shade-1": `color-mix(in srgb, ${color} 76%, #14231f)`,
    "--anatomy-shade-2": `color-mix(in srgb, ${color} 88%, #14231f)`,
    "--anatomy-shade-3": color,
  } as CSSProperties;
}

function kitFor(parts: Part[]): Kit {
  const add = (part: Omit<Part, "lines">) => { const full = { ...part, lines: [] }; parts.push(full); return full; };
  return {
    block: (x, y, w, d, z, h, color, o = {}) => add({ flat: Math.min(w, d) <= 2 && h > 2, shape: slabOf({ x, y, w, d, r: o.r ?? 2 }, z, h, P, 4), color, source: o.source, float: o.float, alpha: o.alpha, depth: (o.layer ?? z) * 10000 + depthOf([x + w / 2, y + d / 2, z + h / 2], P) }),
    disc: (x, y, z, radius, h, color, o = {}) => add({ shape: cylinder(x, y, radius, z, h, P, 28), ridges: o.ridged ? [knurl(x, y, radius, z, z + h, 18, P)] : undefined, color, source: o.source, float: o.float, alpha: o.alpha, depth: (o.layer ?? z) * 10000 + depthOf([x, y, z + h / 2], P) }),
    ball: (x, y, z, radius, color, o = {}) => add({ shape: sphereOf([x, y, z], radius, P, { steps: 36 }), color, source: o.source, float: o.float, depth: (o.layer ?? z) * 10000 + depthOf([x, y, z], P) }),
    rod: (points, radius, color, o = {}) => {
      const mid = points[Math.floor(points.length / 2)]!;
      return add({ tube: tubePieces(points, radius, P, { spacing: 2 }), color, source: o.source, float: o.float, depth: (o.layer ?? Math.min(...points.map((point) => point[2]))) * 10000 + depthOf(mid, P) });
    },
    top: (points, z) => onTop(points, z, P),
  };
}

// ── Reusable objects ────────────────────────────────────────────────────────

function shop(k: Kit, x: number, y: number, z = 0, source?: string) {
  const o = { source };
  k.block(x, y, 46, 34, z, 24, c.cream, { ...o, r: 1 });
  k.block(x - 2, y - 2, 50, 38, z + 24, 4, c.shopify, o);
  k.block(x + 46, y + 4, .8, 12, z + 5, 10, c.sky, { ...o, r: .5 });
  k.block(x + 46, y + 20, .8, 9, z, 15, "#2d6b4d", { ...o, r: .5 });
  k.block(x + 8, y + 34, 28, .8, z + 5, 10, c.sky, { ...o, r: .5 });
  for (let i = 0; i < 6; i++) k.block(x + 46, y + 1 + i * 5.3, 5, 5.3, z + 17, 3, i % 2 ? c.paper : c.shopify, { ...o, r: 0 });
  for (let i = 0; i < 8; i++) k.block(x + 1 + i * 5.6, y + 34, 5.6, 5, z + 17, 3, i % 2 ? c.paper : c.shopify, { ...o, r: 0 });
  k.block(x + 15, y + 9, 16, 14, z + 28, 9, c.paper, { ...o, r: 3 });
  k.block(x + 19, y + 13, 8, 6, z + 37, .6, c.shopify, { ...o, r: 1 });
}

function phone(k: Kit, x: number, y: number, z: number, accent: string, source?: string) {
  const o = { source };
  k.block(x, y, 5, 26, z, 44, c.ink, { ...o, r: 3 });
  k.block(x + 5, y + 2, .5, 22, z + 3, 38, c.paper, { ...o, r: 1.5 });
  k.block(x + 5.5, y + 4, .5, 18, z + 22, 15, `color-mix(in srgb, ${accent} 35%, white)`, { ...o, r: 1 });
  k.block(x + 5.5, y + 8, .5, 10, z + 26, 7, accent, { ...o, r: 3 });
  k.block(x + 5.5, y + 4, .5, 14, z + 17, 1.6, c.grey, { ...o, r: 0 });
  k.block(x + 5.5, y + 4, .5, 9, z + 13.5, 1.6, c.grey, { ...o, r: 0 });
  k.block(x + 5.5, y + 4, .5, 11, z + 6, 4.5, accent, { ...o, r: 1.5 });
}

function envelope(k: Kit, x: number, y: number, z: number, o: Opts = {}, color = c.paper, s = 1) {
  const part = k.block(x, y, 22 * s, 15 * s, z, 1.6, color, { ...o, r: 1 });
  part.lines.push(k.top([[x + .6, y + .6], [x + 11 * s, y + 8 * s], [x + 22 * s - .6, y + .6]], z + 1.6));
  return part;
}

function mailbox(k: Kit, x: number, y: number, z = 0, source?: string, s = 1) {
  const o = { source };
  k.block(x + 8 * s, y + 5 * s, 4 * s, 4 * s, z, 18 * s, c.wood, { ...o, r: .5 });
  k.block(x, y, 22 * s, 14 * s, z + 18 * s, 13 * s, c.klaviyo, { ...o, r: 5 * s });
  k.block(x + 22 * s, y + 3 * s, .6, 8 * s, z + 22 * s, 4 * s, "#151515", { ...o, r: 1 });
  k.block(x + 15 * s, y + 14 * s, 1.4, 1.4, z + 22 * s, 15 * s, c.coral, { ...o, r: .3 });
  k.block(x + 16.4 * s, y + 14 * s, 7 * s, .9, z + 31 * s, 6 * s, c.coral, { ...o, r: .5 });
}

function laptop(k: Kit, x: number, y: number, z: number, bars: number[], accent = c.green) {
  k.block(x, y, 34, 46, z, 3, "#cdd8d3", { r: 3 });
  k.block(x + 15, y + 6, 15, 34, z + 3, .5, "#aebcb6", { r: 1 });
  k.block(x, y + 1, 3, 44, z + 3, 30, c.ink, { r: 2 });
  k.block(x + 3, y + 3, .5, 40, z + 6, 25, c.mint, { r: 1 });
  bars.forEach((h, i) => k.block(x + 3.5, y + 8 + i * 7, .5, 4, z + 9, h, i === bars.length - 1 ? accent : "#7fa89b", { r: 0 }));
}

function coins(k: Kit, x: number, y: number, z: number, count: number, o: Opts = {}) {
  for (let i = 0; i < count; i++) k.disc(x, y, z + i * 2.4, 7, 2.4, c.gold, { ...o, ridged: true });
}

function person(k: Kit, x: number, y: number, z: number, shirt: string, o: Opts = {}, tall = 15) {
  k.disc(x, y, z, 4.4, tall, shirt, o);
  k.ball(x, y, z + tall + 5, 4, c.skin, o.layer === undefined ? o : { ...o, layer: o.layer + 1 });
}

// Upright speech bubble facing the viewer's right, with its little tail.
function bubble(k: Kit, x: number, y: number, z: number, w: number, h: number, color: string, lines: number) {
  const o = { float: true, layer: z };
  k.block(x, y, 2, w, z, h, color, { ...o, r: 1 });
  k.block(x, y + w - 9, 2, 5, z - 4, 5, color, { ...o, r: .5 });
  for (let i = 0; i < lines; i++) k.block(x + 2, y + 4, .5, w - 9 - i * 6, z + h - 5 - i * 4.5, 1.6, `color-mix(in srgb, ${color} 50%, ${c.ink})`, { ...o, r: 0 });
}

function boxes(k: Kit, x: number, y: number, z: number, stack: number) {
  for (let i = 0; i < stack; i++) {
    const part = k.block(x, y, 20, 18, z + i * 12, 12, c.card, { r: 1 });
    part.lines.push(k.top([[x + 10, y], [x + 10, y + 18]], z + i * 12 + 12));
  }
}

function flag(k: Kit, x: number, y: number, z: number, color: string) {
  k.rod([[x, y, z], [x, y, z + 32]], .8, c.ink, { layer: z + 1 });
  k.block(x + .8, y - .4, 13, .8, z + 23, 9, color, { r: .5, layer: z + 23 });
}

function calendar(k: Kit, x: number, y: number, z: number, marked: number) {
  k.block(x, y, 32, 28, z, 2, c.paper, { r: 2 });
  k.block(x, y, 8, 28, z, 2.6, c.coral, { r: 2 });
  for (let i = 0; i < 12; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    k.block(x + 11 + row * 7, y + 3 + col * 6.3, 4, 4, z + 2, .5, i === marked ? c.green : "#d5ddd9", { r: 1 });
  }
}

function chart(k: Kit, x: number, y: number, z: number, heights: number[], alertAt = -1) {
  k.block(x, y, 18 + heights.length * 9, 22, z, 2, c.paper, { r: 3 });
  heights.forEach((h, i) => k.block(x + 6 + i * 9, y + 8, 5, 6, z + 2, h, i === alertAt ? c.coral : i === heights.length - 1 ? c.green : "#b3afac", { r: 1 }));
}

// ── Chapters ────────────────────────────────────────────────────────────────

const connect: Painter = (k) => {
  shop(k, 14, 10, 0, "shopify");
  k.block(20, 68, 18, 34, 0, 2, "#d3ddd9", { source: "meta" });
  phone(k, 24, 72, 2, c.meta, "meta");
  mailbox(k, 22, 124, 0, "klaviyo");
  envelope(k, 48, 122, 36, { source: "klaviyo", float: true });
  laptop(k, 140, 62, 0, [8, 12, 10, 16, 20]);
};

const numbers: Painter = (k) => {
  // A board everyone can read: bars that grow, coins that pile up beside it.
  k.block(40, 22, 130, 5, 0, 4, c.wood, { r: 1 });
  k.block(44, 23, 122, 3, 4, 52, c.ink, { r: 2 });
  k.block(47, 26, 116, .6, 8, 44, c.mint, { r: 1 });
  [12, 18, 15, 24, 30, 36].forEach((h, i) => k.block(56 + i * 17, 26.6, 9, .6, 13, h, i === 5 ? c.green : "#b3afac", { r: 1 }));
  [2, 4, 6, 9].forEach((n, i) => coins(k, 70 + i * 26, 64, 0, n));
  calendar(k, 22, 104, 0, 6);
  const receipt = k.block(110, 104, 34, 26, 0, 1.2, c.paper, { r: 1 });
  for (let i = 0; i < 5; i++) receipt.lines.push(k.top([[114 + i * 6, 108], [114 + i * 6, i % 2 ? 120 : 126]], 1.2));
};

const store: Painter = (k) => {
  k.block(16, 18, 6, 70, 0, 40, c.sand, { r: 1 });
  [8, 22, 36].forEach((z) => k.block(22, 18, 18, 70, z, 2, c.wood, { r: 1 }));
  [0, 1, 2, 3].forEach((i) => { k.block(25, 22 + i * 16, 10, 10, 10, 9, [c.shopify, c.coral, c.sky, c.gold][i]!, { r: 1 }); k.disc(31, 28 + i * 16, 24, 4, 9, [c.cream, c.mint, c.sand, c.paper][i]!); });
  [0, 1, 2].forEach((i) => k.block(25, 24 + i * 20, 12, 14, 38, 7, [c.mint, c.cream, c.sky][i]!, { r: 2 }));
  const bag = k.block(84, 64, 26, 14, 0, 26, c.shopify, { r: 1.5 });
  bag.lines.push(k.top([[89, 71], [105, 71]], 26));
  k.rod([[89, 71, 26], [92, 71, 33], [102, 71, 33], [105, 71, 26]], .9, "#2d6b4d", { layer: 26 });
  boxes(k, 150, 30, 0, 3);
  boxes(k, 174, 52, 0, 2);
  boxes(k, 140, 86, 0, 1);
  [0, 1, 2].forEach((i) => person(k, 74 + i * 14, 120 - i * 6, 0, [c.coral, c.meta, c.gold][i]!));
};

const ads: Painter = (k) => {
  k.block(30, 34, 22, 46, 0, 3, "#d3ddd9", { r: 3 });
  k.block(34, 38, 8, 38, 3, 66, c.ink, { r: 4 });
  k.block(42, 41, .6, 32, 7, 58, c.paper, { r: 2 });
  k.block(42.6, 44, .6, 26, 34, 24, "#bcd3f6", { r: 1.5 });
  k.block(42.6, 50, .6, 14, 40, 12, c.meta, { r: 5 });
  k.block(42.6, 44, .6, 20, 27, 2, c.grey, { r: 0 });
  k.block(42.6, 44, .6, 13, 22, 2, c.grey, { r: 0 });
  k.block(42.6, 44, .6, 16, 11, 6, c.meta, { r: 2 });
  [22, 17, 12, 7, 3].forEach((r, i) => k.disc(146, 60, i * 1.6, r, 1.6, i % 2 ? c.paper : c.coral, { layer: i }));
  k.rod([[172, 34, 30], [147, 59, 9]], 1, c.ink, { layer: 9 });
  k.block(170, 32, 5, 5, 28, 5, c.coral, { r: .5, layer: 30 });
  coins(k, 74, 108, 0, 6);
  coins(k, 94, 124, 0, 3);
  chart(k, 128, 108, 0, [8, 14, 11, 22]);
};

const email: Painter = (k) => {
  mailbox(k, 26, 96, 0, undefined, 1.5);
  envelope(k, 64, 98, 44, { float: true }, c.paper, 1.2);
  [0, 1, 2].forEach((i) => {
    const x = 92 + i * 34, y = 92 - i * 30;
    k.disc(x + 15, y + 10, 0, 19, 2, i === 2 ? c.mint : "#e3ebe7");
    envelope(k, x, y, 2, {}, i === 1 ? "#fdf1ea" : c.paper, 1.4);
  });
  k.rod([[122, 92, 2], [132, 78, 2]], .7, c.grey, { layer: 1 });
  k.rod([[156, 62, 2], [166, 48, 2]], .7, c.grey, { layer: 1 });
  chart(k, 116, 128, 0, [9, 15, 12]);
};

const insight: Painter = (k) => {
  chart(k, 40, 46, 0, [18, 24, 21, 30, 9, 27], 4);
  const lens = { x: 84, y: 60, z: 46 };
  k.disc(lens.x, lens.y, lens.z, 19, .6, "#d9eef7", { layer: 60, alpha: .45 });
  k.rod(Array.from({ length: 41 }, (_, i) => [lens.x + 19 * Math.cos(i / 40 * Math.PI * 2), lens.y + 19 * Math.sin(i / 40 * Math.PI * 2), lens.z] as Point3), 1.8, c.ink, { layer: 61 });
  k.rod([[lens.x + 14, lens.y - 14, lens.z], [lens.x + 34, lens.y - 34, lens.z - 4]], 2.6, c.wood, { layer: 62 });
  const note = k.block(140, 96, 30, 28, 0, 1.2, "#ffe7a3", { r: 1 });
  note.lines.push(k.top([[146, 102], [146, 118]], 1.2), k.top([[152, 102], [152, 112]], 1.2));
  k.disc(160, 114, 1.2, 3.6, 1.4, c.coral);
  k.disc(108, 128, 0, 4, 5, c.grey);
  k.ball(108, 128, 12, 7.5, "#ffe08a");
};

const copilot: Painter = (k) => {
  k.block(40, 40, 50, 74, 0, 4, "#cdd8d3", { r: 3 });
  k.block(58, 48, 26, 58, 4, .5, "#aebcb6", { r: 1 });
  k.block(40, 41, 4, 72, 4, 48, c.ink, { r: 2 });
  k.block(44, 44, .6, 66, 8, 42, c.paper, { r: 1 });
  k.block(44.6, 48, .6, 36, 38, 9, c.mint, { r: 1 });
  k.block(44.6, 70, .6, 36, 13, 20, "#eef3f1", { r: 1 });
  [6, 10, 8, 14].forEach((h, i) => k.block(44.8, 76 + i * 6, .6, 3.5, 16, h, i === 3 ? c.green : "#b3afac", { r: 0 }));
  bubble(k, 120, 28, 52, 44, 18, c.paper, 2);
  bubble(k, 136, 64, 30, 50, 22, c.mint, 3);
  [0, 1, 2].forEach((i) => {
    const sheet = k.block(150 + i * 1.5, 112 - i * 1.5, 30, 38, i * 1.4, 1.4, c.paper, { r: 1, layer: i });
    if (i === 2) [0, 1, 2, 3].forEach((n) => sheet.lines.push(k.top([[158 + n * 5, 113], [158 + n * 5, 136 - n * 4]], 4.2)));
  });
  person(k, 30, 140, 0, c.meta);
};

const path: Painter = (k) => {
  const stones: Array<[number, number]> = [[34, 150], [58, 132], [76, 110], [96, 90], [118, 70], [140, 52], [164, 34]];
  stones.forEach(([x, y], i) => k.disc(x, y, 0, 9, 3 + i * 4.5, i === 2 || i === 4 ? c.mint : "#e3ebe7", { layer: 0 }));
  const last = stones.length - 1;
  flag(k, stones[last]![0], stones[last]![1], 3 + last * 4.5, c.coral);
  [2, 4].forEach((i) => flag(k, stones[i]![0] + 4, stones[i]![1] - 4, 3 + i * 4.5, c.green));
  person(k, stones[0]![0], stones[0]![1], 3, c.gold, { layer: 3 });
  calendar(k, 150, 112, 0, 9);
};

const campaign: Painter = (k) => {
  k.block(30, 30, 8, 82, 0, 4, c.wood, { r: 1 });
  k.block(34, 34, 4, 74, 4, 56, c.ink, { r: 2 });
  k.block(38, 37, .6, 68, 8, 50, c.paper, { r: 2 });
  k.block(38.6, 41, .6, 60, 32, 22, "#f6d8cc", { r: 1.5 });
  k.block(38.6, 52, .6, 18, 36, 12, c.coral, { r: 6 });
  k.block(38.6, 41, .6, 44, 25, 2, c.grey, { r: 0 });
  k.block(38.6, 41, .6, 32, 20, 2, c.grey, { r: 0 });
  k.block(38.6, 41, .6, 22, 11, 6, c.green, { r: 2 });
  [c.coral, c.gold, c.green, c.meta].forEach((color, i) => k.disc(76 + i * 12, 128 - i * 4, 0, 5, 3, color));
  envelope(k, 112, 40, 34, { float: true }, c.paper, 1.3);
  phone(k, 150, 70, 0, c.meta);
};

const team: Painter = (k) => {
  const t = { x: 110, y: 92 };
  person(k, t.x - 46, t.y - 6, 0, c.green, {}, 24);
  person(k, t.x - 28, t.y - 38, 0, c.coral, {}, 24);
  person(k, t.x + 10, t.y - 46, 0, c.meta, {}, 24);
  k.disc(t.x, t.y, 0, 3, 16, c.ink, { layer: 0 });
  k.disc(t.x, t.y, 16, 38, 3, c.wood, { layer: 16 });
  person(k, t.x + 50, t.y - 10, 0, c.gold, { layer: 20 }, 24);
  const sheet = k.block(t.x - 14, t.y - 12, 22, 16, 19, .8, c.paper, { r: 1 });
  [0, 1, 2].forEach((n) => sheet.lines.push(k.top([[t.x - 9 + n * 5, t.y - 9], [t.x - 9 + n * 5, t.y + 1 - n * 2]], 19.8)));
  chart(k, t.x - 2, t.y + 8, 19, [4, 6, 9]);
  [[t.x - 18, t.y + 14], [t.x + 16, t.y - 18]].forEach(([x, y]) => { k.disc(x!, y!, 19, 2.6, 4, c.paper); });
  bubble(k, 150, 18, 58, 40, 18, c.mint, 2);
};

export const scenes: Painter[] = [connect, numbers, store, ads, email, insight, copilot, path, campaign, team];

function Scene({ index, motionPaused }: { index: number; motionPaused: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(svgRef);
  const still = useStillness();
  const elapsed = useRef(0);
  const pulses = useRef<Array<SVGCircleElement | null>>([]);
  const routes = useRef<Array<SVGPathElement | null>>([]);
  const lengths = useRef<number[]>([]);
  const moving = index === 0 && inView && !still && !motionPaused;
  useLoop((dt, calm) => {
    if (!moving || calm) return false;
    elapsed.current = (elapsed.current + dt * .22) % 1;
    pulses.current.forEach((pulse, i) => {
      const route = routes.current[i];
      if (!pulse || !route) return;
      const length = lengths.current[i] ?? (lengths.current[i] = route.getTotalLength());
      const point = route.getPointAtLength(length * ((elapsed.current + i / 3) % 1));
      pulse.setAttribute("cx", point.x.toFixed(1));
      pulse.setAttribute("cy", point.y.toFixed(1));
    });
    return true;
  }, moving);

  const parts: Part[] = [];
  const k = kitFor(parts);
  const ground = k.block(0, 0, 220, 170, -8, 8, "#e6eeea", { r: 16 });
  ground.depth = -Infinity;
  scenes[index]!(k);
  const flows = index === 0
    ? ([
        ["shopify", [[60, 27, 1.5], [96, 27, 1.5], [116, 70, 1.5], [140, 72, 1.5]]],
        ["meta", [[40, 85, 1.5], [96, 85, 1.5], [140, 85, 1.5]]],
        ["klaviyo", [[33, 139, 1.5], [96, 139, 1.5], [116, 98, 1.5], [140, 98, 1.5]]],
      ] as Array<[keyof typeof routeColors, Point3[]]>).map(([source, points]) => ({
        source, color: routeColors[source],
        path: pathOf(points.map((point) => iso(point, P))),
        tubes: tubePieces(points, 1.3, P, { spacing: 3, rings: { pitch: 6, tone: "mid" } }),
      }))
    : [];
  const sorted = parts.sort((a, b) => a.depth - b.depth);
  const draw = (part: Part, i: number) => (
    <g key={i} className={part.float ? "enoraProcess_part enoraProcess_float" : "enoraProcess_part"} style={{ animationDelay: `${Math.min(i * 8, 360)}ms`, opacity: part.alpha }} data-source-app={part.source}>
      <g style={shades(part.color)}>
        {part.shape && <Solid paths={part.shape} tone="mid" crease="faint" flat={part.flat} />}
        {part.tube?.map((piece, n) => <g key={n}><path className="tb-body" d={piece.body} />{piece.wide && <><path className="tb-shine" d={piece.shine} /><path className="tb-shade" d={piece.shade} /></>}<path className="enoraProcess_tubeEdge" d={piece.edges} /></g>)}
        {part.ridges?.map((d, n) => <path key={`r${n}`} d={d} className="enoraProcess_ridge" />)}
        {part.lines.map((d, n) => <path key={`l${n}`} d={d} className="enoraProcess_mark" />)}
      </g>
    </g>
  );
  return <svg ref={svgRef} className="enoraProcess_scene" viewBox="160 70 600 420" aria-hidden="true" focusable="false">
    {draw(sorted[0]!, 0)}
    {flows.map((route) => <g key={route.source} data-source-app={route.source} style={{ ...shades(route.color), "--anatomy-hi": "#ffffff" } as CSSProperties}>
      {route.tubes.map((tube, i) => <g key={i}>
        <path className="tb-body" d={tube.body} />
        {tube.wide && <><path className="tb-shine" d={tube.shine} /><path className="tb-shade" d={tube.shade} /></>}
        {tube.rings.map((ring, n) => <path key={n} className="tb-ring" d={ring.d} opacity={ring.alpha.toFixed(2)} />)}
        <path className="enoraProcess_tubeEdge" d={tube.edges} />
      </g>)}
    </g>)}
    {sorted.slice(1).map((part, i) => draw(part, i + 1))}
    {flows.map((route, i) => <g key={route.source} data-source-app={route.source}>
      <path ref={(node) => { routes.current[i] = node; }} d={route.path} fill="none" stroke="none" />
      <circle ref={(node) => { pulses.current[i] = node; }} className="enoraProcess_flowPulse" r="3.4" fill={route.color} stroke="#ffffff" strokeWidth="1" cx={iso([140, 85, 1.5], P)[0]} cy={iso([140, 85, 1.5], P)[1]} />
    </g>)}
  </svg>;
}

export function ProcessMachine({ stage, selectedSource = null, motionPaused = false }: { stage: number; selectedSource?: number | null; motionPaused?: boolean }) {
  const index = Math.max(0, Math.min(scenes.length - 1, stage));
  return <div className="enoraProcess_machine" data-machine-active={index} data-source-selected={selectedSource === null ? undefined : ["shopify", "meta", "klaviyo"][selectedSource]} key={index} aria-hidden="true">
    <div className="enoraProcess_layer enoraProcess_layerEntering"><Scene index={index} motionPaused={motionPaused} /></div>
  </div>;
}
