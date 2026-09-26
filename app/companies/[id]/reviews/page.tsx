"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Review = {
  id: string; rating: number; comment: string | null; company_reply: string | null;
  created_at: string; reviewer_name: string;
};

export default function CompanyReviewsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/reviews?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setReviews(data.reviews ?? []);
  }, [companyId, router]);

  useEffect(() => { load().catch(() => setError("Impossible de charger les avis")); }, [load]);

  async function sendReply(reviewId: string) {
    const reply = replyDrafts[reviewId];
    if (!reply) return;
    setReplying(reviewId);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ reply }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible d'envoyer la réponse");
        return;
      }
      await load();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setReplying(null);
    }
  }

  const average = reviews && reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Avis clients</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 4 }}>
        {average ? `Note moyenne : ${average} ★ (${reviews?.length} avis)` : "Aucun avis pour le moment"}
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: 11.5, marginBottom: 24 }}>
        Les avis négatifs ne peuvent pas être supprimés — vous pouvez seulement y répondre.
      </div>

      {error && <div className="error-text">{error}</div>}
      {reviews === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {reviews?.map((r) => (
          <div key={r.id} className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>{r.reviewer_name}</span>
              <span style={{ color: "var(--orange)" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
            </div>
            {r.comment && <div style={{ fontSize: 13, marginBottom: 10 }}>{r.comment}</div>}
            {r.company_reply ? (
              <div style={{ background: "var(--bg-panel)", borderRadius: 8, padding: 10, fontSize: 12.5 }}>
                <strong>Votre réponse :</strong> {r.company_reply}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  placeholder="Répondre à cet avis..."
                  value={replyDrafts[r.id] ?? ""}
                  onChange={(e) => setReplyDrafts({ ...replyDrafts, [r.id]: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button className="btn" disabled={replying === r.id} onClick={() => sendReply(r.id)}>
                  {replying === r.id ? "..." : "Répondre"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
