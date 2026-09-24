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
    `SELECT id, name, address, latitude, longitude, created_at
     FROM warehouses WHERE company_id = $1 ORDER BY created_at`,
    [companyId]
  );

  return NextResponse.json({ warehouses: rows });
}

const CreateWarehouseSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2),
  address: z.string().optional(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateWarehouseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "warehouses.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const warehouse = await withTenant(data.companyId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO warehouses (company_id, name, address) VALUES ($1, $2, $3) RETURNING *`,
      [data.companyId, data.name, data.address ?? null]
    );
    return rows[0];
  });

  return NextResponse.json({ warehouse }, { status: 201 });
}
