"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type Group = { id: string; name: string; type: string; member_count: string; is_member: boolean };

const TYPE_LABELS: Record<string, string> = {
  livraison: "Livraison", stock: "Stock", production: "Production",
  direction: "Direction", general: "Général", commercial: "Commercial",
};

export default function GroupsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("general");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/groups?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setGroups(data.groups ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger les groupes")); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ companyId, name, type }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(extractErrorMessage(data.error)); return; }
      setName("");
      await load();
    } catch {
      setFormError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
      </div>

      <div className="serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4  }}>Communication</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Groupes de discussion internes
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Créer un groupe</div>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {formError && <div className="error-text">{formError}</div>}
          <button className="btn" disabled={submitting} type="submit">
            {submitting ? "Création..." : "Créer le groupe"}
          </button>
        </form>
      </div>

      {groups === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groups?.map((g) => (
          <Link key={g.id} href={`/companies/${companyId}/groups/${g.id}`} className="panel" style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{TYPE_LABELS[g.type] ?? g.type} · {g.member_count} membre(s)</div>
            </div>
            {!g.is_member && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Non membre</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
