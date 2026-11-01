"use client";

import { buttonVariants } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { Badge, Banner, EYEBROW, Card, CardContent } from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import { useCachedQuery } from "@/lib/use-cached-query";
import styles from "./reportes.module.css";

type Template = {
  id: string;
  version: string;
  name: string;
  category: string;
  applications: string[];
  description: string;
  useWhen: string;
  includedSections: string[];
};
type Catalog = { templates: Template[] };

function ReportTemplateGallery() {
  const { data, error, isLoading } = useCachedQuery<Catalog>("/v1/admin/report-templates");
  const templates = data?.templates ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const selected = useMemo(() => templates.find((item) => item.id === selectedId) ?? templates[0], [templates, selectedId]);

  useEffect(() => {
    if (!selected) return;
    let disposed = false;
    let objectUrl = "";
    setLoadingPreview(true);
    setPreviewError("");
    setPreviewUrl("");
    void apiFetch(`/v1/admin/report-templates/${selected.id}/preview`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo generar la vista previa.");
        objectUrl = URL.createObjectURL(await response.blob());
        if (disposed) URL.revokeObjectURL(objectUrl);
        else setPreviewUrl(objectUrl);
      })
      .catch((cause: unknown) => {
        if (!disposed) setPreviewError(cause instanceof Error ? cause.message : "Error al cargar el PDF.");
      })
      .finally(() => { if (!disposed) setLoadingPreview(false); });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected?.id]);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={EYEBROW}>Biblioteca del copiloto</p>
          <h1>Plantillas de informes PDF</h1>
          <p className={styles.intro}>El copiloto selecciona una plantilla versionada y rellena sus bloques con métricas de las fuentes conectadas.</p>
        </div>
        <Badge tone="brand">7 plantillas · PDF nativo</Badge>
      </header>

      <Banner tone="warn">
        <strong>Previsualizaciones con datos ficticios.</strong> Los importes, nombres y resultados de estos documentos son ejemplos sintéticos. No representan a ninguna organización cliente.
      </Banner>

      {error ? <Card className={styles.error}>
        <CardContent>No se pudo cargar el catálogo: {error}</CardContent>
      </Card> : null}
      {isLoading ? <Card className={styles.loading}>
        <CardContent>Cargando biblioteca de plantillas…</CardContent>
      </Card> : null}
      {!isLoading && !error && selected ? (
        <div className={styles.workspace}>
          <aside className={styles.sidebar} aria-label="Plantillas disponibles">
            <div className={styles.listHeading}>
              <span>Plantillas</span><span>{templates.length}</span>
            </div>
            <nav className={styles.templateList}>
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`${styles.templateButton}${selected.id === template.id ? ` ${styles.selected}` : ""}`}
                  aria-current={selected.id === template.id ? "page" : undefined}
                  onClick={() => setSelectedId(template.id)}
                >
                  <span className={styles.templateName}>{template.name}</span>
                  <span className={styles.templateMeta}>{template.category} · {template.version}</span>
                </button>
              ))}
            </nav>
            <div className={styles.costNote}>
              <strong>Uso por el agente</strong>
              <p>El agente envía un ID corto. El catálogo, las secciones y el diseño viven en backend: no se vuelven a redactar en cada conversación.</p>
            </div>
          </aside>

          <section className={styles.detail} aria-labelledby="selected-template-title">
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.tags}>
                  <Badge tone="neutral">{selected.category}</Badge>
                  <Badge tone="neutral">{selected.version}</Badge>
                  {selected.applications.map((app) => <Badge key={app} tone="brand">{app}</Badge>)}
                </div>
                <h2 id="selected-template-title">{selected.name}</h2>
                <p>{selected.description}</p>
              </div>
              {previewUrl ? (
                <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={previewUrl} download={`${selected.id}-muestra.pdf`}>
                  <Download size={16} aria-hidden /> Descargar
                </a>
              ) : null}
            </div>
            <p className={styles.useWhen}><strong>Se usa cuando:</strong> {selected.useWhen}</p>
            <div className={styles.previewToolbar}>
              <span><FileText size={15} aria-hidden /> Vista previa del documento nativo</span>
              <span>PDF · A4</span>
            </div>
            <div className={styles.preview}>
              {loadingPreview ? <div className={styles.previewState}><RefreshCw className={styles.spin} size={18} aria-hidden /> Preparando PDF…</div> : null}
              {previewError ? <div className={styles.previewState} role="alert">{previewError}</div> : null}
              {previewUrl ? <iframe title={`Vista previa: ${selected.name}`} src={previewUrl} /> : null}
            </div>
            <div className={styles.sections}>
              <strong>Contenido incluido</strong>
              <ul>{selected.includedSections.map((section) => <li key={section}>{section}</li>)}</ul>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminReportsPage() {
  return <PlatformAdminShell title="Plantillas PDF">{() => <ReportTemplateGallery />}</PlatformAdminShell>;
}
