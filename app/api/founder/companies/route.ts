import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { isFounder } from "@/lib/founder";

// Seule route (avec ses voisins [id]/status et /api/auth/me) qui lit/écrit à
// travers TOUTES les entreprises sans filtrer par company_id — c'est
// volontaire et strictement réservé au Fondateur. On revérifie toujours
// is_founder EN BASE (pas seulement dans le JWT) pour une autorisation
// aussi sensible — voir lib/founder.ts.
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await isFounder(session.userId))) {
    return NextResponse.json({ error: "Accès réservé au Fondateur" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // filtre optionnel

  const { rows } = await query(
    `SELECT id, name, sector, city, phone, email, status, created_at
     FROM companies
     WHERE ($1::company_status IS NULL OR status = $1)
     ORDER BY created_at DESC`,
    [status]
  );

  return NextResponse.json({ companies: rows });
}
