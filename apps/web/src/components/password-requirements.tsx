import {
  getPasswordRequirements,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-policy";
import { cn } from "@/components/ui";

export function PasswordRequirements({ password }: { password: string }) {
  const requirements = getPasswordRequirements(password);
  const items = [
    [requirements.minLength, `Al menos ${PASSWORD_MIN_LENGTH} caracteres`],
    [requirements.lowercase, "Una letra minúscula"],
    [requirements.uppercase, "Una letra mayúscula"],
    [requirements.number, "Un número"],
    [requirements.symbol, "Un símbolo: ! @ # $ % ..."],
  ] as const;

  return (
    <div className="rounded-md border border-separator bg-surface-muted p-3 text-xs text-muted">
      <p className="font-medium text-foreground">Requisitos de la contraseña</p>
      <ul className="mt-2 grid gap-1" aria-label="Requisitos de la contraseña">
        {items.map(([valid, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                valid
                  ? "bg-success/15 text-success"
                  : "bg-separator text-muted",
              )}
            >
              {valid ? "✓" : "·"}
            </span>
            <span className={valid ? "text-success" : undefined}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
