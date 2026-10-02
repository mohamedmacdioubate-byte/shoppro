import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Recherche de PRODUITS à travers toutes les entreprises actives — distincte
// de /api/shop/companies (qui cherche des entreprises) : chaque onglet du
// tableau de bord client cherche uniquement dans sa propre catégorie.
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ products: [] });

  const { rows } = await query(
    `SELECT p.id, p.name, p.base_price, c.id AS company_id, c.name AS company_name
     FROM products p
     JOIN companies c ON c.id = p.company_id
     WHERE p.status = 'actif' AND c.status IN ('active', 'en_essai')
       AND p.name ILIKE '%' || $1 || '%'
     ORDER BY p.name LIMIT 40`,
    [q]
  );

  return NextResponse.json({ products: rows });
}
