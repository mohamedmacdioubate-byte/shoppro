import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Liste publique (tout utilisateur connecté, sans lien d'appartenance) des
// entreprises actives ou en essai — sert à parcourir/postuler, pas à gérer.
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, name, sector, city
     FROM companies
     WHERE status IN ('active', 'en_essai')
     ORDER BY name`
  );

  return NextResponse.json({ companies: rows });
}
