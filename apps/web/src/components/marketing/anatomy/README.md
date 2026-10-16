# Anatomy geometry core

Upstream: https://github.com/wheresryan22/anatomy
Source: `kit/iso-kit.ts`, downloaded 2026-10-16 from main (HEAD at retrieval: `e9488296a44211c42701ff71705b7901470ec78f`). MIT license retained in LICENSE. The source file is unmodified. The advanced connection scene also uses upstream `kit/tube.mjs`, `kit/lathe.mjs`, and `kit/iso-kit.mjs` in `geometry/` for shaded, ringed three-dimensional cable meshes.

Used by `../process-machine.tsx` to build ten isometric dioramas of everyday objects (shop, phone, mailbox, coins, people around a table) for the public story; `geometry/lathe.d.mts` types the one export it uses, `sphereOf`. It now uses Anatomy’s React `Solid` and `Line` primitives and its `useInView`, `useLoop`, and `useStillness` runtime. The Shopify, Meta, and Klaviyo flows follow the projected SVG cable paths with one capped animation loop, stop when the illustration leaves view, pause from the page control, and honor reduced-motion preferences. The source copies are local, MIT-licensed, and require no package install or runtime fetch. The React helpers are kept in `react/`; their only local adjustments are lint-safe effect dependencies and removal of the unused state-driven easing hook. `../process-story.tsx` controls chapter state and scrolling; page styles remain locally scoped.

The current story uses SVG/isometric mode and Anatomy’s tube mesh for the three connection routes. It does not use WebGL shaders or the beta full-3D mode; those would need a separate visual direction and measured performance budget. The figures explain the product concept and are not literal diagrams of backend architecture or proof of live provider availability.

The drawings are conceptual product illustrations, not the physical architecture or measured performance of E-NORA. Their interface marks are schematic, with no financial values.
