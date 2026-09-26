import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, type, title, body, read_at, created_at
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [session.userId]
  );

  return NextResponse.json({ notifications: rows });
}

const MarkReadSchema = z.object({
  id: z.string().uuid().optional(), // absent = tout marquer comme lu
});

export async function PATCH(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = MarkReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.id) {
    await query(
      `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`,
      [parsed.data.id, session.userId]
    );
  } else {
    await query(
      `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,
      [session.userId]
    );
  }

  return NextResponse.json({ success: true });
}
