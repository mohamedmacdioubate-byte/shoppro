import { query } from "./db";

/**
 * Vérifie EN BASE si un utilisateur est Fondateur — jamais seulement via le
 * JWT. Le champ users.is_founder ne peut être modifié que directement en
 * base (jamais via une route API), donc revérifier ici à chaque action
 * sensible garantit qu'un ancien token ne peut pas conserver un droit après
 * un retrait manuel, et que rien côté client ne peut usurper ce rôle.
 */
export async function isFounder(userId: string): Promise<boolean> {
  const { rows } = await query<{ is_founder: boolean }>(
    `SELECT is_founder FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.is_founder === true;
}
