"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";

type Company = { id: string; name: string; sector: string | null; city: string | null };
type Application = { id: string; status: string; company_id: string; company_name: string };

const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

export default function ApplyDriverPage() {
  const router = useRouter();
  const [hasDriverProfile, setHasDriverProfile] = useState<boolean | null>(null);
  const [vehicleType, setVehicleType] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push("/login");
      return;
    }
    const [driverRes, companiesRes, appsRes] = await Promise.all([
      fetch("/api/drivers", { headers: { Authorization: `Bearer ${t}` } }),
      fetch("/api/shop/companies", { headers: { Authorization: `Bearer ${t}` } }),
      fetch("/api/driver-applications?mine=1", { headers: { Authorization: `Bearer ${t}` } }),
    ]);
    if (driverRes.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      return;
    }
    const driverData = await driverRes.json();
    const companiesData = await companiesRes.json();
    const appsData = await appsRes.json();
    setHasDriverProfile(Boolean(driverData.driver));
    setCompanies(companiesData.companies ?? []);
    setApplications(appsData.applications ?? []);
  }, [router]);

  useEffect(() => {
    load().catch(() => setError("Impossible de charger les données"));
  }, [load]);

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSubmitting(true);
    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ vehicleType, vehiclePlate: vehiclePlate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(extractErrorMessage(data.error));
        return;
      }
      await load();
    } catch {
      setProfileError("Impossible de contacter le serveur");
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function apply(companyId: string) {
    setApplyingTo(companyId);
    try {
      const res = await fetch("/api/driver-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(extractErrorMessage(data.error));
        return;
      }
      await load();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setApplyingTo(null);
    }
  }

  const appliedCompanyIds = new Set(applications.map((a) => a.company_id));

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Tableau de bord</Link>
        <Link href="/driver" style={{ color: "var(--blue)", fontSize: 13, fontWeight: 600 }}>Mes livraisons →</Link>
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Devenir livreur</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Créez votre profil puis postulez auprès des entreprises
      </div>

      {error && <div className="error-text">{error}</div>}

      {hasDriverProfile === false && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Votre profil livreur</div>
          <form onSubmit={createProfile}>
            <div className="field">
              <label>Type de véhicule</label>
              <input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Moto, voiture..." required />
            </div>
            <div className="field">
              <label>Plaque d&apos;immatriculation (optionnel)</label>
              <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />
            </div>
            {profileError && <div className="error-text">{profileError}</div>}
            <button className="btn block" disabled={profileSubmitting} type="submit">
              {profileSubmitting ? "Création..." : "Créer mon profil livreur"}
            </button>
          </form>
        </div>
      )}

      {hasDriverProfile && (
        <>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Entreprises</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {companies.length === 0 && (
              <div className="panel" style={{ color: "var(--text-secondary)" }}>Aucune entreprise disponible pour le moment.</div>
            )}
            {companies.map((c) => {
              const applied = appliedCompanyIds.has(c.id);
              const app = applications.find((a) => a.company_id === c.id);
              return (
                <div key={c.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {c.sector || "Secteur non précisé"} {c.city ? `· ${c.city}` : ""}
                    </div>
                  </div>
                  {applied ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      {STATUS_LABELS[app?.status ?? ""] ?? "Candidature envoyée"}
                    </span>
                  ) : (
                    <button className="btn" disabled={applyingTo === c.id} onClick={() => apply(c.id)}>
                      {applyingTo === c.id ? "..." : "Postuler"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
