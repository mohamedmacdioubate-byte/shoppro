"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Message = { id: string; content: string; sender_id: string; sender_name: string; created_at: string };
type Employee = { id: string; full_name: string; email: string };

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

  const [showInvite, setShowInvite] = useState(false);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  const loadMembers = useCallback(async () => {
    const t = token();
    const res = await fetch(`/api/groups/${groupId}/members`, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return;
    const data = await res.json();
    setMemberIds(new Set((data.members ?? []).map((m: { user_id: string }) => m.user_id)));
  }, [groupId]);

  const loadEmployees = useCallback(async () => {
    const t = token();
    const res = await fetch(`/api/employees?companyId=${companyId}`, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return;
    const data = await res.json();
    setEmployees((data.employees ?? []).map((e: any) => ({ user_id: e.user_id ?? e.id, full_name: e.full_name })));
  }, [companyId]);

  useEffect(() => {
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((d) => setCurrentUserId(d.user?.id ?? null)).catch(() => {});
    load().catch(() => setError("Impossible de charger les messages"));
    loadMembers().catch(() => {});
    const interval = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(interval);
  }, [load, loadMembers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function toggleInvite() {
    setShowInvite((v) => !v);
    if (!showInvite) await loadEmployees();
  }

  async function invite(userId: string) {
    setInviting(userId);
    setInviteError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setInviteError(data.error ?? "Impossible d'ajouter ce membre");
        return;
      }
      await loadMembers();
    } catch {
      setInviteError("Impossible de contacter le serveur");
    } finally {
      setInviting(null);
    }
  }

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
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href={`/companies/${companyId}/groups`} style={{ color: "var(--text-secondary)", fontSize: 13 }}>← Groupes</Link>
        <button
          className="btn"
          onClick={toggleInvite}
          style={{ color: "var(--text-primary)", background: "var(--bg-card)", border: "1px solid var(--border-light)", fontSize: 12, padding: "6px 12px" }}
        >
          {showInvite ? "Fermer" : "+ Inviter"}
        </button>
      </div>

      {showInvite && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>Ajouter un membre de l&apos;équipe</div>
          {inviteError && <div className="error-text">{inviteError}</div>}
          {employees.filter((e) => !memberIds.has(e.user_id)).length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Tout le monde est déjà dans ce groupe.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {employees.filter((e) => !memberIds.has(e.user_id)).map((e) => (
              <div key={e.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span>{e.full_name}</span>
                <button className="btn" disabled={inviting === e.user_id} onClick={() => invite(e.user_id)} style={{ padding: "5px 10px", fontSize: 11.5 }}>
                  {inviting === e.user_id ? "..." : "Ajouter"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
