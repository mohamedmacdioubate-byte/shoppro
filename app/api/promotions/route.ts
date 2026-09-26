import { NextResponse } from "next/server";
import { z } from "zod";
import { query, withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT id, name, type, value, code, professional_only, starts_at, ends_at, active, created_at
     FROM promotions WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  );

  return NextResponse.json({ promotions: rows });
}

const CreatePromotionSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2),
  type: z.enum(["pourcentage", "montant_fixe"]),
  value: z.number().positive(),
  code: z.string().min(3).optional(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreatePromotionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "promotions.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const promotion = await withTenant(data.companyId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO promotions (company_id, name, type, value, code)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.companyId, data.name, data.type, data.value, data.code?.toUpperCase() ?? null]
    );
    return rows[0];
  });

  return NextResponse.json({ promotion }, { status: 201 });
}
