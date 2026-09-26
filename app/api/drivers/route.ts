import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, vehicle_type, vehicle_plate, rating FROM drivers WHERE user_id = $1`,
    [session.userId]
  );

  return NextResponse.json({ driver: rows[0] ?? null });
}

const CreateDriverSchema = z.object({
  vehicleType: z.string().min(2),
  vehiclePlate: z.string().optional(),
});

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateDriverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await query(`SELECT id FROM drivers WHERE user_id = $1`, [session.userId]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ driverId: existing.rows[0].id });
  }

  const { rows } = await query(
    `INSERT INTO drivers (user_id, vehicle_type, vehicle_plate) VALUES ($1, $2, $3) RETURNING id`,
    [session.userId, parsed.data.vehicleType, parsed.data.vehiclePlate ?? null]
  );

  return NextResponse.json({ driverId: rows[0].id }, { status: 201 });
}
