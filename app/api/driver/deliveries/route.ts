import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const driver = await query(`SELECT id FROM drivers WHERE user_id = $1`, [session.userId]);
  if (driver.rows.length === 0) return NextResponse.json({ deliveries: [] });

  const { rows } = await query(
    `SELECT del.id, del.status, del.distance_km,
            o.order_number, o.total,
            c.name AS company_name,
            cu_user.full_name AS customer_name, cu_user.phone AS customer_phone,
            addr.address_line, addr.commune
     FROM deliveries del
     JOIN orders o ON o.id = del.order_id
     JOIN companies c ON c.id = del.company_id
     JOIN customers cu ON cu.id = o.customer_id
     JOIN users cu_user ON cu_user.id = cu.user_id
     LEFT JOIN customer_addresses addr ON addr.id = o.delivery_address_id
     WHERE del.driver_id = $1
     ORDER BY
       CASE del.status
         WHEN 'livree' THEN 1 WHEN 'annulee' THEN 1 ELSE 0
       END,
       del.created_at DESC`,
    [driver.rows[0].id]
  );

  return NextResponse.json({ deliveries: rows });
}
