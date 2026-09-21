"use client";

import { useCallback, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { Avatar, UploadButton, cn } from "@/components/ui";

// Avatares alojados por HeroUI. Si alguno no carga, el <Avatar.Fallback> con
// las iniciales del nombre lo cubre.
export const AVATAR_PRESETS = [
  "blue",
  "green",
  "purple",
  "red",
  "yellow",
  "pink",
].map(
  (color) =>
    `https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/${color}.jpg`,
);

// Selector de avatar reutilizable (onboarding y /perfil): rejilla de presets +
// subida de foto propia al bucket `avatars/<uid>/`. Controlado por value/onChange.
export function AvatarPicker({
  name,
  value,
  onChange,
  userId,
  onUploadingChange,
}: {
  name: string;
  value: string | null;
  onChange: (url: string) => void;
  userId: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadAvatar = useCallback(
    async (file: File) => {
      setUploadError(null);
      onUploadingChange?.(true);
      const supabase = getSupabaseClient();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setUploadError(error.message);
        onUploadingChange?.(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange(data.publicUrl);
      onUploadingChange?.(false);
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
          >
            <Avatar name={name || "?"} src={url} size="md" />
          </button>
        ))}
      </div>
      <div className="mt-3">
        <UploadButton
          accept="image/png,image/jpeg,image/webp,image/gif"
          variant="secondary"
          size="sm"
          onFile={uploadAvatar}
        >
          Subir una foto
        </UploadButton>
        {uploadError ? (
          <p className="mt-1 text-xs text-danger">{uploadError}</p>
        ) : null}
      </div>
    </div>
  );
}
