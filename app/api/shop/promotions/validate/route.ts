import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Vérifie un code promo public (côté client, sans lien d'appartenance) et
// calcule la remise correspondante pour un sous-total donné.
const ValidateSchema = z.object({
  companyId: z.string().uuid(),
  code: z.string().min(1),
  subtotal: z.number().nonnegative(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = ValidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const { rows } = await query(
    `SELECT id, name, type, value FROM promotions
     WHERE company_id = $1 AND code = $2 AND active = TRUE
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at IS NULL OR ends_at >= now())`,
    [data.companyId, data.code.toUpperCase()]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Code promo invalide ou expiré" }, { status: 404 });
  }

  const promo = rows[0];
  const discountAmount =
    promo.type === "pourcentage"
      ? Math.round((data.subtotal * Number(promo.value)) / 100)
      : Math.min(Number(promo.value), data.subtotal);

  return NextResponse.json({ promotionId: promo.id, name: promo.name, discountAmount });
}
