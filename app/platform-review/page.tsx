"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PlatformReviewPage() {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetType: "plateforme", rating, comment: comment || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible d'envoyer votre avis");
        return;
      }
      setSent(true);
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="panel" style={{ width: 420 }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Noter ShopPro</div>
        {sent ? (
          <div style={{ color: "var(--green)", fontSize: 13 }}>Merci pour votre retour !</div>
        ) : (
          <>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 18 }}>
              Votre avis sur la plateforme elle-même
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, fontSize: 24, cursor: "pointer" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} onClick={() => setRating(n)} style={{ color: n <= rating ? "var(--orange)" : "var(--border-light)" }}>★</span>
              ))}
            </div>
            <div className="field">
              <textarea rows={4} placeholder="Votre commentaire (optionnel)" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn block" disabled={submitting} onClick={submit}>
              {submitting ? "Envoi..." : "Envoyer"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
