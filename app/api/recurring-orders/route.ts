import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveMembership } from "@/lib/tenant";

function computeNextRun(frequency: string, customDays?: number): Date {
  const now = new Date();
  if (frequency === "quotidienne") now.setDate(now.getDate() + 1);
  else if (frequency === "hebdomadaire") now.setDate(now.getDate() + 7);
  else if (frequency === "mensuelle") now.setMonth(now.getMonth() + 1);
  else now.setDate(now.getDate() + (customDays ?? 7));
  return now;
}

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const mine = searchParams.get("mine");

  if (mine) {
    const { rows } = await query(
      `SELECT ro.id, ro.frequency, ro.next_run_at, ro.active, ro.template_items, c.name AS company_name
       FROM recurring_orders ro
       JOIN customers cu ON cu.id = ro.customer_id
       JOIN companies c ON c.id = ro.company_id
       WHERE cu.user_id = $1
       ORDER BY ro.next_run_at`,
      [session.userId]
    );
    return NextResponse.json({ recurringOrders: rows });
  }

  if (!companyId) return NextResponse.json({ error: "companyId ou mine requis" }, { status: 400 });
  const membership = await resolveMembership(session.userId, companyId);
  if (!membership) return NextResponse.json({ error: "Accès refusé à cette entreprise" }, { status: 403 });

  const { rows } = await query(
    `SELECT ro.id, ro.frequency, ro.next_run_at, ro.active, ro.template_items, u.full_name AS customer_name
     FROM recurring_orders ro
     JOIN customers cu ON cu.id = ro.customer_id
     JOIN users u ON u.id = cu.user_id
     WHERE ro.company_id = $1
     ORDER BY ro.next_run_at`,
    [companyId]
  );
  return NextResponse.json({ recurringOrders: rows });
}

const ItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  name: z.string(),
});

const CreateRecurringSchema = z.object({
  companyId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  frequency: z.enum(["quotidienne", "hebdomadaire", "mensuelle", "personnalisee"]),
  customDays: z.number().int().positive().optional(),
  items: z.array(ItemSchema).min(1),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateRecurringSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  let customer = await query(
    `SELECT id FROM customers WHERE company_id = $1 AND user_id = $2`,
    [data.companyId, session.userId]
  );
  if (customer.rows.length === 0) {
    customer = await query(
      `INSERT INTO customers (company_id, user_id, type) VALUES ($1, $2, 'professionnel') RETURNING id`,
      [data.companyId, session.userId]
    );
  }

  const nextRun = computeNextRun(data.frequency, data.customDays);

  const { rows } = await query(
    `INSERT INTO recurring_orders (company_id, customer_id, frequency, custom_cron, template_items, next_run_at, active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
    [
      data.companyId, customer.rows[0].id, data.frequency,
      data.frequency === "personnalisee" ? String(data.customDays ?? 7) : null,
      JSON.stringify({ warehouseId: data.warehouseId, items: data.items }),
      nextRun,
    ]
  );

  return NextResponse.json({ recurringOrder: rows[0] }, { status: 201 });
}
