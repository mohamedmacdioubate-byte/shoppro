import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { verifyPassword, signSession } from "@/lib/auth";

const LoginSchema = z.object({
  identifier: z.string().min(3), // email ou téléphone
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { identifier, password } = parsed.data;

  const { rows } = await query<{
    id: string;
    password_hash: string;
    is_founder: boolean;
    two_factor_enabled: boolean;
  }>(
    `SELECT id, password_hash, is_founder, two_factor_enabled
     FROM users WHERE email = $1 OR phone = $1`,
    [identifier]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const user = rows[0];
  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  if (user.is_founder && user.two_factor_enabled) {
    // Le flux 2FA (envoi + vérification du code) est une étape séparée à
    // implémenter avant d'émettre le token final pour un compte Fondateur.
    return NextResponse.json({ requiresTwoFactor: true, userId: user.id });
  }

  // is_founder est lu depuis la base, jamais fourni par le client : c'est
  // ce qui empêche quiconque de "devenir Fondateur" via une requête forgée.
  const token = signSession({ userId: user.id, isFounder: user.is_founder });

  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  return NextResponse.json({ token });
}
