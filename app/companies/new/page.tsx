"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, sector, city, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Une erreur est survenue");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="panel" style={{ width: 420 }}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Créer mon entreprise</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 22 }}>
          Elle sera créée avec le statut &laquo;&nbsp;en attente&nbsp;&raquo; jusqu&apos;à validation.
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nom de l&apos;entreprise</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Secteur</label>
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Boissons, Électronique, Alimentaire..."
            />
          </div>
          <div className="field">
            <label>Ville</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Conakry" />
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+224 6xx xx xx xx" />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn block" disabled={loading} type="submit">
            {loading ? "Création..." : "Créer mon entreprise"}
          </button>
        </form>
        <div className="muted-link">
          <Link href="/dashboard">← Retour au tableau de bord</Link>
        </div>
      </div>
    </main>
  );
}