"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type Promotion = {
  id: string; name: string; type: string; value: string; code: string | null; active: boolean;
};

export default function PromotionsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<"pourcentage" | "montant_fixe">("pourcentage");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/promotions?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setPromotions(data.promotions ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger les promotions")); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ companyId, name, type, value: Number(value), code: code || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(extractErrorMessage(data.error)); return; }
      setName(""); setValue(""); setCode("");
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

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Promotions</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Réductions applicables dans la boutique
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Créer une promotion</div>
        <form onSubmit={handleAdd}>
          <div className="field">
            <label>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo de lancement" required />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="pourcentage">Pourcentage (%)</option>
                <option value="montant_fixe">Montant fixe (GNF)</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Valeur</label>
              <input type="number" min="1" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Code promo (optionnel — sans code, non applicable au panier)</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BIENVENUE10" />
          </div>
          {formError && <div className="error-text">{formError}</div>}
          <button className="btn" disabled={submitting} type="submit">
            {submitting ? "Création..." : "Créer la promotion"}
          </button>
        </form>
      </div>

      {promotions === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {promotions?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucune promotion pour le moment.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {promotions?.map((p) => (
          <div key={p.id} className="panel" style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {p.code ? `Code : ${p.code}` : "Sans code"}
              </div>
            </div>
            <div style={{ fontWeight: 700 }}>
              {p.type === "pourcentage" ? `-${p.value}%` : `-${Number(p.value).toLocaleString("fr-FR")} GNF`}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
