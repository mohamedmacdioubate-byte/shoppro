import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership, hasPermission } from "@/lib/tenant";

const AdjustSchema = z.object({
  companyId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  type: z.enum(["entree", "sortie", "ajustement"]),
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = AdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const membership = await resolveMembership(session.userId, data.companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });
  if (!hasPermission(membership, "stock.manage")) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const delta = data.type === "sortie" ? -data.quantity : data.quantity;

  try {
    const inventory = await withTenant(data.companyId, async (client) => {
      const existing = await client.query(
        `SELECT id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [data.warehouseId, data.productId]
      );

      let row;
      if (existing.rows.length === 0) {
        if (delta < 0) throw new Error("Stock insuffisant pour cette sortie");
        const inserted = await client.query(
          `INSERT INTO inventory (company_id, warehouse_id, product_id, quantity, min_threshold)
           VALUES ($1, $2, $3, $4, 5) RETURNING *`,
          [data.companyId, data.warehouseId, data.productId, delta]
        );
        row = inserted.rows[0];
      } else {
        const current = existing.rows[0];
        const newQuantity = current.quantity + delta;
        if (newQuantity < 0) throw new Error("Stock insuffisant pour cette sortie");
        const updated = await client.query(
          `UPDATE inventory SET quantity = $1, updated_at = now() WHERE id = $2 RETURNING *`,
          [newQuantity, current.id]
        );
        row = updated.rows[0];
      }

      await client.query(
        `INSERT INTO inventory_movements (company_id, warehouse_id, product_id, type, quantity, reference_type, performed_by, note)
         VALUES ($1, $2, $3, $4, $5, 'manuel', $6, $7)`,
        [data.companyId, data.warehouseId, data.productId, data.type, data.quantity, session.userId, data.note ?? null]
      );

      return row;
    });

    return NextResponse.json({ inventory });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur lors de l'ajustement" }, { status: 400 });
  }
}
