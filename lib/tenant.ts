import { query } from "./db";

export type MembershipContext = {
  companyId: string;
  roleId: string;
  roleName: string;
  isDirector: boolean;
  permissions: string[];
};

export async function resolveMembership(
  userId: string,
  companyId: string
): Promise<MembershipContext | null> {
  const { rows } = await query<{
    role_id: string;
    role_name: string;
    is_director: boolean;
    permission_code: string | null;
  }>(
    `SELECT r.id AS role_id, r.name AS role_name, r.is_director,
            p.code AS permission_code
     FROM company_members cm
     JOIN roles r ON r.id = cm.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE cm.user_id = $1 AND cm.company_id = $2 AND cm.status = 'actif'`,
    [userId, companyId]
  );

  if (rows.length === 0) return null;

  return {
    companyId,
    roleId: rows[0].role_id,
    roleName: rows[0].role_name,
    isDirector: rows[0].is_director,
    permissions: rows
      .map((r) => r.permission_code)
      .filter((code): code is string => Boolean(code)),
  };
}

export function hasPermission(ctx: MembershipContext, code: string): boolean {
  return ctx.isDirector || ctx.permissions.includes(code);
}
