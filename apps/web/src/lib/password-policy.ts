export const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export type PasswordRequirements = {
  minLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
};

export function getPasswordRequirements(
  password: string,
): PasswordRequirements {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: [...PASSWORD_SYMBOLS].some((symbol) => password.includes(symbol)),
  };
}

export function isPasswordValid(password: string): boolean {
  return Object.values(getPasswordRequirements(password)).every(Boolean);
}

export type PasswordConfirmationState = "empty" | "match" | "mismatch";

export function passwordConfirmationState(
  password: string,
  confirmation: string,
): PasswordConfirmationState {
  if (!confirmation) return "empty";
  return password === confirmation ? "match" : "mismatch";
}

export function getPasswordErrorMessage(
  error: {
    code?: string;
    message?: string;
    reasons?: readonly string[];
  } | null,
  password?: string,
): string | null {
  if (!error) return null;

  const rawMessage = error.message ?? "";
  const isWeakPassword =
    error.code === "weak_password" ||
    /password should contain|weak password/i.test(rawMessage);
  if (isWeakPassword && error.reasons?.includes("pwned")) {
    return "Esta contraseña aparece en filtraciones conocidas. Elige una contraseña diferente.";
  }
  if (
    isWeakPassword &&
    password &&
    isPasswordValid(password)
  ) {
    return "La contraseña cumple los requisitos visibles, pero la política de seguridad de Auth la ha rechazado. Elige otra contraseña diferente.";
  }
  if (
    isWeakPassword
  ) {
    return "La contraseña debe tener al menos 8 caracteres e incluir una minúscula, una mayúscula, un número y un símbolo.";
  }

  return rawMessage || "No se pudo guardar la contraseña.";
}
