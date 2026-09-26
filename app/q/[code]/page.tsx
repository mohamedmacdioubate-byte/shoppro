"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

const REDIRECTS: Record<string, (companyId: string) => string> = {
  page_publique: (id) => `/shop/${id}`,
  catalogue: (id) => `/shop/${id}`,
  promotion: (id) => `/shop/${id}`,
  fidelite: (id) => `/shop/${id}`,
  recrutement: () => `/drivers/apply`,
};

export default function QrRedirectPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push(`/login`);
      return;
    }
    fetch(`/api/q/${params.code}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Code invalide");
          return;
        }
        const buildPath = REDIRECTS[data.targetType] ?? ((id: string) => `/shop/${id}`);
        router.replace(buildPath(data.companyId));
      })
      .catch(() => setError("Impossible de contacter le serveur"));
  }, [params.code, router]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
      {error ?? "Redirection..."}
    </main>
  );
}
