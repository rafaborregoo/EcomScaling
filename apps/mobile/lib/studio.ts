// El modelo del Estudio de contenido es el mismo que el de la web (bloques -> HTML de email): se importa de allí en vez
// de copiarlo, para que una plantilla guardada en un sitio se abra y se renderice igual en el otro.
export * from "../../web/src/app/marketing/studio/studio-design";
export { collectMergeTokens } from "../../web/src/app/marketing/template-fields";
export { buildMarketingBrief } from "../../web/src/lib/marketing-brief";
export * from "../../web/src/app/marketing/studio/studio-ai-ops";
