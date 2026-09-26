import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const warehouseId = searchParams.get("warehouseId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT i.id, i.quantity, i.min_threshold,
            p.id AS product_id, p.name AS product_name,
            w.id AS warehouse_id, w.name AS warehouse_name
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     JOIN warehouses w ON w.id = i.warehouse_id
     WHERE i.company_id = $1 AND ($2::uuid IS NULL OR i.warehouse_id = $2)
     ORDER BY w.name, p.name`,
    [companyId, warehouseId]
  );

  return NextResponse.json({ inventory: rows });
}
