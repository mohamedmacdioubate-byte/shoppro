"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Permission = { id: string; code: string; label: string };
type Role = { id: string; name: string; is_director: boolean; permissionIds: string[] };

export default function RolesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/roles?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    if (res.status === 403) { setError("Accès refusé"); return; }
    const data = await res.json();
    setRoles(data.roles ?? []);
    setPermissions(data.permissions ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger les rôles")); }, [load]);

  function toggle(role: Role, permissionId: string) {
    if (role.is_director) return;
    const has = role.permissionIds.includes(permissionId);
    const nextIds = has ? role.permissionIds.filter((id) => id !== permissionId) : [...role.permissionIds, permissionId];
    setRoles((prev) => prev!.map((r) => (r.id === role.id ? { ...r, permissionIds: nextIds } : r)));
  }

  async function save(role: Role) {
    setSaving(role.id);
    setError(null);
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ permissionIds: role.permissionIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible d'enregistrer");
        return;
      }
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSaving(null);
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/companies/${companyId}`} style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Espace entreprise</Link>
      </div>

      <div className="serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Rôles et permissions</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Le Directeur a toujours tous les droits. Cochez ce que chaque autre rôle peut faire.
      </div>

      {error && <div className="error-text">{error}</div>}
      {roles === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {roles?.map((role) => (
          <div key={role.id} className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>
                {role.name} {role.is_director && <span className="eyebrow">— tous les droits</span>}
              </div>
              {!role.is_director && (
                <button className="btn" style={{ padding: "6px 14px", fontSize: 12 }} disabled={saving === role.id} onClick={() => save(role)}>
                  {saving === role.id ? "..." : "Enregistrer"}
                </button>
              )}
            </div>
            {!role.is_director && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {permissions.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={role.permissionIds.includes(p.id)}
                      onChange={() => toggle(role, p.id)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
