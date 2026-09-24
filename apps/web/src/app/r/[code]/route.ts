import { NextResponse, type NextRequest } from "next/server";

/**
 * Enlace del programa de consultores: `/r/ricardo`. Recuerda el codigo 60 dias
 * en una cookie (por si la persona se va y vuelve a registrarse otro dia) y
 * lleva al registro con el codigo ya puesto. No valida nada: eso lo hace el
 * API al crear la organizacion.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = (await params).code.trim().toLowerCase().slice(0, 32);
  const response = NextResponse.redirect(
    new URL(`/registro?ref=${encodeURIComponent(code)}`, request.url),
  );
  response.cookies.set("ecom_ref", code, {
    maxAge: 60 * 60 * 24 * 60,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
