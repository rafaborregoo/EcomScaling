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

export function getPasswordErrorMessage(error: {
  code?: string;
  message?: string;
} | null): string | null {
  if (!error) return null;

  const rawMessage = error.message ?? "";
  if (
    error.code === "weak_password" ||
    /password should contain|weak password/i.test(rawMessage)
  ) {
    return "La contraseña debe tener al menos 8 caracteres e incluir una minúscula, una mayúscula, un número y un símbolo.";
  }

  return rawMessage || "No se pudo guardar la contraseña.";
}
