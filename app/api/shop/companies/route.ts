import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Marketplace publique : recherche par nom, secteur ou ville, avec la note
// moyenne de chaque entreprise (pour aider le client à choisir).
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const { rows } = await query(
    `SELECT c.id, c.name, c.sector, c.city,
            ROUND(AVG(r.rating)::numeric, 1) AS average_rating,
            COUNT(r.id) AS review_count
     FROM companies c
     LEFT JOIN reviews r ON r.company_id = c.id AND r.target_type = 'service'
     WHERE c.status IN ('active', 'en_essai')
       AND ($1::text IS NULL OR c.name ILIKE '%' || $1 || '%' OR c.sector ILIKE '%' || $1 || '%' OR c.city ILIKE '%' || $1 || '%')
     GROUP BY c.id
     ORDER BY c.name`,
    [q || null]
  );

  return NextResponse.json({ companies: rows });
}
