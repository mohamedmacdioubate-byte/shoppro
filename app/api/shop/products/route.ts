import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Contrairement à /api/products (réservée aux membres de l'entreprise),
// cette route sert le catalogue PUBLIC vu par les clients — n'importe quel
// utilisateur connecté peut la consulter, pas besoin d'appartenir à
// l'entreprise. Elle renvoie aussi l'identifiant du dépôt par défaut, utilisé
// tant qu'il n'y a pas de sélection de dépôt côté client.
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const company = await query(`SELECT id, name, status FROM companies WHERE id = $1`, [companyId]);
  if (company.rows.length === 0) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  const { rows: products } = await query(
    `SELECT id, name, description, base_price, professional_price
     FROM products
     WHERE company_id = $1 AND status = 'actif'
     ORDER BY created_at DESC`,
    [companyId]
  );

  const warehouse = await query(
    `SELECT id FROM warehouses WHERE company_id = $1 ORDER BY created_at LIMIT 1`,
    [companyId]
  );

  return NextResponse.json({
    company: company.rows[0],
    warehouseId: warehouse.rows[0]?.id ?? null,
    products,
  });
}
