"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type Employee = {
  id: string; status: string; full_name: string; email: string; role_name: string; is_director: boolean;
};

export default function EmployeesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/employees?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setEmployees(data.employees ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger l'équipe")); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ companyId, email, roleName }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(extractErrorMessage(data.error)); return; }
      setEmail(""); setRoleName("");
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

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Employés</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Membres de votre équipe et leurs rôles
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Ajouter un employé</div>
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>
          La personne doit déjà avoir un compte ShopPro (créé via l&apos;inscription).
        </div>
        <form onSubmit={handleAdd}>
          <div className="field">
            <label>Email du compte existant</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Rôle</label>
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Manager Stock, Commercial..." required />
          </div>
          {formError && <div className="error-text">{formError}</div>}
          <button className="btn" disabled={submitting} type="submit">
            {submitting ? "Ajout..." : "Ajouter"}
          </button>
        </form>
      </div>

      {employees === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {employees?.map((e) => (
          <div key={e.id} className="panel" style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{e.full_name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{e.email}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: e.is_director ? "var(--blue-dim)" : "var(--bg-panel)", color: e.is_director ? "#8fb8fb" : "var(--text-secondary)" }}>
              {e.role_name}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
