import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

const EnsureCustomerSchema = z.object({
  companyId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = EnsureCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { companyId } = parsed.data;

  const existing = await query(
    `SELECT id FROM customers WHERE company_id = $1 AND user_id = $2`,
    [companyId, session.userId]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({ customerId: existing.rows[0].id });
  }

  const { rows } = await query(
    `INSERT INTO customers (company_id, user_id, type) VALUES ($1, $2, 'particulier') RETURNING id`,
    [companyId, session.userId]
  );

  return NextResponse.json({ customerId: rows[0].id }, { status: 201 });
}
