import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Vérifie seulement la PRÉSENCE d'un token ici — la vérification complète
// (signature, expiration) se fait dans chaque route via getSessionFromRequest,
// car jsonwebtoken n'est pas compatible avec l'Edge Runtime des middlewares.
const PUBLIC_PATHS = ["/api/auth/login", "/api/auth/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
