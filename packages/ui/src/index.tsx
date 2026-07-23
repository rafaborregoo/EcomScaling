"use client";

// Design system v2 "Libro Mayor" (FE-08). Cada componente vive en su propio
// archivo bajo ./components (ADR-0013) -- este barrel solo reexporta, para
// que el import publico (`@ecomscaling/ui`) no cambie para nadie que ya lo
// consuma.
export { cn } from "./components/cn.js";
export { Button } from "./components/button.js";
export { Card, Section } from "./components/card.js";
export { Stat } from "./components/stat.js";
export type { Tone } from "./components/tone.js";
export { Badge } from "./components/badge.js";
export { Banner } from "./components/banner.js";
export { Field } from "./components/field.js";
export { Input } from "./components/input.js";
export { Select } from "./components/select.js";
export { Textarea } from "./components/textarea.js";
export { LoadingBlock } from "./components/loading-block.js";
export { ErrorBlock } from "./components/error-block.js";
export { EmptyState } from "./components/empty-state.js";
export type { SyncState } from "./components/sync-state-badge.js";
export { SyncStateBadge } from "./components/sync-state-badge.js";
export type { TabItem } from "./components/tabs.js";
export { Tabs } from "./components/tabs.js";
export { Pagination } from "./components/pagination.js";
export type { ComboboxOption } from "./components/combobox.js";
export { Combobox } from "./components/combobox.js";
