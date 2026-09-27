import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const mine = searchParams.get("mine");

  if (mine) {
    const { rows } = await query(
      `SELECT i.id, i.number, i.amount, i.issued_at, c.name AS company_name, o.order_number
       FROM invoices i
       JOIN companies c ON c.id = i.company_id
       LEFT JOIN orders o ON o.id = i.order_id
       LEFT JOIN customers cu ON cu.id = o.customer_id
       WHERE cu.user_id = $1
       ORDER BY i.issued_at DESC`,
      [session.userId]
    );
    return NextResponse.json({ invoices: rows });
  }

  if (!companyId) return NextResponse.json({ error: "companyId ou mine requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT i.id, i.number, i.amount, i.issued_at, o.order_number, u.full_name AS customer_name
     FROM invoices i
     LEFT JOIN orders o ON o.id = i.order_id
     LEFT JOIN customers cu ON cu.id = o.customer_id
     LEFT JOIN users u ON u.id = cu.user_id
     WHERE i.company_id = $1
     ORDER BY i.issued_at DESC`,
    [companyId]
  );

  return NextResponse.json({ invoices: rows });
}
