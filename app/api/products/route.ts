import { NextResponse } from "next/server";
import { z } from "zod";
import { query, withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

// Toutes les routes métier suivent le même schéma :
// 1. vérifier le token (session)
// 2. résoudre l'appartenance de l'utilisateur à l'entreprise demandée
// 3. vérifier la permission requise pour l'action
// 4. exécuter la requête, toujours filtrée par company_id

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.company_id = $1
     ORDER BY p.created_at DESC`,
    [companyId]
  );

  return NextResponse.json({ products: rows });
}

const CreateProductSchema = z.object({
  companyId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  basePrice: z.number().positive(),
  professionalPrice: z.number().positive().optional(),
  sku: z.string().optional(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "products.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const product = await withTenant(data.companyId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO products (company_id, category_id, name, description, sku, base_price, professional_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.companyId, data.categoryId ?? null, data.name, data.description ?? null,
       data.sku ?? null, data.basePrice, data.professionalPrice ?? null]
    );
    return rows[0];
  });

  return NextResponse.json({ product }, { status: 201 });
}
