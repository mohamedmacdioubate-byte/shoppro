import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

const ALLOWED = ["en_route", "livraison_en_cours", "livree"] as const;

const StatusSchema = z.object({
  status: z.enum(ALLOWED),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const delivery = await query(
    `SELECT del.id, del.order_id
     FROM deliveries del
     JOIN drivers d ON d.id = del.driver_id
     WHERE del.id = $1 AND d.user_id = $2`,
    [params.id, session.userId]
  );
  if (delivery.rows.length === 0) {
    return NextResponse.json({ error: "Livraison introuvable ou non assignée à vous" }, { status: 403 });
  }

  const timestampColumn =
    parsed.data.status === "en_route" ? "picked_up_at" :
    parsed.data.status === "livree" ? "delivered_at" : null;

  const { rows } = await query(
    timestampColumn
      ? `UPDATE deliveries SET status = $1, ${timestampColumn} = now() WHERE id = $2 RETURNING *`
      : `UPDATE deliveries SET status = $1 WHERE id = $2 RETURNING *`,
    [parsed.data.status, params.id]
  );

  if (parsed.data.status === "livree") {
    const order = await query(
      `UPDATE orders SET status = 'livree', updated_at = now() WHERE id = $1 RETURNING order_number, customer_id`,
      [delivery.rows[0].order_id]
    );
    if (order.rows.length > 0) {
      const customer = await query(`SELECT user_id FROM customers WHERE id = $1`, [order.rows[0].customer_id]);
      if (customer.rows.length > 0) {
        await query(
          `INSERT INTO notifications (user_id, type, title, body, related_entity_type, related_entity_id)
           VALUES ($1, 'livraison', 'Commande livrée', $2, 'order', $3)`,
          [customer.rows[0].user_id, `Votre commande ${order.rows[0].order_number} a été livrée`, delivery.rows[0].order_id]
        );
      }
    }
  }

  return NextResponse.json({ delivery: rows[0] });
}
