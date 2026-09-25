import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows: deliveries } = await query(
    `SELECT del.id, del.status, del.driver_id,
            o.order_number, o.total,
            cu_user.full_name AS customer_name,
            drv_user.full_name AS driver_name
     FROM deliveries del
     JOIN orders o ON o.id = del.order_id
     JOIN customers cu ON cu.id = o.customer_id
     JOIN users cu_user ON cu_user.id = cu.user_id
     LEFT JOIN drivers drv ON drv.id = del.driver_id
     LEFT JOIN users drv_user ON drv_user.id = drv.user_id
     WHERE del.company_id = $1
     ORDER BY del.created_at DESC`,
    [companyId]
  );

  const { rows: availableDrivers } = await query(
    `SELECT d.id, u.full_name
     FROM company_drivers cd
     JOIN drivers d ON d.id = cd.driver_id
     JOIN users u ON u.id = d.user_id
     WHERE cd.company_id = $1 AND cd.status = 'actif'
     ORDER BY u.full_name`,
    [companyId]
  );

  return NextResponse.json({ deliveries, availableDrivers });
}
