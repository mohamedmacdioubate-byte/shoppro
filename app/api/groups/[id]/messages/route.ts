import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

async function requireGroupMember(groupId: string, userId: string) {
  const res = await query(
    `SELECT g.company_id FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE g.id = $1 AND gm.user_id = $2`,
    [groupId, userId]
  );
  return res.rows[0]?.company_id ?? null;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const companyId = await requireGroupMember(params.id, session.userId);
  if (!companyId) return NextResponse.json({ error: "Vous n'êtes pas membre de ce groupe" }, { status: 403 });

  const { rows } = await query(
    `SELECT m.id, m.content, m.attachment_url, m.created_at, u.full_name AS sender_name, m.sender_id
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.group_id = $1
     ORDER BY m.created_at ASC LIMIT 200`,
    [params.id]
  );

  return NextResponse.json({ messages: rows });
}

const SendMessageSchema = z.object({
  content: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const companyId = await requireGroupMember(params.id, session.userId);
  if (!companyId) return NextResponse.json({ error: "Vous n'êtes pas membre de ce groupe" }, { status: 403 });

  const { rows } = await query(
    `INSERT INTO messages (group_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
    [params.id, session.userId, parsed.data.content]
  );

  const others = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2`,
    [params.id, session.userId]
  );
  for (const o of others.rows) {
    await query(
      `INSERT INTO notifications (user_id, company_id, type, title, body, related_entity_type, related_entity_id)
       VALUES ($1, $2, 'nouveau_message', 'Nouveau message', $3, 'group', $4)`,
      [o.user_id, companyId, parsed.data.content.slice(0, 80), params.id]
    );
  }

  return NextResponse.json({ message: rows[0] }, { status: 201 });
}
