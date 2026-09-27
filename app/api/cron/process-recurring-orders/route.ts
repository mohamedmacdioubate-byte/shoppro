import { NextResponse } from "next/server";
import { query, withTenant } from "@/lib/db";

// Route déclenchée par Vercel Cron (voir vercel.json), PAS par un
// utilisateur — donc exemptée du contrôle JWT dans middleware.ts. En
// contrepartie, elle DOIT vérifier elle-même un secret partagé : sans lui,
// n'importe qui pourrait déclencher la génération de commandes à volonté.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const due = await query(
    `SELECT id, company_id, customer_id, frequency, custom_cron, template_items
     FROM recurring_orders WHERE active = TRUE AND next_run_at <= now()`
  );

  const results: Array<{ recurringOrderId: string; orderId?: string; error?: string }> = [];

  for (const ro of due.rows) {
    try {
      const template = ro.template_items as { warehouseId: string; items: Array<{ productId: string; quantity: number; unitPrice: number }> };
      const orderNumber = `CMD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const subtotal = template.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

      const order = await withTenant(ro.company_id, async (client) => {
        for (const item of template.items) {
          const stock = await client.query(
            `SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
            [template.warehouseId, item.productId]
          );
          if ((stock.rows[0]?.quantity ?? 0) < item.quantity) {
            throw new Error("Stock insuffisant pour la commande récurrente");
          }
          await client.query(
            `UPDATE inventory SET quantity = quantity - $1, updated_at = now() WHERE warehouse_id = $2 AND product_id = $3`,
            [item.quantity, template.warehouseId, item.productId]
          );
        }

        const orderRes = await client.query(
          `INSERT INTO orders (company_id, customer_id, warehouse_id, order_number, subtotal, delivery_fee, total, payment_method, recurring_order_id)
           VALUES ($1, $2, $3, $4, $5, 0, $5, 'especes_a_la_livraison', $6) RETURNING *`,
          [ro.company_id, ro.customer_id, template.warehouseId, orderNumber, subtotal, ro.id]
        );
        const created = orderRes.rows[0];

        for (const item of template.items) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
             VALUES ($1, $2, $3, $4, $5)`,
            [created.id, item.productId, item.quantity, item.unitPrice, item.unitPrice * item.quantity]
          );
        }

        await client.query(
          `INSERT INTO deliveries (order_id, company_id, status) VALUES ($1, $2, 'commande_acceptee')`,
          [created.id, ro.company_id]
        );

        return created;
      });

      let next = new Date();
      if (ro.frequency === "quotidienne") next.setDate(next.getDate() + 1);
      else if (ro.frequency === "hebdomadaire") next.setDate(next.getDate() + 7);
      else if (ro.frequency === "mensuelle") next.setMonth(next.getMonth() + 1);
      else next.setDate(next.getDate() + Number(ro.custom_cron ?? 7));

      await query(`UPDATE recurring_orders SET next_run_at = $1 WHERE id = $2`, [next, ro.id]);

      results.push({ recurringOrderId: ro.id, orderId: order.id });
    } catch (err: any) {
      results.push({ recurringOrderId: ro.id, error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
