import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

const TransferSchema = z.object({
  companyId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
}).refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
  message: "Le dépôt de départ et d'arrivée doivent être différents",
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = TransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "stock.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  try {
    await withTenant(data.companyId, async (client) => {
      const source = await client.query(
        `SELECT id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [data.fromWarehouseId, data.productId]
      );
      const available = source.rows[0]?.quantity ?? 0;
      if (available < data.quantity) {
        throw new Error("Stock insuffisant dans le dépôt de départ pour ce transfert");
      }
      await client.query(
        `UPDATE inventory SET quantity = quantity - $1, updated_at = now() WHERE id = $2`,
        [data.quantity, source.rows[0].id]
      );
      await client.query(
        `INSERT INTO inventory_movements (company_id, warehouse_id, product_id, type, quantity, reference_type, performed_by)
         VALUES ($1, $2, $3, 'transfert_sortant', $4, 'transfer', $5)`,
        [data.companyId, data.fromWarehouseId, data.productId, data.quantity, session.userId]
      );

      const dest = await client.query(
        `SELECT id FROM inventory WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [data.toWarehouseId, data.productId]
      );
      if (dest.rows.length === 0) {
        await client.query(
          `INSERT INTO inventory (company_id, warehouse_id, product_id, quantity, min_threshold)
           VALUES ($1, $2, $3, $4, 5)`,
          [data.companyId, data.toWarehouseId, data.productId, data.quantity]
        );
      } else {
        await client.query(
          `UPDATE inventory SET quantity = quantity + $1, updated_at = now() WHERE id = $2`,
          [data.quantity, dest.rows[0].id]
        );
      }
      await client.query(
        `INSERT INTO inventory_movements (company_id, warehouse_id, product_id, type, quantity, reference_type, performed_by)
         VALUES ($1, $2, $3, 'transfert_entrant', $4, 'transfer', $5)`,
        [data.companyId, data.toWarehouseId, data.productId, data.quantity, session.userId]
      );
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur lors du transfert" }, { status: 400 });
  }
}
