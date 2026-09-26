import { NextResponse } from "next/server";
import { z } from "zod";
import { query, withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const status = searchParams.get("status");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const { rows } = await query(
    `SELECT o.*, u.full_name AS customer_name
     FROM orders o
     JOIN customers cu ON cu.id = o.customer_id
     JOIN users u ON u.id = cu.user_id
     WHERE o.company_id = $1 AND ($2::order_status IS NULL OR o.status = $2)
     ORDER BY o.created_at DESC`,
    [companyId, status]
  );

  return NextResponse.json({ orders: rows });
}

const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  packagingId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

const CreateOrderSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  deliveryAddressId: z.string().uuid().optional(),
  items: z.array(OrderItemSchema).min(1),
  deliveryFee: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["especes_a_la_livraison", "orange_money", "virement", "autre"]),
  promoCode: z.string().optional(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const customerCheck = await query(
    `SELECT id FROM customers WHERE id = $1 AND company_id = $2`,
    [data.customerId, data.companyId]
  );
  if (customerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Client invalide pour cette entreprise" }, { status: 400 });
  }

  const orderNumber = `CMD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const subtotal = data.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  // Le code promo est toujours revalidé et recalculé ICI, côté serveur —
  // ne jamais faire confiance à une remise envoyée telle quelle par le
  // client, qui pourrait sinon fabriquer n'importe quel montant.
  let discount = 0;
  let promotionId: string | null = null;
  if (data.promoCode) {
    const promo = await query(
      `SELECT id, type, value FROM promotions
       WHERE company_id = $1 AND code = $2 AND active = TRUE
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now())`,
      [data.companyId, data.promoCode.toUpperCase()]
    );
    if (promo.rows.length > 0) {
      const p = promo.rows[0];
      discount = p.type === "pourcentage"
        ? Math.round((subtotal * Number(p.value)) / 100)
        : Math.min(Number(p.value), subtotal);
      promotionId = p.id;
    }
  }

  const total = Math.max(0, subtotal - discount) + data.deliveryFee;

  try {
    const order = await withTenant(data.companyId, async (client) => {
      for (const item of data.items) {
        const stock = await client.query(
          `SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
          [data.warehouseId, item.productId]
        );
        const available = stock.rows[0]?.quantity ?? 0;
        if (available < item.quantity) {
          throw new Error("Stock insuffisant pour un des produits");
        }
        await client.query(
          `UPDATE inventory SET quantity = quantity - $1, updated_at = now()
           WHERE warehouse_id = $2 AND product_id = $3`,
          [item.quantity, data.warehouseId, item.productId]
        );
        await client.query(
          `INSERT INTO inventory_movements (company_id, warehouse_id, product_id, type, quantity, reference_type)
           VALUES ($1, $2, $3, 'sortie', $4, 'order')`,
          [data.companyId, data.warehouseId, item.productId, item.quantity]
        );

        const remaining = await client.query(
          `SELECT quantity, min_threshold FROM inventory WHERE warehouse_id = $1 AND product_id = $2`,
          [data.warehouseId, item.productId]
        );
        if (remaining.rows[0] && remaining.rows[0].quantity <= remaining.rows[0].min_threshold) {
          const staff = await client.query(
            `SELECT user_id FROM company_members WHERE company_id = $1 AND status = 'actif'`,
            [data.companyId]
          );
          for (const s of staff.rows) {
            await client.query(
              `INSERT INTO notifications (user_id, company_id, type, title, body)
               VALUES ($1, $2, 'stock_faible', 'Stock faible', 'Un produit est passé sous le seuil minimum')`,
              [s.user_id, data.companyId]
            );
          }
        }
      }

      const orderRes = await client.query(
        `INSERT INTO orders (company_id, customer_id, warehouse_id, delivery_address_id, order_number,
                              subtotal, discount_amount, delivery_fee, total, payment_method, promotion_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [data.companyId, data.customerId, data.warehouseId, data.deliveryAddressId ?? null,
         orderNumber, subtotal, discount, data.deliveryFee, total, data.paymentMethod, promotionId]
      );
      const createdOrder = orderRes.rows[0];

      for (const item of data.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, packaging_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [createdOrder.id, item.productId, item.packagingId ?? null, item.quantity,
           item.unitPrice, item.unitPrice * item.quantity]
        );
      }

      await client.query(
        `INSERT INTO deliveries (order_id, company_id, status) VALUES ($1, $2, 'commande_acceptee')`,
        [createdOrder.id, data.companyId]
      );

      // Fidélité : 1 point par tranche de 1000 GNF dépensés (simplification
      // de démonstration — un vrai barème par palier reste à définir).
      const points = Math.floor(total / 1000);
      if (points > 0) {
        await client.query(
          `UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2`,
          [points, data.customerId]
        );
        await client.query(
          `INSERT INTO loyalty_transactions (customer_id, order_id, points, reason)
           VALUES ($1, $2, $3, 'Achat')`,
          [data.customerId, createdOrder.id, points]
        );
      }

      const staff = await client.query(
        `SELECT user_id FROM company_members WHERE company_id = $1 AND status = 'actif'`,
        [data.companyId]
      );
      for (const s of staff.rows) {
        await client.query(
          `INSERT INTO notifications (user_id, company_id, type, title, body, related_entity_type, related_entity_id)
           VALUES ($1, $2, 'nouvelle_commande', 'Nouvelle commande', $3, 'order', $4)`,
          [s.user_id, data.companyId, `Commande ${createdOrder.order_number} reçue`, createdOrder.id]
        );
      }

      return createdOrder;
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Impossible de créer la commande" }, { status: 400 });
  }
}
