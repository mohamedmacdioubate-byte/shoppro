import { Pool, type PoolClient, type QueryResultRow } from "pg";

// Pool unique réutilisé par toute l'application (Next.js recharge ce module
// entre les requêtes en dev, d'où le cache sur globalThis).
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

/**
 * Exécute une requête simple (sans besoin d'isolation transactionnelle).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return pool.query<T>(text, params);
}

/**
 * Exécute une série d'opérations dans une transaction, avec le company_id
 * du tenant actif positionné pour la durée de la transaction. Si des
 * politiques Row Level Security sont activées côté PostgreSQL (voir
 * schema.sql), elles s'appliqueront automatiquement à toutes les requêtes
 * exécutées via `client` dans ce callback.
 */
export async function withTenant<T>(
  companyId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_company_id', $1, true)", [
      companyId,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
