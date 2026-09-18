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
  const status = searchParams.get("status"); // optionnel, filtre côté UI
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

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

  // Le client passant commande doit être membre "customer" de l'entreprise
  // (créé automatiquement lors de sa première commande côté logique métier),
  // pas nécessairement un company_member — donc pas de check de permission
  // ici, seulement l'existence du client pour cette entreprise.
  const customerCheck = await query(
    `SELECT id FROM customers WHERE id = $1 AND company_id = $2`,
    [data.customerId, data.companyId]
  );
  if (customerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Client invalide pour cette entreprise" }, { status: 400 });
  }

  const orderNumber = `CMD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const subtotal = data.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const total = subtotal + data.deliveryFee;

  const order = await withTenant(data.companyId, async (client) => {
    // Vérifie et décrémente le stock pour chaque article, dans la même
    // transaction que la création de la commande — évite la survente.
    for (const item of data.items) {
      const stock = await client.query(
        `SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [data.warehouseId, item.productId]
      );
      const available = stock.rows[0]?.quantity ?? 0;
      if (available < item.quantity) {
        throw new Error(`Stock insuffisant pour le produit ${item.productId}`);
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
    }

    const orderRes = await client.query(
      `INSERT INTO orders (company_id, customer_id, warehouse_id, delivery_address_id, order_number,
                            subtotal, delivery_fee, total, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.companyId, data.customerId, data.warehouseId, data.deliveryAddressId ?? null,
       orderNumber, subtotal, data.deliveryFee, total, data.paymentMethod]
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

    return createdOrder;
  });

  return NextResponse.json({ order }, { status: 201 });
}
