"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Message = { id: string; content: string; sender_id: string; sender_name: string; created_at: string };

export default function GroupChatPage() {
  const router = useRouter();
  const params = useParams<{ id: string; groupId: string }>();
  const companyId = params.id;
  const groupId = params.groupId;

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const token = () => localStorage.getItem("token");

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/groups/${groupId}/messages`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
    if (res.status === 403) { setError("Vous n'êtes pas membre de ce groupe"); return; }
    const data = await res.json();
    setMessages(data.messages ?? []);
  }, [groupId, router]);

  useEffect(() => {
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((d) => setCurrentUserId(d.user?.id ?? null)).catch(() => {});
    load().catch(() => setError("Impossible de charger les messages"));
    const interval = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Impossible d'envoyer le message");
        return;
      }
      setContent("");
      await load();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px", display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/companies/${companyId}/groups`} style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Groupes</Link>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="panel" style={{ flex: 1, overflowY: "auto", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages === null && !error && <div style={{ color: "var(--text-secondary)" }}>Chargement...</div>}
        {messages?.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              {!mine && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{m.sender_name}</div>}
              <div style={{ background: mine ? "var(--blue)" : "var(--bg-panel)", color: mine ? "#fff" : "var(--text-primary)", borderRadius: 10, padding: "8px 12px", fontSize: 13.5 }}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Votre message..."
          style={{ flex: 1 }}
        />
        <button className="btn" disabled={sending} onClick={send}>Envoyer</button>
      </div>
    </main>
  );
}
