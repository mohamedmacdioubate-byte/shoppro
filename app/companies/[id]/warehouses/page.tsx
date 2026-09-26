"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type Warehouse = { id: string; name: string; address: string | null };

export default function WarehousesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const res = await fetch(`/api/warehouses?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setWarehouses(data.warehouses ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger les dépôts")); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setFormError(null); setSubmitting(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/warehouses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ companyId, name, address: address || undefined }) });
      const data = await res.json();
      if (!res.ok) { setFormError(extractErrorMessage(data.error)); return; }
      setName(""); setAddress(""); await load();
    } catch { setFormError("Impossible de contacter le serveur"); } finally { setSubmitting(false); }
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
        <Link href={`/companies/${companyId}/stock`} style={{ color: "var(--blue)", fontSize: 13, fontWeight: 600 }}>Voir le stock →</Link>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Dépôts</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>Vos sites de stockage</div>
      {error && <div className="error-text">{error}</div>}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Ajouter un dépôt</div>
        <form onSubmit={handleAdd}>
          <div className="field"><label>Nom du dépôt</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kaloum, Matoto..." required /></div>
          <div className="field"><label>Adresse (optionnel)</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          {formError && <div className="error-text">{formError}</div>}
          <button className="btn" disabled={submitting} type="submit">{submitting ? "Ajout..." : "Ajouter le dépôt"}</button>
        </form>
      </div>
      {warehouses === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {warehouses?.length === 0 && <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucun dépôt pour le moment.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {warehouses?.map((w) => (
          <div key={w.id} className="panel"><div style={{ fontWeight: 600 }}>{w.name}</div>{w.address && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{w.address}</div>}</div>
        ))}
      </div>
    </main>
  );
}
