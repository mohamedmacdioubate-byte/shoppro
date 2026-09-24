import { query } from "./db";

/**
 * Le JWT porte un champ isFounder figé au moment de la connexion. Comme les
 * sessions durent longtemps (voir JWT_EXPIRES_IN), on ne s'y fie jamais pour
 * une autorisation aussi sensible : on revérifie toujours en base que
 * l'utilisateur est ENCORE marqué is_founder=true au moment de l'action.
 */
export async function isFounder(userId: string): Promise<boolean> {
  const { rows } = await query<{ is_founder: boolean }>(
    `SELECT is_founder FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.is_founder === true;
}
