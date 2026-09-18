import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET manquant dans les variables d'environnement");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type SessionPayload = {
  userId: string;
  isFounder: boolean;
};

export function signSession(payload: SessionPayload): string {
  // Ne jamais inclure isFounder=true ici sauf si l'utilisateur est
  // RÉELLEMENT marqué is_founder=true en base — ce token ne doit jamais
  // pouvoir être construit ou modifié côté client (voir /api/auth/login).
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Extrait et vérifie le token depuis l'en-tête Authorization d'une requête.
 * Retourne null si absent ou invalide — à chaque route de gérer le 401.
 */
export function getSessionFromRequest(req: Request): SessionPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  return verifySession(token);
}
