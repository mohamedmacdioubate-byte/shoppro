"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Application = {
  id: string;
  status: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  rating: string;
};

export default function CompanyDriversPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/driver-applications?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      return;
    }
    const data = await res.json();
    setApplications(data.applications ?? []);
  }, [companyId, router]);

  useEffect(() => {
    load().catch(() => setError("Impossible de charger les candidatures"));
  }, [load]);

  async function decide(applicationId: string, status: "acceptee" | "refusee") {
    setActingOn(applicationId);
    try {
      const res = await fetch(`/api/driver-applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible de traiter la candidature");
        return;
      }
      await load();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setActingOn(null);
    }
  }

  const pending = applications?.filter((a) => a.status === "en_attente") ?? [];
  const decided = applications?.filter((a) => a.status !== "en_attente") ?? [];

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
        <Link href={`/companies/${companyId}/deliveries`} style={{ color: "var(--blue)", fontSize: 13, fontWeight: 600 }}>
          Voir les livraisons →
        </Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Livreurs</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Candidatures et livreurs actifs
      </div>

      {error && <div className="error-text">{error}</div>}

      <div style={{ fontWeight: 600, marginBottom: 12 }}>Candidatures en attente</div>
      {applications === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
      {pending.length === 0 && applications !== null && (
        <div className="panel" style={{ marginBottom: 24, color: "var(--text-secondary)" }}>Aucune candidature en attente.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {pending.map((a) => (
          <div key={a.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.driver_name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {a.driver_phone ?? "Téléphone non renseigné"} {a.vehicle_type ? `· ${a.vehicle_type}` : ""} {a.vehicle_plate ? `· ${a.vehicle_plate}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn"
                disabled={actingOn === a.id}
                onClick={() => decide(a.id, "acceptee")}
                style={{ background: "var(--green)", padding: "7px 12px", fontSize: 12 }}
              >
                Accepter
              </button>
              <button
                className="btn"
                disabled={actingOn === a.id}
                onClick={() => decide(a.id, "refusee")}
                style={{ background: "var(--bg-card)", border: "1px solid var(--red)", color: "var(--red)", padding: "7px 12px", fontSize: 12 }}
              >
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>

      {decided.length > 0 && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>Historique des candidatures</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decided.map((a) => (
              <div key={a.id} className="panel" style={{ display: "flex", justifyContent: "space-between", opacity: 0.7 }}>
                <span>{a.driver_name}</span>
                <span style={{ color: a.status === "acceptee" ? "var(--green)" : "var(--red)" }}>
                  {a.status === "acceptee" ? "Accepté" : "Refusé"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
