"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  sector: string | null;
  city: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  en_negociation: "En négociation",
  offre_proposee: "Offre proposée",
  paiement_en_attente: "Paiement en attente",
  en_essai: "En essai",
  active: "Active",
  suspendue: "Suspendue",
  resiliee: "Résiliée",
};

const FILTERS = [
  { key: "", label: "Toutes" },
  { key: "en_attente", label: "En attente" },
  { key: "active", label: "Actives" },
  { key: "suspendue", label: "Suspendues" },
];

export default function FounderPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async (statusFilter: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    const url = statusFilter ? `/api/founder/companies?status=${statusFilter}` : "/api/founder/companies";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      return;
    }
    if (res.status === 403) {
      setError("Accès réservé au Fondateur — ce compte n'a pas ce rôle.");
      setCompanies([]);
      return;
    }
    const data = await res.json();
    setCompanies(data.companies ?? []);
  }, [router]);

  useEffect(() => {
    load(filter).catch(() => setError("Impossible de charger les entreprises"));
  }, [filter, load]);

  async function changeStatus(companyId: string, status: string) {
    setActingOn(companyId);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/founder/companies/${companyId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible de changer le statut");
        return;
      }
      await load(filter);
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setActingOn(null);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          ← Retour au tableau de bord
        </Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>👑 Espace Fondateur</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Validation et suivi des entreprises de la plateforme
      </div>

      <PlatformReviewsSummary />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="btn"
            style={{
              background: filter === f.key ? "var(--blue)" : "var(--bg-card)",
              border: filter === f.key ? "none" : "1px solid var(--border-light)",
              padding: "7px 14px",
              fontSize: 12.5,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="error-text">{error}</div>}

      {companies === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}

      {companies?.length === 0 && !error && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Aucune entreprise dans cette catégorie.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {companies?.map((c) => (
          <div key={c.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {c.sector || "Secteur non précisé"} {c.city ? `· ${c.city}` : ""}
              </div>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 6,
                  background: c.status === "active" ? "var(--green-dim)" : c.status === "suspendue" ? "var(--red-dim)" : "var(--orange, #F59E0B)",
                  color: c.status === "active" ? "var(--green)" : c.status === "suspendue" ? "var(--red)" : "#0a0e17",
                }}
              >
                {STATUS_LABELS[c.status] ?? c.status}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {c.status !== "active" && (
                <button
                  className="btn"
                  disabled={actingOn === c.id}
                  onClick={() => changeStatus(c.id, "active")}
                  style={{ background: "var(--green)", padding: "7px 12px", fontSize: 12 }}
                >
                  Valider
                </button>
              )}
              {c.status === "active" && (
                <button
                  className="btn"
                  disabled={actingOn === c.id}
                  onClick={() => changeStatus(c.id, "suspendue")}
                  style={{ background: "var(--orange, #F59E0B)", color: "#0a0e17", padding: "7px 12px", fontSize: 12 }}
                >
                  Suspendre
                </button>
              )}
              {c.status === "suspendue" && (
                <button
                  className="btn"
                  disabled={actingOn === c.id}
                  onClick={() => changeStatus(c.id, "active")}
                  style={{ background: "var(--green)", padding: "7px 12px", fontSize: 12 }}
                >
                  Réactiver
                </button>
              )}
              {c.status !== "resiliee" && (
                <button
                  className="btn"
                  disabled={actingOn === c.id}
                  onClick={() => changeStatus(c.id, "resiliee")}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--red)", color: "var(--red)", padding: "7px 12px", fontSize: 12 }}
                >
                  Résilier
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function PlatformReviewsSummary() {
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string | null; reviewer_name: string }[] | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/reviews?platform=1", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setReviews(data.reviews ?? []))
      .catch(() => {});
  }, []);

  if (!reviews || reviews.length === 0) return null;

  const average = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Avis sur la plateforme</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 10 }}>
        Note moyenne : {average} ★ ({reviews.length} avis)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reviews.slice(0, 3).map((r) => (
          <div key={r.id} style={{ fontSize: 12.5 }}>
            <strong>{r.reviewer_name}</strong> — {"★".repeat(r.rating)} {r.comment}
          </div>
        ))}
      </div>
    </div>
  );
}
