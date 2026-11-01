"use client";

import { useCallback, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { AVATAR_TYPES, avatarFileProblem, avatarFileExtension } from "@/lib/avatar-file";
import { Avatar, AvatarFallback, AvatarImage, avatarInitials, Button, UploadButton, cn, Card, CardContent } from "@/components/ui";

// Avatares alojados por HeroUI. Si alguno no carga, el AvatarFallback con las
// iniciales del nombre lo cubre. Comprobados el 2026-10-26: yellow y pink
// devolvían 403, por eso no están.
export const AVATAR_PRESETS = [
  "blue",
  "green",
  "purple",
  "red",
  "orange",
  "black",
].map(
  (color) =>
    `https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/${color}.jpg`,
);

// Selector de avatar reutilizable (onboarding y /perfil): rejilla de presets +
// subida de foto propia al bucket `avatars/<uid>/`. Controlado por value/onChange;
// guardar en el perfil es cosa de quien lo usa.
export function AvatarPicker({
  name,
  value,
  onChange,
  userId,
  onUploadingChange,
}: {
  name: string;
  value: string | null;
  /** `null` = sin foto: se ven las iniciales. */
  onChange: (url: string | null) => void;
  userId: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadAvatar = useCallback(
    async (file: File) => {
      setUploadError(null);
      const problem = avatarFileProblem(file);
      if (problem) {
        setUploadError(problem);
        return;
      }
      onUploadingChange?.(true);
      try {
        const supabase = getSupabaseClient();
        // Extensión por tipo real, no por el nombre (una «foto» sin extensión
        // o con .jpeg/.JPG acababa con una ruta rara).
        const path = `${userId}/${crypto.randomUUID()}.${avatarFileExtension(file.type)}`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          setUploadError(`No se pudo subir la foto: ${error.message}`);
          return;
        }
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        onChange(data.publicUrl);
      } catch {
        setUploadError("No se pudo subir la foto por un error de red. Inténtalo de nuevo.");
      } finally {
        onUploadingChange?.(false);
      }
    },
    [onChange, onUploadingChange, userId],
  );

  return (
    <div>
      <p className="text-sm font-medium text-foreground">Avatar</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {AVATAR_PRESETS.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => onChange(url)}
            className={cn(
              "rounded-full ring-2 ring-offset-2 transition",
              value === url ? "ring-accent" : "ring-transparent",
            )}
            aria-label="Elegir avatar"
            aria-pressed={value === url}
          >
            <Avatar size="lg">
              <AvatarImage src={url} alt="" />
              <AvatarFallback>{avatarInitials(name)}</AvatarFallback>
            </Avatar>
          </button>
        ))}
      </div>
      {value && !AVATAR_PRESETS.includes(value) ? (
        <Card size="sm" className="mt-4"><CardContent className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={value} alt="" />
            <AvatarFallback>{avatarInitials(name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">Foto seleccionada · se aplica al guardar</span>
        </CardContent></Card>
      ) : null}
      {value ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange(null)}>
          Quitar la foto y usar las iniciales
        </Button>
      ) : null}
      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <ImagePlus size={20} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Sube tu propia foto</p>
            <p className="mt-0.5 text-xs text-muted">PNG, JPG, WEBP o GIF · hasta 2 MB</p>
          </div>
        </div>
        <UploadButton
          accept={AVATAR_TYPES.join(",")}
          variant="secondary"
          size="default"
          onFile={uploadAvatar}
        >
          <Upload size={16} aria-hidden />
          Elegir archivo
        </UploadButton>
      </div>
      {uploadError ? <p role="alert" className="mt-2 text-xs text-danger">{uploadError}</p> : null}
    </div>
  );
}
