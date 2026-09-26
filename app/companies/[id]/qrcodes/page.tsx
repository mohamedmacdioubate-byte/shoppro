"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type QrCode = { id: string; code: string; target_type: string; active: boolean; scan_count: number };

const TYPE_LABELS: Record<string, string> = {
  page_publique: "Page publique",
  catalogue: "Catalogue",
  promotion: "Promotion",
  recrutement: "Recrutement livreurs",
  fidelite: "Fidélité",
};

export default function QrCodesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [qrCodes, setQrCodes] = useState<QrCode[] | null>(null);
  const [targetType, setTargetType] = useState("catalogue");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [origin, setOrigin] = useState("");

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/qrcodes?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    const data = await res.json();
    setQrCodes(data.qrCodes ?? []);
  }, [companyId, router]);

  useEffect(() => {
    setOrigin(window.location.origin);
    load().catch(() => setError("Impossible de charger les QR codes"));
  }, [load]);

  async function create() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/qrcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ companyId, targetType }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible de créer le QR code");
        return;
      }
      await load();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${origin}/q/${code}`);
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>QR Codes</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Générez des codes pointant vers votre boutique
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Créer un QR code</div>
        <div className="field">
          <label>Destination</label>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button className="btn" disabled={submitting} onClick={create}>
          {submitting ? "Création..." : "Générer"}
        </button>
      </div>

      {qrCodes === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {qrCodes?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Aucun QR code pour le moment.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {qrCodes?.map((q) => (
          <div key={q.id} className="panel" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {origin && (
              // Génération de l'image via un service public — pratique pour
              // un premier lot, à remplacer par une génération locale si le
              // volume ou la confidentialité le justifie plus tard.
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`${origin}/q/${q.code}`)}`}
                alt="QR code"
                width={90}
                height={90}
                style={{ borderRadius: 8, background: "#fff" }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{TYPE_LABELS[q.target_type] ?? q.target_type}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{q.scan_count} scans</div>
            </div>
            <button className="btn" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-light)" }} onClick={() => copyLink(q.code)}>
              Copier le lien
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
